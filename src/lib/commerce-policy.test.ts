import { describe, expect, it } from 'vitest';
import {
  classifyCommerceBucket,
  isMerchantEligible,
  isPurchasable,
  merchantAvailability,
  resolveAvailability,
} from './commerce-policy';

const base = {
  activo: true,
  disponible: true,
  precio: 150_000,
  stock: 5,
  gestionar_stock: true,
  stock_estado: 'instock',
  backorder_policy: 'no',
  imagen_principal: 'https://i-me.com.co/assets/p.jpg',
  slug: 'sensor-flujo',
};

describe('resolveAvailability', () => {
  it('disponible=false gana sobre stock positivo', () => {
    const r = resolveAvailability({ ...base, disponible: false, stock: 10 });
    expect(r.state).toBe('unavailable');
    expect(r.unitsAvailable).toBe(0);
  });

  it('stock 0 → out_of_stock', () => {
    expect(resolveAvailability({ ...base, stock: 0 }).state).toBe('out_of_stock');
  });

  it('sin gestionar stock → available sin cupo', () => {
    const r = resolveAvailability({
      activo: true,
      disponible: true,
      stock: null,
      gestionar_stock: false,
    });
    expect(r.state).toBe('available');
    expect(r.unitsAvailable).toBeNull();
  });
});

describe('isPurchasable', () => {
  it('precio + disponible + stock → ok', () => {
    expect(isPurchasable(base).ok).toBe(true);
  });

  it('sin precio → no', () => {
    expect(isPurchasable({ ...base, precio: null }).reason).toBe('sin_precio');
    expect(isPurchasable({ ...base, precio: 0 }).ok).toBe(false);
  });

  it('no usa umbral 6M: precio alto sigue comprable', () => {
    expect(isPurchasable({ ...base, precio: 12_000_000 }).ok).toBe(true);
  });

  it('stock insuficiente para cantidad', () => {
    expect(isPurchasable(base, { quantity: 6 }).reason).toBe('stock_insuficiente');
  });

  it('backorder no es checkout automático', () => {
    expect(
      isPurchasable({ ...base, stock: 0, backorder_policy: 'yes', stock_estado: 'onbackorder' }).ok
    ).toBe(false);
  });

  it('fulfillment_mode cotizacion no bloquea si hay precio (feat-comercio)', () => {
    expect(isPurchasable({ ...base, fulfillment_mode: 'cotizacion' }).ok).toBe(true);
  });
});

describe('isMerchantEligible', () => {
  it('requiere imagen y slug además de comprable', () => {
    expect(isMerchantEligible({ ...base, imagen_principal: '' }).ok).toBe(false);
    expect(isMerchantEligible({ ...base, slug: '' }).ok).toBe(false);
    expect(isMerchantEligible(base).ok).toBe(true);
  });

  it('separada: sin stock no entra a Merchant', () => {
    expect(isMerchantEligible({ ...base, stock: 0 }).ok).toBe(false);
  });
});

describe('classifyCommerceBucket / merchantAvailability', () => {
  it('A vs C', () => {
    expect(classifyCommerceBucket(base)).toBe('A_compra_directa');
    expect(classifyCommerceBucket({ ...base, precio: null })).toBe('C_cotizacion');
  });

  it('merchant availability', () => {
    expect(merchantAvailability(base)).toBe('in_stock');
    expect(merchantAvailability({ ...base, stock: 0 })).toBe('out_of_stock');
  });
});
