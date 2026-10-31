/**
 * Lock-in: fulfillment supplier RPC must require dropship readiness gates
 * introduced by the supplier-directory migrations (dropship_enabled + apto_dropship).
 * Checking only `activo` let research prospects receive customer PII after a
 * single admin flip.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function extractGetProveedorBody(sql: string): string {
  const match = sql.match(/CREATE OR REPLACE FUNCTION get_proveedor_para_producto\([\s\S]*?\$\$;/);
  expect(match, 'get_proveedor_para_producto definition').toBeTruthy();
  return match?.[0] ?? '';
}

function assertDropshipGates(sql: string, label: string): void {
  const body = extractGetProveedorBody(sql);
  expect(body, `${label}: apto_dropship`).toMatch(/pp\.apto_dropship\s*=\s*true/i);
  expect(body, `${label}: dropship_enabled`).toMatch(/p\.dropship_enabled\s*=\s*true/i);
  expect(body, `${label}: still requires pp.activo`).toMatch(/pp\.activo\s*=\s*true/i);
  expect(body, `${label}: still requires p.activo`).toMatch(/p\.activo\s*=\s*true/i);
}

describe('get_proveedor_para_producto dropship readiness', () => {
  it('schema.sql requires dropship_enabled and apto_dropship', () => {
    const sql = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
    assertDropshipGates(sql, 'schema.sql');
  });

  it('hardening migration requires dropship_enabled and apto_dropship', () => {
    const sql = readFileSync(
      join(
        root,
        'supabase/migrations/20260909120000_enforce_dropship_readiness_on_supplier_rpc.sql'
      ),
      'utf8'
    );
    assertDropshipGates(sql, 'migration');
  });
});
