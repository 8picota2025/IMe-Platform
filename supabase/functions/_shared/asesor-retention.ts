/**
 * Logica pura de retencion para asesor_agent_turns — ADR-0017. Separado de
 * purgar-asesor-agent-turns/index.ts (que llama Deno.serve a nivel de
 * modulo) para poder testear sin levantar un servidor real.
 */

const DEFAULT_RETENTION_DIAS = 90;

export function retentionDias(): number {
  const raw = Number(Deno.env.get('ASESOR_RETENTION_DIAS'));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_RETENTION_DIAS;
}

export function cutoffIso(now: Date, dias: number): string {
  const cutoff = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}
