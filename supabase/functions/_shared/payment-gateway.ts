/**
 * PaymentGateway swappable — implementaciones Wompi (Colombia/COP) y Stripe (internacional).
 *
 * REGLA CRÍTICA: El servidor recalcula siempre — el cliente NUNCA decide precios ni
 * estado de pago. crearCheckout/verificarPago/validarWebhook solo se llaman desde
 * Edge Functions con service_role.
 *
 * Variables de entorno (Supabase Edge Functions, nunca en cliente):
 * - WOMPI_PUBLIC_KEY — llave pública Wompi (usada en URL de checkout hospedado)
 * - WOMPI_PRIVATE_KEY — llave privada Wompi (autenticación API y verificación server-side)
 * - WOMPI_INTEGRITY_SECRET — secreto de integridad para firmar referencias (checkout)
 * - WOMPI_EVENTS_SECRET — secreto para validar firmas de webhooks/eventos de Wompi
 * - WOMPI_API_BASE — (opcional) endpoint base API, default: https://production.wompi.co/v1
 * - STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * - SITE_URL (origen público del sitio, p.ej. https://i-me.com.co) — usado para redirect URLs
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
  locale?: 'es' | 'en'
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
   WompiGateway — Colombia, COP
   Docs: https://docs.wompi.co
   ============================================================ */

const WOMPI_API_BASE = Deno.env.get('WOMPI_API_BASE') ?? 'https://production.wompi.co/v1'
const WOMPI_CHECKOUT_BASE = 'https://checkout.wompi.co/p/'

interface WompiTransaction {
  id: string
  status: string
  reference: string
  amount_in_cents: number
  currency: string
  payment_method_type?: string
  created_at?: string
  updated_at?: string
}

interface WompiApiResponse {
  data?: WompiTransaction | WompiTransaction[]
  meta?: Record<string, unknown>
  error?: { type?: string; messages?: Record<string, unknown> }
}

function mapWompiEstado(status: string): PedidoEstado {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return 'pagado'
    case 'DECLINED':
    case 'ERROR':
      return 'rechazado'
    case 'VOIDED':
      return 'cancelado'
    case 'PENDING':
    default:
      return 'pendiente'
  }
}

/**
 * Calcula el checksum de integridad para el Web Checkout de Wompi.
 * SHA256( reference + amount_in_cents + currency + integrity_secret )
 */
async function wompiIntegrityHash(
  reference: string,
  amountInCents: number,
  currency: string,
  integritySecret: string
): Promise<string> {
  const data = `${reference}${amountInCents}${currency}${integritySecret}`
  const enc = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(data))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Valida la firma de un evento Wompi.
 * SHA256( concatenación de valores de signature.properties + events_secret )
 */
async function wompiEventoHash(
  payload: Record<string, unknown>,
  eventsSecret: string
): Promise<string> {
  const sig = payload['signature'] as { properties?: string[]; checksum?: string } | undefined
  const properties = sig?.properties ?? []
  const event = payload['data'] as Record<string, unknown> | undefined

  const values = properties.map((prop) => {
    const parts = prop.split('.')
    let cur: unknown = event
    for (const part of parts) {
      cur = (cur as Record<string, unknown> | undefined)?.[part]
    }
    return cur ?? ''
  })

  const data = values.join('') + eventsSecret
  const enc = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(data))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export class WompiGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'wompi'

  /**
   * Genera la URL del Web Checkout hospedado de Wompi.
   * No requiere llamada API — construye la URL con firma de integridad.
   */
  async crearCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY')
    const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET')
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://i-me.com.co'

    if (!publicKey) {
      return { ok: false, error: 'BLOQUEANTE_BACKEND: WOMPI_PUBLIC_KEY no configurado' }
    }
    if (!integritySecret) {
      return { ok: false, error: 'BLOQUEANTE_BACKEND: WOMPI_INTEGRITY_SECRET no configurado' }
    }

    const amountInCents = Math.round(request.total * 100)
    const currency = request.moneda // COP
    const reference = request.referencia
    const locale = request.locale === 'en' ? 'en' : 'es'
    const redirectPath = locale === 'en' ? '/en/payment/result' : '/es/pago/resultado'
    const redirectUrl = `${siteUrl}${redirectPath}?ref=${reference}`

    const integrityHash = await wompiIntegrityHash(
      reference,
      amountInCents,
      currency,
      integritySecret
    )

    const params = new URLSearchParams({
      'public-key': publicKey,
      currency,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': integrityHash,
      'redirect-url': redirectUrl,
      'customer-data:email': request.cliente.email,
      'customer-data:full-name': `${request.cliente.nombre} ${request.cliente.apellido}`.trim(),
      'customer-data:phone-number': request.cliente.telefono,
    })

    return {
      ok: true,
      checkout_url: `${WOMPI_CHECKOUT_BASE}?${params.toString()}`,
      referencia_pasarela: reference,
    }
  }

  /**
   * Verifica el estado real de una transacción contra la API de Wompi (server-side).
   * Busca por referencia — Wompi puede tener múltiples intentos para la misma referencia;
   * se toma el más reciente con estado APPROVED si existe.
   */
  async verificarPago(referenciaPasarela: string): Promise<VerificacionPago> {
    const privateKey = Deno.env.get('WOMPI_PRIVATE_KEY')
    if (!privateKey) return { estado: 'error_verificacion' }

    try {
      const res = await fetch(
        `${WOMPI_API_BASE}/transactions?reference=${encodeURIComponent(referenciaPasarela)}`,
        {
          headers: { Authorization: `Bearer ${privateKey}` },
        }
      )

      if (!res.ok) return { estado: 'error_verificacion' }

      const json = (await res.json()) as WompiApiResponse
      const transactions = Array.isArray(json.data) ? json.data : json.data ? [json.data] : []

      if (transactions.length === 0) return { estado: 'pendiente' }

      // Prioridad: APPROVED > cualquier otro
      const approved = transactions.find((t) => t.status?.toUpperCase() === 'APPROVED')
      const latest = approved ?? transactions[transactions.length - 1]

      return { estado: mapWompiEstado(latest!.status), raw: latest }
    } catch {
      return { estado: 'error_verificacion' }
    }
  }

  /**
   * Valida la firma del evento Wompi.
   * Wompi envía `signature.checksum` en el body; se recalcula con los valores
   * de `signature.properties` concatenados más WOMPI_EVENTS_SECRET.
   */
  async validarWebhook(rawBody: string, _req: Request): Promise<WebhookEvento | null> {
    const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET')
    if (!eventsSecret) return null

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return null
    }

    const sig = payload['signature'] as { checksum?: string } | undefined
    if (!sig?.checksum) return null

    const expectedChecksum = await wompiEventoHash(payload, eventsSecret)
    if (expectedChecksum !== sig.checksum) return null

    const eventId = payload['event'] as string | undefined
    const dataObj = payload['data'] as { transaction?: WompiTransaction } | undefined
    const transaction = dataObj?.transaction

    if (!eventId || !transaction?.reference) return null

    return {
      event_id: `${eventId}:${transaction.id ?? transaction.reference}`,
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
