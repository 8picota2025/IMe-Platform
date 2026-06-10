/**
 * Interfaces PaymentGateway para Edge Functions.
 * Implementaciones reales en F4: Wompi + Stripe.
 *
 * BLOQUEANTE_BACKEND: No implementar hasta F4.
 * REGLA: El servidor recalcula siempre los precios — el cliente NUNCA decide.
 */

// TODO_CLIENTE: Claves reales en variables de entorno de Supabase — jamás en código
// WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET
// STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

export type PaymentProvider = 'wompi' | 'stripe'
export type PaymentStatus = 'pending' | 'approved' | 'declined' | 'voided' | 'error'

export interface CheckoutRequest {
  items: Array<{
    producto_id: string
    nombre: string
    cantidad: number
    precio_unitario: number // Calculado server-side
    moneda: string
  }>
  cliente: {
    nombre: string
    apellido: string
    email: string
    telefono: string
  }
  mercado: 'CO' | 'INTL'
  referencia?: string
}

export interface CheckoutResult {
  ok: boolean
  checkout_url?: string
  referencia_pasarela?: string
  error?: string
}

/**
 * Interfaz de pasarela de pagos swappable.
 * Implementaciones: WompiGateway (F4), StripeGateway (F4).
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider
  crearCheckout(request: CheckoutRequest): Promise<CheckoutResult>
  verificarPago(referencia: string): Promise<PaymentStatus>
  validarWebhook(payload: string, signature: string): boolean
}
