import { t, type Locale } from '../i18n/utils';
import { isPurchasable, type CommerceProductSignals } from './commerce-policy';
import { tienePrecioPublico } from './format';

export type AccionComercialTipo = 'carrito' | 'cotizacion' | 'consultar';

export interface ProductoComercial extends CommerceProductSignals {
  precio?: number | null | undefined;
  disponible?: boolean;
}

export interface AccionComercial {
  tipo: AccionComercialTipo;
  label: string;
  tienePrecio: boolean;
}

/**
 * CTA de UI derivado de la política única `isPurchasable`.
 * Con precio pero no comprable ahora (stock/disponible) → consultar.
 * Sin precio → cotización.
 */
export function getAccionComercial(producto: ProductoComercial, locale: Locale): AccionComercial {
  const tienePrecio = tienePrecioPublico(producto.precio);
  const purchase = isPurchasable(producto, { quantity: 1 });

  if (purchase.ok) {
    return { tipo: 'carrito', label: t(locale, 'carrito.agregar'), tienePrecio };
  }

  if (tienePrecio) {
    return {
      tipo: 'consultar',
      label: t(locale, 'producto.cta_consultar_disponibilidad'),
      tienePrecio,
    };
  }

  return { tipo: 'cotizacion', label: t(locale, 'cotizacion_equipos.agregar'), tienePrecio };
}
