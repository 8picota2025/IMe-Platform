import type { CotizacionPayload } from './datos';
import { captureCommercialAttribution } from './commercial-attribution';
import { emitAnalyticsEvent } from './analytics';

export async function submitCotizacion(datos: CotizacionPayload): Promise<{
  ok: boolean;
  error?: string;
  emails?: { interno?: boolean; cliente?: boolean };
}> {
  const supabaseModule = await import('./supabase');
  if (supabaseModule.isSupabaseConfigured()) {
    const supabase = supabaseModule.getSupabaseClient()!;
    const { normalizarPayloadCotizacion, interpretarErrorEdgeFunction } =
      await import('./cotizacion-submit');
    const payload = normalizarPayloadCotizacion({
      ...captureCommercialAttribution(datos.campaign),
      ...datos,
    });
    if (!payload.mensaje.trim()) {
      return {
        ok: false,
        error:
          payload.locale === 'en'
            ? 'Message is required when no products are selected.'
            : 'El mensaje es obligatorio si no hay productos en la solicitud.',
      };
    }

    const { data, error } = await supabase.functions.invoke('registrar-cotizacion', {
      body: payload,
    });
    if (error) {
      return { ok: false, error: await interpretarErrorEdgeFunction(error, data) };
    }
    const result = data as {
      ok?: boolean;
      error?: string | { message?: string };
      emails?: { interno?: boolean; cliente?: boolean };
    } | null;
    if (!result?.ok) {
      const edgeError =
        typeof result?.error === 'string'
          ? result.error
          : result?.error?.message
            ? result.error.message
            : await interpretarErrorEdgeFunction(null, data);
      return { ok: false, error: edgeError };
    }
    emitAnalyticsEvent('quote_submit', {
      origin: datos.origen,
      has_products: Array.isArray(datos.productos) && datos.productos.length > 0,
      item_count: datos.productos?.reduce((acc, producto) => acc + producto.cantidad, 0) ?? 0,
      products: datos.productos?.map(producto => `${producto.slug}:${producto.cantidad}`).join(','),
    });
    return result.emails ? { ok: true, emails: result.emails } : { ok: true };
  }

  console.warn('[datos] submitCotizacion mock (sin Supabase):', datos.email);
  emitAnalyticsEvent('quote_submit', {
    origin: datos.origen,
    has_products: Array.isArray(datos.productos) && datos.productos.length > 0,
    item_count: datos.productos?.reduce((acc, producto) => acc + producto.cantidad, 0) ?? 0,
    products: datos.productos?.map(producto => `${producto.slug}:${producto.cantidad}`).join(','),
  });
  return { ok: true };
}
