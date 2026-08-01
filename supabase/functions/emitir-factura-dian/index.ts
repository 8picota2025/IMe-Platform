import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import {
  autenticar,
  crearFactura,
  getSiigoConfig,
  resolverCliente,
  resolverProducto,
  type SiigoConfig,
} from '../_shared/siigo-client.ts';
import { mapDianDraftToSiigoInvoice } from '../_shared/siigo-mapper.ts';
import type { DianInvoiceDraft } from '../../../src/lib/fiscal.ts';

const FN_NAME = 'emitir-factura-dian';
const PROVEEDOR = 'siigo';

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
  if (!token) return false;

  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (serviceRole && token === serviceRole) return true;

  // El gateway de Supabase ya verificó la firma JWT (función con verify_jwt).
  // Acepta también el JWT legacy service_role cuando el secret inyectado
  // usa el formato nuevo (sb_secret_*) y no coincide byte-a-byte.
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const padded = payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4);
    const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
      ref?: string;
    };
    const projectRef = Deno.env.get('SUPABASE_URL')?.match(/https:\/\/([^.]+)\./)?.[1];
    return payload.role === 'service_role' && (!projectRef || payload.ref === projectRef);
  } catch {
    return false;
  }
}

/** Mapea stamp.status de Siigo al estado interno de pedidos/facturas_electronicas. */
function normalizeEstadoSiigo(raw: unknown): 'emitida' | 'rechazada' | 'error' {
  const status = String(raw ?? '').toLowerCase();
  // Accepted = DIAN OK. Draft/Pending/Sending = creada en Siigo, sello en curso.
  if (status === 'accepted' || status === 'draft' || status === 'pending' || status === 'sending') {
    return 'emitida';
  }
  if (status === 'rejected') return 'rechazada';
  return 'error';
}

async function emitirConSiigo(
  supabase: ReturnType<typeof getServerSupabase>,
  config: SiigoConfig,
  draft: DianInvoiceDraft
): Promise<{
  ok: boolean;
  estado: 'emitida' | 'rechazada' | 'error';
  numeroFactura: string | null;
  cufe: string | null;
  payloadEnviado: unknown;
  respuesta: unknown;
  error: string | null;
}> {
  const token = await autenticar(config);

  const { identification } = await resolverCliente(token, config, draft.cliente);

  const codigosProducto: string[] = [];
  for (const linea of draft.lineas) {
    const { code } = await resolverProducto(token, config, supabase, {
      productoId: linea.producto_id,
      slug: linea.slug,
      nombre: linea.descripcion,
      tarifaIvaPct: linea.tarifa_iva_pct,
    });
    codigosProducto.push(code);
  }

  const payload = mapDianDraftToSiigoInvoice({
    draft,
    config,
    clienteIdentification: identification,
    codigosProducto,
    fecha: new Date().toISOString().slice(0, 10),
  });

  const resultado = await crearFactura(token, config, payload);
  const estado = resultado.ok ? normalizeEstadoSiigo(resultado.estadoStamp) : 'error';

  return {
    ok: resultado.ok,
    estado,
    numeroFactura: resultado.numeroFactura ?? null,
    cufe: resultado.cufe ?? null,
    payloadEnviado: payload,
    respuesta: resultado.raw,
    error: resultado.error ?? null,
  };
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
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
    const draft = metadata['dian_draft'];
    if (!draft || typeof draft !== 'object') {
      await supabase.from('facturas_electronicas').upsert(
        {
          pedido_id: pedido.id,
          estado: 'error',
          proveedor: PROVEEDOR,
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

    let config: SiigoConfig;
    try {
      config = getSiigoConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Configuracion Siigo invalida';
      await supabase.from('facturas_electronicas').upsert(
        {
          pedido_id: pedido.id,
          estado: 'error',
          proveedor: PROVEEDOR,
          payload: draft,
          error: message,
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
      const resultado = await emitirConSiigo(supabase, config, draft as DianInvoiceDraft);

      await supabase.from('facturas_electronicas').upsert(
        {
          pedido_id: pedido.id,
          estado: resultado.estado,
          proveedor: PROVEEDOR,
          numero_factura: resultado.numeroFactura,
          cufe: resultado.cufe,
          payload: resultado.payloadEnviado,
          respuesta: resultado.respuesta,
          error: resultado.error,
        },
        { onConflict: 'pedido_id' }
      );
      await supabase
        .from('pedidos')
        .update({ facturacion_electronica_estado: resultado.estado })
        .eq('id', pedido.id);

      void trackEvent(
        FN_NAME,
        resultado.estado === 'emitida' ? 'factura_emitida' : 'factura_rechazada',
        {
          pedido_id: pedido.id,
          estado: resultado.estado,
          numero_factura: resultado.numeroFactura,
        },
        { nivel: resultado.estado === 'emitida' ? 'info' : 'warn' }
      );

      return new Response(
        JSON.stringify({
          ok: resultado.ok,
          estado: resultado.estado,
          numero_factura: resultado.numeroFactura,
          cufe: resultado.cufe,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido al emitir factura Siigo';
      await supabase.from('facturas_electronicas').upsert(
        {
          pedido_id: pedido.id,
          estado: 'error',
          proveedor: PROVEEDOR,
          payload: draft,
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
  })
);
