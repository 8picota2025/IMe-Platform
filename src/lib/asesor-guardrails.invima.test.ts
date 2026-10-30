import { describe, expect, it } from 'vitest';
import { aplicarGuardrailInvima, INVIMA_GUARDRAIL_TEXT } from './asesor-guardrails';

describe('aplicarGuardrailInvima', () => {
  it('no toca textos sin afirmaciones INVIMA', () => {
    const t = 'El ecógrafo portátil tiene WiFi y DICOM.';
    expect(aplicarGuardrailInvima(t)).toBe(t);
  });
  it('elimina afirmación de registro no verificado', () => {
    const r = aplicarGuardrailInvima('El exoesqueleto ZW568 cuenta con registro INVIMA vigente. Te envío la ficha.');
    expect(r).not.toMatch(/cuenta con registro/i);
    expect(r).toContain('Te envío la ficha.');
    expect(r).toContain(INVIMA_GUARDRAIL_TEXT);
  });
  it('enmascara códigos RS no verificados y respeta los verificados', () => {
    expect(aplicarGuardrailInvima('RS INVIMA 2019DM-0019837')).toContain('[registro en verificación]');
    expect(aplicarGuardrailInvima('RS INVIMA 2019DM-0019837', ['2019DM-0019837'])).toBe('RS INVIMA 2019DM-0019837');
  });
});
