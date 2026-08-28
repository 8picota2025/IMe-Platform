/**
 * Canary CI: header `x-ime-canary-secret` + env `CANARY_SMOKE_SECRET`.
 * Usa bucket de rate-limit dedicado para no quemar cuota de clientes reales.
 */

export function isCanaryRequest(req: Request): boolean {
  const secret = Deno.env.get('CANARY_SMOKE_SECRET')?.trim();
  if (!secret) return false;
  const header = req.headers.get('x-ime-canary-secret')?.trim();
  return Boolean(header && header === secret);
}

/** Identificador de rate-limit: canary aislado o IP real. */
export function rateLimitIdentificador(
  req: Request,
  accion: 'cotizacion' | 'lead-comercial',
  ip: string
): string {
  if (isCanaryRequest(req)) return `${accion}:canary:ci`;
  return `${accion}:ip:${ip || 'desconocida'}`;
}
