import { describe, expect, it } from 'vitest';
import {
  isCuponLineaElegible,
  looksLikeUuid,
  resolveFamiliaFilter,
} from './cupon-familia-elegibilidad';

const VENTILADORES_ID = '61d5c2d6-acdc-4de3-896d-044269702899';
const MONITOR_ID = '82aa3109-df88-468b-aed8-5ff953f2749a';

const bySlug = new Map([
  ['ventiladores', VENTILADORES_ID],
  ['monitores', MONITOR_ID],
]);

describe('cupon-familia-elegibilidad', () => {
  it('looksLikeUuid accepts canonical UUIDs', () => {
    expect(looksLikeUuid(VENTILADORES_ID)).toBe(true);
    expect(looksLikeUuid('ventiladores')).toBe(false);
  });

  it('resolveFamiliaFilter maps admin slugs to familia UUIDs', () => {
    const resolved = resolveFamiliaFilter(['ventiladores', 'monitores'], bySlug);
    expect(resolved.configured).toBe(true);
    expect(resolved.ids.has(VENTILADORES_ID)).toBe(true);
    expect(resolved.ids.has(MONITOR_ID)).toBe(true);
  });

  it('resolveFamiliaFilter accepts raw UUIDs (case-insensitive)', () => {
    const resolved = resolveFamiliaFilter([VENTILADORES_ID.toUpperCase()], bySlug);
    expect(resolved.configured).toBe(true);
    expect(resolved.ids.has(VENTILADORES_ID)).toBe(true);
  });

  it('resolveFamiliaFilter keeps configured=true when slug typos do not resolve', () => {
    const resolved = resolveFamiliaFilter(['familia-inexistente'], bySlug);
    expect(resolved.configured).toBe(true);
    expect(resolved.ids.size).toBe(0);
  });

  it('excludes lines whose familia slug was listed in familias_excluidas', () => {
    const excluidas = resolveFamiliaFilter(['ventiladores'], bySlug);
    const vacias = resolveFamiliaFilter([], bySlug);

    expect(
      isCuponLineaElegible({
        slug: 'vent-a',
        familiaId: VENTILADORES_ID,
        productosIncluidos: new Set(),
        productosExcluidos: new Set(),
        familiasIncluidas: vacias,
        familiasExcluidas: excluidas,
      })
    ).toBe(false);

    expect(
      isCuponLineaElegible({
        slug: 'monitor-b',
        familiaId: MONITOR_ID,
        productosIncluidos: new Set(),
        productosExcluidos: new Set(),
        familiasIncluidas: vacias,
        familiasExcluidas: excluidas,
      })
    ).toBe(true);
  });

  it('regression: raw slug≡UUID compare would fail-open exclusions', () => {
    // Pre-fix behavior: Set(["ventiladores"]).has(uuid) === false → eligible.
    const brokenExcluidas = {
      configured: true,
      ids: new Set(['ventiladores']),
    };
    expect(
      isCuponLineaElegible({
        slug: 'vent-a',
        familiaId: VENTILADORES_ID,
        productosIncluidos: new Set(),
        productosExcluidos: new Set(),
        familiasIncluidas: resolveFamiliaFilter([], bySlug),
        familiasExcluidas: brokenExcluidas,
      })
    ).toBe(true);

    const fixed = resolveFamiliaFilter(['ventiladores'], bySlug);
    expect(
      isCuponLineaElegible({
        slug: 'vent-a',
        familiaId: VENTILADORES_ID,
        productosIncluidos: new Set(),
        productosExcluidos: new Set(),
        familiasIncluidas: resolveFamiliaFilter([], bySlug),
        familiasExcluidas: fixed,
      })
    ).toBe(false);
  });

  it('inclusions fail closed when configured slugs do not resolve', () => {
    const incluidas = resolveFamiliaFilter(['typo-familia'], bySlug);
    expect(incluidas.configured).toBe(true);
    expect(
      isCuponLineaElegible({
        slug: 'vent-a',
        familiaId: VENTILADORES_ID,
        productosIncluidos: new Set(),
        productosExcluidos: new Set(),
        familiasIncluidas: incluidas,
        familiasExcluidas: resolveFamiliaFilter([], bySlug),
      })
    ).toBe(false);
  });
});
