/**
 * Rechaza comprobante de transferencia de un pedido:
 * - marca pedido como rechazado
 * - reabre la cotizacion asociada (nuevo token Formalizar)
 * - envia email al cliente invitandolo a reintentar la validacion
 *
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
import { enviarEmailPlantilla, escapeHtml } from '../_shared/email.ts';
import {
  expiryFromValidez,
  formalizarPath,
  generarTokenFormalizacion,
  hashTokenSha256,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';

const DEFAULT_SITE_URL = 'https://i-me.com.co';
const ROLES = new Set(['owner', 'admin', 'ventas', 'operaciones']);

interface Body {
  pedido_id?: string;
  motivo?: string;
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
  const pedidoId = (body.pedido_id ?? '').trim();
  const motivo = (body.motivo ?? '').trim().slice(0, 500);
  if (!pedidoId) return badRequest('pedido_id requerido', origin);

  const { data: pedidoData, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, estado, total, moneda, cliente, metadata, referencia_pasarela, proveedor_pago')
    .eq('id', pedidoId)
    .maybeSingle();
  if (pedidoError) return internalError(pedidoError.message, origin);
  if (!pedidoData) return notFound(origin);

  const pedido = pedidoData as {
    id: string;
    estado: string;
    total: number | string | null;
    moneda: string | null;
    cliente: { nombre?: string; apellido?: string; email?: string } | null;
    metadata: Record<string, unknown> | null;
    referencia_pasarela: string | null;
    proveedor_pago: string | null;
  };

  if (pedido.estado !== 'pendiente_validacion') {
    return errorResponse(
      {
        code: 'ESTADO_INVALIDO',
        message: `Solo se puede rechazar comprobantes en pendiente_validacion (actual: ${pedido.estado})`,
      },
      409,
      origin
    );
  }

  const meta = pedido.metadata ?? {};
  let cotizacionId = String(meta.solicitud_cotizacion_id ?? '').trim();
  if (!cotizacionId) {
    const { data: cotByPedido } = await supabase
      .from('solicitudes_cotizacion')
      .select('id')
      .eq('pedido_id', pedidoId)
      .maybeSingle();
    cotizacionId = String((cotByPedido as { id?: string } | null)?.id ?? '').trim();
  }

  const { data: updatedPedido, error: updatePedidoError } = await supabase
    .from('pedidos')
    .update({
      estado: 'rechazado',
      leida: true,
      metadata: {
        ...meta,
        comprobante_rechazado_at: new Date().toISOString(),
        comprobante_rechazado_por: auth.userId,
        comprobante_rechazo_motivo: motivo || null,
      },
    })
    .eq('id', pedidoId)
    .eq('estado', 'pendiente_validacion')
    .select('id')
    .maybeSingle();
  if (updatePedidoError) return internalError(updatePedidoError.message, origin);
  if (!updatedPedido) {
    return errorResponse(
      {
        code: 'RACE_CONDITION',
        message: 'El pedido ya cambio de estado (posible validacion concurrente)',
      },
      409,
      origin
    );
  }

  let formalizarUrl = '';
  let cotizacionRef = pedido.referencia_pasarela ?? pedidoId.slice(0, 8).toUpperCase();
  let total = String(pedido.total ?? '');
  let moneda = String(pedido.moneda ?? 'COP');
  let locale: 'es' | 'en' = 'es';
  let clienteNombre =
    `${pedido.cliente?.nombre ?? ''} ${pedido.cliente?.apellido ?? ''}`.trim() || 'Cliente';
  let emailCliente = String(pedido.cliente?.email ?? '')
    .trim()
    .toLowerCase();

  if (cotizacionId) {
    const { data: cotData, error: cotError } = await supabase
      .from('solicitudes_cotizacion')
      .select('*')
      .eq('id', cotizacionId)
      .maybeSingle();
    if (cotError) return internalError(cotError.message, origin);

    if (cotData) {
      const row = cotData as CotizacionOfertaRow & {
        notas_internas?: string | null;
        validez_hasta?: string | null;
      };
      locale = row.locale === 'en' ? 'en' : 'es';
      emailCliente =
        String(row.email ?? '')
          .trim()
          .toLowerCase() || emailCliente;
      clienteNombre = String(row.nombre ?? '').trim() || clienteNombre;
      total = String(row.precio_total_ofertado ?? pedido.total ?? total);
      moneda = String(row.moneda ?? pedido.moneda ?? moneda);
      cotizacionRef = cotizacionId.slice(0, 8).toUpperCase();

      const token = generarTokenFormalizacion();
      const tokenHash = await hashTokenSha256(token);
      const expiraAt = expiryFromValidez(row.validez_hasta);
      const siteUrl = (Deno.env.get('SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
      formalizarUrl = `${siteUrl}${formalizarPath(locale, cotizacionId, token)}`;

      const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const nota = `[${timestamp}] Comprobante rechazado (pedido ${pedidoId.slice(0, 8)}). Cotizacion reabierta para reintento.${motivo ? ` Motivo: ${motivo}` : ''}`;
      const notasPrevias = String(row.notas_internas ?? '').trim();
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? { ...(row.metadata as Record<string, unknown>) }
          : {};
      meta.formalizacion_url = formalizarUrl;

      const { error: reopenError } = await supabase
        .from('solicitudes_cotizacion')
        .update({
          estado: 'enviada',
          pedido_id: null,
          formalizacion_token_hash: tokenHash,
          formalizacion_token_expira_at: expiraAt,
          metadata: meta,
          leida: true,
          notas_internas: notasPrevias ? `${notasPrevias}\n${nota}` : nota,
        })
        .eq('id', cotizacionId);
      if (reopenError) return internalError(reopenError.message, origin);
    }
  }

  if (!emailCliente.includes('@')) {
    return errorResponse(
      {
        code: 'SIN_EMAIL',
        message: 'Pedido rechazado pero no hay email de cliente para notificar',
      },
      422,
      origin
    );
  }

  if (!formalizarUrl) {
    const siteUrl = (Deno.env.get('SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
    formalizarUrl = `${siteUrl}/es/contacto/`;
  }

  const plantilla =
    locale === 'en'
      ? 'transferencia_comprobante_rechazado_en'
      : 'transferencia_comprobante_rechazado_es';

  const envio = await enviarEmailPlantilla(
    supabase,
    plantilla,
    [emailCliente],
    {
      cliente_nombre: escapeHtml(clienteNombre),
      referencia: escapeHtml(cotizacionRef),
      total: escapeHtml(total),
      moneda: escapeHtml(moneda),
      formalizar_url: formalizarUrl,
      formalizar_url_href: escapeHtml(formalizarUrl),
      motivo: escapeHtml(
        motivo || (locale === 'en' ? 'Receipt not valid' : 'Comprobante no valido')
      ),
    },
    pedidoId
  );

  // Pedido ya rechazado y cotizacion reabierta: no devolver 502 si solo falla el email.
  return new Response(
    JSON.stringify({
      ok: true,
      pedido_id: pedidoId,
      estado: 'rechazado',
      cotizacion_id: cotizacionId || null,
      formalizar_url: formalizarUrl,
      email_enviado: envio.ok,
      email_error: envio.ok ? null : (envio.detalle ?? 'EMAIL_FALLIDO'),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
