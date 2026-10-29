import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildComparisons,
  emptyAssumptions,
  isPriceStale,
  parseCsvRecords,
  parseMoney,
  parsePriceBatch,
  quoteLanding,
  selectBestPrice,
  type LandingAssumptions,
  type PriceEntry,
} from './price-intelligence';

const NOW = Date.parse('2026-10-25T12:00:00Z');

function entry(
  partial: Partial<PriceEntry> &
    Pick<
      PriceEntry,
      'source_type' | 'currency' | 'unit_cost_original' | 'incoterm' | 'equipment_name'
    >
): PriceEntry {
  return {
    id: partial.id ?? partial.model ?? partial.equipment_name,
    product_id: null,
    category: partial.category ?? null,
    equipment_name: partial.equipment_name,
    brand: partial.brand ?? null,
    model: partial.model ?? null,
    specs_summary: null,
    invima_registration: null,
    invima_status: partial.invima_status ?? null,
    source_type: partial.source_type,
    supplier_or_source_name: partial.supplier_or_source_name ?? null,
    supplier_country: null,
    contact_email: null,
    source_url_or_ref: null,
    currency: partial.currency,
    unit_cost_original: partial.unit_cost_original,
    price_min_original: partial.price_min_original ?? null,
    price_avg_original: partial.price_avg_original ?? null,
    price_max_original: partial.price_max_original ?? null,
    incoterm: partial.incoterm,
    tier_min_qty: partial.tier_min_qty ?? 1,
    lead_time: null,
    iva_mode: partial.iva_mode ?? null,
    trm_applied: partial.trm_applied ?? null,
    freight_pct: partial.freight_pct ?? null,
    duty_pct: partial.duty_pct ?? null,
    ime_margin_pct: partial.ime_margin_pct ?? null,
    estimated_landed_cost_cop: partial.estimated_landed_cost_cop ?? null,
    suggested_sale_price_cop: partial.suggested_sale_price_cop ?? null,
    max_reference_price_cop: partial.max_reference_price_cop ?? null,
    public_stamp_surcharge_pct: partial.public_stamp_surcharge_pct ?? null,
    valid_until: partial.valid_until ?? null,
    captured_at: partial.captured_at ?? '2026-10-25T12:00:00.000Z',
    notes: null,
    raw_metadata: {},
    external_key: partial.external_key ?? null,
  };
}

function assumptions(partial: Partial<LandingAssumptions> = {}): LandingAssumptions {
  return { ...emptyAssumptions(), ...partial };
}

describe('parseMoney', () => {
  it('lee COP con puntos de miles y USD con coma', () => {
    expect(parseMoney('$3.360.000')).toBe(3360000);
    expect(parseMoney('2.850.000')).toBe(2850000);
    expect(parseMoney('53.695.144')).toBe(53695144);
    expect(parseMoney('24.620.000')).toBe(24620000);
    expect(parseMoney('9.215.954')).toBe(9215954);
    expect(parseMoney('54,000')).toBe(54000);
    expect(parseMoney('42,400')).toBe(42400);
    expect(parseMoney('4,350')).toBe(4350);
    expect(parseMoney('5550')).toBe(5550);
  });
});

