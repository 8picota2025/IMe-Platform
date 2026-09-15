/**
 * Lock-in: get_proveedor_para_producto must not be executable by PUBLIC/anon.
 * SECURITY DEFINER + default PUBLIC EXECUTE would leak webhook_url / api_config.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function assertPrivilegedOnly(sql: string, label: string): void {
  expect(sql, label).toMatch(
    /REVOKE ALL ON FUNCTION(?: public)?\.?get_proveedor_para_producto\(uuid\) FROM PUBLIC/i
  );
  expect(sql, label).toMatch(
    /REVOKE ALL ON FUNCTION(?: public)?\.?get_proveedor_para_producto\(uuid\) FROM anon/i
  );
  expect(sql, label).toMatch(
    /REVOKE ALL ON FUNCTION(?: public)?\.?get_proveedor_para_producto\(uuid\) FROM authenticated/i
  );
  expect(sql, label).toMatch(
    /GRANT EXECUTE ON FUNCTION(?: public)?\.?get_proveedor_para_producto\(uuid\) TO service_role/i
  );
}

describe('get_proveedor_para_producto grants', () => {
  it('schema.sql revokes public/anon/authenticated and grants service_role only', () => {
    const sql = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
    assertPrivilegedOnly(sql, 'schema.sql');
  });

  it('hardening migration revokes public/anon/authenticated and grants service_role only', () => {
    const sql = readFileSync(
      join(
        root,
        'supabase/migrations/20260825010000_revoke_get_proveedor_para_producto_public.sql'
      ),
      'utf8'
    );
    assertPrivilegedOnly(sql, 'migration');
  });
});
