import { describe, expect, it } from 'vitest';

import { assessRegistrarLeadComercialQa } from './canary-cotizacion-checks.mjs';

const silentQa = {
  ok: true,
  qa: true,
  crmSyncStatus: 'skipped',
  emails: { interno: false, cliente: false },
};

describe('assessRegistrarLeadComercialQa', () => {
  it('acepta 201 QA silencioso sin leadId (contrato Edge canary)', () => {
    expect(assessRegistrarLeadComercialQa(201, silentQa)).toEqual({
      pass: true,
      code: 'ok',
    });
  });

  it('acepta 200 QA silencioso sin leadId', () => {
    expect(assessRegistrarLeadComercialQa(200, silentQa)).toEqual({
      pass: true,
      code: 'ok',
    });
  });

  it('rechaza exigir persistencia: leadId en QA no es éxito', () => {
    expect(assessRegistrarLeadComercialQa(201, { ...silentQa, leadId: 'uuid-real' })).toEqual({
      pass: false,
      code: 'unexpected_lead',
    });
  });

  it('rechaza HTTP de error aunque el cuerpo diga ok', () => {
    expect(assessRegistrarLeadComercialQa(500, silentQa)).toEqual({
      pass: false,
      code: 'http',
    });
  });

  it('rechaza cuerpo sin ok', () => {
    expect(assessRegistrarLeadComercialQa(201, { ...silentQa, ok: false })).toEqual({
      pass: false,
      code: 'http',
    });
  });

  it('rechaza CRM o correos no skipped', () => {
    expect(assessRegistrarLeadComercialQa(201, { ...silentQa, crmSyncStatus: 'synced' })).toEqual({
      pass: false,
      code: 'not_silent',
    });
    expect(
      assessRegistrarLeadComercialQa(201, {
        ...silentQa,
        emails: { interno: true, cliente: false },
      })
    ).toEqual({ pass: false, code: 'not_silent' });
  });

  it('rechaza json nulo', () => {
    expect(assessRegistrarLeadComercialQa(201, null)).toEqual({
      pass: false,
      code: 'http',
    });
  });
});
