/**
 * Total a pagar y enlace Wompi de una cotización.
 * Las llaves se leen del entorno de la Edge Function y no se registran.
 *
 * REGLA: la `reference` de Wompi DEBE ser `pedidos.id` (= referencia_pasarela).
 * Nunca el número de cotización (IME-Q-…): webhook-wompi solo busca pedidos
 * por esa columna; si no hay fila marca el evento procesado y el cobro queda huérfano.
 */
import { buildWompiCheckoutUrl } from '../../../src/lib/wompi-checkout.ts';
import {
  desgloseCotizacion,
  type DesgloseCotizacion,
  type ProductoIva,
} from '../../../src/lib/cotizacion-iva.ts';
import type { CotizacionLineaOferta } from '../../../src/lib/cotizacion-oferta.ts';
import { esReferenciaPedidoUuid } from '../../../src/lib/pedido-referencia.ts';

type ProductosQuery = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[]
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export async function ivaProductosPorSlug(
  supabase: ProductosQuery,
  slugs: string[]
): Promise<Map<string, ProductoIva>> {
  const unicos = [...new Set(slugs.map(slug => slug.trim()).filter(Boolean))];
  const map = new Map<string, ProductoIva>();
  if (unicos.length === 0) return map;
  const { data, error } = await supabase
    .from('productos')
    .select('slug, tarifa_iva_pct, excluido_iva')
    .in('slug', unicos);
  if (error || !Array.isArray(data)) return map;
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as {
      slug?: unknown;
      tarifa_iva_pct?: number | string | null;
      excluido_iva?: boolean | null;
    };
    const slug = String(rec.slug ?? '').trim();
    if (!slug) continue;
    map.set(slug, {
      tarifa_iva_pct: rec.tarifa_iva_pct ?? null,
      excluido_iva: rec.excluido_iva === true,
    });
  }
  return map;
}

export async function desgloseDeLineas(
  supabase: ProductosQuery,
  lineas: Array<
    Pick<
      CotizacionLineaOferta,
      'precio_unitario' | 'cantidad' | 'slug' | 'moneda' | 'precio_pendiente_validar'
    > & { tratamiento_iva?: unknown }
  >,
  opts: { impuestosIncluidos: boolean; moneda: string }
): Promise<DesgloseCotizacion> {
  const productos = await ivaProductosPorSlug(
    supabase,
    lineas.map(linea => linea.slug)
  );
  return desgloseCotizacion(lineas, { ...opts, productos });
}

export async function enlaceWompiDeCotizacion(input: {
  /** Debe ser pedidos.id (= referencia_pasarela). Nunca el número IME-Q-…. */
  referencia: string;
  total: number;
  moneda: string;
  email?: string | null;
  nombre?: string | null;
  telefono?: string | null;
  redirectUrl: string;
}): Promise<{ url: string | null; error: string | null }> {
  if (String(input.moneda ?? 'COP').toUpperCase() !== 'COP') {
    return { url: null, error: null };
  }
  const referencia = input.referencia.trim();
  if (!referencia) {
    return { url: null, error: 'Falta la referencia del pedido para Wompi.' };
  }
  if (!esReferenciaPedidoUuid(referencia)) {
    return {
      url: null,
      error:
        'La referencia Wompi debe ser el UUID del pedido. No se firma el número de cotización.',
    };
  }
  const built = await buildWompiCheckoutUrl({
    publicKey: Deno.env.get('WOMPI_PUBLIC_KEY') ?? '',
    integritySecret: Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? '',
    reference: referencia,
    total: input.total,
    currency: 'COP',
    redirectUrl: input.redirectUrl,
    email: input.email?.trim() || undefined,
    fullName: input.nombre?.trim() || undefined,
    phone: input.telefono?.trim() || undefined,
  });
  if (!built.ok) return { url: null, error: built.error };
  return { url: built.url, error: null };
}

export function htmlBotonWompi(url: string | null, locale: 'es' | 'en'): string {
  if (!url) return '';
  const href = url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const label = locale === 'en' ? 'Pay with Wompi' : 'Pagar con Wompi';
  return `<p><a href="${href}" style="display:inline-block;padding:12px 20px;background:#005e60;color:#fff;text-decoration:none;border-radius:8px">${label}</a></p>`;
}

/**
 * CTA Wompi en correo/PDF: apunta a formalizar (crea pedido + firma checkout).
 * Nunca enlaza checkout.wompi.co con el número de cotización.
 */
export function htmlBotonWompiViaFormalizar(
  formalizarUrl: string | null | undefined,
  locale: 'es' | 'en'
): string {
  const url = String(formalizarUrl ?? '').trim();
  if (!url.startsWith('https://') && !url.startsWith('http://')) return '';
  return htmlBotonWompi(url, locale);
}
