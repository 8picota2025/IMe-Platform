import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

interface EmitirFacturaRequest {
  pedido_id?: string;
}

interface PedidoRow {
  id: string;
  facturacion_electronica_solicitada: boolean;
  metadata: Record<string, unknown> | null;
}

function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return !!token && !!serviceRole && token === serviceRole;
}

function normalizeEstadoProveedor(raw: unknown): 'emitida' | 'rechazada' | 'error' {
  const status = String(raw ?? '').toLowerCase();
  if (
    status === 'emitida' ||
    status === 'issued' ||
    status === 'accepted' ||
    status === 'success' ||
    status === 'ok'
  ) {
    return 'emitida';
  }
  if (status === 'rechazada' || status === 'rejected') return 'rechazada';
  return 'error';
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);
  if (!isServiceRoleRequest(req)) return unauthorized(origin);

  let body: EmitirFacturaRequest;
  try {
    body = (await req.json()) as EmitirFacturaRequest;
  } catch {
    return badRequest('JSON invalido', origin);
  }

  if (!body.pedido_id) return badRequest('pedido_id requerido', origin);

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, facturacion_electronica_solicitada, metadata')
    .eq('id', body.pedido_id)
    .maybeSingle();

  if (error) return internalError(`error consultando pedido: ${error.message}`, origin);
  if (!data) return badRequest('pedido no encontrado', origin);

  const pedido = data as PedidoRow;
  if (!pedido.facturacion_electronica_solicitada) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_solicitada' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }

  const metadata = pedido.metadata ?? {};
  const payload = metadata['dian_draft'];
  if (!payload || typeof payload !== 'object') {
    await supabase.from('facturas_electronicas').upsert(
      {
        pedido_id: pedido.id,
        estado: 'error',
        proveedor: Deno.env.get('DIAN_PROVIDER_NAME') ?? 'pendiente_configuracion',
        error: 'Borrador DIAN ausente en metadata.dian_draft',
      },
      { onConflict: 'pedido_id' }
    );
    await supabase
      .from('pedidos')
      .update({ facturacion_electronica_estado: 'error' })
      .eq('id', pedido.id);
    return badRequest('borrador DIAN ausente', origin);
  }

  const providerUrl = Deno.env.get('DIAN_PROVIDER_API_URL');
  const providerToken = Deno.env.get('DIAN_PROVIDER_API_TOKEN');
  const providerName = Deno.env.get('DIAN_PROVIDER_NAME') ?? 'pendiente_configuracion';

  if (!providerUrl || !providerToken) {
    await supabase.from('facturas_electronicas').upsert(
      {
        pedido_id: pedido.id,
        estado: 'error',
        proveedor: providerName,
        payload,
        error: 'DIAN_PROVIDER_API_URL o DIAN_PROVIDER_API_TOKEN no configurado',
      },
      { onConflict: 'pedido_id' }
    );
    await supabase
      .from('pedidos')
      .update({ facturacion_electronica_estado: 'error' })
      .eq('id', pedido.id);

    return new Response(JSON.stringify({ ok: false, error: 'PROVIDER_NOT_CONFIGURED' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  }

  try {
    const providerRes = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
        'X-IME-Source': 'supabase-edge-function',
      },
      body: JSON.stringify(payload),
    });
    const providerJson = (await providerRes.json().catch(() => ({}))) as Record<string, unknown>;
    const estado = providerRes.ok
      ? normalizeEstadoProveedor(providerJson['status'] ?? 'emitida')
      : normalizeEstadoProveedor(providerJson['status'] ?? 'error');
    const numeroFactura = String(
      providerJson['numero_factura'] ?? providerJson['invoice_number'] ?? ''
    ).trim();
    const cufe = String(providerJson['cufe'] ?? providerJson['uuid'] ?? '').trim();
    const errorText = providerRes.ok
      ? null
      : String(providerJson['error'] ?? providerJson['message'] ?? `HTTP ${providerRes.status}`);

    await supabase.from('facturas_electronicas').upsert(
      {
        pedido_id: pedido.id,
        estado,
        proveedor: providerName,
        numero_factura: numeroFactura || null,
        cufe: cufe || null,
        payload,
        respuesta: providerJson,
        error: errorText,
      },
      { onConflict: 'pedido_id' }
    );
    await supabase
      .from('pedidos')
      .update({ facturacion_electronica_estado: estado })
      .eq('id', pedido.id);

    return new Response(
      JSON.stringify({
        ok: providerRes.ok,
        estado,
        numero_factura: numeroFactura || null,
        cufe: cufe || null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al emitir factura';
    await supabase.from('facturas_electronicas').upsert(
      {
        pedido_id: pedido.id,
        estado: 'error',
        proveedor: providerName,
        payload,
        error: message,
      },
      { onConflict: 'pedido_id' }
    );
    await supabase
      .from('pedidos')
      .update({ facturacion_electronica_estado: 'error' })
      .eq('id', pedido.id);
    return internalError(message, origin);
  }
});
