import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrato de `_cotizacion_huella` (migración post-#251): campos que cambian
 * lo que el cliente paga o quién recibe la oferta deben invalidar la marca.
 */
describe('huella SQL de aprobación de envío', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      'supabase/migrations/20261102010000_cotizacion_huella_impuestos_incluidos.sql'
    ),
    'utf8'
  );

  it('incluye impuestos_incluidos, destinatario y validez en la huella', () => {
    expect(sql).toMatch(/impuestos_incluidos::text/);
    expect(sql).toMatch(/lower\(btrim\(coalesce\(r\.email/);
    expect(sql).toMatch(/btrim\(coalesce\(r\.telefono/);
    expect(sql).toMatch(/validez_hasta::text/);
  });

  it('invalida la marca cuando la huella no cuadra aunque cambien aprobado_at', () => {
    expect(sql).toMatch(/aprobacion_hash is distinct from public\._cotizacion_huella\(new\)/);
    expect(sql).not.toMatch(/old\.aprobado_at is not distinct from new\.aprobado_at/);
  });

  it('exige huella vigente al pasar a enviada', () => {
    expect(sql).toMatch(/new\.aprobacion_hash is null/);
    expect(sql).toMatch(/new\.aprobacion_hash is distinct from public\._cotizacion_huella\(new\)/);
    expect(sql).toMatch(/message = 'SIN_APROBACION'/);
  });
});
