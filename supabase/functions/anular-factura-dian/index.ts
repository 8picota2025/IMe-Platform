/**
 * Emite nota de credito Siigo para anular una factura electronica.
 * Motivo DIAN 2 = Anulacion de factura electronica.
 *
 * Auth: service_role (o JWT admin owner/admin).
 *
 * Body:
 *  - pedido_id (required)
 *  - observaciones (optional)
 *  - dry_run (optional)
 *  - stamp (optional, default true) — enviar a DIAN
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
import {
  autenticar,
  crearNotaCredito,
  getSiigoConfig,
  listarMediosPago,
  listarTiposDocumento,
} from '../_shared/siigo-client.ts';

const ROLES = new Set(['owner', 'admin']);
const MOTIVO_ANULACION = 2;

interface Body {
  pedido_id?: string;
  observaciones?: string;
  dry_run?: boolean;
  stamp?: boolean;
}

function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return false;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (serviceRole && token === serviceRole) return true;
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

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  if (!isServiceRoleRequest(req)) {
    const auth = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
    if (!auth.ok) return unauthorized(origin);
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const pedidoId = (body.pedido_id ?? '').trim();
  if (!pedidoId) return badRequest('pedido_id requerido', origin);

  const { data: facturaRow, error: facturaError } = await supabase
    .from('facturas_electronicas')
    .select('pedido_id, estado, numero_factura, respuesta, payload')
    .eq('pedido_id', pedidoId)
    .maybeSingle();
  if (facturaError) return internalError(facturaError.message, origin);
  if (!facturaRow) return notFound(origin);

  const factura = facturaRow as {
    pedido_id: string;
    estado: string;
    numero_factura: string | null;
    respuesta: Record<string, unknown> | null;
    payload: Record<string, unknown> | null;
  };

  if (factura.estado === 'anulada') {
    return errorResponse(
      { code: 'YA_ANULADA', message: 'La factura ya esta marcada como anulada' },
      409,
      origin
    );
  }

  const respuesta = factura.respuesta ?? {};
  const invoiceId = String(respuesta.id ?? '').trim();
  if (!invoiceId) {
    return errorResponse(
      {
        code: 'SIN_ID_SIIGO',
        message: 'La factura no tiene id Siigo en respuesta (no se puede anular)',
      },
      422,
      origin
    );
  }

  const itemsRaw = Array.isArray(respuesta.items) ? respuesta.items : [];
  if (itemsRaw.length === 0) {
    return errorResponse(
      { code: 'SIN_ITEMS', message: 'La factura Siigo no tiene items para la nota credito' },
      422,
      origin
    );
  }

  const total = Number(respuesta.total ?? 0);
  if (!(total > 0)) {
    return errorResponse(
      { code: 'TOTAL_INVALIDO', message: 'Total de factura invalido para nota credito' },
      422,
      origin
    );
  }

  const observaciones =
    (body.observaciones ?? '').trim() ||
    `Anulacion FV ${factura.numero_factura ?? invoiceId}: prueba controlada de flujo de negocio I-ME (cotizacion→transferencia→validacion→DIAN). Importe de prueba. No corresponde a venta real.`;

  let config;
  try {
    config = getSiigoConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Config Siigo invalida';
    return new Response(
      JSON.stringify({ ok: false, error: 'PROVIDER_NOT_CONFIGURED', details: message }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  }

  const token = await autenticar(config);
  const tiposNc = await listarTiposDocumento(token, config, 'NC');
  const tipoElectronico =
    tiposNc.find(t => {
      const et = String((t as { electronic_type?: string }).electronic_type ?? '').toLowerCase();
      return et.includes('electronic') && !et.includes('noelectronic');
    }) ??
    tiposNc.find(t => t.electronic === true) ??
    tiposNc.find(t => /electron/i.test(String(t.name ?? ''))) ??
    tiposNc[0];
  if (!tipoElectronico?.id) {
    return errorResponse(
      {
        code: 'SIN_TIPO_NC',
        message: 'No hay tipo de documento NC configurado en Siigo',
        details: tiposNc,
      },
      422,
      origin
    );
  }

  const electronicType = String(
    (tipoElectronico as { electronic_type?: string }).electronic_type ?? ''
  );
  const esElectronica = /electronic/i.test(electronicType) && !/noelectronic/i.test(electronicType);

  const medios = await listarMediosPago(token, config, 'NC');
  const medio =
    medios.find(m => /transfer/i.test(String(m.name ?? ''))) ??
    medios.find(m => m.id === config.paymentTypeId) ??
    medios[0];
  if (!medio?.id) {
    return errorResponse(
      {
        code: 'SIN_MEDIO_PAGO_NC',
        message: 'No hay medio de pago NC en Siigo',
        details: medios,
      },
      422,
      origin
    );
  }

  const items = itemsRaw.map((item: Record<string, unknown>) => {
    const taxesRaw = Array.isArray(item.taxes) ? item.taxes : [];
    const taxes = taxesRaw
      .map((t: Record<string, unknown>) => ({ id: Number(t.id) }))
      .filter(t => Number.isFinite(t.id));
    return {
      code: String(item.code ?? ''),
      description: String(item.description ?? item.code ?? 'Item'),
      quantity: Number(item.quantity ?? 1),
      price: Number(item.price ?? 0),
      ...(taxes.length ? { taxes } : {}),
    };
  });

  const payload = {
    document: { id: Number(tipoElectronico.id) },
    date: new Date().toISOString().slice(0, 10),
    invoice: invoiceId,
    reason: MOTIVO_ANULACION,
    seller: config.sellerId,
    observations: observaciones,
    items,
    payments: [{ id: Number(medio.id), value: total }],
    stamp: { send: esElectronica && body.stamp !== false },
    mail: { send: false },
  };

  if (body.dry_run === true) {
    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: true,
        pedido_id: pedidoId,
        factura: factura.numero_factura,
        invoice_id: invoiceId,
        document_type_nc: tipoElectronico,
        tipos_nc_disponibles: tiposNc,
        electronica: esElectronica,
        payment_type_nc: medio,
        payload,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  }

  const resultado = await crearNotaCredito(token, config, payload);
  if (!resultado.ok) {
    await supabase
      .from('facturas_electronicas')
      .update({
        error: `Nota credito fallida: ${resultado.error ?? 'error'}`,
      })
      .eq('pedido_id', pedidoId);
    return errorResponse(
      {
        code: 'NOTA_CREDITO_FALLIDA',
        message: resultado.error ?? 'No se pudo crear la nota credito',
        details: resultado.raw,
      },
      502,
      origin
    );
  }

  const metaPedido = await supabase
    .from('pedidos')
    .select('metadata')
    .eq('id', pedidoId)
    .maybeSingle();
  const prevMeta =
    (metaPedido.data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};

  await supabase
    .from('facturas_electronicas')
    .update({
      estado: 'anulada',
      error: null,
      respuesta: {
        ...respuesta,
        nota_credito: resultado.raw,
        anulada_at: new Date().toISOString(),
        anulacion_motivo: observaciones,
      },
    })
    .eq('pedido_id', pedidoId);

  await supabase
    .from('pedidos')
    .update({
      facturacion_electronica_estado: 'anulada',
      metadata: {
        ...prevMeta,
        nota_credito: {
          numero: resultado.numeroNota ?? null,
          cude: resultado.cude ?? null,
          motivo_dian: MOTIVO_ANULACION,
          observaciones,
          stamp: resultado.estadoStamp,
          created_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', pedidoId);

  return new Response(
    JSON.stringify({
      ok: true,
      pedido_id: pedidoId,
      factura_anulada: factura.numero_factura,
      nota_credito: resultado.numeroNota ?? null,
      cude: resultado.cude ?? null,
      stamp: resultado.estadoStamp,
      motivo_dian: MOTIVO_ANULACION,
      observaciones,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
