import { describe, expect, it } from 'vitest';
import {
  brandSlugFromLabel,
  ensureUniqueProductoSeoSlug,
  isOpaqueProductSlug,
  mergeLegacySlugs,
  planProductoSeoSlug,
} from './producto-seo-slug';

describe('producto-seo-slug', () => {
  it('añade fabricante a una URL descriptiva que ya tiene modelo', () => {
    const plan = planProductoSeoSlug({
      slug: 'incubadora-neonatal-a3186',
      nombre_es: 'Incubadora Neonatal A3186',
      sku: 'A3186',
      atributos: { fabricante: 'Advanced' },
    });
    expect(plan.newSlug).toBe('incubadora-neonatal-a3186-advanced');
    expect(plan.changed).toBe(true);
  });

  it('añade modelo y fabricante sin pisar la descripción existente', () => {
    const plan = planProductoSeoSlug({
      slug: 'sistema-de-rayos-x-dr-montado-en-suelo',
      nombre_es: 'Sistema de Rayos X DR Montado en Suelo',
      sku: 'DR-FLOOR',
      atributos: { marca: 'Angell Technology' },
    });
    expect(plan.newSlug).toBe('sistema-de-rayos-x-dr-montado-en-suelo-ref-dr-floor-angell');
  });

  it('reescribe slugs opacos g-* a descripción + ref + fabricante', () => {
    expect(isOpaqueProductSlug('g-kp68081')).toBe(true);
    const plan = planProductoSeoSlug({
      slug: 'g-kp68081',
      nombre_es: 'Barra de seguridad tamaño 40-64 cm Konfort Plus',
      sku: 'KP68081',
      atributos: { marca: 'Konfort Plus' },
    });
    expect(plan.newSlug).toContain('barra-de-seguridad');
    expect(plan.newSlug).toContain('ref-kp68081');
    expect(plan.newSlug).toContain('konfort-plus');
    expect(plan.changed).toBe(true);
  });

  it('no duplica fabricante ni modelo si ya están en el slug', () => {
    const plan = planProductoSeoSlug({
      slug: 'humidificador-respiratorio-ref-950-fisher-paykel',
      nombre_es: 'Humidificador Respiratorio Ref 950 Fisher & Paykel',
      sku: '950',
      atributos: { marca: 'Fisher & Paykel' },
    });
    expect(plan.newSlug).toBe('humidificador-respiratorio-ref-950-fisher-paykel');
    expect(plan.changed).toBe(false);
  });

  it('es idempotente sobre un slug ya enriquecido', () => {
    const plan = planProductoSeoSlug({
      slug: 'incubadora-neonatal-a3186-advanced',
      nombre_es: 'Incubadora Neonatal A3186',
      sku: 'A3186',
      atributos: { fabricante: 'Advanced' },
    });
    expect(plan.changed).toBe(false);
  });

  it('no vuelve a insertar modelo cuando el SKU ya está partido en el slug', () => {
    const plan = planProductoSeoSlug({
      slug: 'ventilador-neonatal-pedriatrico-convencional-ref-6000-sle',
      nombre_es: 'Ventilador Neonatal Pediátrico Convencional Ref 6000 SLE',
      sku: 'SLE6000',
      atributos: { marca: 'SLE' },
    });
    expect(plan.changed).toBe(false);
  });

  it('acorta marcas corporativas largas', () => {
    expect(brandSlugFromLabel('Rayto Life and Analytical Sciences Co.,Ltd.')).toBe('rayto');
  });

  it('no renombra el producto de prueba test', () => {
    expect(planProductoSeoSlug({ slug: 'test', nombre_es: 'Test' }).changed).toBe(false);
  });

  it('garantiza unicidad y conserva legacy_slugs', () => {
    const occupied = new Set(['foo-advanced']);
    expect(ensureUniqueProductoSeoSlug('foo-advanced', occupied, 'a3186')).toBe(
      'foo-advanced-a3186'
    );
    expect(mergeLegacySlugs(['old-a'], 'old-b', 'new')).toEqual(['old-a', 'old-b']);
    expect(mergeLegacySlugs(['new'], 'new', 'new')).toEqual([]);
  });
});
