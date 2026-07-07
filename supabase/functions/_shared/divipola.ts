/**
 * Resuelve nombres libres de departamento/ciudad (capturados en checkout como
 * texto, `src/components/Carrito.astro`) contra los códigos DIVIPOLA oficiales
 * que exige Siigo en `address.city.state_code`/`city_code`. Nunca inventa un
 * código: si no hay match confiable, devuelve null y el caller debe tratarlo
 * como error (ver `resolverCliente` en `siigo-client.ts`).
 */

import { DIVIPOLA_MUNICIPIOS } from './divipola-municipios.ts';

export interface DivipolaMatch {
  stateCode: string;
  cityCode: string;
  departamento: string;
  municipio: string;
}

/**
 * Alias de uso común hacia el nombre oficial DIVIPOLA (ya normalizado). No es
 * un dato inventado: son equivalencias de uso cotidiano universalmente
 * aceptadas (ej. "Bogotá" para el Distrito Capital "BOGOTÁ, D.C."), no
 * códigos supuestos.
 */
const ALIAS_NORMALIZADO: Record<string, string> = {
  BOGOTA: 'BOGOTA DC',
};

function normalizar(value: string): string {
  const base = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (marcas diacríticas combinantes tras NFD)
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return ALIAS_NORMALIZADO[base] ?? base;
}

/** Índice normalizado, construido una sola vez por invocación de función. */
const INDEX = DIVIPOLA_MUNICIPIOS.map(([codDpto, dpto, codMpio, mpio]) => ({
  codDpto,
  dpto,
  dptoNorm: normalizar(dpto),
  codMpio,
  mpio,
  mpioNorm: normalizar(mpio),
}));

/**
 * Busca por (departamento, ciudad). Si el departamento no coincide con
 * ninguno conocido, se ignora y se busca solo por ciudad (ambiguo si hay
 * más de un municipio con ese nombre en departamentos distintos).
 */
export function resolverDivipola(
  departamentoTexto: string,
  ciudadTexto: string
): DivipolaMatch | null {
  const ciudadNorm = normalizar(ciudadTexto);
  const departamentoNorm = normalizar(departamentoTexto);
  if (!ciudadNorm) return null;

  const dptoConocido = INDEX.some(entry => entry.dptoNorm === departamentoNorm);

  const candidatos = INDEX.filter(entry => {
    if (entry.mpioNorm !== ciudadNorm) return false;
    if (dptoConocido) return entry.dptoNorm === departamentoNorm;
    return true;
  });

  if (candidatos.length !== 1) return null;

  const match = candidatos[0];
  return {
    stateCode: match.codDpto,
    cityCode: match.codMpio,
    departamento: match.dpto,
    municipio: match.mpio,
  };
}
