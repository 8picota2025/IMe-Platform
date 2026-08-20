import type { ClienteFiscalProfile } from './fiscal';

/**
 * Public crear-pago must never trust self-asserted withholding-agent flags.
 *
 * `calculateFiscalSummary` subtracts retefuente/reteiva/reteica from the
 * charged total when these are true. Accepting them from the anonymous
 * checkout body lets anyone open an underpriced Wompi session once product
 * (or CO_DEFAULT_RETE*) retention rates are configured.
 */
export function stripUntrustedAgenteFlags<
  T extends Pick<ClienteFiscalProfile, 'agente_retencion' | 'agente_reteica'>,
>(fiscal: T): T {
  return {
    ...fiscal,
    agente_retencion: false,
    agente_reteica: false,
  };
}
