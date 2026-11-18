import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression lock: F-06 RBAC must not allow anon / non-staff Auth to mint or
 * escalate formalizable quotes (underpriced formalizar / crear-pago locked).
 *
 * Bad state introduced by 20260830120000_cotizaciones_rbac_ventas.sql
 * (WITH CHECK true INSERT + any-Auth UPDATE own). Fixed in
 * 20260831010000_harden_cotizaciones_rbac_insert_update.sql.
 */

function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n');
}

function extractPolicy(sql: string, name: string): string {
  const code = stripSqlComments(sql);
  const marker = `CREATE POLICY "${name}"`;
  const start = code.lastIndexOf(marker);
  expect(start, `missing policy ${name}`).toBeGreaterThanOrEqual(0);
  const rest = code.slice(start);
  const end = rest.search(/;\s*(?:CREATE|DROP|ALTER|$)/);
  return end >= 0 ? rest.slice(0, end + 1) : rest;
}

function assertNoPermissivePublicInsert(sql: string): void {
  const code = stripSqlComments(sql);
  expect(code).not.toMatch(
    /CREATE POLICY "cotizaciones_ventas_insert_public"[\s\S]*?WITH CHECK\s*\(\s*true\s*\)/
  );
  expect(code).not.toMatch(
    /CREATE POLICY "cotizaciones_insert_public"[\s\S]*?WITH CHECK\s*\(\s*true\s*\)/
  );
}

function assertStaffDraftInsert(sql: string): void {
  const policy = extractPolicy(sql, 'cotizaciones_ventas_insert');
  expect(policy).toContain('TO authenticated');
  expect(policy).toContain("estado = 'nueva'");
  expect(policy).toContain('formalizacion_token_hash IS NULL');
  expect(policy).toContain('formalizacion_token_expira_at IS NULL');
  expect(policy).toContain('oferta_enviada_at IS NULL');
  expect(policy).toContain('pedido_id IS NULL');
  expect(policy).toMatch(/is_admin\(\s*ARRAY\s*\[\s*'ventas'\s*\]\s*\)/);
  expect(policy).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/);
  expect(policy).not.toContain('TO anon');
}

function assertStaffGatedUpdate(sql: string): void {
  const policy = extractPolicy(sql, 'cotizaciones_ventas_update_own');
  expect(policy).toContain('TO authenticated');
  expect(policy).toMatch(/is_admin\(\s*ARRAY\s*\[\s*'ventas'\s*\]\s*\)/);
  expect(policy).toContain('created_by = (SELECT auth.uid())');
  // Must not allow bare Auth ownership without admin_profiles check.
  const usingOnlyCreatedBy =
    /USING\s*\(\s*created_by\s*=\s*\(SELECT auth\.uid\(\)\)\s*OR/i.test(policy) &&
    !/is_admin/.test(policy.split('USING')[1] ?? '');
  expect(usingOnlyCreatedBy).toBe(false);
}

describe('cotizaciones RBAC harden (post F-06 regression)', () => {
  const fixMigration = resolve(
    process.cwd(),
    'supabase/migrations/20260831010000_harden_cotizaciones_rbac_insert_update.sql'
  );
  const schemaPath = resolve(process.cwd(), 'supabase/schema.sql');

  it('fix migration drops permissive public INSERT and gates staff draft INSERT', () => {
    const sql = readFileSync(fixMigration, 'utf8');
    expect(sql).toContain('DROP POLICY IF EXISTS "cotizaciones_ventas_insert_public"');
    expect(sql).toContain('DROP POLICY IF EXISTS "cotizaciones_insert_public"');
    assertNoPermissivePublicInsert(sql);
    assertStaffDraftInsert(sql);
    assertStaffGatedUpdate(sql);
  });

  it('schema.sql matches staff-only draft INSERT and staff-gated UPDATE', () => {
    const sql = readFileSync(schemaPath, 'utf8');
    assertNoPermissivePublicInsert(sql);
    assertStaffDraftInsert(sql);
    assertStaffGatedUpdate(sql);
  });

  it('broken F-06 migration is superseded (still documents the regression for auditors)', () => {
    const broken = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260830120000_cotizaciones_rbac_ventas.sql'),
      'utf8'
    );
    expect(broken).toMatch(/WITH CHECK\s*\(\s*true\s*\)/);
    const fix = readFileSync(fixMigration, 'utf8');
    expect(fix).toContain('20260830120000_cotizaciones_rbac_ventas.sql');
  });
});
