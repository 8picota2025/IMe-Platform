/**
 * Classified IMEIA widget errors. `clase` maps to i18n `asesor.error_<clase>`.
 */

export type AsesorErrorClase =
  | 'rate_limited'
  | 'agent_unavailable'
  | 'agent_timeout'
  | 'agent_poll_timeout'
  | 'invoke_abort'
  | 'invoke_timeout'
  | 'missing_token'
  | 'siteverify_timeout'
  | 'turnstile_forbidden'
  | 'turnstile_not_configured'
  | 'turnstile_client'
  | 'session_forbidden'
  | 'supabase_missing'
  | 'invalid_payload'
  | 'generic';

export type ErrorAsesor = {
  tipo: 'rate_limited' | 'no_disponible' | 'verificacion' | 'error';
  clase: AsesorErrorClase;
  retryAfterSegundos?: number | null;
  codes?: string[];
  /** Existing agent turn to resume on retry instead of creating a new row. */
  turnId?: string;
};

export function asesorError(
  tipo: ErrorAsesor['tipo'],
  clase: AsesorErrorClase,
  extra?: { retryAfterSegundos?: number | null; codes?: string[]; turnId?: string }
): ErrorAsesor {
  return {
    tipo,
    clase,
    ...(extra?.retryAfterSegundos !== undefined
      ? { retryAfterSegundos: extra.retryAfterSegundos }
      : {}),
    ...(extra?.codes && extra.codes.length > 0 ? { codes: extra.codes.slice(0, 8) } : {}),
    ...(extra?.turnId ? { turnId: extra.turnId } : {}),
  };
}

const ASESOR_ERROR_COPY_FIELD: Record<AsesorErrorClase, string> = {
  rate_limited: 'limite',
  agent_unavailable: 'errorAgentUnavailable',
  agent_timeout: 'errorAgentTimeout',
  agent_poll_timeout: 'errorAgentPollTimeout',
  invoke_abort: 'errorInvokeAbort',
  invoke_timeout: 'errorInvokeTimeout',
  missing_token: 'errorMissingToken',
  siteverify_timeout: 'errorSiteverifyTimeout',
  turnstile_forbidden: 'errorTurnstileForbidden',
  turnstile_not_configured: 'errorTurnstileNotConfigured',
  turnstile_client: 'errorTurnstileClient',
  session_forbidden: 'errorSessionForbidden',
  supabase_missing: 'errorSupabaseMissing',
  invalid_payload: 'errorInvalidPayload',
  generic: 'error',
};

/** Pick UI copy for a classified asesor failure. Falls back to the tipo bucket. */
export function copyForAsesorError(error: ErrorAsesor, i18n: object): string {
  const bag = i18n as Record<string, string | undefined>;
  const field = ASESOR_ERROR_COPY_FIELD[error.clase];
  const specific = bag[field];
  const fallback =
    error.tipo === 'rate_limited'
      ? bag.limite
      : error.tipo === 'no_disponible'
        ? bag.noDisponible
        : error.tipo === 'verificacion'
          ? bag.verificacion
          : bag.error;
  let texto = (specific && specific.trim()) || fallback || bag.error || error.clase;
  if (error.codes && error.codes.length > 0) {
    texto = `${texto} (${error.codes.slice(0, 4).join(', ')})`;
  }
  return texto;
}
