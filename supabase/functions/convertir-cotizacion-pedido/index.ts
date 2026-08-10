/**
 * Admin: convierte cotización ofertada en pedido pendiente + checkout URL.
 * Precios = los de la cotización (locked). Sin FE por defecto.
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
import { getPaymentGateway, type CheckoutItem, type Mercado } from '../_shared/payment-gateway.ts';
import {
  COTIZACION_ESTADOS_CLAIMABLES,
  calcularTotalOfertado,
  evaluateCotizacionConversionClaim,
  ofertaCompleta,
  parseLineasOferta,
  splitNombreApellido,
  type CotizacionOfertaRow,
} from '../../../src/lib/cotizacion-oferta.ts';

const ROLES = new Set(['owner', 'admin', 'ventas']);

interface Body {
  cotizacion_id?: string;
  mercado?: string;
  locale?: string;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  const auth = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
  if (!auth.ok) return unauthorized(origin);

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = (body.cotizacion_id ?? '').trim();
  if (!id) return badRequest('cotizacion_id requerido', origin);

  const { data, error } = await supabase
    .from('solicitudes_cotizacion')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);

  const row = data as CotizacionOfertaRow & {
    notas_internas?: string | null;
    telefono?: string | null;
    cliente_id?: string | null;
    lead_comercial_id?: string | null;
    campaign?: string | null;
    landing_path?: string | null;
    referrer?: string | null;
    analytics_session_id?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  };

  if (row.pedido_id || row.estado === 'convertida') {
    if (row.pedido_id) {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, checkout_url, estado')
        .eq('id', row.pedido_id)
        .maybeSingle();
      const p = pedido as { id: string; checkout_url?: string | null; estado?: string } | null;
      if (p?.checkout_url) {
        return new Response(
          JSON.stringify({
            ok: true,
            pedido_id: p.id,
            checkout_url: p.checkout_url,
            already_converted: true,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
          }
        );
      }
    }
    return errorResponse(
      { code: 'COTIZACION_YA_CONVERTIDA', message: 'La cotizacion ya fue convertida' },
      409,
      origin
    );
  }

  const lineas = parseLineasOferta(row.productos);
  const check = ofertaCompleta(lineas, row.condiciones);
  if (!check.ok) {
    return errorResponse(
      { code: check.error, message: 'Completa precios y condiciones antes de convertir' },
      422,
      origin
    );
  }

  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  const telefono = String(row.telefono ?? '').trim();
  if (!email.includes('@') || !telefono) {
    return errorResponse(
      {
        code: 'DATOS_CLIENTE_INCOMPLETOS',
        message: 'Email y telefono requeridos en la cotizacion',
      },
      422,
      origin
    );
  }

  const { nombre, apellido } = splitNombreApellido(String(row.nombre ?? 'Cliente'));
  const mercado: Mercado = body.mercado === 'INTL' || row.mercado === 'INTL' ? 'INTL' : 'CO';
  const locale = body.locale === 'en' || row.locale === 'en' ? 'en' : 'es';
  const moneda = lineas[0]?.moneda || (mercado === 'CO' ? 'COP' : 'USD');
  const total = calcularTotalOfertado(lineas);

  const slugs = lineas.map(l => l.slug);
  const { data: productos, error: prodErr } = await supabase
    .from('productos')
    .select('id, slug, nombre_es, nombre_en, activo, disponible, stock, familia_id, moneda')
    .in('slug', slugs);
  if (prodErr) return internalError(prodErr.message, origin);

  const porSlug = new Map(
    ((productos ?? []) as Array<Record<string, unknown>>).map(p => [String(p.slug), p])
  );

  const checkoutItems: CheckoutItem[] = [];
  const itemsSnapshot: Array<Record<string, unknown>> = [];

  for (const linea of lineas) {
    const producto = porSlug.get(linea.slug);
    if (!producto || producto.activo === false) {
      return errorResponse(
        { code: 'PRODUCTO_NO_DISPONIBLE', message: `Producto no disponible: ${linea.slug}` },
        400,
        origin
      );
    }
    if (producto.disponible === false) {
      return errorResponse(
        {
          code: 'PRODUCTO_NO_DISPONIBLE_TEMPORAL',
          message: `Producto temporalmente no disponible: ${linea.slug}`,
        },
        422,
        origin
      );
    }
    const nombreProducto =
      locale === 'en' && producto.nombre_en
        ? String(producto.nombre_en)
        : String(producto.nombre_es ?? linea.nombre);
    checkoutItems.push({
      producto_id: String(producto.id),
      nombre: nombreProducto,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      moneda,
    });
    itemsSnapshot.push({
      producto_id: producto.id,
      slug: linea.slug,
      familia_id: producto.familia_id ?? null,
      nombre: nombreProducto,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      moneda,
      precio_locked_cotizacion: true,
    });
  }

  const pedidoId = crypto.randomUUID();
  const proveedorFlow = mercado === 'CO' ? 'wompi' : 'stripe';

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
    proveedor_pago: proveedorFlow,
    estado: 'pendiente',
    referencia_pasarela: pedidoId,
    facturacion_electronica_solicitada: false,
    facturacion_electronica_estado: 'no_solicitada',
    consentimiento_datos: true,
    consentimiento_timestamp: new Date().toISOString(),
    metadata: {
      solicitud_cotizacion_id: id,
      lead_comercial_id: row.lead_comercial_id ?? null,
      origen: 'cotizacion_convertida',
      precios_locked: true,
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

  if (insertError) return internalError(`error creando pedido: ${insertError.message}`, origin);

  // Claim atomico ANTES del checkout live. Sin CAS, dos converts concurrentes
  // crean dos sesiones Wompi/Stripe pagables sobre la misma cotizacion.
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const nota = `[${timestamp}] Convertida a pedido ${pedidoId.slice(0, 8)}.`;
  const notasPrevias = String(row.notas_internas ?? '').trim();

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
    .in('estado', [...COTIZACION_ESTADOS_CLAIMABLES])
    .is('pedido_id', null)
    .select('id')
    .maybeSingle();

  const claimState = evaluateCotizacionConversionClaim({
    claimedId: (claimed as { id?: string } | null)?.id,
    claimErrorMessage: claimError?.message ?? null,
  });

  if (claimState !== 'claimed') {
    await supabase.from('pedidos').delete().eq('id', pedidoId);
    if (claimState === 'error') {
      return internalError(`error reservando cotizacion: ${claimError?.message}`, origin);
    }
    return errorResponse(
      { code: 'COTIZACION_YA_CONVERTIDA', message: 'La cotizacion ya fue convertida' },
      409,
      origin
    );
  }

  const gateway = getPaymentGateway(mercado);
  const resultado = await gateway.crearCheckout({
    items: checkoutItems,
    cliente: {
      nombre,
      apellido,
      email,
      telefono,
      ...(row.empresa ? { institucion: String(row.empresa) } : {}),
    },
    mercado,
    locale,
    referencia: pedidoId,
    total,
    moneda,
  });

  if (!resultado.ok) {
    await supabase
      .from('pedidos')
      .update({ estado: 'error_verificacion', metadata: { error: resultado.error } })
      .eq('id', pedidoId);
    return errorResponse(
      {
        code: 'GATEWAY_ERROR',
        message: 'No se pudo crear el checkout',
        details: resultado.error,
      },
      502,
      origin
    );
  }

  await supabase
    .from('pedidos')
    .update({ checkout_url: resultado.checkout_url ?? null })
    .eq('id', pedidoId);

  return new Response(
    JSON.stringify({
      ok: true,
      pedido_id: pedidoId,
      checkout_url: resultado.checkout_url,
      total,
      moneda,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  );
});
