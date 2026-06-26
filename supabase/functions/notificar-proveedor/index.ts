/**
 * Edge Function: notificar-proveedor
 *
 * Núcleo del modelo dropshipping. Crea/actualiza registros en `fulfillments`
 * y notifica al proveedor según su canal (email, whatsapp, webhook, api, manual).
 * Nunca expone precio_costo ni precios de venta al proveedor.
 *
 * Dos formas de invocación:
 * - { pedido_id, producto_ids } — llamada automática desde webhook-bold/webhook-stripe
 *   tras marcar un pedido como pagado. Agrupa producto_ids por proveedor (vía
 *   get_proveedor_para_producto) y crea un fulfillment por (pedido_id, proveedor_id).
 *   Idempotente: si ya existe un fulfillment no-error para ese par, no duplica.
 * - { fulfillment_id } — "Reenviar notificación al proveedor" desde el admin.
 *
 * Variables opcionales:
 * - MAILER_API_KEY (TODO_CLIENTE si algún proveedor usa canal='email'; API estilo Resend)
 * - MAILER_FROM (remitente, default pedidos@i-me.com.co)
 * Sin estas variables: canal='email' queda en estado 'error' con mensaje accionable
 * para que el admin notifique manualmente (modo mock documentado en F4).
 *
 * FASE 3 IMPROVEMENTS:
 * - Structured logging via createLogger
 * - Exponential backoff retry strategy (configurable per channel)
 * - Rate limiting per provider (10/min, 100/hour)
 * - Audit trail in notification_log table
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, notFound } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { createLogger, generateRequestId } from '../_shared/logging.ts';
import { postWithRetry } from '../_shared/retry-strategy.ts';
import { checkProviderRateLimit, logNotificationAttempt } from '../_shared/provider-rate-limit.ts';

interface NotificarRequest {
  pedido_id?: string;
  producto_ids?: string[];
  fulfillment_id?: string;
}

interface PedidoItem {
  producto_id: string;
  slug: string;
  nombre: string;
  cantidad: number;
  precio_unitario?: number;
  moneda?: string;
}

interface PedidoCliente {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  institucion?: string | null;
}

interface PedidoRow {
  id: string;
  cliente: PedidoCliente;
  items: PedidoItem[];
  referencia_pasarela: string | null;
  mercado: string;
}

interface ProveedorRow {
  id: string;
  nombre: string;
  canal: 'email' | 'whatsapp' | 'webhook' | 'api' | 'manual';
  contacto_email: string | null;
  contacto_whatsapp: string | null;
  webhook_url: string | null;
  api_config: Record<string, unknown> | null;
}

interface NotificacionPayload {
  pedido_id: string;
  referencia: string;
  fecha: string;
  cliente: PedidoCliente;
  items: Array<{ producto_id: string; slug: string; nombre: string; cantidad: number }>;
}

interface ResultadoNotificacion {
  ok: boolean;
  mensaje: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function construirPayload(pedido: PedidoRow, items: PedidoItem[]): NotificacionPayload {
  return {
    pedido_id: pedido.id,
    referencia: pedido.referencia_pasarela ?? pedido.id,
    fecha: new Date().toISOString(),
    cliente: pedido.cliente,
    items: items.map(i => ({
      producto_id: i.producto_id,
      slug: i.slug,
      nombre: i.nombre,
      cantidad: i.cantidad,
    })),
  };
}

function construirEnlaceWhatsapp(telefono: string, payload: NotificacionPayload): string {
  const numero = telefono.replace(/[^\d]/g, '');
  const itemsTxt = payload.items
    .map(i => `- ${i.cantidad} x ${i.nombre} (ref: ${i.slug})`)
    .join('\n');
  const texto =
    `Nuevo pedido ${payload.referencia} de I-ME.\n` +
    `Cliente: ${payload.cliente.nombre} ${payload.cliente.apellido} (${payload.cliente.telefono}, ${payload.cliente.email})\n` +
    `Productos:\n${itemsTxt}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

async function enviarEmail(
  apiKey: string,
  to: string,
  payload: NotificacionPayload
): Promise<ResultadoNotificacion> {
  const from = Deno.env.get('MAILER_FROM') ?? 'pedidos@i-me.com.co';
  const itemsHtml = payload.items
    .map(i => `<li>${i.cantidad} x ${escapeHtml(i.nombre)} (ref: ${escapeHtml(i.slug)})</li>`)
    .join('');
  const html = `
    <h2>Nuevo pedido ${escapeHtml(payload.referencia)}</h2>
    <p>Cliente: ${escapeHtml(payload.cliente.nombre)} ${escapeHtml(payload.cliente.apellido)}</p>
    <p>Email: ${escapeHtml(payload.cliente.email)}</p>
    <p>Telefono: ${escapeHtml(payload.cliente.telefono)}</p>
    ${payload.cliente.institucion ? `<p>Institucion: ${escapeHtml(payload.cliente.institucion)}</p>` : ''}
    <p>Productos:</p>
    <ul>${itemsHtml}</ul>
    <p>Fecha: ${escapeHtml(payload.fecha)}</p>
  `;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `Nuevo pedido ${payload.referencia} - I-ME`,
        html,
      }),
    });
    if (res.ok) return { ok: true, mensaje: `Email enviado a ${to}` };
    const detalle = await res.text();
    return {
      ok: false,
      mensaje: `Error enviando email (HTTP ${res.status}): ${detalle.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      ok: false,
      mensaje: `Error enviando email: ${err instanceof Error ? err.message : 'desconocido'}`,
    };
  }
}

// Usa postWithRetry de retry-strategy.ts (FASE 3)

async function notificarPorCanal(
  proveedor: ProveedorRow,
  pedido: PedidoRow,
  items: PedidoItem[],
  _logger: ReturnType<typeof createLogger>
): Promise<ResultadoNotificacion> {
  const payload = construirPayload(pedido, items);

  switch (proveedor.canal) {
    case 'webhook': {
      if (!proveedor.webhook_url) {
        return {
          ok: false,
          mensaje: `BLOQUEANTE_BACKEND: proveedor ${proveedor.nombre} sin webhook_url configurado.`,
        };
      }
      const result = await postWithRetry(proveedor.webhook_url, payload, {}, 'webhook', {
        providerId: proveedor.id,
        fulfillmentId: pedido.id,
      });
      return {
        ok: result.ok,
        mensaje: result.ok
          ? `Notificado via webhook (${result.attempts} intento${result.attempts > 1 ? 's' : ''})`
          : `Error webhook tras ${result.attempts} intentos: ${result.lastError}`,
      };
    }
    case 'api': {
      const url =
        typeof proveedor.api_config?.['url'] === 'string'
          ? (proveedor.api_config['url'] as string)
          : null;
      if (!url) {
        return {
          ok: false,
          mensaje: `BLOQUEANTE_BACKEND: proveedor ${proveedor.nombre} (canal api) sin api_config.url definido. TODO_CLIENTE.`,
        };
      }
      const headers =
        proveedor.api_config && typeof proveedor.api_config['headers'] === 'object'
          ? (proveedor.api_config['headers'] as Record<string, string>)
          : {};
      const result = await postWithRetry(url, payload, headers, 'api', {
        providerId: proveedor.id,
      });
      return {
        ok: result.ok,
        mensaje: result.ok
          ? `Notificado via API (${result.attempts} intento${result.attempts > 1 ? 's' : ''})`
          : `Error API tras ${result.attempts} intentos: ${result.lastError}`,
      };
    }
    case 'email': {
      if (!proveedor.contacto_email) {
        return {
          ok: false,
          mensaje: `BLOQUEANTE_BACKEND: proveedor ${proveedor.nombre} sin contacto_email configurado.`,
        };
      }
      const apiKey = Deno.env.get('MAILER_API_KEY');
      if (!apiKey) {
        return {
          ok: false,
          mensaje: `BLOQUEANTE_BACKEND: MAILER_API_KEY no configurado (TODO_CLIENTE). Notificar manualmente a ${proveedor.contacto_email} sobre el pedido ${payload.referencia}.`,
        };
      }
      return await enviarEmail(apiKey, proveedor.contacto_email, payload);
    }
    case 'whatsapp': {
      if (!proveedor.contacto_whatsapp) {
        return {
          ok: false,
          mensaje: `BLOQUEANTE_BACKEND: proveedor ${proveedor.nombre} sin contacto_whatsapp configurado.`,
        };
      }
      const link = construirEnlaceWhatsapp(proveedor.contacto_whatsapp, payload);
      return {
        ok: true,
        mensaje: `Enlace de WhatsApp generado para notificar al proveedor: ${link}`,
      };
    }
    case 'manual':
    default:
      return {
        ok: true,
        mensaje: `Canal manual: gestionar el pedido ${payload.referencia} desde Fulfillments.`,
      };
  }
}

async function resolverProveedorId(
  supabase: ReturnType<typeof getServerSupabase>,
  productoId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_proveedor_para_producto', {
    p_producto_id: productoId,
  });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { proveedor_id?: string }
    | null
    | undefined;
  return row?.proveedor_id ? String(row.proveedor_id) : null;
}

async function procesarPedido(
  supabase: ReturnType<typeof getServerSupabase>,
  pedidoId: string,
  productoIds: string[],
  origin: string | null,
  logger: ReturnType<typeof createLogger>
): Promise<Response> {
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, cliente, items, referencia_pasarela, mercado')
    .eq('id', pedidoId)
    .maybeSingle();

  if (pedidoError) return internalError(`error consultando pedido: ${pedidoError.message}`, origin);
  if (!pedido) return notFound(origin);

  const pedidoRow = pedido as unknown as PedidoRow;
  const items = Array.isArray(pedidoRow.items) ? pedidoRow.items : [];
  const idsValidos = new Set(productoIds.filter(id => typeof id === 'string' && id));

  const grupos = new Map<string, PedidoItem[]>();
  for (const item of items) {
    if (!idsValidos.has(item.producto_id)) continue;
    const proveedorId = await resolverProveedorId(supabase, item.producto_id);
    if (!proveedorId) continue;
    if (!grupos.has(proveedorId)) grupos.set(proveedorId, []);
    grupos.get(proveedorId)!.push(item);
  }

  const resultados: Array<Record<string, unknown>> = [];

  for (const [proveedorId, itemsGrupo] of grupos) {
    // Rate limit check (FASE 3)
    const { allowed, reason } = await checkProviderRateLimit(supabase, proveedorId);
    if (!allowed) {
      logger.warn(`Rate limit alcanzado`, { providerId: proveedorId, reason });
      resultados.push({
        proveedor_id: proveedorId,
        ok: false,
        mensaje: `Rate limit: ${reason}. Reintenta más tarde.`,
      });
      continue;
    }

    const { data: existente } = await supabase
      .from('fulfillments')
      .select('id, estado')
      .eq('pedido_id', pedidoId)
      .eq('proveedor_id', proveedorId)
      .maybeSingle();

    if (existente && existente.estado !== 'error') {
      resultados.push({ proveedor_id: proveedorId, skipped: true, estado: existente.estado });
      continue;
    }

    const { data: proveedor } = await supabase
      .from('proveedores')
      .select('id, nombre, canal, contacto_email, contacto_whatsapp, webhook_url, api_config')
      .eq('id', proveedorId)
      .maybeSingle();

    if (!proveedor) {
      resultados.push({ proveedor_id: proveedorId, ok: false, mensaje: 'proveedor no encontrado' });
      continue;
    }

    const resultado = await notificarPorCanal(
      proveedor as unknown as ProveedorRow,
      pedidoRow,
      itemsGrupo,
      logger
    );
    const ahora = new Date().toISOString();
    const cambios = {
      estado: resultado.ok ? 'notificado' : 'error',
      notificado_at: resultado.ok ? ahora : null,
      error_detalle: resultado.ok ? null : resultado.mensaje,
      notas: resultado.mensaje,
    };

    if (existente) {
      await supabase.from('fulfillments').update(cambios).eq('id', existente.id);
    } else {
      await supabase
        .from('fulfillments')
        .insert({ pedido_id: pedidoId, proveedor_id: proveedorId, ...cambios });
    }

    // Log to notification_log (FASE 3 - auditoría)
    await logNotificationAttempt(supabase, proveedorId, resultado.ok ? 'enviado' : 'fallido', {
      pedido_id: pedidoId,
      canal: (proveedor as unknown as ProveedorRow).canal,
      error: resultado.ok ? null : resultado.mensaje,
    });

    resultados.push({ proveedor_id: proveedorId, ...resultado });
  }

  return new Response(JSON.stringify({ ok: true, resultados }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

async function reenviarFulfillment(
  supabase: ReturnType<typeof getServerSupabase>,
  fulfillmentId: string,
  origin: string | null,
  logger: ReturnType<typeof createLogger>
): Promise<Response> {
  const { data: fulfillment, error: fulfillmentError } = await supabase
    .from('fulfillments')
    .select('id, pedido_id, proveedor_id')
    .eq('id', fulfillmentId)
    .maybeSingle();

  if (fulfillmentError)
    return internalError(`error consultando fulfillment: ${fulfillmentError.message}`, origin);
  if (!fulfillment || !fulfillment.pedido_id || !fulfillment.proveedor_id) return notFound(origin);

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, cliente, items, referencia_pasarela, mercado')
    .eq('id', fulfillment.pedido_id)
    .maybeSingle();
  if (!pedido) return notFound(origin);

  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, nombre, canal, contacto_email, contacto_whatsapp, webhook_url, api_config')
    .eq('id', fulfillment.proveedor_id)
    .maybeSingle();
  if (!proveedor) return notFound(origin);

  const pedidoRow = pedido as unknown as PedidoRow;
  const proveedorRow = proveedor as unknown as ProveedorRow;
  const items = Array.isArray(pedidoRow.items) ? pedidoRow.items : [];

  const itemsProveedor: PedidoItem[] = [];
  for (const item of items) {
    const proveedorId = await resolverProveedorId(supabase, item.producto_id);
    if (proveedorId === proveedorRow.id) itemsProveedor.push(item);
  }
  const itemsFinal = itemsProveedor.length > 0 ? itemsProveedor : items;

  const resultado = await notificarPorCanal(proveedorRow, pedidoRow, itemsFinal, logger);
  const ahora = new Date().toISOString();

  await supabase
    .from('fulfillments')
    .update({
      estado: resultado.ok ? 'notificado' : 'error',
      notificado_at: resultado.ok ? ahora : null,
      error_detalle: resultado.ok ? null : resultado.mensaje,
      notas: resultado.mensaje,
    })
    .eq('id', fulfillmentId);

  // Log reintento (FASE 3)
  await logNotificationAttempt(supabase, proveedorRow.id, resultado.ok ? 'enviado' : 'fallido', {
    fulfillment_id: fulfillmentId,
  });

  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const requestId = generateRequestId();
  const logger = createLogger({
    function: 'notificar-proveedor',
    requestId,
  });

  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  let body: NotificarRequest;
  try {
    body = (await req.json()) as NotificarRequest;
  } catch {
    return badRequest('JSON invalido', origin);
  }

  const supabase = getServerSupabase();

  if (typeof body.fulfillment_id === 'string' && body.fulfillment_id) {
    logger.info('Reenviar fulfillment', { fulfillment_id: body.fulfillment_id });
    return await reenviarFulfillment(supabase, body.fulfillment_id, origin, logger);
  }

  if (typeof body.pedido_id === 'string' && body.pedido_id && Array.isArray(body.producto_ids)) {
    logger.info('Procesar pedido', {
      pedido_id: body.pedido_id,
      producto_count: body.producto_ids.length,
    });
    return await procesarPedido(supabase, body.pedido_id, body.producto_ids, origin, logger);
  }

  return badRequest('Se requiere fulfillment_id o (pedido_id + producto_ids)', origin);
});
