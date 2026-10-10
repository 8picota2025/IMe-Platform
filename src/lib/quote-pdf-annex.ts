/**
 * Decide qué líneas de una cotización merecen página de anexo en el PDF.
 * Una página solo con el nombre (sin ficha, o con ficha sin descripción larga
 * ni especificaciones/aplicaciones) se omite.
 */

export interface QuoteAnnexDraft {
  nombre: string;
  /** Descripción larga sin HTML. Vacía cuando la ficha solo aporta características. */
  descripcion: string;
  /** Descripción corta, o el nombre si no hay corta. El PDF la usa como bajada cuando hay specs y no hay larga. */
  resumen: string;
  caracteristicas: string[];
}

export interface QuoteAnnexContentInput {
  nombre?: string | null;
  descripcion?: string | null;
  caracteristicas?: readonly string[] | null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparación laxa: el nombre repetido como descripción no es contenido de ficha. */
function comparable(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[.\s]+$/g, '');
}

export function caracteristicasDeFicha(especificaciones: unknown, aplicaciones: unknown): string[] {
  const caracteristicas: string[] = [];
  if (Array.isArray(especificaciones)) {
    for (const item of especificaciones) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const clave = String(rec.clave ?? '').trim();
      const valor = String(rec.valor ?? '').trim();
      if (clave && valor) caracteristicas.push(`${clave}: ${valor}`);
      else if (valor) caracteristicas.push(valor);
    }
  }
  if (Array.isArray(aplicaciones)) {
    for (const item of aplicaciones) {
      const texto = String(item ?? '').trim();
      if (texto) caracteristicas.push(texto);
    }
  }
  return caracteristicas;
}

/**
 * Hay contenido de ficha si existe al menos una característica (especificación o
 * aplicación) o una descripción larga distinta del nombre del producto.
 * La descripción corta, por sí sola, no abre página.
 */
export function quoteAnnexHasSpecContent(annex: QuoteAnnexContentInput): boolean {
  if ((annex.caracteristicas ?? []).some(item => String(item ?? '').trim().length > 0)) {
    return true;
  }
  const descripcion = comparable(String(annex.descripcion ?? ''));
  const nombre = comparable(String(annex.nombre ?? ''));
  return descripcion.length > 0 && descripcion !== nombre;
}

/**
 * `null` cuando la línea no debe generar anexo: sin producto de catálogo, o con
 * producto sin descripción larga útil y sin especificaciones ni aplicaciones.
 */
export function draftQuoteAnnex(input: {
  linked: boolean;
  nombreLinea: string;
  nombreProducto?: string | null;
  descripcionLarga?: string | null;
  descripcionCorta?: string | null;
  especificaciones?: unknown;
  aplicaciones?: unknown;
}): QuoteAnnexDraft | null {
  if (!input.linked) return null;
  const nombre =
    String(input.nombreProducto ?? '').trim() || input.nombreLinea.trim() || 'Producto';
  const descripcion = stripHtml(String(input.descripcionLarga ?? ''));
  const corta = stripHtml(String(input.descripcionCorta ?? ''));
  const caracteristicas = caracteristicasDeFicha(input.especificaciones, input.aplicaciones);
  if (!quoteAnnexHasSpecContent({ nombre, descripcion, caracteristicas })) return null;
  return {
    nombre,
    descripcion,
    resumen: corta || nombre,
    caracteristicas,
  };
}
