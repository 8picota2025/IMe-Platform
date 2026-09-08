import { describe, expect, it } from 'vitest';
import { prepareVentasProductDraftRows, resolveProductImportRows } from './admin-import-productos';

describe('prepareVentasProductDraftRows', () => {
  it('strips client id and forces activo=false', () => {
    expect(
      prepareVentasProductDraftRows([
        { id: 'live-uuid', slug: 'nuevo-borrador', precio: 100, activo: true },
      ])
    ).toEqual([{ slug: 'nuevo-borrador', precio: 100, activo: false }]);
  });
});

describe('resolveProductImportRows', () => {
  const existingBySlug = new Map([['monitor-p22', { id: 'prod-1' }]]);
  const existingBySku = new Map([['SKU-P22', { id: 'prod-1' }]]);

  it('attaches existing id for catalogo updates', () => {
    expect(
      resolveProductImportRows(
        [{ slug: 'monitor-p22', precio: 500 }],
        existingBySku,
        existingBySlug
      )
    ).toEqual([{ slug: 'monitor-p22', precio: 500, id: 'prod-1' }]);
  });

  it('rejects slug match when forbidExisting (ventas)', () => {
    expect(() =>
      resolveProductImportRows(
        [{ slug: 'monitor-p22', precio: 1 }],
        existingBySku,
        existingBySlug,
        { forbidExisting: true }
      )
    ).toThrow(/ventas solo puede crear borradores/);
  });

  it('rejects sku match when forbidExisting (ventas)', () => {
    expect(() =>
      resolveProductImportRows(
        [{ slug: 'otro-slug', sku: 'SKU-P22', precio: 1 }],
        existingBySku,
        existingBySlug,
        { forbidExisting: true }
      )
    ).toThrow(/sku SKU-P22 ya existe/);
  });

  it('allows new slug/sku drafts for ventas without attaching id', () => {
    expect(
      resolveProductImportRows(
        [{ id: 'forged-uuid', slug: 'borrador-nuevo', sku: 'SKU-NEW', precio: 10 }],
        existingBySku,
        existingBySlug,
        { forbidExisting: true }
      )
    ).toEqual([{ slug: 'borrador-nuevo', sku: 'SKU-NEW', precio: 10 }]);
  });

  it('throws when sku and slug point to different products', () => {
    const bySku = new Map([['SKU-A', { id: 'prod-a' }]]);
    const bySlug = new Map([['slug-b', { id: 'prod-b' }]]);
    expect(() =>
      resolveProductImportRows([{ slug: 'slug-b', sku: 'SKU-A' }], bySku, bySlug)
    ).toThrow(/pertenece a otro producto/);
  });
});
