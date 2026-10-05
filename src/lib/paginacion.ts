/**
 * Ventana de paginación numerada: primera y última página, la actual y `radio` vecinas a cada
 * lado. Los huecos de una sola página se rellenan; los mayores se marcan con 'gap' (…).
 *
 * Por qué importa para SEO: con solo "anterior/siguiente" la página 14 queda a 14 clics de la
 * portada y Google tarda en descubrirla. Con enlaces numerados cualquier página queda a 2–3 clics.
 */
export type ItemPaginacion = number | 'gap';

export function ventanaPaginacion(page: number, pageCount: number, radio = 2): ItemPaginacion[] {
  if (!Number.isFinite(pageCount) || pageCount <= 1) return [];
  const actual = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);

  const paginas = new Set<number>([1, pageCount]);
  for (let p = actual - radio; p <= actual + radio; p += 1) {
    if (p >= 1 && p <= pageCount) paginas.add(p);
  }

  const ordenadas = [...paginas].sort((a, b) => a - b);
  const salida: ItemPaginacion[] = [];
  ordenadas.forEach((p, i) => {
    if (i > 0) {
      const previa = ordenadas[i - 1]!;
      if (p - previa === 2) salida.push(previa + 1);
      else if (p - previa > 2) salida.push('gap');
    }
    salida.push(p);
  });
  return salida;
}
