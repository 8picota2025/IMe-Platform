import { describe, expect, it } from 'vitest';
import { canInvokeIngestaPdf, INGESTA_PDF_ROLES } from './ingesta-auth';

describe('canInvokeIngestaPdf', () => {
  it('allows active CMS and sales roles that already use PDF ingest', () => {
    for (const rol of INGESTA_PDF_ROLES) {
      expect(canInvokeIngestaPdf({ rol, activo: true })).toBe(true);
    }
  });

  it('rejects inactive profiles and storefront-only sessions', () => {
    expect(canInvokeIngestaPdf(null)).toBe(false);
    expect(canInvokeIngestaPdf({ rol: 'owner', activo: false })).toBe(false);
    expect(canInvokeIngestaPdf({ rol: 'lectura', activo: true })).toBe(false);
    expect(canInvokeIngestaPdf({ rol: 'operaciones', activo: true })).toBe(false);
    expect(canInvokeIngestaPdf({ rol: '', activo: true })).toBe(false);
  });
});
