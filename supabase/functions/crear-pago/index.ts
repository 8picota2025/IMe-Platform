/**
 * Edge Function: crear-pago
 *
 * Checkout de consumibles. Recalcula precios server-side desde Supabase,
 * crea un pedido 'pendiente' y devuelve la URL de checkout hospedado
 * (Wompi para mercado CO, Stripe para INTL).
 *
 * REGLA RECTORA: el servidor recalcula siempre — el cliente nunca decide
 * precios ni estado de pago.
 *
 * Variables requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * WOMPI_PUBLIC_KEY/WOMPI_INTEGRITY_SECRET (mercado CO) o STRIPE_SECRET_KEY (mercado INTL),
 * SITE_URL.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts'
import { badRequest, errorResponse, internalError } from '../_shared/errors.ts'
import { getServerSupabase } from '../_shared/supabase-server.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { getPaymentGateway, type CheckoutItem, type Mercado } from '../_shared/payment-gateway.ts'

const MAX_ITEMS = 20
const MAX_CANTIDAD = 50

interface ItemRequest {
  slug?: string
  cantidad?: number
}

interface ClienteRequest {
  nombre?: string
  apellido?: string
  email?: string
  telefono?: string
  institucion?: string
}

interface CrearPagoRequest {
  items?: ItemRequest[]
  cliente?: ClienteRequest
  mercado?: string
  consentimiento_datos?: boolean
  locale?: string
}

interface ProductoRow {
  id: string
  slug: string
  nombre_es: string
  nombre_en: string | null
  precio: number | string | null
  moneda: string
  stock: number | null
  activo: boolean
  tipo_comercial: string
  fulfillment_mode: string
}

function obtenerIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  )
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsRes = handleCors(req)
  if (corsRes) return corsRes
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin)

  let body: CrearPagoRequest
  try {
    body = (await req.json()) as CrearPagoRequest
  } catch {
    return badRequest('JSON invalido', origin)
  }

  // ── Validación de input ──────────────────────────────────
  const items = body.items
  if (!Array.isArray(items) || items.length === 0) {
    return badRequest('items requerido (array no vacio)', origin)
  }
  if (items.length > MAX_ITEMS) {
    return badRequest(`maximo ${MAX_ITEMS} items por pedido`, origin)
  }
  for (const item of items) {
    if (typeof item.slug !== 'string' || !item.slug) {
      return badRequest('cada item requiere slug', origin)
    }
    if (
      typeof item.cantidad !== 'number' ||
      !Number.isInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > MAX_CANTIDAD
    ) {
      return badRequest(`cantidad invalida para ${item.slug}`, origin)
    }
  }

  const cliente = body.cliente
  if (
    !cliente ||
    typeof cliente.nombre !== 'string' ||
    !cliente.nombre.trim() ||
    typeof cliente.apellido !== 'string' ||
    !cliente.apellido.trim() ||
    typeof cliente.email !== 'string' ||
    !cliente.email.includes('@') ||
    typeof cliente.telefono !== 'string' ||
    !cliente.telefono.trim()
  ) {
    return badRequest('cliente invalido: nombre, apellido, email y telefono son requeridos', origin)
  }

  const mercado = body.mercado
  if (mercado !== 'CO' && mercado !== 'INTL') {
    return badRequest("mercado debe ser 'CO' o 'INTL'", origin)
  }

  if (body.consentimiento_datos !== true) {
    return badRequest('consentimiento_datos requerido', origin)
  }

  const locale = body.locale === 'en' ? 'en' : 'es'

  const supabase = getServerSupabase()
  const ip = obtenerIp(req)

  // ── Rate-limit por IP ────────────────────────────────────
  const limite = await checkRateLimit(supabase, `pago:ip:${ip}`)
  if (limite.limited) {
    return new Response(
      JSON.stringify({
        error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta mas tarde' },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin),
          ...(limite.retryAfterSeconds ? { 'Retry-After': String(limite.retryAfterSeconds) } : {}),
        },
      }
    )
  }

  // ── Recalcular desde Supabase (NUNCA confiar en el cliente) ──
  const slugs = items.map((i) => i.slug as string)
  const { data: productos, error: productosError } = await supabase
    .from('productos')
    .select(
      'id, slug, nombre_es, nombre_en, precio, moneda, stock, activo, tipo_comercial, fulfillment_mode'
    )
    .in('slug', slugs)

  if (productosError) {
    return internalError(`error consultando productos: ${productosError.message}`, origin)
  }

  const productosPorSlug = new Map<string, ProductoRow>(
    ((productos ?? []) as ProductoRow[]).map((p) => [p.slug, p])
  )

  const checkoutItems: CheckoutItem[] = []
  const itemsSnapshot: Array<Record<string, unknown>> = []
  let monedaComun: string | null = null

  for (const item of items) {
    const slug = item.slug as string
    const cantidad = item.cantidad as number
    const producto = productosPorSlug.get(slug)

    if (!producto || !producto.activo) {
      return errorResponse(
        { code: 'PRODUCTO_NO_DISPONIBLE', message: `Producto no disponible: ${slug}` },
        400,
        origin
      )
    }
    if (producto.tipo_comercial !== 'consumible') {
      return errorResponse(
        {
          code: 'PRODUCTO_NO_COMPRABLE',
          message: `${slug} es un equipo: requiere cotizacion, no checkout directo`,
        },
        400,
        origin
      )
    }
    const precio = producto.precio === null ? null : Number(producto.precio)
    if (precio === null || Number.isNaN(precio)) {
      return errorResponse(
        {
          code: 'SIN_PRECIO',
          message: `${slug} no tiene precio real configurado (TODO_CLIENTE). No puede comprarse.`,
        },
        409,
        origin
      )
    }
    if (producto.stock !== null && cantidad > producto.stock) {
      return errorResponse(
        { code: 'STOCK_INSUFICIENTE', message: `Stock insuficiente para ${slug}` },
        409,
        origin
      )
    }
    if (producto.fulfillment_mode === 'dropship') {
      const { data: proveedor, error: provError } = await supabase.rpc(
        'get_proveedor_para_producto',
        { p_producto_id: producto.id }
      )
      if (provError) {
        return internalError(`error consultando proveedor: ${provError.message}`, origin)
      }
      const proveedorRow = Array.isArray(proveedor) ? proveedor[0] : proveedor
      if (!proveedorRow) {
        // Si un item dropship no tiene proveedor asignado: bloquear checkout (ver F4 §notificar-proveedor)
        return errorResponse(
          {
            code: 'PROVEEDOR_NO_ASIGNADO',
            message: `${slug} no tiene proveedor dropship asignado. Checkout bloqueado — revisar en admin/Proveedores.`,
          },
          409,
          origin
        )
      }
    }

    if (monedaComun === null) monedaComun = producto.moneda
    if (monedaComun !== producto.moneda) {
      return badRequest('todos los items deben tener la misma moneda', origin)
    }

    const nombre = locale === 'en' && producto.nombre_en ? producto.nombre_en : producto.nombre_es
    checkoutItems.push({
      producto_id: producto.id,
      nombre,
      cantidad,
      precio_unitario: precio,
      moneda: producto.moneda,
    })
    itemsSnapshot.push({
      producto_id: producto.id,
      slug: producto.slug,
      nombre,
      cantidad,
      precio_unitario: precio,
      moneda: producto.moneda,
    })
  }

  const moneda = monedaComun ?? 'COP'
  const subtotal = checkoutItems.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0)
  const total = subtotal // Sin impuestos/envio en V1 — ver BACKLOG_V2

  const pedidoId = crypto.randomUUID()
  const proveedorPago = mercado === 'CO' ? 'wompi' : 'stripe'

  const { error: insertError } = await supabase.from('pedidos').insert({
    id: pedidoId,
    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email,
      telefono: cliente.telefono,
      institucion: cliente.institucion ?? null,
    },
    items: itemsSnapshot,
    subtotal,
    total,
    moneda,
    mercado,
    proveedor_pago: proveedorPago,
    estado: 'pendiente',
    referencia_pasarela: pedidoId,
    consentimiento_datos: true,
    consentimiento_timestamp: new Date().toISOString(),
    leida: false,
  })

  if (insertError) {
    return internalError(`error creando pedido: ${insertError.message}`, origin)
  }

  const gateway = getPaymentGateway(mercado as Mercado)
  const resultado = await gateway.crearCheckout({
    items: checkoutItems,
    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email,
      telefono: cliente.telefono,
      ...(cliente.institucion ? { institucion: cliente.institucion } : {}),
    },
    mercado: mercado as Mercado,
    referencia: pedidoId,
    total,
    moneda,
  })

  if (!resultado.ok) {
    await supabase
      .from('pedidos')
      .update({ estado: 'error_verificacion', metadata: { error: resultado.error } })
      .eq('id', pedidoId)

    return errorResponse(
      { code: 'GATEWAY_ERROR', message: 'No se pudo crear el checkout', details: resultado.error },
      502,
      origin
    )
  }

  await supabase
    .from('pedidos')
    .update({ checkout_url: resultado.checkout_url ?? null })
    .eq('id', pedidoId)

  return new Response(
    JSON.stringify({ ok: true, checkout_url: resultado.checkout_url, referencia: pedidoId }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    }
  )
})
