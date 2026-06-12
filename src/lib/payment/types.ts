/**
 * Tipos compartidos del checkout — usados por src/lib/carrito.ts al llamar a la
 * Edge Function crear-pago.
 *
 * La implementación real de PaymentGateway (WompiGateway/StripeGateway) vive en
 * supabase/functions/_shared/payment-gateway.ts — solo accesible con service_role.
 *
 * Regla crítica: el servidor recalcula siempre — el cliente NUNCA decide precios ni
 * estado de pago. precio_unitario aquí es solo lo que el cliente cree pagar; crear-pago
 * lo ignora y recalcula desde productos.precio en Supabase.
 */

export type PaymentProvider = 'wompi' | 'stripe'

export type Mercado = 'CO' | 'INTL'

export interface CheckoutItem {
  slug: string
  cantidad: number
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
  consentimiento_datos: boolean
}

export interface CheckoutResult {
  ok: boolean
  checkout_url?: string
  referencia?: string
  error?: string
}
