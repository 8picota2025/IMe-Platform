import { t, type Locale } from '../i18n/utils';

export type AccionComercialTipo = 'carrito' | 'cotizacion' | 'consultar';

export interface ProductoComercial {
  precio?: number | null;
  disponible?: boolean;
}

export interface AccionComercial {
  tipo: AccionComercialTipo;
  label: string;
  tienePrecio: boolean;
}

export function getAccionComercial(producto: ProductoComercial, locale: Locale): AccionComercial {
  const tienePrecio =
    typeof producto.precio === 'number' && Number.isFinite(producto.precio) && producto.precio > 0;

  if (tienePrecio && producto.disponible !== false) {
    return { tipo: 'carrito', label: t(locale, 'carrito.agregar'), tienePrecio };
  }

  if (tienePrecio && producto.disponible === false) {
    return {
      tipo: 'consultar',
      label: t(locale, 'producto.cta_consultar_disponibilidad'),
      tienePrecio,
    };
  }

  return { tipo: 'cotizacion', label: t(locale, 'cotizacion_equipos.agregar'), tienePrecio };
}