describe('quoteLanding', () => {
  it('no inventa TRM ni margen para un FOB/EXW en USD', () => {
    const quote = quoteLanding(
      entry({
        equipment_name: 'SonoScape SV-M4K220Exp',
        brand: 'SonoScape',
        model: 'SV-M4K220Exp',
        source_type: 'factory_exw',
        currency: 'USD',
        unit_cost_original: 42400,
        incoterm: 'EXW',
      }),
      emptyAssumptions()
    );
    expect(quote.landedCop).toBeNull();
    expect(quote.suggestedCop).toBeNull();
    expect(quote.missing).toContain('trm');
  });

  it('aterriza EXW con TRM, flete y arancel y CIF sin flete', () => {
    const exw = quoteLanding(
      entry({
        equipment_name: 'Siriusmed R55',
        source_type: 'factory_exw',
        currency: 'USD',
        unit_cost_original: 100,
        incoterm: 'EXW',
      }),
      assumptions({ trm: 4000, freightPct: 8, dutyPct: 10, marginPct: 25 })
    );
    expect(exw.landedCop).toBe(475200);
    expect(exw.suggestedCop).toBe(594000);
    expect(exw.partial).toBe(false);

    const cif = quoteLanding(
      entry({
        equipment_name: 'Angell DM156A',
        source_type: 'factory_cif',
        currency: 'USD',
        unit_cost_original: 54000,
        incoterm: 'CIF',
      }),
      assumptions({ trm: 4000, freightPct: 50, dutyPct: 10, marginPct: 20 })
    );
    expect(cif.landedCop).toBe(237600000);
    expect(cif.suggestedCop).toBe(285120000);
  });

  it('deja el costo local en COP y marca el margen como pendiente', () => {
    const quote = quoteLanding(
      entry({
        equipment_name: 'Miniklav 12L',
        source_type: 'local_distributor',
        currency: 'COP',
        unit_cost_original: 3360000,
        incoterm: 'LOCAL',
      }),
      emptyAssumptions()
    );
    expect(quote.landedCop).toBe(3360000);
    expect(quote.suggestedCop).toBeNull();
    expect(quote.missing).toContain('margen');
  });

  it('aplica +30 % sobre el precio máximo cuando se pide estampillas', () => {
    const quote = quoteLanding(
      entry({
        equipment_name: 'Referencia web',
        source_type: 'web_scrape',
        currency: 'COP',
        unit_cost_original: 10000000,
        price_max_original: 12000000,
        incoterm: 'WEB_REF',
        max_reference_price_cop: 12000000,
      }),
      assumptions({ applyStamp: true, stampPct: 30, marginPct: 0 })
    );
    expect(quote.stampBaseCop).toBe(12000000);
    expect(quote.stampPriceCop).toBe(15600000);
  });

  it('no nacionaliza un precio web extranjero', () => {
    const quote = quoteLanding(
      entry({
        equipment_name: 'Referencia web',
        source_type: 'web_scrape',
        currency: 'USD',
        unit_cost_original: 100,
        incoterm: 'WEB_REF',
      }),
      assumptions({ trm: 4000, freightPct: 40, dutyPct: 15 })
    );
    expect(quote.landedCop).toBe(400000);
    expect(quote.partial).toBe(false);
  });
});

