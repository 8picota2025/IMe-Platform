/**
 * PaymentGateway swappable — implementaciones Wompi (Colombia) y Stripe (internacional).
 *
 * REGLA CRÍTICA: El servidor recalcula siempre — el cliente NUNCA decide precios ni
 * estado de pago. crearCheckout/verificarPago/validarWebhook solo se llaman desde
 * Edge Functions con service_role.
 *
 * Variables de entorno (Supabase Edge Functions, nunca en cliente):
 * - WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET
 * - WOMPI_INTEGRITY_SECRET (TODO_CLIENTE: "secreto de integridad" del dashboard Wompi,
 *   distinto de WOMPI_PRIVATE_KEY — necesario para firmar el Web Checkout hospedado)
 * - STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * - SITE_URL (origen público del sitio, p.ej. https://i-me.com.co) — usado para
 *   construir redirect-url/success_url/cancel_url
 */

export type PaymentProvider = 'wompi' | 'stripe'
export type Mercado = 'CO' | 'INTL'

/**
 * Estados internos de pedido (sección 2 del prompt F4).
 */
export type PedidoEstado =
  | 'pendiente'
  | 'pagado'
  | 'rechazado'
  | 'expirado'
  | 'cancelado'
  | 'reembolsado'
  | 'error_verificacion'

export interface CheckoutItem {
  producto_id: string
  nombre: string
  cantidad: number
  /** Calculado server-side desde productos.precio — nunca confiar en el cliente */
  precio_unitario: number
  moneda: string
}

export interface CheckoutCliente {
  nombre: string
  apellido: string
  email: string
  telefono: string
  institucion?: string
}

export interface CheckoutRequest {
  items: CheckoutItem[]
  cliente: CheckoutCliente
  mercado: Mercado
  /** Referencia única del pedido (pedidos.id) — usada como reference/client_reference_id */
  referencia: string
  /** Total recalculado server-side */
  total: number
  moneda: string
}

export interface CheckoutResult {
  ok: boolean
  checkout_url?: string
  referencia_pasarela?: string
  error?: string
}

export interface VerificacionPago {
  estado: PedidoEstado
  raw?: unknown
}

export interface WebhookEvento {
  event_id: string
  referencia_pasarela: string
  payload: Record<string, unknown>
}

/**
 * Interfaz de pasarela de pagos intercambiable.
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider
  /** Crea una sesión de pago hospedada y devuelve la URL de checkout. */
  crearCheckout(request: CheckoutRequest): Promise<CheckoutResult>
  /** Consulta el estado real del pago contra el proveedor (server-side). */
  verificarPago(referenciaPasarela: string): Promise<VerificacionPago>
  /**
   * Valida firma/integridad de un webhook entrante y extrae event_id + referencia.
   * Devuelve null si la firma no es válida o falta configuración.
   */
  validarWebhook(rawBody: string, req: Request): Promise<WebhookEvento | null>
}

/* ============================================================
   Helpers criptográficos (Web Crypto API, disponible en Deno)
   ============================================================ */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256Hex(key: string, input: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(input))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Navega un path tipo "transaction.id" dentro de un objeto, devuelve '' si no existe. */
function getNestedValue(obj: unknown, path: string): string {
  let current: unknown = obj
  for (const part of path.split('.')) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return ''
    }
  }
  return current === undefined || current === null ? '' : String(current)
}

/* ============================================================
   WompiGateway — Colombia, COP
   ============================================================ */

const WOMPI_API_BASE = Deno.env.get('WOMPI_API_BASE') ?? 'https://api.wompi.co/v1'
const WOMPI_CHECKOUT_BASE = Deno.env.get('WOMPI_CHECKOUT_BASE') ?? 'https://checkout.wompi.co/p/'

interface WompiTransaction {
  id: string
  status: string
  reference: string
  created_at?: string
}

interface WompiTransactionsResponse {
  data?: WompiTransaction[]
}

function mapWompiEstado(status: string): PedidoEstado {
  switch (status) {
    case 'APPROVED':
      return 'pagado'
    case 'DECLINED':
      return 'rechazado'
    case 'VOIDED':
      return 'cancelado'
    case 'ERROR':
      return 'error_verificacion'
    case 'PENDING':
    default:
      return 'pendiente'
  }
}

