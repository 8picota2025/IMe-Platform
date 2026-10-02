/**
 * Envía oferta formal de cotización al cliente con PDF + link Formalizar.
 * Auth: JWT admin (ventas+) o service_role.
 * "Enviar como": con service_role se puede indicar `actor_email` / `actor_user_id` de un
 * usuario ventas/admin/owner activo; la cotización queda a su nombre (owner, asesor del
 * email/PDF y Reply-To). Con JWT de usuario el actor es siempre el propio usuario.
 * dry_run=true: valida todo, genera el PDF de vista previa y NO envía ni numera ni cambia estado.
 * canal=email  → estado=enviada SOLO si Resend acepta el correo.
 * canal=whatsapp → prepara PDF + enlace y abre wa.me (estado=enviada al devolver URL).
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import {
  badRequest,
  unauthorized,
  notFound,
  errorResponse,
  internalError,
} from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import {
  enviarEmailPlantilla,
  escapeHtml,
  itemsToHtml,
  previsualizarPlantilla,
} from '../_shared/email.ts';
import { perfilComercialActivo, perfilPorUsuario } from '../_shared/asesor.ts';
import { resolverAsesor } from '../../../src/lib/cotizacion-asesor.ts';
import { validarEnvioCotizacion } from '../../../src/lib/cotizacion-envio.ts';
import { normalizeE164 } from '../_shared/phone.ts';
import { renderQuotePdf } from '../_shared/render-quote-pdf.ts';
import {
  buildQuoteAnnexes,
  loadQuotePdfFonts,
  loadQuotePdfLogo,
  loadQuotePdfWhatsappIcon,
} from '../_shared/quote-pdf-assets.ts';
import {
  datosBancariosTexto,
  getDatosBancariosTransferencia,
  bancoLineasCotizacion,
} from '../_shared/transferencia-bancaria.ts';
import {
  canonizarLineasOferta,
  expiryFromValidez,
  formalizarPath,
  generarTokenFormalizacion,
  hashBytesSha256,
  hashTokenSha256,
  normalizarMonedaOferta,
  normalizarOferta,
  parseLineasOferta,
  tokenExpirado,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';

type AdjuntoCotizacion = { path?: unknown; nombre?: unknown; size?: unknown };
type ServerSupabase = ReturnType<typeof getServerSupabase>;
const MAX_ADJUNTOS_BYTES = 25 * 1024 * 1024;

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function cargarAdjuntosCliente(
  supabase: ServerSupabase,
  value: unknown
): Promise<
  | { ok: true; archivos: Array<{ filename: string; content: string }> }
  | { ok: false; error: string }
> {
  if (!Array.isArray(value)) return { ok: true, archivos: [] };
  const archivos: Array<{ filename: string; content: string }> = [];
  let total = 0;
  for (const raw of value) {
    const item = raw as AdjuntoCotizacion;
    const path = String(item?.path ?? '').trim();
    const filename = String(item?.nombre ?? '')
      .trim()
      .slice(0, 160);
    if (!path || !filename || path.includes('..')) continue;
    const { data, error } = await supabase.storage.from('cotizaciones-adjuntos').download(path);
    if (error || !data) return { ok: false, error: `No se pudo leer el adjunto ${filename}` };
    const bytes = new Uint8Array(await data.arrayBuffer());
    total += bytes.byteLength;
    if (total > MAX_ADJUNTOS_BYTES) {
      return { ok: false, error: 'Los adjuntos superan el límite de 25 MB' };
    }
    archivos.push({ filename, content: base64(bytes) });
  }
  return { ok: true, archivos };
}

async function releaseSendClaim(
  supabase: ServerSupabase,
  id: string,
  sendError: string
): Promise<void> {
  const { error } = await supabase
    .from('solicitudes_cotizacion')
    .update({
      send_claimed_at: null,
      send_error: sendError.slice(0, 500),
    })
    .eq('id', id);
  // Produccion puede tener la tabla antes de la migracion PDF. Conserva el
  // error en metadata para que la interfaz no presente un falso borrador sano.
  if (!error) return;
  const { data } = await supabase
    .from('solicitudes_cotizacion')
    .select('metadata')
    .eq('id', id)
    .maybeSingle();
  const previous =
    data?.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  await supabase
    .from('solicitudes_cotizacion')
    .update({
      metadata: {
        ...previous,
        quote_send_error: sendError.slice(0, 500),
        quote_send_failed_at: new Date().toISOString(),
      },
    })
    .eq('id', id);
}

const DEFAULT_SITE_URL = 'https://i-me.com.co';
const ROLES = new Set(['owner', 'admin', 'ventas']);

interface Body {
  cotizacion_id?: string;
  /** Opcional: persistir oferta del CMS justo antes de enviar (evita DOM vs DB). */
  productos?: unknown;
  condiciones?: string;
  validez_hasta?: string | null;
  moneda?: string;
  mercado?: string;
  /** Si true, invalida el enlace anterior y genera uno nuevo. Default: reutilizar si sigue vigente. */
  rotar_token?: boolean;
  /** Canal de entrega. Default email. */
  canal?: 'email' | 'whatsapp';
  /** Solo service_role: envía a nombre de este usuario comercial. */
  actor_user_id?: string;
  actor_email?: string;
  /** Valida y genera vista previa sin enviar. */
  dry_run?: boolean;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  const auth = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
  if (!auth.ok) return unauthorized(origin);

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = (body.cotizacion_id ?? '').trim();
  if (!id) return badRequest('cotizacion_id requerido', origin);
  const canal: 'email' | 'whatsapp' = body.canal === 'whatsapp' ? 'whatsapp' : 'email';
  const dryRun = body.dry_run === true;

  // Actor ("enviar como"): solo aceptado con service_role y para un usuario comercial activo.
  let actor: { userId: string | null; email: string | null; role: string | null } = {
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
  };
  const actorDelegado = Boolean(
    String(body.actor_user_id ?? '').trim() || String(body.actor_email ?? '').trim()
  );
  if (actorDelegado) {
    if (auth.role !== 'service_role') {
      return errorResponse(
        {
          code: 'ACTOR_NO_PERMITIDO',
          message: 'actor_email / actor_user_id solo se aceptan con service role.',
        },
        403,
        origin
      );
    }
    const perfilActor = await perfilComercialActivo(supabase, {
      userId: String(body.actor_user_id ?? '').trim() || null,
      email: String(body.actor_email ?? '').trim() || null,
    });
    if (!perfilActor) {
      return errorResponse(
        {
          code: 'ACTOR_INVALIDO',
          message: 'El actor debe ser un usuario activo con rol ventas, admin u owner.',
        },
        422,
        origin
      );
    }
    actor = { userId: perfilActor.user_id, email: perfilActor.email, role: perfilActor.rol };
  }

  const loadRow = async (): Promise<
    | { ok: true; row: CotizacionOfertaRow & { notas_internas?: string | null } }
    | { ok: false; res: Response }
  > => {
    const { data, error } = await supabase
      .from('solicitudes_cotizacion')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, res: internalError(error.message, origin) };
    if (!data) return { ok: false, res: notFound(origin) };
    return {
      ok: true,
      row: data as CotizacionOfertaRow & { notas_internas?: string | null },
    };
  };

  const loaded = await loadRow();
  if (!loaded.ok) return loaded.res;
  let row = loaded.row;

  // Vendedores solo pueden operar cotizaciones propias. service_role y
  // supervisores conservan bandeja compartida; filas web sin propietario
  // pueden ser reclamadas por el vendedor que las envía.
  if (
    actor.userId &&
    actor.role === 'ventas' &&
    row.created_by &&
    row.created_by !== actor.userId
  ) {
    return notFound(origin);
  }

  if (row.pedido_id || row.estado === 'convertida') {
    return errorResponse(
      { code: 'COTIZACION_YA_CONVERTIDA', message: 'La cotizacion ya fue convertida en pedido' },
      409,
      origin
    );
  }

  const wantsPersist =
    body.productos !== undefined ||
    body.condiciones !== undefined ||
    body.moneda !== undefined ||
    body.mercado !== undefined ||
    body.validez_hasta !== undefined;
  const inmutable = row.estado === 'enviada';

  if (wantsPersist && !inmutable && !dryRun) {
    const monedaPayload =
      body.moneda !== undefined ? normalizarMonedaOferta(body.moneda) : undefined;
    const lineasRaw = parseLineasOferta(
      body.productos !== undefined ? body.productos : row.productos
    ).map(l => (monedaPayload ? { ...l, moneda: monedaPayload } : l));
    const condicionesPayload =
      body.condiciones !== undefined
        ? String(body.condiciones).trim()
        : String(row.condiciones ?? '');
    const headerMoneda = monedaPayload ?? normalizarMonedaOferta(row.moneda);
    const checkPayload =
      body.condiciones !== undefined || String(row.condiciones ?? '').trim()
        ? normalizarOferta(lineasRaw, condicionesPayload, headerMoneda)
        : canonizarLineasOferta(lineasRaw, headerMoneda);
    if (!checkPayload.ok) {
      return errorResponse(
        { code: checkPayload.error, message: 'Completa precios y condiciones antes de enviar' },
        422,
        origin
      );
    }
    const patch: Record<string, unknown> = {
      leida: true,
      productos: checkPayload.lineas,
      precio_total_ofertado: checkPayload.total,
      moneda: checkPayload.moneda,
    };
    if (body.condiciones !== undefined) patch.condiciones = condicionesPayload;
    if (body.validez_hasta !== undefined) {
      patch.validez_hasta = body.validez_hasta ? String(body.validez_hasta).trim() || null : null;
    }
    patch.mercado =
      body.mercado === 'INTL' || body.mercado === 'CO'
        ? body.mercado
        : checkPayload.moneda === 'USD'
          ? 'INTL'
          : 'CO';
    if (actor.userId) patch.created_by = actor.userId;
    let { error: saveError } = await supabase
      .from('solicitudes_cotizacion')
      .update(patch)
      .eq('id', id);
    if (saveError && /created_by|Could not find|schema cache/i.test(saveError.message)) {
      delete patch.created_by;
      ({ error: saveError } = await supabase
        .from('solicitudes_cotizacion')
        .update(patch)
        .eq('id', id));
    }
    if (saveError) return internalError(saveError.message, origin);
    const reloaded = await loadRow();
    if (!reloaded.ok) return reloaded.res;
    row = reloaded.row;
  }

  const validado = validarEnvioCotizacion(row, { canal, exigirPreciosFirmes: dryRun });
  if (!validado.ok) {
    return errorResponse(
      { code: validado.code, message: validado.message },
      validado.status,
      origin
    );
  }
  const oferta = { lineas: validado.lineas, total: validado.total, moneda: validado.moneda };
  const email = validado.email;
  const telefonoCliente = String(row.telefono ?? '').trim();

  // Asesor que firma email/PDF: el actor; si no hay (service role sin actor), el
  // propietario de la cotización; nunca el email en crudo (fallback "Equipo Comercial I-ME").
  const perfilFirma = actor.userId
    ? await perfilPorUsuario(supabase, actor.userId)
    : row.created_by
      ? await perfilPorUsuario(supabase, row.created_by)
      : null;
  const asesor = resolverAsesor(perfilFirma ?? (actor.email ? { email: actor.email } : null), {
    replyToEntorno: Deno.env.get('COTIZACION_REPLY_TO'),
  });
  const siteUrl = (Deno.env.get('SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
  const nombreComercial = asesor.nombre;
  const correoComercial = asesor.correo;
  const telefonoComercial = asesor.telefono;

  const locale = row.locale === 'en' ? 'en' : 'es';
  const renderPdf = async (numeroPdf: string) => {
    const [annexes, logoBytes, whatsappIconBytes, fonts] = await Promise.all([
      buildQuoteAnnexes(supabase, oferta.lineas, siteUrl),
      loadQuotePdfLogo(siteUrl),
      loadQuotePdfWhatsappIcon(siteUrl),
      loadQuotePdfFonts(siteUrl),
    ]);
    const banco = getDatosBancariosTransferencia();
    return renderQuotePdf({
      numero: numeroPdf,
      clienteNombre: String(row.nombre ?? 'Cliente'),
      empresa: row.empresa,
      email: row.email,
      telefono: row.telefono,
      condiciones: String(row.condiciones ?? ''),
      validezHasta: row.validez_hasta ? String(row.validez_hasta) : null,
      moneda: oferta.moneda,
      total: oferta.total,
      lineas: oferta.lineas,
      locale,
      nombreComercial,
      correoComercial,
      telefonoComercial,
      annexes,
      logoBytes,
      whatsappIconBytes,
      fontRegularBytes: fonts.regular,
      fontBoldBytes: fonts.bold,
      bancoLineas: bancoLineasCotizacion(banco),
    });
  };

  if (dryRun) {
    const metaPrev =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const numeroPrev =
      String(row.numero ?? '').trim() ||
      String(metaPrev.numero_presupuesto ?? '').trim() ||
      'BORRADOR';
    let asunto: string | null = null;
    let plantillaDry: string | null = null;
    if (canal === 'email') {
      plantillaDry = locale === 'en' ? 'cotizacion_oferta_cliente_en' : 'presupuesto';
      const varsAsunto = {
        cliente_nombre: String(row.nombre ?? 'Cliente'),
        referencia: numeroPrev,
        nombre_comercial: nombreComercial,
        total: String(oferta.total),
        moneda: oferta.moneda,
      };
      let prev = await previsualizarPlantilla(supabase, plantillaDry, varsAsunto);
      if (!prev.ok && locale !== 'en' && prev.desconocida) {
        plantillaDry = 'cotizacion_oferta_cliente_es';
        prev = await previsualizarPlantilla(supabase, plantillaDry, varsAsunto);
      }
      if (!prev.ok) {
        return errorResponse(
          {
            code: prev.inactiva ? 'TEMPLATE_INACTIVE' : 'PLANTILLA_NO_DISPONIBLE',
            message: prev.inactiva
              ? 'La plantilla presupuesto esta desactivada. Activala y reintenta.'
              : 'La plantilla de email de cotizacion no esta disponible.',
            details: prev.detalle,
          },
          422,
          origin
        );
      }
      asunto = prev.asunto ?? null;
    }
    let pdfPreviewUrl: string | null = null;
    let pdfPreviewError: string | null = null;
    try {
      const bytes = await renderPdf(numeroPrev);
      const previewPath = `${id}/preview.pdf`;
      const { error: upErr } = await supabase.storage
        .from('cotizaciones-pdf')
        .upload(previewPath, bytes, { contentType: 'application/pdf', upsert: true });
      if (upErr) {
        pdfPreviewError = upErr.message.slice(0, 300);
      } else {
        const { data: signed, error: signErr } = await supabase.storage
          .from('cotizaciones-pdf')
          .createSignedUrl(previewPath, 3600);
        if (signErr || !signed?.signedUrl) pdfPreviewError = signErr?.message ?? 'sin url firmada';
        else pdfPreviewUrl = signed.signedUrl;
      }
    } catch (err) {
      pdfPreviewError = err instanceof Error ? err.message.slice(0, 300) : 'PDF_RENDER_FAILED';
    }
    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: true,
        cotizacion_id: id,
        canal,
        estado: row.estado ?? null,
        numero: row.numero ?? null,
        destinatario: canal === 'email' ? email : telefonoCliente,
        asunto,
        plantilla: plantillaDry,
        total: oferta.total,
        moneda: oferta.moneda,
        validez_hasta: row.validez_hasta ?? null,
        lineas: oferta.lineas.map(l => ({
          nombre: l.nombre,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          subtotal: l.subtotal,
        })),
        asesor: { nombre: nombreComercial, email: correoComercial, telefono: telefonoComercial },
        reply_to: asesor.replyTo,
        pdf_preview_url: pdfPreviewUrl,
        pdf_preview_error: pdfPreviewError,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  }

  // Numeración: RPC si existe; si no (sandbox sin migración PDF), metadata/fallback.
  let numero = String(row.numero ?? '').trim();
  const { data: numeroRaw, error: numeroError } = await supabase.rpc('ensure_cotizacion_numero', {
    p_id: id,
  });
  if (!numeroError && numeroRaw) {
    numero = String(numeroRaw).trim();
  } else if (!numero) {
    const metaNum =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? String((row.metadata as Record<string, unknown>).numero_presupuesto ?? '').trim()
        : '';
    numero =
      metaNum ||
      `IME-Q-${new Date().getFullYear()}-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }
  if (!numero) return internalError('No se pudo asignar numero de presupuesto', origin);

  // Claim atómico si existe; si no, continuar (sandbox).
  const { data: claimedRows, error: claimError } = await supabase.rpc('claim_cotizacion_send', {
    p_id: id,
  });
  const claimed = !claimError ? (Array.isArray(claimedRows) ? claimedRows[0] : claimedRows) : null;
  if (!claimError && !claimed) {
    return errorResponse(
      { code: 'SEND_IN_FLIGHT', message: 'Hay un envio en curso. Espera 2 minutos y reintenta.' },
      409,
      origin
    );
  }
  const claimActive = Boolean(!claimError && claimed);
  const pdfRevision = claimActive
    ? Number((claimed as CotizacionOfertaRow).pdf_revision ?? 1) || 1
    : (Number((row as { pdf_revision?: number }).pdf_revision ?? 0) || 0) + 1;
  const releaseClaim = async (sendError: string) => {
    // Persistir también cuando la RPC de claim aún no existe en una
    // instancia parcialmente migrada. La función hace fallback a metadata.
    await releaseSendClaim(supabase, id, sendError);
  };
  const expiraAt = expiryFromValidez(row.validez_hasta);
  const forceRotate = body.rotar_token === true;
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  const existingUrl = String(meta.formalizacion_url ?? '').trim();
  const canReuse =
    !forceRotate &&
    Boolean(row.formalizacion_token_hash) &&
    Boolean(existingUrl) &&
    existingUrl.includes(`id=${id}`) &&
    !tokenExpirado(row.formalizacion_token_expira_at);

  let formalizarUrl: string;
  let tokenHash: string | null = row.formalizacion_token_hash ?? null;
  let tokenRotated = false;

  if (canReuse) {
    formalizarUrl = existingUrl;
  } else {
    const token = generarTokenFormalizacion();
    tokenHash = await hashTokenSha256(token);
    formalizarUrl = `${siteUrl}${formalizarPath(locale, id, token)}`;
    tokenRotated = true;
  }

  meta.formalizacion_url = formalizarUrl;
  meta.numero_presupuesto = numero;

  const quienEnvia = asesor.deperfil ? asesor.correo : actor.email || actor.role || 'admin';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const destinoNota = canal === 'whatsapp' ? telefonoCliente || 'WhatsApp' : email;
  const nota = tokenRotated
    ? `[${timestamp}] Presupuesto ${numero} enviado por ${canal} a ${destinoNota} por ${quienEnvia}. Nuevo enlace de formalizacion.`
    : `[${timestamp}] Presupuesto ${numero} reenviado por ${canal} a ${destinoNota} por ${quienEnvia}. Mismo enlace vigente.`;
  const notasPrevias = String(row.notas_internas ?? '').trim();
  const notas = notasPrevias ? `${notasPrevias}\n${nota}` : nota;

  const preMail: Record<string, unknown> = {
    numero,
    formalizacion_token_expira_at: expiraAt,
    metadata: meta,
    precio_total_ofertado: oferta.total,
    moneda: oferta.moneda,
    leida: true,
  };
  if (!inmutable) {
    preMail.productos = oferta.lineas;
  }
  if (tokenRotated && tokenHash) {
    preMail.formalizacion_token_hash = tokenHash;
  }
  // Owner: quien envía (o el actor delegado) queda como propietario de la cotización.
  if (actor.userId && (actorDelegado || !row.created_by)) preMail.created_by = actor.userId;
  // created_by / numero solo si el schema los tiene
  let { error: preError } = await supabase
    .from('solicitudes_cotizacion')
    .update(preMail)
    .eq('id', id);
  if (preError && /created_by|numero|Could not find/i.test(preError.message)) {
    const soft = { ...preMail };
    delete soft.created_by;
    delete soft.numero;
    ({ error: preError } = await supabase.from('solicitudes_cotizacion').update(soft).eq('id', id));
  }
  if (preError) {
    await releaseClaim(preError.message);
    return internalError(preError.message, origin);
  }

  // Plantilla canónica: presupuesto (ES). EN mantiene oferta_en.
  const validezLabel = row.validez_hasta
    ? escapeHtml(String(row.validez_hasta))
    : locale === 'en'
      ? 'See terms'
      : 'Ver condiciones';
  const adjuntos = await cargarAdjuntosCliente(supabase, (row as { adjuntos?: unknown }).adjuntos);
  if (!adjuntos.ok) {
    await releaseClaim(adjuntos.error);
    return errorResponse({ code: 'ADJUNTOS_INVALIDOS', message: adjuntos.error }, 422, origin);
  }

  let pdfBytes: Awaited<ReturnType<typeof renderPdf>>;
  try {
    pdfBytes = await renderPdf(numero);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : 'PDF_RENDER_FAILED';
    await releaseClaim(detalle);
    return errorResponse(
      {
        code: 'PDF_RENDER_FAILED',
        message: 'No se pudo generar el PDF del presupuesto',
        details: detalle,
      },
      500,
      origin
    );
  }

  const pdfPath = `${id}/${pdfRevision}.pdf`;
  const previousPdfPath = typeof meta.pdf_storage_path === 'string' ? meta.pdf_storage_path : null;
  let storedPdfPath: string | null = previousPdfPath;
  const { error: uploadError } = await supabase.storage
    .from('cotizaciones-pdf')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (!uploadError) {
    storedPdfPath = pdfPath;
    delete meta.pdf_storage_error;
  } else {
    // No borrar referencia de una revisión anterior si el bucket falla en un
    // reintento; el endpoint puede seguir descargando ese PDF.
    meta.pdf_storage_error = uploadError.message.slice(0, 500);
  }
  // Si el bucket no existe aún, igual enviamos el PDF adjunto por email.

  const pdfSha = await hashBytesSha256(pdfBytes);
  // Persistir referencia del artefacto antes de llamar al proveedor de email.
  // Si Resend falla, el comercial aún puede abrir/descargar el PDF y reintentar.
  meta.pdf_storage_path = storedPdfPath;
  meta.pdf_sha256 = pdfSha;
  meta.pdf_revision = pdfRevision;
  let { error: artifactError } = await supabase
    .from('solicitudes_cotizacion')
    .update({
      numero,
      metadata: meta,
      ...(storedPdfPath
        ? {
            pdf_storage_path: storedPdfPath,
            pdf_sha256: pdfSha,
            pdf_revision: pdfRevision,
          }
        : {}),
    })
    .eq('id', id);
  if (artifactError) {
    // Legacy schema: metadata is always available, while PDF columns may not.
    ({ error: artifactError } = await supabase
      .from('solicitudes_cotizacion')
      .update({ metadata: meta })
      .eq('id', id));
  }
  if (artifactError) {
    await releaseClaim(artifactError.message);
    return internalError(artifactError.message, origin);
  }
  const pdfAdjunto = {
    filename: `${numero}.pdf`,
    content: base64(pdfBytes),
  };

  let whatsappUrl: string | null = null;
  let plantilla: string | null = null;
  let messageId: string | null = null;

  if (canal === 'whatsapp') {
    const phone = normalizeE164(telefonoCliente, '57');
    if (!phone.ok || !phone.e164) {
      await releaseClaim('SIN_TELEFONO');
      return errorResponse(
        { code: 'SIN_TELEFONO', message: 'Telefono invalido para WhatsApp.' },
        422,
        origin
      );
    }
    const totalTxt = `${oferta.total} ${oferta.moneda}`;
    const mensaje =
      locale === 'en'
        ? `Hello ${String(row.nombre ?? '').trim() || 'there'}, here is I-ME quote ${numero} for ${totalTxt}. Review and formalize: ${formalizarUrl}`
        : `Hola ${String(row.nombre ?? '').trim() || 'cliente'}, te compartimos el presupuesto ${numero} de I-ME por ${totalTxt}. Revisa y formaliza aquí: ${formalizarUrl}`;
    const digits = phone.e164.replace(/^\+/, '');
    whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
    meta.quote_send_channel = 'whatsapp';
    meta.whatsapp_url = whatsappUrl;
  } else {
    plantilla = locale === 'en' ? 'cotizacion_oferta_cliente_en' : 'presupuesto';
    const emailVars = {
      cliente_nombre: escapeHtml(String(row.nombre ?? 'Cliente')),
      cliente_empresa: escapeHtml(String(row.empresa ?? '—')),
      cliente_email: escapeHtml(String(row.email ?? '')),
      cliente_telefono: escapeHtml(String(row.telefono ?? '—')),
      nombre_comercial: escapeHtml(nombreComercial),
      correo_comercial: escapeHtml(correoComercial),
      telefono_comercial: escapeHtml(telefonoComercial || '—'),
      referencia: escapeHtml(numero),
      total: escapeHtml(String(oferta.total)),
      moneda: escapeHtml(oferta.moneda),
      validez: validezLabel,
      items_html: itemsToHtml(oferta.lineas, locale),
      condiciones: escapeHtml(String(row.condiciones ?? '')),
      datos_bancarios: escapeHtml(datosBancariosTexto(getDatosBancariosTransferencia())),
      formalizar_url: formalizarUrl,
      formalizar_url_href: escapeHtml(formalizarUrl),
    };

    let envio = await enviarEmailPlantilla(
      supabase,
      plantilla,
      [email],
      emailVars,
      numero,
      [pdfAdjunto, ...adjuntos.archivos],
      {
        failOnInactive: true,
        idempotencyKey: `quote-send:${id}:${pdfRevision}`,
        replyTo: asesor.replyTo,
      }
    );
    if (
      !envio.ok &&
      locale !== 'en' &&
      String(envio.detalle ?? '').includes('plantilla desconocida')
    ) {
      envio = await enviarEmailPlantilla(
        supabase,
        'cotizacion_oferta_cliente_es',
        [email],
        emailVars,
        numero,
        [pdfAdjunto, ...adjuntos.archivos],
        {
          failOnInactive: true,
          idempotencyKey: `quote-send:${id}:${pdfRevision}:es`,
          replyTo: asesor.replyTo,
        }
      );
    }

    if (!envio.ok) {
      await releaseClaim(envio.detalle ?? 'EMAIL_FALLIDO');
      const inactive = String(envio.detalle ?? '').includes('TEMPLATE_INACTIVE');
      return errorResponse(
        {
          code: inactive ? 'TEMPLATE_INACTIVE' : 'EMAIL_FALLIDO',
          message: inactive
            ? 'La plantilla presupuesto esta desactivada. Activala y reintenta.'
            : 'Email no salio. Cotizacion no marcada enviada.',
          details: envio.detalle,
        },
        inactive ? 422 : 502,
        origin
      );
    }
    meta.quote_send_channel = 'email';
    messageId = envio.messageId ?? null;
    meta.quote_send_message_id = messageId;
    meta.quote_send_reply_to = asesor.replyTo;
    meta.quote_send_asesor = asesor.correo;
  }

  const postUpdate: Record<string, unknown> = {
    estado: 'enviada',
    oferta_enviada_at: new Date().toISOString(),
    notas_internas: notas,
    leida: true,
    metadata: meta,
  };
  if (storedPdfPath) {
    postUpdate.pdf_storage_path = storedPdfPath;
    postUpdate.pdf_sha256 = pdfSha;
    postUpdate.pdf_revision = pdfRevision;
  }
  postUpdate.send_error = null;
  postUpdate.send_claimed_at = null;

  let { error: updateError } = await supabase
    .from('solicitudes_cotizacion')
    .update(postUpdate)
    .eq('id', id);
  if (updateError && /column|schema cache|Could not find/i.test(updateError.message)) {
    const softPost: Record<string, unknown> = {
      estado: 'enviada',
      oferta_enviada_at: new Date().toISOString(),
      notas_internas: notas,
      leida: true,
      metadata: meta,
    };
    ({ error: updateError } = await supabase
      .from('solicitudes_cotizacion')
      .update(softPost)
      .eq('id', id));
  }

  if (updateError) return internalError(updateError.message, origin);

  // CRM: solo tras validación admin (action validar-crm). Envío deja pending.
  await supabase
    .from('solicitudes_cotizacion')
    .update({
      crm_sync_status: 'pending',
      crm_sync_error: null,
    })
    .eq('id', id);

  return new Response(
    JSON.stringify({
      ok: true,
      canal,
      cotizacion_id: id,
      numero,
      estado: 'enviada',
      formalizar_url: formalizarUrl,
      whatsapp_url: whatsappUrl,
      token_rotado: tokenRotated,
      total: oferta.total,
      moneda: oferta.moneda,
      pdf_revision: pdfRevision,
      pdf_storage_path: storedPdfPath,
      plantilla,
      message_id: messageId,
      asesor: { nombre: nombreComercial, email: correoComercial, telefono: telefonoComercial },
      reply_to: canal === 'email' ? asesor.replyTo : null,
      crm_sync_status: 'pending',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
