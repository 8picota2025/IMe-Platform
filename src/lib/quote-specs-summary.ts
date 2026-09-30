/**
 * Resumen de especificaciones de una línea de oferta: texto corto, editable por el comercial,
 * que viaja en `CotizacionLineaOferta.notas` y llega al cliente en el PDF y el email.
 */

export const RESUMEN_ESPECIFICACIONES_MAX = 5;

function texto(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Hasta `max` líneas «Clave: valor»; si faltan especificaciones, completa con aplicaciones. */
export function resumenEspecificaciones(
  especificaciones: unknown,
  aplicaciones?: unknown,
  max = RESUMEN_ESPECIFICACIONES_MAX
): string {
  const salida: string[] = [];
  if (Array.isArray(especificaciones)) {
    for (const item of especificaciones) {
      if (salida.length >= max) break;
      if (!item || typeof item !== 'object') continue;
      const fila = item as Record<string, unknown>;
      const clave = texto(fila.clave);
      const valor = texto(fila.valor);
      if (clave && valor) salida.push(`${clave}: ${valor}`);
      else if (valor) salida.push(valor);
    }
  }
  if (Array.isArray(aplicaciones)) {
    for (const item of aplicaciones) {
      if (salida.length >= max) break;
      const aplicacion = texto(item);
      if (aplicacion) salida.push(aplicacion);
    }
  }
  return salida.join('\n');
}

/** Líneas del resumen ya limpias, para pintarlas en PDF/email. */
export function lineasDeResumen(notas: unknown, max = 6): string[] {
  if (typeof notas !== 'string') return [];
  return notas
    .split(/\r?\n/)
    .map(linea => linea.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, max);
}
