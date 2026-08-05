import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized, errorResponse } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { extractBearerToken, isExactServiceRoleToken } from '../_shared/service-role-auth.ts';
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
import { pushFacturaToTwenty } from '../_shared/twenty-commerce-sync.ts';

const FN_NAME = 'emitir-factura-dian';
const PROVEEDOR = 'siigo';

interface EmitirFacturaRequest {
  pedido_id?: string;
  /** Si true: autentica Siigo + mapea payload, NO crea factura. */
  dry_run?: boolean;
  /**
   * Emision live solo si total <= tope (default 5000 COP) o force_live=true.
   * Protege pruebas controladas de importes minimos.
   */
  force_live?: boolean;
}

interface PedidoRow {
  id: string;
  facturacion_electronica_solicitada: boolean;
  total?: number | string | null;
  moneda?: string | null;
  metadata: Record<string, unknown> | null;
}

const DIAN_TEST_MAX_COP = Number(Deno.env.get('DIAN_TEST_MAX_COP') ?? 5000);

function isServiceRoleRequest(req: Request): boolean {
  const token = extractBearerToken(req.headers.get('authorization'));
  return isExactServiceRoleToken(token);
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

    const dryRun = body.dry_run === true;
    const forceLive = body.force_live === true;

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('pedidos')
      .select('id, facturacion_electronica_solicitada, total, moneda, metadata')
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
      if (!dryRun) {
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
      }
      return badRequest('borrador DIAN ausente', origin);
    }

    const totalPedido = Number(pedido.total ?? 0);
    const monedaPedido = String(pedido.moneda ?? 'COP').toUpperCase();
    if (!dryRun && !forceLive && monedaPedido === 'COP' && totalPedido > DIAN_TEST_MAX_COP) {
      return errorResponse(
        {
          code: 'DIAN_IMPORTE_SOBRE_TOPE',
          message: `Emision live bloqueada: total ${totalPedido} COP > tope prueba ${DIAN_TEST_MAX_COP}. Usa dry_run o force_live.`,
        },
        422,
        origin
      );
    }

    let config: SiigoConfig;
    try {
      config = getSiigoConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Configuracion Siigo invalida';
      if (!dryRun) {
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
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'PROVIDER_NOT_CONFIGURED', details: message }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        }
      );
    }

    if (dryRun) {
      try {
        const typedDraft = draft as DianInvoiceDraft;
        await autenticar(config);
        const tarifas = typedDraft.lineas.map(l => l.tarifa_iva_pct);
        const tarifasSinMapa = tarifas.filter(t => config.taxMap[String(t)] === undefined);
        if (tarifasSinMapa.length > 0) {
          throw new Error(
            `SIIGO_TAX_MAP sin tarifa(s): ${[...new Set(tarifasSinMapa)].join(', ')}`
          );
        }
        return new Response(
          JSON.stringify({
            ok: true,
            dry_run: true,
            pedido_id: pedido.id,
            total: totalPedido,
            moneda: monedaPedido,
            tope_prueba_cop: DIAN_TEST_MAX_COP,
            siigo_auth: 'ok',
            lineas: typedDraft.lineas.length,
            tarifas_iva: [...new Set(tarifas)],
            cliente: {
              tipo_documento: typedDraft.cliente.tipo_documento,
              numero_documento: typedDraft.cliente.numero_documento,
              razon_social: typedDraft.cliente.razon_social,
            },
            totales: typedDraft.totales,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, dry_run: true, error: message }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        });
      }
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

      void pushFacturaToTwenty(supabase, pedido.id, {
        numeroFactura: resultado.numeroFactura,
        cufe: resultado.cufe,
        estado: resultado.estado,
      });

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
