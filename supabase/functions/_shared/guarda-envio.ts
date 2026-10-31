/**
 * Guarda de envío de cotizaciones (borrador 31-10-2026).
 * Bloquea (409) si: (a) condiciones/notas contienen "NO ENVIAR" (sin importar
 * mayúsculas, tildes ni espacios/guiones/puntos intermedios), o
 * (b) la cotización no tiene marca de aprobación (aprobado_por + aprobado_at).
 * La marca la pone Shoky (OK por número) o el paso de validación aprobado
 * (criterio de costeo + margen validados) vía RPC aprobar_cotizacion_envio.
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
  | { ok: false; code: 'NO_ENVIAR_MARCADO' | 'SIN_APROBACION'; message: string };

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
  const por = String(row.aprobado_por ?? '').trim();
  const at = String(row.aprobado_at ?? '').trim();
  if (!por || !at) {
    return {
      ok: false,
      code: 'SIN_APROBACION',
      message:
        'Falta la marca de aprobación (aprobado_por/aprobado_at). Requiere OK de Shoky o validación de costeo y margen aprobada.',
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
