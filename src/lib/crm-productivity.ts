/**
 * Productividad comercial del warehouse CRM (`#/crm`).
 * Espejo de palancas de Sugar Activities / Odoo: agenda, log rápido,
 * snooze y siguiente paso obligatorio. Sin columnas nuevas.
 */

export const CRM_CLOSED_STAGES = ['ganado', 'perdido', 'posventa'] as const;

export type CrmSeguimientoFilter = '' | 'vencido' | 'hoy' | 'sin_fecha' | 'estancada';
export type CrmAsignacionFilter = '' | 'mias' | 'sin_owner';
export type CrmQuickLogKind = 'llamada' | 'whatsapp' | 'email';
export type CrmSnoozeDays = 1 | 3 | 7;

export const CRM_QUICK_LOG: Record<
  CrmQuickLogKind,
  { channel: 'phone' | 'whatsapp' | 'email'; label: string }
> = {
  llamada: { channel: 'phone', label: 'Llamada' },
  whatsapp: { channel: 'whatsapp', label: 'WhatsApp' },
  email: { channel: 'email', label: 'Email' },
};

export const CRM_SNOOZE_DAYS: readonly CrmSnoozeDays[] = [1, 3, 7];
export const CRM_STALE_DAYS = 14;

export function isCrmStageClosed(etapa: string): boolean {
  return (CRM_CLOSED_STAGES as readonly string[]).includes(etapa);
}

/** Etapas abiertas (Sugar/Odoo) exigen próxima acción al guardar. */
export function crmStageRequiresNextAction(etapa: string): boolean {
  return Boolean(etapa) && !isCrmStageClosed(etapa);
}

export function isOverdueNextAction(
  nextActionAt: string | null | undefined,
  now = new Date()
): boolean {
  if (!nextActionAt) return false;
  const due = new Date(nextActionAt);
  return !Number.isNaN(due.getTime()) && due.getTime() <= now.getTime();
}

/** Misma fecha local y aún no vencida. */
export function isDueToday(nextActionAt: string | null | undefined, now = new Date()): boolean {
  if (!nextActionAt) return false;
  const due = new Date(nextActionAt);
  if (Number.isNaN(due.getTime()) || due.getTime() <= now.getTime()) return false;
  return due.toDateString() === now.toDateString();
}

export function isStaleOpportunity(input: {
  etapa: string;
  lastContactAt?: string | null;
  updatedAt?: string | null;
  now?: Date;
  staleDays?: number;
}): boolean {
  if (isCrmStageClosed(input.etapa)) return false;
  const now = input.now ?? new Date();
  const staleDays = input.staleDays ?? CRM_STALE_DAYS;
  const ref = input.lastContactAt || input.updatedAt;
  if (!ref) return true;
  const stamp = new Date(ref);
  if (Number.isNaN(stamp.getTime())) return true;
  return now.getTime() - stamp.getTime() >= staleDays * 24 * 60 * 60 * 1000;
}

export function matchesCrmSeguimiento(
  row: {
    etapa: string;
    nextActionAt?: string | null;
    lastContactAt?: string | null;
    updatedAt?: string | null;
  },
  filter: CrmSeguimientoFilter,
  now = new Date()
): boolean {
  if (!filter) return true;
  const closed = isCrmStageClosed(row.etapa);
  if (filter === 'vencido') return !closed && isOverdueNextAction(row.nextActionAt, now);
  if (filter === 'hoy') return !closed && isDueToday(row.nextActionAt, now);
  if (filter === 'sin_fecha') return !closed && !row.nextActionAt;
  if (filter === 'estancada') return isStaleOpportunity({ ...row, now });
  return true;
}

export function matchesCrmAsignacion(
  twentyOwnerId: string | null | undefined,
  myMemberId: string | null | undefined,
  filter: CrmAsignacionFilter
): boolean {
  if (!filter) return true;
  const owner = (twentyOwnerId ?? '').trim();
  if (filter === 'sin_owner') return owner.length === 0;
  if (filter === 'mias') {
    const mine = (myMemberId ?? '').trim();
    return mine.length > 0 && owner === mine;
  }
  return true;
}

/** Tras un contacto registrado: P1 mañana, P2 3 días, P3 7 días. */
export function crmFollowUpHoursAfterLog(prioridad: string | null | undefined): number {
  if (prioridad === 'P2') return 72;
  if (prioridad === 'P3') return 168;
  return 24;
}

export function nextActionAfterQuickLog(
  prioridad: string | null | undefined,
  now = new Date()
): string {
  return new Date(
    now.getTime() + crmFollowUpHoursAfterLog(prioridad) * 60 * 60 * 1000
  ).toISOString();
}

/** Posponer desde el máximo entre ahora y la fecha actual (no deja vencida). */
export function snoozeNextActionIso(
  currentIso: string | null | undefined,
  days: number,
  now = new Date()
): string {
  const safeDays = Number.isFinite(days) && days > 0 ? days : 1;
  const current = currentIso ? new Date(currentIso) : now;
  const base = Number.isNaN(current.getTime()) || current.getTime() < now.getTime() ? now : current;
  return new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export function crmFilterHref(
  current: URLSearchParams,
  patch: Record<string, string | null | undefined>
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    const clean = (value ?? '').trim();
    if (!clean) next.delete(key);
    else next.set(key, clean);
  }
  const qs = next.toString();
  return qs ? `#/crm?${qs}` : '#/crm';
}

export function isAgendaItem(
  row: { etapa: string; nextActionAt?: string | null },
  now = new Date()
): boolean {
  if (isCrmStageClosed(row.etapa)) return false;
  return isOverdueNextAction(row.nextActionAt, now) || isDueToday(row.nextActionAt, now);
}
