/**
 * Envía oferta formal de cotización al cliente con link Formalizar.
 * Auth: JWT admin (ventas+) o service_role.
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
import { enviarEmailPlantilla, escapeHtml, itemsToHtml } from '../_shared/email.ts';
import {
  datosBancariosTexto,
  getDatosBancariosTransferencia,
} from '../_shared/transferencia-bancaria.ts';
import {
  calcularTotalOfertado,
  expiryFromValidez,
  formalizarPath,
  generarTokenFormalizacion,
  hashTokenSha256,
  ofertaCompleta,
  parseLineasOferta,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';

type AdjuntoCotizacion = { path?: unknown; nombre?: unknown; size?: unknown };
const MAX_ADJUNTOS_BYTES = 25 * 1024 * 1024;

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function cargarAdjuntosCliente(
  supabase: ReturnType<typeof getServerSupabase>,
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
}

function normalizarMoneda(value: unknown): 'COP' | 'USD' {
  return String(value ?? 'COP')
    .trim()
    .toUpperCase() === 'USD'
    ? 'USD'
    : 'COP';
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

  // Si el CMS manda la oferta actual, persistirla antes de validar/enviar.
  if (
    body.productos !== undefined ||
    body.condiciones !== undefined ||
    body.moneda !== undefined ||
    body.mercado !== undefined
  ) {
    const monedaPayload = body.moneda !== undefined ? normalizarMoneda(body.moneda) : undefined;
    const lineasPayload = parseLineasOferta(body.productos).map(l =>
      monedaPayload ? { ...l, moneda: monedaPayload } : l
    );
    const condicionesPayload =
      body.condiciones !== undefined ? String(body.condiciones).trim() : undefined;
    const checkPayload =
      condicionesPayload !== undefined
        ? ofertaCompleta(lineasPayload, condicionesPayload)
        : lineasPayload.length > 0 || body.productos === undefined
          ? ({ ok: true } as const)
          : { ok: false, error: 'OFERTA_SIN_LINEAS' as const };
    if (!checkPayload.ok) {
      return errorResponse(
        { code: checkPayload.error, message: 'Completa precios y condiciones antes de enviar' },
        422,
        origin
      );
    }
    const patch: Record<string, unknown> = {
      leida: true,
    };
    if (body.productos !== undefined) {
      patch.productos = lineasPayload;
      patch.precio_total_ofertado = calcularTotalOfertado(lineasPayload);
    }
    if (condicionesPayload !== undefined) patch.condiciones = condicionesPayload;
    if (body.validez_hasta !== undefined) {
      patch.validez_hasta = body.validez_hasta ? String(body.validez_hasta).trim() || null : null;
    }
    if (monedaPayload) {
      patch.moneda = monedaPayload;
      patch.mercado =
        body.mercado === 'INTL' || body.mercado === 'CO'
          ? body.mercado
          : monedaPayload === 'USD'
            ? 'INTL'
            : 'CO';
    } else if (body.mercado === 'INTL' || body.mercado === 'CO') {
      patch.mercado = body.mercado;
    }
    const { error: saveError } = await supabase
      .from('solicitudes_cotizacion')
      .update(patch)
      .eq('id', id);
    if (saveError) return internalError(saveError.message, origin);
  }

  const { data, error } = await supabase
    .from('solicitudes_cotizacion')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);

  const row = data as CotizacionOfertaRow & {
    notas_internas?: string | null;
    validez_hasta?: string | null;
  };

  if (row.pedido_id || row.estado === 'convertida') {
    return errorResponse(
      { code: 'COTIZACION_YA_CONVERTIDA', message: 'La cotizacion ya fue convertida en pedido' },
      409,
      origin
    );
  }

  const lineas = parseLineasOferta(row.productos);
  const check = ofertaCompleta(lineas, row.condiciones);
  if (!check.ok) {
    return errorResponse(
      { code: check.error, message: 'Completa precios y condiciones antes de enviar' },
      422,
      origin
    );
  }

  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  if (!email.includes('@')) {
    return errorResponse(
      { code: 'SIN_EMAIL', message: 'Cotizacion sin email de cliente' },
      422,
      origin
    );
  }

  const token = generarTokenFormalizacion();
  const tokenHash = await hashTokenSha256(token);
  const expiraAt = expiryFromValidez(row.validez_hasta);
  const total = calcularTotalOfertado(lineas);
  const moneda = normalizarMoneda(row.moneda || lineas[0]?.moneda || 'COP');
  const locale = row.locale === 'en' ? 'en' : 'es';
  const siteUrl = (Deno.env.get('SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
  const formalizarUrl = `${siteUrl}${formalizarPath(locale, id, token)}`;

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const nota = `[${timestamp}] Oferta enviada al cliente (${email}).`;
  const notasPrevias = String(row.notas_internas ?? '').trim();
  const notas = notasPrevias ? `${notasPrevias}\n${nota}` : nota;

  const { error: updateError } = await supabase
    .from('solicitudes_cotizacion')
    .update({
      estado: 'enviada',
      oferta_enviada_at: new Date().toISOString(),
      formalizacion_token_hash: tokenHash,
      formalizacion_token_expira_at: expiraAt,
      precio_total_ofertado: total,
      leida: true,
      notas_internas: notas,
    })
    .eq('id', id);

  if (updateError) return internalError(updateError.message, origin);

  const plantilla =
    locale === 'en' ? 'cotizacion_oferta_cliente_en' : 'cotizacion_oferta_cliente_es';
  const validezLabel = row.validez_hasta
    ? escapeHtml(String(row.validez_hasta))
    : locale === 'en'
      ? 'See terms'
      : 'Ver condiciones';
  const adjuntos = await cargarAdjuntosCliente(supabase, (row as { adjuntos?: unknown }).adjuntos);
  if (!adjuntos.ok) {
    return errorResponse({ code: 'ADJUNTOS_INVALIDOS', message: adjuntos.error }, 422, origin);
  }

  const envio = await enviarEmailPlantilla(
    supabase,
    plantilla,
    [email],
    {
      cliente_nombre: escapeHtml(String(row.nombre ?? 'Cliente')),
      referencia: escapeHtml(id.slice(0, 8).toUpperCase()),
      total: escapeHtml(String(total)),
      moneda: escapeHtml(moneda),
      validez: validezLabel,
      items_html: itemsToHtml(lineas, locale),
      condiciones: escapeHtml(String(row.condiciones ?? '')),
      datos_bancarios: escapeHtml(datosBancariosTexto(getDatosBancariosTransferencia())),
      formalizar_url: escapeHtml(formalizarUrl),
    },
    id,
    adjuntos.archivos
  );

  if (!envio.ok) {
    return errorResponse(
      {
        code: 'EMAIL_FALLIDO',
        message: 'Oferta guardada pero el email no se pudo enviar',
        details: envio.detalle,
      },
      502,
      origin
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      cotizacion_id: id,
      estado: 'enviada',
      formalizar_url: formalizarUrl,
      total,
      moneda,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
