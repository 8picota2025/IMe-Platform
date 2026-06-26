/**
 * Edge Function: confirmar-notificacion-proveedor
 *
 * Webhook callback que un proveedor invoca para confirmar que recibió
 * una notificación de pedido.
 *
 * Permite a I-ME saber que:
 * 1. La notificación llegó al proveedor
 * 2. El proveedor leyó/procesó el pedido
 * 3. Hay tiempo para que el proveedor empiece a preparar
 *
 * Autenticación: Token en header (proveedores.api_token)
 *
 * Request body:
 * {
 *   fulfillment_id: string (UUID),
 *   confirmado: boolean,
 *   mensaje?: string,
 *   metadatos?: { [...] }
 * }
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized, notFound } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { createLogger, generateRequestId } from '../_shared/logging.ts';

interface ConfirmarNotificacionRequest {
  fulfillment_id?: string;
  confirmado?: boolean;
  mensaje?: string;
  metadatos?: Record<string, unknown>;
}

interface FulfillmentRow {
  id: string;
  proveedor_id: string;
  estado: string;
}

interface ProveedorRow {
  id: string;
  api_token: string | null;
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') return null;
  return parts[1] ?? null;
}

function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const requestId = generateRequestId();
  const logger = createLogger({ function: 'confirmar-notificacion-proveedor', requestId });

  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== 'POST') {
    logger.warn('Metodo no soportado', { method: req.method });
    return badRequest('Metodo no soportado', origin);
  }

  let body: ConfirmarNotificacionRequest;
  try {
    body = (await req.json()) as ConfirmarNotificacionRequest;
  } catch {
    logger.warn('JSON invalido');
    return badRequest('JSON invalido', origin);
  }

  // Validar fulfillment_id
  if (!body.fulfillment_id || !isValidUuid(body.fulfillment_id)) {
    logger.warn('fulfillment_id invalido', { fulfillment_id: body.fulfillment_id });
    return badRequest('fulfillment_id invalido o no proporcionado', origin);
  }

  // Validar token
  const authHeader = req.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) {
    logger.warn('Token ausente', { fulfillment_id: body.fulfillment_id });
    return unauthorized(origin);
  }

  const supabase = getServerSupabase();

  logger.info('Confirmar notificación iniciado', {
    fulfillmentId: body.fulfillment_id,
    confirmado: body.confirmado,
  });

  // 1. Buscar fulfillment
  const { data: fulfillment, error: fulfillmentError } = await supabase
    .from('fulfillments')
    .select('id, proveedor_id, estado')
    .eq('id', body.fulfillment_id)
    .maybeSingle();

  if (fulfillmentError) {
    logger.error('Error consultando fulfillment', new Error(fulfillmentError.message), {
      fulfillment_id: body.fulfillment_id,
    });
    return internalError(`error consultando fulfillment: ${fulfillmentError.message}`, origin);
  }

  if (!fulfillment) {
    logger.warn('fulfillment no encontrado', { fulfillment_id: body.fulfillment_id });
    return notFound(origin);
  }

  const fulfillmentRow = fulfillment as unknown as FulfillmentRow;

  // 2. Validar token
  const { data: proveedor, error: proveedorError } = await supabase
    .from('proveedores')
    .select('id, api_token')
    .eq('id', fulfillmentRow.proveedor_id)
    .maybeSingle();

  if (proveedorError) {
    logger.error('Error consultando proveedor', new Error(proveedorError.message), {
      proveedor_id: fulfillmentRow.proveedor_id,
    });
    return internalError(`error consultando proveedor: ${proveedorError.message}`, origin);
  }

  if (!proveedor) {
    logger.warn('proveedor no encontrado', { proveedor_id: fulfillmentRow.proveedor_id });
    return notFound(origin);
  }

  const proveedorRow = proveedor as unknown as ProveedorRow;

  if (!proveedorRow.api_token || proveedorRow.api_token !== token) {
    logger.warn('Token inválido o no coincide', {
      proveedor_id: fulfillmentRow.proveedor_id,
    });
    return unauthorized(origin);
  }

  // 3. Registrar confirmación
  const ahora = new Date().toISOString();

  // Actualizar notas del fulfillment
  const estadoConfirmacion = body.confirmado ? 'confirmado' : 'rechazado';
  const notaNueva = `[${ahora}] Proveedor ${estadoConfirmacion} recepción${
    body.mensaje ? `: ${body.mensaje}` : ''
  }`;

  const cambios: Record<string, unknown> = {
    notas: notaNueva,
    updated_at: ahora,
  };

  // Opcional: cambiar estado a "preparando" si fue confirmado
  if (body.confirmado && fulfillmentRow.estado === 'notificado') {
    cambios.estado = 'preparando';
  }

  const { data: actualizado, error: updateError } = await supabase
    .from('fulfillments')
    .update(cambios)
    .eq('id', body.fulfillment_id)
    .select('id, estado, updated_at')
    .single();

  if (updateError) {
    logger.error('Error actualizando fulfillment', new Error(updateError.message), {
      fulfillment_id: body.fulfillment_id,
    });
    return internalError(`error actualizando fulfillment: ${updateError.message}`, origin);
  }

  // 4. Log de confirmación (para auditoría)
  await supabase.from('notification_log').insert({
    proveedor_id: fulfillmentRow.proveedor_id,
    fulfillment_id: body.fulfillment_id,
    tipo: 'confirmacion',
    status: body.confirmado ? 'confirmado' : 'rechazado',
    metadatos: body.metadatos,
    created_at: ahora,
  });

  logger.info('Confirmación registrada exitosamente', {
    fulfillmentId: body.fulfillment_id,
    confirmado: body.confirmado,
    nuevoEstado: actualizado?.estado,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      confirmacion: {
        fulfillment_id: body.fulfillment_id,
        estado: actualizado?.estado,
        confirmado: body.confirmado,
        timestamp: ahora,
      },
      mensaje: `Confirmación de notificación registrada (${estadoConfirmacion})`,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin),
      },
    }
  );
});
