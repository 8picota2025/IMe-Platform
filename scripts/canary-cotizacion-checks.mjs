/**
 * Aserciones del canary de cotización (sin I/O).
 * Extraídas para que Vitest cubra el contrato QA silencioso.
 */

/**
 * QA de registrar-lead-comercial: validación + CORS + rate-limit,
 * sin persistir lead, CRM ni correo.
 *
 * El Edge Function (isCanaryRequest) responde 201 + ok + qa y no
 * incluye leadId a propósito. Exigir leadId hacía fallar el canary
 * con el propio éxito silencioso.
 *
 * @param {number} status
 * @param {Record<string, unknown> | null} json
 * @returns {{ pass: boolean, code: 'ok' | 'http' | 'not_silent' | 'unexpected_lead' }}
 */
export function assessRegistrarLeadComercialQa(status, json) {
  if (![200, 201].includes(status) || json?.ok !== true) {
    return { pass: false, code: 'http' };
  }

  const silent =
    json.qa === true &&
    json.crmSyncStatus === 'skipped' &&
    json.emails?.interno === false &&
    json.emails?.cliente === false;

  if (!silent) {
    return { pass: false, code: 'not_silent' };
  }

  if (json.leadId) {
    return { pass: false, code: 'unexpected_lead' };
  }

  return { pass: true, code: 'ok' };
}
