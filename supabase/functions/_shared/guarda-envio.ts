/**
 * Guarda de envío de cotizaciones.
 * Bloquea (409) solo si condiciones/notas contienen "NO ENVIAR" (sin importar
 * mayúsculas, tildes ni espacios/guiones/puntos intermedios).
 * La aprobación previa (aprobado_por / aprobado_at) ya no es requisito de envío
 * (orden del dueño, 2026-11-20): un borrador puede enviarse sin esa marca.
 */
export function normalizarTexto(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

const NO_ENVIAR_RE = /\bNO[\s._\-:]*ENVIA(R|RLA|RLO)?\b/;

export function contieneNoEnviar(...textos: unknown[]): boolean {
  return textos.some(t => NO_ENVIAR_RE.test(normalizarTexto(t)));
}

export type BloqueoEnvio =
  | { ok: true }
  | { ok: false; code: 'NO_ENVIAR_MARCADO'; message: string };

export function verificarEnvioPermitido(row: Record<string, unknown>): BloqueoEnvio {
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  if (
    contieneNoEnviar(
      row.condiciones,
      row.condiciones_en,
      row.notas_internas,
      row.notas,
      meta.nota_envio,
      meta.notas
    )
  ) {
    return {
      ok: false,
      code: 'NO_ENVIAR_MARCADO',
      message: 'La cotización está marcada "NO ENVIAR". Quita la marca solo con OK de Shoky.',
    };
  }
  return { ok: true };
}

/** Solo la marca "NO ENVIAR" (para flujos que no son el envío de la oferta: pedidos, formalización, catálogo). */
export function verificarNoEnviar(row: Record<string, unknown> | null | undefined): BloqueoEnvio {
  if (!row) return { ok: true };
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  if (contieneNoEnviar(row.condiciones, row.condiciones_en, row.notas_internas, row.mensaje, meta.nota_envio, meta.notas)) {
    return { ok: false, code: 'NO_ENVIAR_MARCADO', message: 'Marcado "NO ENVIAR": no se envía correo al cliente.' };
  }
  return { ok: true };
}
