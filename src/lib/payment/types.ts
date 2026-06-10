/**
 * Interfaces PaymentGateway — contratos sin implementación real.
 * Implementación real en F4: Wompi (Colombia) + Stripe (INTL).
 *
 * BLOQUEANTE_BACKEND: No implementar hasta F4.
 * Regla crítica: el servidor recalcula siempre — el cliente NUNCA decide precios ni estado de pago.
 */

export type PaymentProvider = 'wompi' | 'stripe'

export type PaymentStatus = 'pending' | 'approved' | 'declined' | 'voided' | 'error'

export type Mercado = 'CO' | 'INTL'

export interface CheckoutItem {
  producto_id: string
  slug: string
  nombre: string
  cantidad: number
  /** precio_unitario viene del servidor, no del cliente */
  precio_unitario: number
  moneda: string
}

export interface CheckoutRequest {
  items: CheckoutItem[]
  cliente: {
    nombre: string
    apellido: string
    email: string
    telefono: string
    institucion?: string
  }
  mercado: Mercado
  referencia?: string
}

export interface CheckoutResult {
  ok: boolean
  checkout_url?: string
  referencia_pasarela?: string
  error?: string
}

export interface PaymentEvent {
  proveedor_pago: PaymentProvider
  event_id: string
  referencia_pasarela: string
  estado: PaymentStatus
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
}

/**
 * Contrato de pasarela de pagos intercambiable.
 * Implementaciones reales: WompiGateway (F4), StripeGateway (F4).
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider
  /**
   * Crea una sesión de pago y devuelve la URL de checkout.
   * Llamado SOLO desde Edge Functions con service_role.
   */
  crearCheckout(request: CheckoutRequest): Promise<CheckoutResult>
  /**
   * Verifica el estado de un pago usando la referencia de pasarela.
   * Llamado SOLO desde Edge Functions con service_role.
   */
  verificarPago(referencia: string): Promise<PaymentStatus>
  /**
   * Valida la firma/secreto de un webhook entrante.
   */
  validarWebhook(payload: string, signature: string): boolean
}
