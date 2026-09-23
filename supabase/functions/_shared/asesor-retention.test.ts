import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cutoffIso, retentionDias } from './asesor-retention.ts';

Deno.test('retentionDias: usa el default 90 sin env var', () => {
  Deno.env.delete('ASESOR_RETENTION_DIAS');
  assertEquals(retentionDias(), 90);
});

Deno.test('retentionDias: respeta ASESOR_RETENTION_DIAS si es un entero positivo', () => {
  Deno.env.set('ASESOR_RETENTION_DIAS', '30');
  assertEquals(retentionDias(), 30);
  Deno.env.delete('ASESOR_RETENTION_DIAS');
});

Deno.test('retentionDias: ignora valores invalidos y cae al default', () => {
  Deno.env.set('ASESOR_RETENTION_DIAS', 'no-es-numero');
  assertEquals(retentionDias(), 90);
  Deno.env.set('ASESOR_RETENTION_DIAS', '-5');
  assertEquals(retentionDias(), 90);
  Deno.env.set('ASESOR_RETENTION_DIAS', '0');
  assertEquals(retentionDias(), 90);
  Deno.env.delete('ASESOR_RETENTION_DIAS');
});

Deno.test('cutoffIso: resta la cantidad correcta de dias en ISO', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  assertEquals(cutoffIso(now, 90), '2026-06-24T12:00:00.000Z');
  assertEquals(cutoffIso(now, 1), '2026-09-21T12:00:00.000Z');
  assertEquals(cutoffIso(now, 0), '2026-09-22T12:00:00.000Z');
});
