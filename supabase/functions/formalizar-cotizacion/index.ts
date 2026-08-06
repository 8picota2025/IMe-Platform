/**
 * Formalizar cotización por transferencia bancaria manual.
 * Actions:
 *  - preview (default): resumen + datos bancarios
 *  - registrar_transferencia: crea pedido pendiente_validacion + sube comprobante
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, notFound, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { enviarEmailPlantilla, escapeHtml, DESTINATARIOS_INTERNOS } from '../_shared/email.ts';
import {
  datosBancariosTexto,
  getDatosBancariosTransferencia,
} from '../_shared/transferencia-bancaria.ts';
import {
  calcularTotalOfertado,
  hashTokenSha256,
  ofertaCompleta,
  parseLineasOferta,
  splitNombreApellido,
  tokenExpirado,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';
import {
  buildDianInvoiceDraft,
  baseNetaDesdePrecioConIva,
  calculateFiscalSummary,
  normalizeClienteFiscalInput,
  validateClienteFiscal,
  type ClienteFiscalProfile,
} from '../../../src/lib/fiscal.ts';
import { pushClienteToTwenty } from '../_shared/twenty-commerce-sync.ts';

interface Body {
  action?: 'preview' | 'registrar_transferencia';
  cotizacion_id?: string;
  token?: string;
  referencia_transferencia?: string;
  comprobante_base64?: string;
  comprobante_nombre?: string;
  comprobante_mime?: string;
  consentimiento_datos?: boolean;
  /** Datos fiscales opcionales para factura electronica DIAN (solo CO/COP). */
  fiscal?: Partial<ClienteFiscalProfile> & {
    direccion_facturacion?: {
      direccion?: string;
      ciudad?: string;
      departamento?: string;
      codigo_postal?: string;
      pais?: string;
    };
  };
}

const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;
const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function obtenerIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

async function loadCotizacionValidada(
  supabase: ReturnType<typeof getServerSupabase>,
  id: string,
  token: string,
  origin: string | null
): Promise<{ ok: true; row: CotizacionOfertaRow } | { ok: false; response: Response }> {
  const { data, error } = await supabase
    .from('solicitudes_cotizacion')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, response: internalError(error.message, origin) };
  if (!data) return { ok: false, response: notFound(origin) };

  const row = data as CotizacionOfertaRow;
  if (row.pedido_id || row.estado === 'convertida') {
    return {
      ok: false,
      response: errorResponse(
        { code: 'COTIZACION_YA_CONVERTIDA', message: 'Esta cotizacion ya fue formalizada' },
        409,
        origin
      ),
    };
  }
  if (row.estado !== 'enviada' && row.estado !== 'respondida') {
    return {
      ok: false,
      response: errorResponse(
        {
          code: 'COTIZACION_NO_ENVIADA',
          message: 'La cotizacion no esta disponible para formalizar',
        },
        409,
        origin
      ),
    };
  }
  if (tokenExpirado(row.formalizacion_token_expira_at)) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'TOKEN_EXPIRADO', message: 'El enlace de formalizacion expiro' },
        410,
        origin
      ),
    };
  }
  if (!row.formalizacion_token_hash) {
    return {
      ok: false,
      response: errorResponse(
        {
          code: 'TOKEN_INVALIDO',
          message:
            'Token invalido. Usa el enlace del correo mas reciente (los envios anteriores quedan sin efecto).',
        },
        401,
        origin
      ),
    };
  }
  const hash = await hashTokenSha256(token);
  if (hash !== row.formalizacion_token_hash) {
    return {
      ok: false,
      response: errorResponse(
        {
          code: 'TOKEN_INVALIDO',
          message:
            'Token invalido. Usa el enlace del correo mas reciente (los envios anteriores quedan sin efecto).',
        },
        401,
        origin
      ),
    };
  }

  const lineas = parseLineasOferta(row.productos);
  const check = ofertaCompleta(lineas, row.condiciones);
  if (!check.ok) {
    return {
      ok: false,
      response: errorResponse({ code: check.error, message: 'Oferta incompleta' }, 422, origin),
    };
  }

  return { ok: true, row };
}

