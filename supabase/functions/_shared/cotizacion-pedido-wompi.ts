/**
 * Crea (o reutiliza) un pedido Wompi pendiente desde una cotización formalizable.
 * La referencia de pasarela es siempre el UUID del pedido — nunca el número IME-Q-….
 */
import {
  calcularTotalOfertado,
  parseLineasOferta,
  splitNombreApellido,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';
import {
  indexProductosPorSlug,
  validarDisponibilidadLineasOferta,
} from '../../../src/lib/cotizacion-disponibilidad.ts';
import { desgloseDeLineas } from './cotizacion-pago.ts';

type SupabaseLike = {
  from: (table: string) => any;
};

export type PedidoWompiDesdeCotizacion =
  | { ok: true; pedidoId: string; total: number; moneda: string; created: boolean }
  | { ok: false; code: string; message: string };

function totalAPagar(
  desgloseTotal: number,
  row: CotizacionOfertaRow,
  lineas: ReturnType<typeof parseLineasOferta>
): number {
  if (desgloseTotal > 0) return desgloseTotal;
  const locked = Number(row.precio_total_ofertado);
  if (Number.isFinite(locked) && locked > 0) return locked;
  return calcularTotalOfertado(lineas);
}

async function cargarYValidarProductosOferta(
  supabase: SupabaseLike,
  lineas: ReturnType<typeof parseLineasOferta>
): Promise<
  | { ok: true; porSlug: Map<string, Record<string, unknown>> }
  | { ok: false; code: string; message: string }
> {
  const slugs = lineas.map(l => l.slug);
  const { data: productos, error } = await supabase
    .from('productos')
    .select('id, slug, nombre_es, familia_id, activo, disponible')
    .in('slug', slugs);
  if (error) {
    return {
      ok: false,
      code: 'PRODUCTOS_LOOKUP_ERROR',
      message: error.message ?? 'No se pudieron validar productos',
    };
  }
  const rows = (productos ?? []) as Array<Record<string, unknown>>;
  const gate = validarDisponibilidadLineasOferta(
    lineas,
    indexProductosPorSlug(
      rows.map(p => ({
        slug: String(p.slug ?? ''),
        activo: p.activo as boolean | null | undefined,
        disponible: p.disponible as boolean | null | undefined,
      }))
    )
  );
  if (!gate.ok) {
    return { ok: false, code: gate.code, message: gate.message };
  }
  return {
    ok: true,
    porSlug: new Map(rows.map(p => [String(p.slug), p])),
  };
}

/**
 * Inserta pedido pendiente + reclama la cotización (estado convertida).
 * Si ya hay pedido con la misma cotización y proveedor wompi pendiente, lo reutiliza.
 */
export async function crearOReusarPedidoWompiDesdeCotizacion(
  supabase: SupabaseLike,
  row: CotizacionOfertaRow,
  opts?: { referenciaPasarelaOverride?: string | null }
): Promise<PedidoWompiDesdeCotizacion> {
  const id = String(row.id);
  const lineas = parseLineasOferta(row.productos);
  if (lineas.length === 0) {
    return { ok: false, code: 'OFERTA_INCOMPLETA', message: 'Oferta sin lineas' };
  }

  // Escenario A: catálogo vivo (activo/disponible) antes de cobrar o reusar pendiente.
  const catalogo = await cargarYValidarProductosOferta(supabase, lineas);
  if (!catalogo.ok) {
    return { ok: false, code: catalogo.code, message: catalogo.message };
  }

  if (row.pedido_id) {
    const { data: existente } = await supabase
      .from('pedidos')
      .select('id, estado, total, moneda, proveedor_pago, referencia_pasarela')
      .eq('id', row.pedido_id)
      .maybeSingle();
    if (
      existente &&
      String(existente.proveedor_pago) === 'wompi' &&
      String(existente.estado) === 'pendiente'
    ) {
      return {
        ok: true,
        pedidoId: String(existente.id),
        total: Number(existente.total) || 0,
        moneda: String(existente.moneda || 'COP'),
        created: false,
      };
    }
    return {
      ok: false,
      code: 'COTIZACION_YA_CONVERTIDA',
      message: 'Esta cotizacion ya fue formalizada',
    };
  }
  const moneda = lineas[0]?.moneda || String(row.moneda ?? 'COP');
  if (moneda.toUpperCase() !== 'COP') {
    return {
      ok: false,
      code: 'MONEDA_NO_WOMPI',
      message: 'Wompi solo aplica a cotizaciones en COP',
    };
  }
  const impuestosIncluidos =
    (row as { impuestos_incluidos?: unknown }).impuestos_incluidos === true;
  const desglose = await desgloseDeLineas(supabase, lineas, {
    impuestosIncluidos,
    moneda,
  });
  const total = totalAPagar(desglose.total, row, lineas);
  if (!(total > 0)) {
    return { ok: false, code: 'TOTAL_INVALIDO', message: 'Total a pagar invalido' };
  }

  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  const telefono = String((row as { telefono?: string }).telefono ?? '').trim() || '0000000000';
  if (!email.includes('@')) {
    return { ok: false, code: 'SIN_EMAIL', message: 'Cotizacion sin email de cliente' };
  }

  const { nombre, apellido } = splitNombreApellido(String(row.nombre ?? 'Cliente'));
  const mercado = row.mercado === 'INTL' ? 'INTL' : 'CO';
  const pedidoId = crypto.randomUUID();
  const referenciaPasarela = String(opts?.referenciaPasarelaOverride ?? '').trim() || pedidoId;

  const porSlug = catalogo.porSlug;
  const itemsSnapshot = lineas.map(linea => {
    const producto = porSlug.get(linea.slug);
    return {
      producto_id: producto?.id ?? null,
      slug: linea.slug,
      familia_id: producto?.familia_id ?? null,
      nombre: linea.nombre || String(producto?.nombre_es ?? linea.slug),
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      moneda,
      precio_locked_cotizacion: true,
    };
  });

  const { data: clienteRow } = await supabase
    .from('clientes')
    .upsert(
      {
        email,
        nombre,
        apellido,
        telefono,
        institucion: row.empresa ?? null,
        tipo_cliente: row.empresa ? 'b2b' : 'b2c',
        consentimiento_datos: true,
        consentimiento_timestamp: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single();
  const clienteId = (clienteRow as { id?: string } | null)?.id ?? null;

  const { error: insertError } = await supabase.from('pedidos').insert({
    id: pedidoId,
    cliente_id: clienteId,
    solicitud_cotizacion_id: id,
    lead_comercial_id: row.lead_comercial_id ?? null,
    cliente: {
      nombre,
      apellido,
      email,
      telefono,
      institucion: row.empresa ?? null,
    },
    items: itemsSnapshot,
    subtotal: total,
    envio_total: 0,
    total,
    moneda,
    mercado,
    proveedor_pago: 'wompi',
    estado: 'pendiente',
    referencia_pasarela: referenciaPasarela,
    facturacion_electronica_solicitada: false,
    facturacion_electronica_estado: 'no_solicitada',
    consentimiento_datos: true,
    consentimiento_timestamp: new Date().toISOString(),
    metadata: {
      solicitud_cotizacion_id: id,
      lead_comercial_id: row.lead_comercial_id ?? null,
      origen: 'cotizacion',
      locale: row.locale === 'en' ? 'en' : 'es',
      precios_locked: true,
      metodo_pago: 'wompi',
      total_ofertado: total,
      numero_cotizacion: String(row.numero ?? '').trim() || null,
      condiciones: row.condiciones,
      attribution: {
        campaign: row.campaign ?? null,
        landing_path: row.landing_path ?? null,
        referrer: row.referrer ?? null,
        analytics_session_id: row.analytics_session_id ?? null,
        utm_source: row.utm_source ?? null,
        utm_medium: row.utm_medium ?? null,
        utm_campaign: row.utm_campaign ?? null,
        utm_content: row.utm_content ?? null,
        utm_term: row.utm_term ?? null,
      },
    },
  });

  if (insertError) {
    // Carrera: otro proceso insertó con la misma referencia (p.ej. webhook recovery).
    if (insertError.code === '23505' && opts?.referenciaPasarelaOverride) {
      const { data: porRef } = await supabase
        .from('pedidos')
        .select('id, total, moneda, estado')
        .eq('referencia_pasarela', referenciaPasarela)
        .maybeSingle();
      if (porRef?.id) {
        return {
          ok: true,
          pedidoId: String(porRef.id),
          total: Number(porRef.total) || total,
          moneda: String(porRef.moneda || moneda),
          created: false,
        };
      }
    }
    return {
      ok: false,
      code: 'PEDIDO_INSERT_ERROR',
      message: insertError.message ?? 'No se pudo crear el pedido',
    };
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const notasPrevias = String((row as { notas_internas?: string }).notas_internas ?? '').trim();
  const nota = `[${timestamp}] Cliente inicio pago Wompi. Pedido ${pedidoId.slice(0, 8)}.`;

  const { data: claimed, error: claimError } = await supabase
    .from('solicitudes_cotizacion')
    .update({
      estado: 'convertida',
      pedido_id: pedidoId,
      precio_total_ofertado: total,
      leida: true,
      notas_internas: notasPrevias ? `${notasPrevias}\n${nota}` : nota,
    })
    .eq('id', id)
    .in('estado', ['enviada', 'respondida'])
    .is('pedido_id', null)
    .select('id')
    .maybeSingle();

  if (claimError || !claimed) {
    await supabase.from('pedidos').delete().eq('id', pedidoId);
    return {
      ok: false,
      code: 'COTIZACION_YA_CONVERTIDA',
      message: claimError?.message ?? 'Esta cotizacion ya fue formalizada',
    };
  }

  return { ok: true, pedidoId, total, moneda, created: true };
}

/**
 * Resuelve una cotización formalizable por número de presupuesto (IME-Q-…).
 * Usado solo como recuperación de webhooks firmados con el bug pre-fix.
 */
export async function buscarCotizacionPorNumero(
  supabase: SupabaseLike,
  numero: string
): Promise<CotizacionOfertaRow | null> {
  const n = numero.trim();
  if (!n) return null;
  const { data, error } = await supabase
    .from('solicitudes_cotizacion')
    .select('*')
    .eq('numero', n)
    .in('estado', ['enviada', 'respondida', 'convertida'])
    .maybeSingle();
  if (error || !data) return null;
  return data as CotizacionOfertaRow;
}