describe('vigencia y comparativa', () => {
  it('alerta a los 90 días y si la vigencia ya venció', () => {
    const fresh = entry({
      equipment_name: 'A',
      source_type: 'factory_cif',
      currency: 'USD',
      unit_cost_original: 1,
      incoterm: 'CIF',
      captured_at: new Date(NOW - 89 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const stale = entry({
      equipment_name: 'B',
      source_type: 'factory_cif',
      currency: 'USD',
      unit_cost_original: 1,
      incoterm: 'CIF',
      captured_at: new Date(NOW - 91 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const expired = entry({
      equipment_name: 'C',
      source_type: 'local_distributor',
      currency: 'COP',
      unit_cost_original: 1,
      incoterm: 'LOCAL',
      captured_at: new Date(NOW).toISOString(),
      valid_until: '2026-10-01',
    });
    expect(isPriceStale(fresh, NOW)).toBe(false);
    expect(isPriceStale(stale, NOW)).toBe(true);
    expect(isPriceStale(expired, NOW)).toBe(true);
  });

  it('prefiere fábrica vigente sobre distribuidor y la escala que cubre la cantidad', () => {
    const factory = entry({
      id: 'factory',
      equipment_name: 'VG70',
      brand: 'Heyer/Aeonmed',
      model: 'VG70',
      source_type: 'factory_cif',
      currency: 'USD',
      unit_cost_original: 4350,
      incoterm: 'CIF',
      tier_min_qty: 1,
    });
    const volume = entry({
      ...factory,
      id: 'volume',
      unit_cost_original: 4000,
      tier_min_qty: 5,
    });
    const local = entry({
      id: 'local',
      equipment_name: 'VG70',
      brand: 'Heyer/Aeonmed',
      model: 'VG70',
      source_type: 'local_distributor',
      currency: 'COP',
      unit_cost_original: 20000000,
      incoterm: 'LOCAL',
    });
    const best = selectBestPrice([factory, volume, local], { qty: 5, now: NOW });
    expect(best.supplier?.id).toBe('volume');
    expect(best.quoteBase?.id).toBe('volume');

    const staleFactory = entry({
      ...factory,
      id: 'stale-factory',
      captured_at: '2026-01-01T00:00:00.000Z',
    });
    const freshLocal = selectBestPrice([staleFactory, local], { now: NOW });
    expect(freshLocal.supplier?.id).toBe('local');
  });

  it('calcula el diferencial entre fábrica aterrizada, local y web', () => {
    const comparisons = buildComparisons(
      [
        entry({
          equipment_name: 'Monitor',
          brand: 'COMEN',
          model: 'S5',
          source_type: 'factory_cif',
          currency: 'USD',
          unit_cost_original: 1000,
          incoterm: 'CIF',
        }),
        entry({
          equipment_name: 'Monitor',
          brand: 'COMEN',
          model: 'S5',
          source_type: 'local_distributor',
          supplier_or_source_name: 'Allers',
          currency: 'COP',
          unit_cost_original: 8000000,
          incoterm: 'LOCAL',
        }),
        entry({
          equipment_name: 'Monitor',
          brand: 'COMEN',
          model: 'S5',
          source_type: 'web_scrape',
          currency: 'COP',
          unit_cost_original: 9000000,
          price_min_original: 8500000,
          price_avg_original: 9000000,
          price_max_original: 10000000,
          incoterm: 'WEB_REF',
        }),
      ],
      assumptions({ trm: 4000, dutyPct: 0, marginPct: 10 }),
      NOW
    );
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]?.factoryLandedCop).toBe(4000000);
    expect(comparisons[0]?.localCop).toBe(8000000);
    expect(comparisons[0]?.webMaxCop).toBe(10000000);
    expect(comparisons[0]?.deltaLocalVsFactoryPct).toBe(100);
    expect(comparisons[0]?.deltaWebVsFactoryPct).toBe(150);
  });
});

describe('ingesta', () => {
  it('acepta CSV y JSON con encabezados en español', () => {
    const csv = parseCsvRecords(
      'equipo,marca,modelo,origen,proveedor,moneda,precio,incoterm\nAngell DM156A,Angell,DM156A,CIF,Angell,USD,"54,000",CIF\n'
    );
    expect(csv).toHaveLength(1);
    const parsed = parsePriceBatch({ rows: csv ?? [] });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.rows[0]?.source_type).toBe('factory_cif');
      expect(parsed.rows[0]?.unit_cost_original).toBe(54000);
    }
  });
});

describe('semilla SQL', () => {
  const sql = readFileSync(
    'supabase/migrations/20261025120000_market_price_intelligence.sql',
    'utf8'
  );

  it('guarda los precios reales recibidos y no inventa referencias web', () => {
    const expected = [
      ['DM156A', '54000'],
      ['SV-M4K220Exp', '42400'],
      ['R55', '5550'],
      ['VG70', '4350'],
      ['Miniklav 12L', '3360000'],
      ['Miniklav 5,5L', '2850000'],
      ['GraphNet TS', '53695144'],
      ['ZOLL', '24620000'],
      ['COMEN', '9215954'],
    ];
    for (const [model, price] of expected) {
      expect(sql).toContain(model);
      expect(sql).toContain(price);
    }
    expect(sql).toContain('mas_iva');
    expect(sql).toContain('no se insertan filas inventadas');
    const seed = sql.split('INSERT INTO market_price_entries')[1] ?? '';
    expect(seed).not.toContain('web_scrape');
  });
});
