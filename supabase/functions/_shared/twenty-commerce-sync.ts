/**
 * Orquestación Twenty para cliente / pago / factura (best-effort).
 * Usado desde crear-pago, formalizar-cotizacion, post-pago, emitir-factura-dian.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { syncClienteWithTwenty, syncFacturaWithTwenty, syncPagoWithTwenty } from './twenty-crm.ts';

type TipoCliente = 'b2b' | 'b2c' | 'mixto';

function asTipo(value: unknown): TipoCliente {
  const v = String(value ?? 'b2c').toLowerCase();
  if (v === 'b2b' || v === 'mixto') return v;
  return 'b2c';
}

export async function pushClienteToTwenty(
  supabase: SupabaseClient,
  clienteId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('clientes')
    .select(
      'id, email, nombre, apellido, telefono, institucion, tipo_cliente, razon_social, tipo_documento, numero_documento, email_facturacion, total_gastado, twenty_person_id, twenty_company_id'
    )
    .eq('id', clienteId)
    .maybeSingle();
  if (error || !data) {
    console.error('pushClienteToTwenty: cliente no leído', error?.message);
    return;
  }
  const row = data as Record<string, unknown>;
  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) return;

  const sync = await syncClienteWithTwenty({
    nombre: String(row.nombre ?? 'Cliente'),
    apellido: (row.apellido as string | null) ?? null,
    email,
    telefono: (row.telefono as string | null) ?? null,
    institucion: (row.institucion as string | null) ?? null,
    tipoCliente: asTipo(row.tipo_cliente),
    razonSocial: (row.razon_social as string | null) ?? null,
    tipoDocumento: (row.tipo_documento as string | null) ?? null,
    numeroDocumento: (row.numero_documento as string | null) ?? null,
    emailFacturacion: (row.email_facturacion as string | null) ?? email,
    totalGastado: Number(row.total_gastado ?? 0),
    moneda: 'COP',
  });

  if (sync.skipped) return;
  if (!sync.ok || !sync.data) {
    console.error('pushClienteToTwenty: Twenty failed', sync.error);
    return;
  }

  await supabase
    .from('clientes')
    .update({
      twenty_person_id: sync.data.personId,
      twenty_company_id: sync.data.companyId,
    })
    .eq('id', clienteId);
}

export async function pushPagoToTwenty(
  supabase: SupabaseClient,
  pedidoId: string,
  provider: 'wompi' | 'stripe' | 'bold' | 'transferencia'
): Promise<void> {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, total, moneda, cliente_id, twenty_opportunity_id, cliente')
    .eq('id', pedidoId)
    .maybeSingle();
  if (error || !pedido) {
    console.error('pushPagoToTwenty: pedido no leído', error?.message);
    return;
  }
  const p = pedido as Record<string, unknown>;
  const clienteId = p.cliente_id as string | null;
  if (clienteId) {
    await pushClienteToTwenty(supabase, clienteId);
  }

  let personId: string | undefined;
  let companyId: string | undefined;
  let opportunityId = (p.twenty_opportunity_id as string | null) || undefined;

  if (clienteId) {
    const { data: cli } = await supabase
      .from('clientes')
      .select('twenty_person_id, twenty_company_id, institucion, nombre, razon_social')
      .eq('id', clienteId)
      .maybeSingle();
    const c = cli as Record<string, unknown> | null;
    personId = (c?.twenty_person_id as string) || undefined;
    companyId = (c?.twenty_company_id as string) || undefined;
  }

  {
    const { data: sol } = await supabase
      .from('solicitudes_cotizacion')
      .select('twenty_opportunity_id, twenty_person_id, twenty_company_id')
      .eq('pedido_id', pedidoId)
      .maybeSingle();
    const s = sol as Record<string, unknown> | null;
    opportunityId = opportunityId || (s?.twenty_opportunity_id as string) || undefined;
    personId = personId || (s?.twenty_person_id as string) || undefined;
    companyId = companyId || (s?.twenty_company_id as string) || undefined;
  }

  const clienteJson = (p.cliente as Record<string, unknown> | null) ?? {};
  const label =
    String(clienteJson.institucion || clienteJson.nombre || 'Pedido I-ME').slice(0, 80) +
    ` — pagado ${pedidoId.slice(0, 8)}`;

  const sync = await syncPagoWithTwenty({
    companyId,
    personId,
    opportunityId,
    pedidoId,
    nombreOportunidad: label,
    total: Number(p.total ?? 0),
    moneda: String(p.moneda ?? 'COP'),
    proveedorPago: provider,
  });

  if (sync.skipped) return;
  if (!sync.ok || !sync.data) {
    console.error('pushPagoToTwenty: Twenty failed', sync.error);
    return;
  }

  await supabase
    .from('pedidos')
    .update({ twenty_opportunity_id: sync.data.opportunityId })
    .eq('id', pedidoId);
}

export async function pushFacturaToTwenty(
  supabase: SupabaseClient,
  pedidoId: string,
  factura: {
    numeroFactura?: string | null;
    cufe?: string | null;
    estado: string;
  }
): Promise<void> {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id, total, moneda, cliente_id, twenty_opportunity_id')
    .eq('id', pedidoId)
    .maybeSingle();
  if (error || !pedido) return;
  const p = pedido as Record<string, unknown>;
  let personId: string | undefined;
  let companyId: string | undefined;
  if (p.cliente_id) {
    const { data: cli } = await supabase
      .from('clientes')
      .select('twenty_person_id, twenty_company_id')
      .eq('id', p.cliente_id as string)
      .maybeSingle();
    const c = cli as Record<string, unknown> | null;
    personId = (c?.twenty_person_id as string) || undefined;
    companyId = (c?.twenty_company_id as string) || undefined;
  }

  const sync = await syncFacturaWithTwenty({
    companyId,
    personId,
    opportunityId: (p.twenty_opportunity_id as string) || undefined,
    pedidoId,
    numeroFactura: factura.numeroFactura,
    cufe: factura.cufe,
    estado: factura.estado,
    total: Number(p.total ?? 0),
    moneda: String(p.moneda ?? 'COP'),
  });
  if (sync.skipped) return;
  if (!sync.ok) console.error('pushFacturaToTwenty: Twenty failed', sync.error);
}