function decodeComprobante(
  base64: string,
  mime: string
): { ok: true; bytes: Uint8Array } | { ok: false; error: string } {
  const clean = base64.includes(',') ? base64.split(',').pop()! : base64;
  let binary: string;
  try {
    binary = atob(clean);
  } catch {
    return { ok: false, error: 'Comprobante base64 invalido' };
  }
  if (binary.length > MAX_COMPROBANTE_BYTES) {
    return { ok: false, error: 'Comprobante supera 5 MB' };
  }
  if (!MIME_OK.has(mime)) {
    return { ok: false, error: 'Formato no permitido (PDF/JPG/PNG/WEBP)' };
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { ok: true, bytes };
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = (body.cotizacion_id ?? '').trim();
  const token = (body.token ?? '').trim();
  const action = body.action === 'registrar_transferencia' ? 'registrar_transferencia' : 'preview';
  if (!id || !token) return badRequest('cotizacion_id y token requeridos', origin);

  const supabase = getServerSupabase();
  const ip = obtenerIp(req);
  const rateAction = action === 'registrar_transferencia' ? 'crear-pago' : 'formalizar-preview';
  const rateKey =
    action === 'registrar_transferencia'
      ? `formalizar:submit:ip:${ip}`
      : `formalizar:preview:ip:${ip}`;
  const limite = await checkRateLimit(supabase, rateKey, rateAction);
  if (limite.limited) {
    return errorResponse(
      {
        code: 'RATE_LIMITED',
        message:
          action === 'registrar_transferencia'
            ? 'Demasiados intentos de registro. Espera unos minutos e intenta de nuevo.'
            : 'Demasiadas consultas del enlace. Espera unos minutos e intenta de nuevo.',
      },
      429,
      origin
    );
  }

  const loaded = await loadCotizacionValidada(supabase, id, token, origin);
  if (!loaded.ok) return loaded.response;
  const row = loaded.row;
  const lineas = parseLineasOferta(row.productos);
  const total = Number(row.precio_total_ofertado) || calcularTotalOfertado(lineas);
  const moneda = lineas[0]?.moneda || String(row.moneda ?? 'COP');
  const bancarios = getDatosBancariosTransferencia();

  if (action === 'preview') {
    return new Response(
      JSON.stringify({
        ok: true,
        cotizacion: {
          id: row.id,
          nombre: row.nombre,
          empresa: row.empresa,
          email: row.email,
          telefono: (row as { telefono?: string }).telefono ?? null,
          condiciones: row.condiciones,
          validez_hasta: row.validez_hasta,
          estado: row.estado,
          locale: row.locale === 'en' ? 'en' : 'es',
          mercado: row.mercado === 'INTL' ? 'INTL' : 'CO',
          moneda,
          total,
          permite_factura_electronica: row.mercado !== 'INTL' && moneda.toUpperCase() === 'COP',
          lineas: lineas.map(l => ({
            slug: l.slug,
            nombre: l.nombre,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            subtotal: l.subtotal,
            moneda: l.moneda,
          })),
        },
        transferencia: {
          ...bancarios,
          texto: datosBancariosTexto(bancarios),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  }

  // ── registrar_transferencia ────────────────────────────────
  if (body.consentimiento_datos !== true) {
    return badRequest('consentimiento_datos requerido', origin);
  }
  const mime = (body.comprobante_mime ?? '').trim().toLowerCase();
  const nombreArchivo = (body.comprobante_nombre ?? 'comprobante.pdf').trim().slice(0, 120);
  const decoded = decodeComprobante(body.comprobante_base64 ?? '', mime);
  if (!decoded.ok) {
    return errorResponse({ code: 'COMPROBANTE_INVALIDO', message: decoded.error }, 422, origin);
  }

  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  const telefono = String((row as { telefono?: string }).telefono ?? '').trim() || '0000000000';
  if (!email.includes('@')) {
    return errorResponse(
      { code: 'SIN_EMAIL', message: 'Cotizacion sin email de cliente' },
      422,
      origin
    );
  }

  const { nombre, apellido } = splitNombreApellido(String(row.nombre ?? 'Cliente'));
  const mercado = row.mercado === 'INTL' ? 'INTL' : 'CO';

  // Factura electronica: precios ofertados se tratan como total final (IVA 0 en draft)
  // para no alterar el importe transferido. IVA debe ir reflejado en la oferta si aplica.
  const fiscalCliente = normalizeClienteFiscalInput(body.fiscal, {
    mercado,
    moneda,
    email,
    razonSocialFallback: row.empresa ?? `${nombre} ${apellido}`.trim(),
  });
  const fiscalErrors = validateClienteFiscal(fiscalCliente, { moneda, mercado });
  if (fiscalErrors.length > 0) {
    return errorResponse(
      {
        code: 'DATOS_FISCALES_INVALIDOS',
        message: 'Faltan datos fiscales para factura electronica',
        details: fiscalErrors,
      },
      422,
      origin
    );
  }

  const impuestosIncluidos =
    (row as { impuestos_incluidos?: unknown }).impuestos_incluidos === true;
  if (fiscalCliente.solicitar_factura_electronica && !impuestosIncluidos) {
    return errorResponse(
      {
        code: 'TRATAMIENTO_TRIBUTARIO_OFERTA_REQUERIDO',
        message:
          'La oferta no declara que sus precios incluyen impuestos. Solicita a I-ME una cotizacion revisada antes de emitir factura electronica.',
      },
      422,
      origin
    );
  }

  const productosFiscales = new Map<
    string,
    {
      tarifa_iva_pct: number | string | null;
      retencion_fuente_pct: number | string | null;
      retencion_iva_pct: number | string | null;
      retencion_ica_pct: number | string | null;
      dian_codigo: string | null;
      excluido_iva: boolean | null;
    }
  >();
  if (fiscalCliente.solicitar_factura_electronica) {
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select(
        'slug, tarifa_iva_pct, retencion_fuente_pct, retencion_iva_pct, retencion_ica_pct, dian_codigo, excluido_iva'
      )
      .in(
        'slug',
        lineas.map(linea => linea.slug)
      );
    if (productosError)
      return internalError(
        `error consultando impuestos de productos: ${productosError.message}`,
        origin
      );
    for (const producto of (productos ?? []) as Array<Record<string, unknown>>) {
      productosFiscales.set(
        String(producto.slug),
        producto as typeof productosFiscales extends Map<string, infer T> ? T : never
      );
    }
  }

  const pedidoId = crypto.randomUUID();
  let fiscalSummary;
  try {
    const lineasFiscales = lineas.map(l => {
      const producto = productosFiscales.get(l.slug);
      if (!fiscalCliente.solicitar_factura_electronica) {
        return {
          slug: l.slug,
          nombre: l.nombre,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          excluido_iva: true,
        };
      }
      if (!producto) throw new Error(`Producto sin configuracion fiscal: ${l.slug}`);
      const tarifaIva = producto.excluido_iva ? 0 : Number(producto.tarifa_iva_pct);
      if (!producto.excluido_iva && (!Number.isFinite(tarifaIva) || tarifaIva < 0)) {
        throw new Error(`Tarifa IVA invalida para producto: ${l.slug}`);
      }
      return {
        slug: l.slug,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio_unitario: baseNetaDesdePrecioConIva(l.precio_unitario, tarifaIva),
        tarifa_iva_pct: tarifaIva,
        retencion_fuente_pct:
          producto.retencion_fuente_pct === null ? null : Number(producto.retencion_fuente_pct),
        retencion_iva_pct:
          producto.retencion_iva_pct === null ? null : Number(producto.retencion_iva_pct),
        retencion_ica_pct:
          producto.retencion_ica_pct === null ? null : Number(producto.retencion_ica_pct),
        dian_codigo: producto.dian_codigo,
        excluido_iva: producto.excluido_iva === true,
      };
    });
    fiscalSummary = calculateFiscalSummary(lineasFiscales, fiscalCliente, {
      moneda,
      mercado,
      envio_total: 0,
      default_iva_pct: 0,
    });
  } catch (error) {
    return errorResponse(
      {
        code: 'CONFIGURACION_FISCAL_PRODUCTO_INVALIDA',
        message: error instanceof Error ? error.message : 'Configuracion fiscal invalida',
      },
      422,
      origin
    );
  }
  if (fiscalCliente.solicitar_factura_electronica && Math.abs(fiscalSummary.total - total) > 1) {
    return errorResponse(
      {
        code: 'TOTAL_FISCAL_NO_CUADRA',
        message:
          'El total fiscal no coincide con el total ofrecido. Solicita una cotizacion revisada.',
      },
      422,
      origin
    );
  }
  const dianDraft = buildDianInvoiceDraft({
    referencia: pedidoId,
    fiscal: fiscalSummary,
    clienteFiscal: fiscalCliente,
    moneda,
  });
  const ext =
    mime === 'application/pdf'
      ? 'pdf'
      : mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : 'jpg';
  const storagePath = `${pedidoId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('comprobantes-pago')
    .upload(storagePath, decoded.bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    return internalError(`error subiendo comprobante: ${uploadError.message}`, origin);
  }

  const slugs = lineas.map(l => l.slug);
  const { data: productos } = await supabase
    .from('productos')
    .select('id, slug, nombre_es, familia_id')
    .in('slug', slugs);
  const porSlug = new Map(
    ((productos ?? []) as Array<Record<string, unknown>>).map(p => [String(p.slug), p])
  );

  const itemsSnapshot = lineas.map(linea => {
    const producto = porSlug.get(linea.slug);
    return {
      producto_id: producto?.id ?? null,
      slug: linea.slug,
      familia_id: producto?.familia_id ?? null,
      nombre: linea.nombre || String(producto?.nombre_es ?? linea.slug),
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      moneda,
      precio_locked_cotizacion: true,
    };
  });

  const { data: clienteRow } = await supabase
    .from('clientes')
    .upsert(
      {
        email,
        nombre,
        apellido,
        telefono,
        institucion: row.empresa ?? null,
        tipo_cliente: row.empresa ? 'b2b' : 'b2c',
        consentimiento_datos: true,
        consentimiento_timestamp: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single();

  const clienteId = (clienteRow as { id?: string } | null)?.id ?? null;
  if (clienteId) {
    void pushClienteToTwenty(supabase, clienteId);
  }
  const refTransferencia = (body.referencia_transferencia ?? '').trim().slice(0, 120);

  // Insertar pedido primero: solicitudes_cotizacion.pedido_id tiene FK a pedidos(id).
  // Luego claim atomico de la cotizacion. Si el claim pierde la carrera, limpia el pedido.
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const notasPrevias = String((row as { notas_internas?: string }).notas_internas ?? '').trim();
  const nota = `[${timestamp}] Cliente cargo comprobante. Pedido ${pedidoId.slice(0, 8)} pendiente de validacion.`;

  const { error: insertError } = await supabase.from('pedidos').insert({
    id: pedidoId,
    cliente_id: clienteId,
    cliente: {
      nombre,
      apellido,
      email,
      telefono,
      institucion: row.empresa ?? null,
    },
    items: itemsSnapshot,
    subtotal: total,
    envio_total: 0,
    total,
    moneda,
    mercado,
    proveedor_pago: 'transferencia',
    estado: 'pendiente_validacion',
    referencia_pasarela: pedidoId,
    comprobante_pago_path: storagePath,
    comprobante_pago_nombre: nombreArchivo,
    comprobante_subido_at: new Date().toISOString(),
    facturacion_electronica_solicitada: fiscalCliente.solicitar_factura_electronica,
    facturacion_electronica_estado: fiscalCliente.solicitar_factura_electronica
      ? 'pendiente_pago'
      : 'no_solicitada',
    consentimiento_datos: true,
    consentimiento_timestamp: new Date().toISOString(),
    metadata: {
      solicitud_cotizacion_id: id,
      origen: 'cotizacion',
      locale: row.locale === 'en' ? 'en' : 'es',
      precios_locked: true,
      metodo_pago: 'transferencia',
      condiciones: row.condiciones,
      referencia_transferencia: refTransferencia || null,
      datos_bancarios: bancarios,
      fiscal: {
        solicitar_factura_electronica: fiscalCliente.solicitar_factura_electronica,
        tipo_documento: fiscalCliente.tipo_documento,
        numero_documento: fiscalCliente.numero_documento,
        tipo_persona: fiscalCliente.tipo_persona,
        razon_social: fiscalCliente.razon_social,
        responsable_iva: fiscalCliente.responsable_iva === true,
        agente_retencion: fiscalCliente.agente_retencion === true,
        agente_reteica: fiscalCliente.agente_reteica === true,
        email_facturacion: fiscalCliente.email_facturacion,
      },
      fiscal_resumen: fiscalSummary,
      dian_draft: dianDraft,
    },
  });

  if (insertError) {
    await supabase.storage.from('comprobantes-pago').remove([storagePath]);
    return internalError(`error creando pedido: ${insertError.message}`, origin);
  }

  const { data: claimed, error: claimError } = await supabase
    .from('solicitudes_cotizacion')
    .update({
      estado: 'convertida',
      pedido_id: pedidoId,
      precio_total_ofertado: total,
      leida: true,
      notas_internas: notasPrevias ? `${notasPrevias}\n${nota}` : nota,
    })
    .eq('id', id)
    .in('estado', ['enviada', 'respondida'])
    .is('pedido_id', null)
    .select('id')
    .maybeSingle();

  if (claimError || !claimed) {
    await supabase.from('pedidos').delete().eq('id', pedidoId);
    await supabase.storage.from('comprobantes-pago').remove([storagePath]);
    if (claimError) {
      return internalError(`error reservando cotizacion: ${claimError.message}`, origin);
    }
    return errorResponse(
      {
        code: 'COTIZACION_YA_CONVERTIDA',
        message: 'Esta cotizacion ya fue formalizada',
      },
      409,
      origin
    );
  }

  if (fiscalCliente.solicitar_factura_electronica) {
    await supabase.from('facturas_electronicas').upsert(
      {
        pedido_id: pedidoId,
        estado: 'pendiente_pago',
        proveedor: 'siigo',
        payload: dianDraft ?? {},
      },
      { onConflict: 'pedido_id' }
    );
  }

  const refCorta = pedidoId.slice(0, 8).toUpperCase();
  const emailInterno = await enviarEmailPlantilla(
    supabase,
    'transferencia_recibida_interna',
    DESTINATARIOS_INTERNOS,
    {
      referencia: escapeHtml(refCorta),
      cliente_nombre: escapeHtml(`${nombre} ${apellido}`.trim()),
      cliente_email: escapeHtml(email),
      total: escapeHtml(String(total)),
      moneda: escapeHtml(moneda),
    },
    pedidoId
  );
  const emailCliente = await enviarEmailPlantilla(
    supabase,
    'transferencia_recibida_cliente',
    [email],
    {
      referencia: escapeHtml(refCorta),
      cliente_nombre: escapeHtml(nombre),
      total: escapeHtml(String(total)),
      moneda: escapeHtml(moneda),
    },
    pedidoId
  );
  if (!emailInterno.ok) {
    console.error('formalizar: email interno fallido', emailInterno.detalle);
  }
  if (!emailCliente.ok) {
    console.error('formalizar: email cliente fallido', emailCliente.detalle);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      pedido_id: pedidoId,
      referencia: refCorta,
      estado: 'pendiente_validacion',
      total,
      moneda,
      email_cliente_enviado: emailCliente.ok,
      facturacion_solicitada: fiscalCliente.solicitar_factura_electronica,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
