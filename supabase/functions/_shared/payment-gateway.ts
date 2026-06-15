/**
 * PaymentGateway swappable — implementaciones Bold.co (Colombia) y Stripe (internacional).
 *
 * REGLA CRÍTICA: El servidor recalcula siempre — el cliente NUNCA decide precios ni
 * estado de pago. crearCheckout/verificarPago/validarWebhook solo se llaman desde
 * Edge Functions con service_role.
 *
 * Variables de entorno (Supabase Edge Functions, nunca en cliente):
 * - BOLD_API_KEY — API key de Bold.co para crear checkouts y verificar pagos
 * - BOLD_WEBHOOK_SECRET — secreto para validar firmas de webhooks de Bold
 * - BOLD_API_BASE — (opcional) endpoint base API de Bold, default: https://api.bold.co/v1
 * - STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * - SITE_URL (origen público del sitio, p.ej. https://i-me.com.co) — usado para
 *   construir redirect URLs
 */

export type PaymentProvider = 'bold' | 'stripe'
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

/* ============================================================
   BoldGateway — Colombia, COP + USD + INTL
   ============================================================ */

const BOLD_API_BASE = Deno.env.get('BOLD_API_BASE') ?? 'https://api.bold.co/v1'

interface BoldTransaction {
  id: string
  status: string
  reference: string
  reference_code?: string
  amount?: number
  currency?: string
  created_at?: string
  updated_at?: string
}

interface BoldCheckoutResponse {
  data?: {
    id: string
    checkout_url?: string
    payment_link?: string
    transaction?: BoldTransaction
  }
  transaction?: BoldTransaction
}

function mapBoldEstado(status: string): PedidoEstado {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
    case 'APPROVED':
    case 'CAPTURED':
      return 'pagado'
    case 'DECLINED':
    case 'REJECTED':
    case 'FAILED':
      return 'rechazado'
    case 'VOIDED':
    case 'REVERSED':
    case 'CANCELED':
      return 'cancelado'
    case 'EXPIRED':
      return 'expirado'
    case 'PENDING':
    case 'PROCESSING':
    default:
      return 'pendiente'
  }
}

export class BoldGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'bold'

  async crearCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const apiKey = Deno.env.get('BOLD_API_KEY')
    if (!apiKey) {
      return {
        ok: false,
        error: 'BLOQUEANTE_BACKEND: BOLD_API_KEY no configurado',
      }
    }

    const amountInCents = Math.round(request.total * 100)
    const reference = request.referencia
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://i-me.com.co'

    const payload = {
      amount: amountInCents,
      currency: request.moneda,
      reference,
      description: `Pedido ${reference}`,
      customer: {
        email: request.cliente.email,
        name: `${request.cliente.nombre} ${request.cliente.apellido}`.trim(),
        phone: request.cliente.telefono,
      },
      redirect_url: `${siteUrl}/${request.cliente.email?.includes('@') ? 'es' : 'en'}/pago/exito?ref=${reference}`,
      items: request.items.map((item) => ({
        sku: item.producto_id,
        name: item.nombre,
        quantity: item.cantidad,
        price: Math.round(item.precio_unitario * 100),
      })),
    }

    try {
      const res = await fetch(`${BOLD_API_BASE}/payments/app-checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const json = (await res.json()) as BoldCheckoutResponse & {
        error?: { message?: string; code?: string }
      }

      if (!res.ok) {
        return {
          ok: false,
          error: json.error?.message ?? `Error Bold: ${res.status}`,
        }
      }

      const checkoutUrl = json.data?.checkout_url || json.data?.payment_link || json.data?.id
      if (!checkoutUrl) {
        return { ok: false, error: 'No checkout URL en respuesta Bold' }
      }

      return {
        ok: true,
        checkout_url: checkoutUrl,
        referencia_pasarela: reference,
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Error desconocido Bold',
      }
    }
  }

  async verificarPago(referenciaPasarela: string): Promise<VerificacionPago> {
    const apiKey = Deno.env.get('BOLD_API_KEY')
    if (!apiKey) return { estado: 'error_verificacion' }

    try {
      const res = await fetch(
        `${BOLD_API_BASE}/payments?reference=${encodeURIComponent(referenciaPasarela)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      )

      if (!res.ok) return { estado: 'error_verificacion' }

      const json = (await res.json()) as BoldCheckoutResponse
      const transaction = json.data?.transaction || json.transaction

      if (!transaction) return { estado: 'pendiente' }

      return { estado: mapBoldEstado(transaction.status), raw: transaction }
    } catch {
      return { estado: 'error_verificacion' }
    }
  }

  async validarWebhook(rawBody: string, req: Request): Promise<WebhookEvento | null> {
    const webhookSecret = Deno.env.get('BOLD_WEBHOOK_SECRET')
    if (!webhookSecret) return null

    const signature = req.headers.get('x-bold-signature')
    if (!signature) return null

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }

    const expectedSignature = await hmacSha256Hex(webhookSecret, rawBody)
    if (expectedSignature !== signature) return null

    const transaction = payload as BoldTransaction | undefined
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
  return mercado === 'CO' ? new BoldGateway() : new StripeGateway()
}

export function getGatewayByProvider(provider: PaymentProvider): PaymentGateway {
  return provider === 'bold' ? new BoldGateway() : new StripeGateway()
}
