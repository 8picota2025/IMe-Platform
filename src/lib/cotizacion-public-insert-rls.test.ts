import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression lock: public INSERT on solicitudes_cotizacion must not allow
 * minting a formalizable offer (estado enviada/respondida + token + precios).
 * See supabase/migrations/20260811010000_harden_cotizaciones_public_insert.sql
 */
const REQUIRED_NULLS = [
  'formalizacion_token_hash IS NULL',
  'formalizacion_token_expira_at IS NULL',
  'condiciones IS NULL',
  'precio_total_ofertado IS NULL',
  'oferta_enviada_at IS NULL',
  'pedido_id IS NULL',
  'validez_hasta IS NULL',
  'notas_internas IS NULL',
  'impuestos_incluidos IS NULL',
] as const;

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n');
}

function extractPublicInsertPolicy(sql: string): string {
  const code = stripSqlComments(sql);
  const marker = 'CREATE POLICY "cotizaciones_insert_public"';
  const start = code.lastIndexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = code.slice(start);
  const withCheck = rest.match(/WITH CHECK\s*\(([\s\S]*?)\)\s*;/);
  expect(withCheck).not.toBeNull();
  return withCheck![0]!;
}

function assertHardenedPolicy(sql: string): void {
  const policy = extractPublicInsertPolicy(sql);
  expect(policy).toContain("estado = 'nueva'");
  expect(policy).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/);
  for (const clause of REQUIRED_NULLS) {
    expect(policy).toContain(clause);
  }
}

describe('cotizaciones_insert_public RLS harden', () => {
  it('migration forbids formalizable offer fields on anon/authenticated INSERT', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260811010000_harden_cotizaciones_public_insert.sql'
      ),
      'utf8'
    );
    assertHardenedPolicy(migration);
  });

  it('schema.sql stays in sync with the hardened public INSERT policy', () => {
    const schema = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');
    assertHardenedPolicy(schema);
  });
});
