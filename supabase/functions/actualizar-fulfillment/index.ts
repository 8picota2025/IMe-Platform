/**
 * Edge Function: actualizar-fulfillment
 *
 * Permite que un proveedor actualice el estado de un fulfillment (pedido pendiente).
 * Autenticación: Bearer token en header Authorization (proveedores.api_token).
 *
 * Estados permitidos: preparando, enviado, entregado, cancelado.
 *
 * Request body:
 * {
 *   fulfillment_id: string (UUID),
 *   estado: 'preparando' | 'enviado' | 'entregado' | 'cancelado',
 *   tracking_number?: string,
 *   tracking_url?: string,
 *   notas?: string
 * }
 *
 * Response:
 * - 200: { ok: true, fulfillment: { id, estado, tracking_number, tracking_url, updated_at } }
 * - 400: { error: { code, message } }
 * - 401: { error: { code: 'UNAUTHORIZED', message: '...' } }
 * - 404: { error: { code: 'NOT_FOUND', message: '...' } }
 * - 500: { error: { code: 'INTERNAL_ERROR', message: '...' } }
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized, notFound } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

interface ActualizarFulfillmentRequest {
  fulfillment_id?: string;
  estado?: string;
  tracking_number?: string;
  tracking_url?: string;
  notas?: string;
}

interface FulfillmentRow {
  id: string;
  proveedor_id: string;
  pedido_id: string;
  estado: string;
  tracking_number: string | null;
  tracking_url: string | null;
  notificado_at: string | null;
  enviado_at: string | null;
  entregado_at: string | null;
}

interface ProveedorRow {
  id: string;
  nombre: string;
  api_token: string | null;
}

const ESTADOS_PERMITIDOS = ['preparando', 'enviado', 'entregado', 'cancelado'];

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
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== 'POST') {
    return badRequest('Metodo no soportado', origin);
  }

  let body: ActualizarFulfillmentRequest;
  try {
    body = (await req.json()) as ActualizarFulfillmentRequest;
  } catch {
    return badRequest('JSON invalido', origin);
  }

  // Validar fulfillment_id
  if (!body.fulfillment_id || !isValidUuid(body.fulfillment_id)) {
    return badRequest('fulfillment_id invalido o no proporcionado', origin);
  }

  // Validar estado
  if (!body.estado || !ESTADOS_PERMITIDOS.includes(body.estado)) {
    return badRequest(`estado invalido. Permitidos: ${ESTADOS_PERMITIDOS.join(', ')}`, origin);
  }

  // Validar token en header Authorization
  const authHeader = req.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) {
    return unauthorized(origin);
  }

  const supabase = getServerSupabase();

  // 1. Buscar el fulfillment
  const { data: fulfillment, error: fulfillmentError } = await supabase
    .from('fulfillments')
    .select(
      'id, proveedor_id, pedido_id, estado, tracking_number, tracking_url, notificado_at, enviado_at, entregado_at'
    )
    .eq('id', body.fulfillment_id)
    .maybeSingle();

  if (fulfillmentError) {
    return internalError(`error consultando fulfillment: ${fulfillmentError.message}`, origin);
  }

  if (!fulfillment) {
    return notFound(origin);
  }

  const fulfillmentRow = fulfillment as unknown as FulfillmentRow;

  // 2. Validar que el proveedor está autenticado para este fulfillment
  const { data: proveedor, error: proveedorError } = await supabase
    .from('proveedores')
    .select('id, nombre, api_token')
    .eq('id', fulfillmentRow.proveedor_id)
    .maybeSingle();

  if (proveedorError) {
    return internalError(`error consultando proveedor: ${proveedorError.message}`, origin);
  }

  if (!proveedor) {
    return notFound(origin);
  }

  const proveedorRow = proveedor as unknown as ProveedorRow;

  // Validar que el token del proveedor coincide
  if (!proveedorRow.api_token || proveedorRow.api_token !== token) {
    return unauthorized(origin);
  }

  // 3. Preparar los cambios
  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = {
    estado: body.estado,
    updated_at: ahora,
  };

  // Actualizar timestamps según el estado
  if (body.estado === 'preparando' && !fulfillmentRow.notificado_at) {
    cambios.notificado_at = ahora;
  }
  if (body.estado === 'enviado' && !fulfillmentRow.enviado_at) {
    cambios.enviado_at = ahora;
  }
  if (body.estado === 'entregado' && !fulfillmentRow.entregado_at) {
    cambios.entregado_at = ahora;
  }

  // Tracking
  if (body.tracking_number !== undefined) {
    cambios.tracking_number = body.tracking_number || null;
  }
  if (body.tracking_url !== undefined) {
    cambios.tracking_url = body.tracking_url || null;
  }

  // Notas (append si existen notas previas)
  if (body.notas) {
    const notasAnteriores = fulfillmentRow.id ? ` | Anterior: ...` : '';
    cambios.notas = `[${ahora}] ${body.notas}${notasAnteriores}`;
  }

  // 4. Actualizar fulfillment
  const { data: actualizado, error: updateError } = await supabase
    .from('fulfillments')
    .update(cambios)
    .eq('id', body.fulfillment_id)
    .select('id, estado, tracking_number, tracking_url, updated_at')
    .single();

  if (updateError) {
    return internalError(`error actualizando fulfillment: ${updateError.message}`, origin);
  }

  // 5. Retornar resultado exitoso
  return new Response(
    JSON.stringify({
      ok: true,
      fulfillment: actualizado,
      mensaje: `Fulfillment actualizado a estado '${body.estado}'`,
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