export class WompiGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'wompi'

  async crearCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY')
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET')
    if (!publicKey || !integritySecret) {
      return {
        ok: false,
        error: 'BLOQUEANTE_BACKEND: WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET no configurados',
      }
    }
    if (request.moneda !== 'COP') {
      return { ok: false, error: `Wompi solo soporta COP, recibido ${request.moneda}` }
    }

    const amountInCents = Math.round(request.total * 100)
    const reference = request.referencia
    const signature = await sha256Hex(
      `${reference}${amountInCents}${request.moneda}${integritySecret}`
    )

    const siteUrl = Deno.env.get('SITE_URL')
    const params = new URLSearchParams({
      'public-key': publicKey,
      currency: request.moneda,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': signature,
      'customer-data:email': request.cliente.email,
      'customer-data:full-name': `${request.cliente.nombre} ${request.cliente.apellido}`.trim(),
      'customer-data:phone-number': request.cliente.telefono,
    })
    if (siteUrl) {
      params.set('redirect-url', `${siteUrl}/es/pago/exito?ref=${reference}`)
    }

    return {
      ok: true,
      checkout_url: `${WOMPI_CHECKOUT_BASE}?${params.toString()}`,
      referencia_pasarela: reference,
    }
  }

  async verificarPago(referenciaPasarela: string): Promise<VerificacionPago> {
    const privateKey = Deno.env.get('WOMPI_PRIVATE_KEY')
    if (!privateKey) return { estado: 'error_verificacion' }

    try {
      const res = await fetch(
        `${WOMPI_API_BASE}/transactions?reference=${encodeURIComponent(referenciaPasarela)}`,
        { headers: { Authorization: `Bearer ${privateKey}` } }
      )
      if (!res.ok) return { estado: 'error_verificacion' }
      const json = (await res.json()) as WompiTransactionsResponse
      const transacciones = Array.isArray(json.data) ? json.data : []
      if (transacciones.length === 0) return { estado: 'pendiente' }

      const masReciente = transacciones.reduce((a, b) =>
        new Date(b.created_at ?? 0).getTime() > new Date(a.created_at ?? 0).getTime() ? b : a
      )
      return { estado: mapWompiEstado(masReciente.status), raw: masReciente }
    } catch {
      return { estado: 'error_verificacion' }
    }
  }

  async validarWebhook(rawBody: string, _req: Request): Promise<WebhookEvento | null> {
    const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET')
    if (!eventsSecret) return null

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }

    const signature = payload['signature'] as
      | { checksum?: string; properties?: string[] }
      | undefined
    const properties = signature?.properties
    const checksum = signature?.checksum
    const timestamp = payload['timestamp']
    if (!Array.isArray(properties) || !checksum || timestamp === undefined) return null

    const data = payload['data']
    const valores = properties.map((path) => getNestedValue(data, path)).join('')
    const esperado = await sha256Hex(`${valores}${timestamp}${eventsSecret}`)
    if (esperado.toLowerCase() !== String(checksum).toLowerCase()) return null

    const transaction = (data as Record<string, unknown> | undefined)?.['transaction'] as
      | WompiTransaction
      | undefined
    if (!transaction?.id || !transaction?.reference) return null

    return {
      event_id: String(transaction.id),
      referencia_pasarela: String(transaction.reference),
      payload,
    }
  }
}

/* ============================================================
   StripeGateway — Internacional
   ============================================================ */

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

interface StripeCheckoutSession {
  id: string
  url?: string
  status?: string
  payment_status?: string
  client_reference_id?: string | null
}

function mapStripeEstado(session: StripeCheckoutSession): PedidoEstado {
  if (session.status === 'expired') return 'expirado'
  switch (session.payment_status) {
    case 'paid':
    case 'no_payment_required':
      return 'pagado'
    case 'unpaid':
    default:
      return 'pendiente'
  }
}

export class StripeGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'stripe'

  async crearCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const siteUrl = Deno.env.get('SITE_URL')
    if (!secretKey) {
      return { ok: false, error: 'BLOQUEANTE_BACKEND: STRIPE_SECRET_KEY no configurado' }
    }
    if (!siteUrl) {
      return { ok: false, error: 'BLOQUEANTE_BACKEND: SITE_URL no configurado' }
    }

    const body = new URLSearchParams()
    body.set('mode', 'payment')
    body.set('client_reference_id', request.referencia)
    body.set('customer_email', request.cliente.email)
    body.set('success_url', `${siteUrl}/en/payment/success?ref=${request.referencia}`)
    body.set('cancel_url', `${siteUrl}/en/payment/failure?ref=${request.referencia}`)

    request.items.forEach((item, i) => {
      body.set(`line_items[${i}][quantity]`, String(item.cantidad))
      body.set(`line_items[${i}][price_data][currency]`, item.moneda.toLowerCase())
      body.set(
        `line_items[${i}][price_data][unit_amount]`,
        String(Math.round(item.precio_unitario * 100))
      )
      body.set(`line_items[${i}][price_data][product_data][name]`, item.nombre)
    })

    try {
      const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      const json = (await res.json()) as StripeCheckoutSession & {
        error?: { message?: string }
      }
      if (!res.ok) {
        return { ok: false, error: json.error?.message ?? 'Error creando sesion Stripe' }
      }
      return { ok: true, checkout_url: json.url, referencia_pasarela: json.id }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }

  async verificarPago(referenciaPasarela: string): Promise<VerificacionPago> {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) return { estado: 'error_verificacion' }

    try {
      const res = await fetch(
        `${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(referenciaPasarela)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      )
      if (!res.ok) return { estado: 'error_verificacion' }
      const json = (await res.json()) as StripeCheckoutSession
      return { estado: mapStripeEstado(json), raw: json }
    } catch {
      return { estado: 'error_verificacion' }
    }
  }

  async validarWebhook(rawBody: string, req: Request): Promise<WebhookEvento | null> {
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const header = req.headers.get('stripe-signature')
    if (!secret || !header) return null

    const parts: Record<string, string> = {}
    for (const kv of header.split(',')) {
      const [k, v] = kv.split('=')
      if (k && v) parts[k] = v
    }
    const timestamp = parts['t']
    const v1 = parts['v1']
    if (!timestamp || !v1) return null

    const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
    if (expected !== v1) return null

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }
    const dataObject = payload['data'] as { object?: StripeCheckoutSession } | undefined
    const session = dataObject?.object
    const eventId = payload['id']
    if (!eventId || !session?.id) return null

    return {
      event_id: String(eventId),
      referencia_pasarela: String(session.client_reference_id ?? session.id),
      payload,
    }
  }
}

/* ============================================================
   Selección de gateway
   ============================================================ */

export function getPaymentGateway(mercado: Mercado): PaymentGateway {
  return mercado === 'CO' ? new WompiGateway() : new StripeGateway()
}

export function getGatewayByProvider(provider: PaymentProvider): PaymentGateway {
  return provider === 'wompi' ? new WompiGateway() : new StripeGateway()
}
