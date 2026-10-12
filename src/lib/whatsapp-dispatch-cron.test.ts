import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260925150000_whatsapp_dispatch_cron.sql', import.meta.url),
  'utf8'
);

describe('migración cron whatsapp-imeia-dispatch', () => {
  it('programa el job y lee el token al ejecutar, sin secretos en el archivo', () => {
    expect(sql).toContain('cron.schedule(');
    expect(sql).toContain("'whatsapp-imeia-dispatch'");
    expect(sql).toContain("'* * * * *'");
    expect(sql).toContain('public.whatsapp_dispatch_auth');
    expect(sql).toContain('pg_catalog.gen_random_uuid()');
    expect(sql).not.toMatch(/SERVICE_ROLE/);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}/);
    expect(sql).not.toMatch(/sb_secret_/);
    expect(sql).not.toContain('vault.create_secret');
  });
});
