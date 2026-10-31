/**
 * Escenario A — disponibilidad en formalización de cotizaciones.
 *
 * `crear-pago` (locked) y `convertir-cotizacion-pedido` ya rechazan
 * `activo=false` / `disponible=false`. `formalizar-cotizacion` y
 * `crearOReusarPedidoWompiDesdeCotizacion` deben aplicar la misma regla
 * sobre SKUs de catálogo: un proveedor que marca el producto no disponible
 * no debe seguir cobrando ni disparar dropship vía el enlace del correo.
 *
 * Líneas sin slug / slug ausente del catálogo (equipo individualizado) se
 * dejan pasar aquí: no hay señal Escenario A que aplicar.
 */

export interface ProductoDisponibilidadRow {
  slug: string;
  activo?: boolean | null;
  disponible?: boolean | null;
}

export type ValidacionDisponibilidad =
  | { ok: true }
  | {
      ok: false;
      code: 'PRODUCTO_NO_DISPONIBLE' | 'PRODUCTO_NO_DISPONIBLE_TEMPORAL';
      message: string;
      slug: string;
    };

/**
 * Valida líneas de oferta contra el catálogo vivo (solo SKUs encontrados).
 */
export function validarDisponibilidadLineasOferta(
  lineas: Array<{ slug?: string | null }>,
  productosPorSlug: Map<string, ProductoDisponibilidadRow>
): ValidacionDisponibilidad {
  for (const linea of lineas) {
    const slug = String(linea.slug ?? '').trim();
    if (!slug) continue;
    const producto = productosPorSlug.get(slug);
    if (!producto) continue;
    if (producto.activo === false) {
      return {
        ok: false,
        code: 'PRODUCTO_NO_DISPONIBLE',
        message: `Producto no disponible: ${slug}`,
        slug,
      };
    }
    if (producto.disponible === false) {
      return {
        ok: false,
        code: 'PRODUCTO_NO_DISPONIBLE_TEMPORAL',
        message: `Producto temporalmente no disponible: ${slug}`,
        slug,
      };
    }
  }
  return { ok: true };
}

/** Indexa filas de productos por slug (primera gana si hay duplicados). */
export function indexProductosPorSlug(
  rows: Array<ProductoDisponibilidadRow | null | undefined> | null | undefined
): Map<string, ProductoDisponibilidadRow> {
  const map = new Map<string, ProductoDisponibilidadRow>();
  for (const row of rows ?? []) {
    if (!row) continue;
    const slug = String(row.slug ?? '').trim();
    if (!slug || map.has(slug)) continue;
    map.set(slug, row);
  }
  return map;
}
