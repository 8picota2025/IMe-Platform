/**
 * Envia al cliente el email de cambio de estado de su pedido.
 * Invocable desde el admin (JWT de usuario con perfil admin activo)
 * o server-to-server con la service_role key.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, unauthorized, notFound } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { enviarEmailPlantilla, escapeHtml, ESTADO_LABELS } from '../_shared/email.ts';

interface NotificarClienteBody {
  pedido_id?: string;
  a_estado?: string;
  tracking_number?: string;
  tracking_url?: string;
}

const ROLES_PERMITIDOS = new Set(['owner', 'admin', 'ventas', 'operaciones']);

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return unauthorized(origin);

  const supabase = getServerSupabase();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (token !== serviceKey) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);
    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('rol, activo')
      .eq('user_id', user.id)
      .maybeSingle();
    const p = profile as { rol?: string; activo?: boolean } | null;
    if (!p?.activo || !ROLES_PERMITIDOS.has(p.rol ?? '')) return unauthorized(origin);
  }

  const body = (await req.json().catch(() => ({}))) as NotificarClienteBody;
  const pedidoId = (body.pedido_id ?? '').trim();
  const aEstado = (body.a_estado ?? '').trim();
  if (!pedidoId || !aEstado) return badRequest('pedido_id y a_estado son obligatorios', origin);
  if (!ESTADO_LABELS[aEstado]) {
    return badRequest(
      `a_estado sin notificacion definida. Validos: ${Object.keys(ESTADO_LABELS).join(', ')}`,
      origin
    );
  }

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, cliente, referencia_pasarela')
    .eq('id', pedidoId)
    .maybeSingle();
  if (error || !data) return notFound(origin);

  const pedido = data as {
    id: string;
    cliente: { nombre?: string; apellido?: string; email?: string } | null;
    referencia_pasarela: string | null;
  };
  const emailCliente = pedido.cliente?.email ?? '';
  if (!emailCliente) {
    return new Response(JSON.stringify({ ok: false, error: 'Pedido sin email de cliente' }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const referencia = pedido.referencia_pasarela ?? pedido.id;
  const nombre =
    `${pedido.cliente?.nombre ?? ''} ${pedido.cliente?.apellido ?? ''}`.trim() || 'Cliente';
  let trackingHtml = '';
  if (body.tracking_number || body.tracking_url) {
    const num = escapeHtml(body.tracking_number ?? '');
    const url = body.tracking_url ? escapeHtml(body.tracking_url) : '';
    trackingHtml = url
      ? `<p>Guia de envio: <a href="${url}">${num || url}</a></p>`
      : `<p>Guia de envio: ${num}</p>`;
  }

  const resultado = await enviarEmailPlantilla(
    supabase,
    'pedido_estado_cliente',
    [emailCliente],
    {
      referencia: escapeHtml(referencia),
      cliente_nombre: escapeHtml(nombre),
      estado_label: ESTADO_LABELS[aEstado],
      tracking_html: trackingHtml,
    },
    referencia
  );

  return new Response(JSON.stringify({ ok: resultado.ok, detalle: resultado.detalle }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
});
