/**
 * Datos de confianza de una ficha: solo lo que ya está en especificaciones.
 * INVIMA y garantía se omiten si la ficha no los trae.
 */
import type { EspecificacionItem } from './especificaciones';

export interface DatoConfianza {
  clave: string;
  valor: string;
}

export function datosConfianzaProducto(especificaciones: EspecificacionItem[]): {
  invima: DatoConfianza[];
  garantia: DatoConfianza[];
} {
  const invima: DatoConfianza[] = [];
  const garantia: DatoConfianza[] = [];
  const vistos = new Set<string>();

  for (const item of especificaciones) {
    const texto = `${item.grupo ?? ''} ${item.clave} ${item.valor}`;
    const firma = `${item.clave}::${item.valor}`;
    if (vistos.has(firma)) continue;
    if (/invima/i.test(texto)) {
      vistos.add(firma);
      invima.push({ clave: item.clave, valor: item.valor });
      continue;
    }
    if (/garant[ií]a|warrant/i.test(`${item.grupo ?? ''} ${item.clave}`)) {
      vistos.add(firma);
      garantia.push({ clave: item.clave, valor: item.valor });
    }
  }

  return { invima, garantia };
}

/**
 * Capacidad publicada en la ficha. Solo entra si la etiqueta es de capacidad
 * o el valor ya trae litros o STU. No cuenta dimensiones ni textos de función.
 */
export function capacidadesPublicadas(especificaciones: EspecificacionItem[]): DatoConfianza[] {
  return especificaciones
    .filter(item => {
      const etiqueta = `${item.grupo ?? ''} ${item.clave}`;
      if (/capacidad|volumen|\bstu\b/i.test(etiqueta)) return true;
      return /\d[\d.,]*\s*litros|\bstu\b/i.test(item.valor);
    })
    .map(item => ({ clave: item.clave, valor: item.valor }));
}
