import { describe, expect, it } from 'vitest';

import {
  crmFilterHref,
  crmFollowUpHoursAfterLog,
  crmStageRequiresNextAction,
  isAgendaItem,
  isCrmStageClosed,
  isDueToday,
  isOverdueNextAction,
  isStaleOpportunity,
  matchesCrmAsignacion,
  matchesCrmSeguimiento,
  nextActionAfterQuickLog,
  snoozeNextActionIso,
} from './crm-productivity';

const noon = new Date('2026-09-03T12:00:00-05:00');

describe('etapas y siguiente paso', () => {
  it('cierra ganado/perdido/posventa', () => {
    expect(isCrmStageClosed('ganado')).toBe(true);
    expect(isCrmStageClosed('cotizando')).toBe(false);
  });

  it('exige próxima acción en etapas abiertas', () => {
    expect(crmStageRequiresNextAction('cotizando')).toBe(true);
    expect(crmStageRequiresNextAction('nuevo')).toBe(true);
    expect(crmStageRequiresNextAction('perdido')).toBe(false);
    expect(crmStageRequiresNextAction('ganado')).toBe(false);
  });
});

describe('seguimiento', () => {
  it('vencido es next_action <= ahora', () => {
    expect(isOverdueNextAction('2026-09-03T10:00:00-05:00', noon)).toBe(true);
    expect(isOverdueNextAction('2026-09-03T18:00:00-05:00', noon)).toBe(false);
    expect(isOverdueNextAction(null, noon)).toBe(false);
  });

  it('hoy es misma fecha local y aún pendiente', () => {
    expect(isDueToday('2026-09-03T18:00:00-05:00', noon)).toBe(true);
    expect(isDueToday('2026-09-03T10:00:00-05:00', noon)).toBe(false);
    expect(isDueToday('2026-09-04T10:00:00-05:00', noon)).toBe(false);
  });

  it('estancada: 14 días sin last_contact ni update', () => {
    expect(
      isStaleOpportunity({
        etapa: 'cotizando',
        lastContactAt: '2026-08-01T12:00:00Z',
        now: noon,
      })
    ).toBe(true);
    expect(
      isStaleOpportunity({
        etapa: 'cotizando',
        lastContactAt: '2026-09-02T12:00:00-05:00',
        now: noon,
      })
    ).toBe(false);
    expect(isStaleOpportunity({ etapa: 'ganado', lastContactAt: null, now: noon })).toBe(false);
  });

  it('filtra seguimiento', () => {
    const open = { etapa: 'cotizando', nextActionAt: '2026-09-03T10:00:00-05:00' };
    expect(matchesCrmSeguimiento(open, 'vencido', noon)).toBe(true);
    expect(matchesCrmSeguimiento(open, 'hoy', noon)).toBe(false);
    expect(
      matchesCrmSeguimiento({ etapa: 'cotizando', nextActionAt: null }, 'sin_fecha', noon)
    ).toBe(true);
  });
});

describe('asignación', () => {
  it('mias exige owner = member del comercial', () => {
    expect(matchesCrmAsignacion('abc', 'abc', 'mias')).toBe(true);
    expect(matchesCrmAsignacion('abc', 'zzz', 'mias')).toBe(false);
    expect(matchesCrmAsignacion('abc', '', 'mias')).toBe(false);
    expect(matchesCrmAsignacion('', 'abc', 'sin_owner')).toBe(true);
    expect(matchesCrmAsignacion('abc', 'abc', '')).toBe(true);
  });
});

describe('log y snooze', () => {
  it('P1 24h, P2 72h, P3 7d', () => {
    expect(crmFollowUpHoursAfterLog('P1')).toBe(24);
    expect(crmFollowUpHoursAfterLog('P2')).toBe(72);
    expect(crmFollowUpHoursAfterLog('P3')).toBe(168);
    expect(crmFollowUpHoursAfterLog(null)).toBe(24);
  });

  it('nextActionAfterQuickLog avanza desde ahora', () => {
    const next = nextActionAfterQuickLog('P1', noon);
    expect(new Date(next).getTime() - noon.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('snooze no deja la fecha en el pasado', () => {
    const snoozed = snoozeNextActionIso('2026-09-01T10:00:00-05:00', 1, noon);
    expect(new Date(snoozed).getTime()).toBe(noon.getTime() + 24 * 60 * 60 * 1000);
  });

  it('snooze desde una fecha futura conserva ese ancla', () => {
    const future = '2026-09-10T10:00:00-05:00';
    const snoozed = snoozeNextActionIso(future, 3, noon);
    expect(new Date(snoozed).getTime()).toBe(new Date(future).getTime() + 3 * 24 * 60 * 60 * 1000);
  });
});

describe('agenda y href', () => {
  it('agenda incluye vencido y hoy', () => {
    expect(isAgendaItem({ etapa: 'nuevo', nextActionAt: '2026-09-03T10:00:00-05:00' }, noon)).toBe(
      true
    );
    expect(isAgendaItem({ etapa: 'nuevo', nextActionAt: '2026-09-03T18:00:00-05:00' }, noon)).toBe(
      true
    );
    expect(isAgendaItem({ etapa: 'ganado', nextActionAt: '2026-09-03T10:00:00-05:00' }, noon)).toBe(
      false
    );
  });

  it('crmFilterHref parchea query sin perder otros filtros', () => {
    const current = new URLSearchParams('prioridad=P1&q=clinic');
    expect(crmFilterHref(current, { seguimiento: 'hoy' })).toBe(
      '#/crm?prioridad=P1&q=clinic&seguimiento=hoy'
    );
    expect(crmFilterHref(current, { q: null })).toBe('#/crm?prioridad=P1');
  });
});
