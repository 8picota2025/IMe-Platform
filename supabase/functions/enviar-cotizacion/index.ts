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

const DEFAULT_SITE_URL = 'https://i-me.com.co';
const ROLES = new Set(['owner', 'admin', 'ventas']);

interface Body {
  cotizacion_id?: string;
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
  const moneda = lineas[0]?.moneda || String(row.moneda ?? 'COP');
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
    id
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
