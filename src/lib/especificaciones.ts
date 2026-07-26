/**
 * Normalize product specification rows for display.
 * Legacy catalog imports often use clave="Característica" with "Param: value"
 * packed into valor — split those for a usable Parámetro column.
 */

export interface EspecificacionItem {
  clave: string;
  valor: string;
  grupo?: string;
}

const CLAVE_GENERICA = /^(caracter[ií]stica|feature|spec|specification)$/i;

export function normalizarEspecificaciones(raw: unknown[]): EspecificacionItem[] {
  return raw.flatMap((item): EspecificacionItem[] => {
    if (!item || typeof item !== 'object') return [];
    const obj = item as Record<string, unknown>;
    if (typeof obj.clave !== 'string' || typeof obj.valor !== 'string') return [];

    let clave = obj.clave.trim();
    let valor = obj.valor.trim();
    const grupo = typeof obj.grupo === 'string' ? obj.grupo : undefined;

    if (CLAVE_GENERICA.test(clave)) {
      const match = valor.match(/^([^:]{1,80}):\s+(.+)$/s);
      if (match) {
        clave = match[1]!.trim();
        valor = match[2]!.trim();
      }
    }

    return [{ clave, valor, ...(grupo ? { grupo } : {}) }];
  });
}
