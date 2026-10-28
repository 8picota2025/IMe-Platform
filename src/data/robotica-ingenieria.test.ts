import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCampaignLanding } from './comercial-landings';
import { getFamiliaSeo } from './familia-seo';
import { PROMO_PADBOT_EN, PROMO_PADBOT_ES } from './promo-padbot';
import {
  FAQS,
  PAGE,
  PHONE_DISPLAY,
  ROBOTICA_PATH,
  ROBOTS,
  WARRANTY,
  buildRoboticaJsonLd,
} from './robotica-ingenieria';

const SKUS = [
  'PADBOT-X3',
  'PADBOT-X2',
  'PADBOT-P2',
  'PADBOT-W2',
  'PADBOT-W3S',
  'C3-CLEANING-ROBOT',
  'PADBOT-T2',
  'CRUZR-AHUMAN-FUTURE',
] as const;

function textoPublico(): string {
  return JSON.stringify({ PAGE, FAQS, ROBOTS, WARRANTY, PROMO_PADBOT_ES, PROMO_PADBOT_EN });
}

describe('landing de distribuidores de robots', () => {
  it('publica los ocho robots del catálogo y ningún SKU nuevo', () => {
    expect(ROBOTS.map(robot => robot.sku)).toEqual([...SKUS]);
    expect(new Set(ROBOTS.map(robot => robot.slug)).size).toBe(8);
  });

  it('coloca las keywords de cabecera en title, descripción y h1', () => {
    expect(PAGE.es.title).toBe('Distribuidores de robots en Colombia y Latinoamérica | I-ME');
    expect(PAGE.es.h1).toContain('Ingeniería Robótica en Colombia y Latinoamérica');
    expect(PAGE.es.description).toContain('Latinoamérica');
    expect(PAGE.es.description).toContain('LiDAR SLAM');
    expect(PAGE.en.title).toContain('Robot Distributors');
    expect(PAGE.en.title).toContain('Latin America');
    expect(PAGE.en.h1).toContain('Robotics Engineering in Colombia and Latin America');
    expect(ROBOTICA_PATH.es).toBe(
      '/es/distribuidores-de-robots-e-ingenieria-robotica-en-colombia-y-latinoamerica/'
    );
    expect(ROBOTICA_PATH.en).toBe(
      '/en/robot-distributors-and-robotics-engineering-in-colombia-and-latin-america/'
    );
    expect(getCampaignLanding('robotica_rehabilitacion', 'es').h1).toBe(PAGE.es.h1);
    expect(getCampaignLanding('robotica_rehabilitacion', 'es').productSlugs).toEqual(
      ROBOTS.map(robot => robot.slug)
    );
  });

  it('usa el teléfono único y no inventa precios, INVIMA ni PadBot 3', () => {
    const texto = textoPublico();
    expect(texto).toContain(PHONE_DISPLAY);
    expect(texto).not.toMatch(/PadBot 3/);
    expect(texto).not.toMatch(/Equitronic|Northern|Monnal|\+34/);
    expect(texto).not.toMatch(/\$\s?\d{2,}|COP\s?\d|UNSPSC\s*[:#]?\s*\d|INVIMA\s*[A-Z]{0,3}\s*\d/);
    expect(WARRANTY.es).toContain('Garantía oficial del fabricante');
    expect(FAQS.map(item => item.a.es).join(' ')).toContain(PHONE_DISPLAY);
  });

  it('marca la promoción como posibilidad según el pedido, no como ambos robots', () => {
    expect(PROMO_PADBOT_ES).toMatch(/PadBot P2 o PadBot X3/);
    expect(PROMO_PADBOT_ES.toLowerCase()).not.toMatch(/ambos|los dos/);
    expect(PROMO_PADBOT_EN.toLowerCase()).not.toMatch(/both robots/);
  });

  it('emite FAQ, ItemList y WebPage sin Product ni Offer', () => {
    for (const locale of ['es', 'en'] as const) {
      const graph = JSON.parse(buildRoboticaJsonLd(locale)) as {
        '@graph': Array<{ '@type': string | string[] }>;
      };
      const types = graph['@graph'].flatMap(node =>
        Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
      );
      expect(types).toContain('FAQPage');
      expect(types).toContain('ItemList');
      expect(types).toContain('WebPage');
      expect(types).toContain('CollectionPage');
      expect(types).not.toContain('Product');
      expect(types).not.toContain('Offer');
      const list = graph['@graph'].find(node => node['@type'] === 'ItemList') as unknown as {
        itemListElement: unknown[];
      };
      expect(list.itemListElement).toHaveLength(8);
    }
  });

  it('refuerza el cluster en la familia de robots', () => {
    const familia = getFamiliaSeo('robots');
    expect(familia?.title_es).toContain('ingeniería robótica en Colombia');
    expect(familia?.description_es.length).toBeLessThanOrEqual(155);
    expect(familia?.description_en.length).toBeLessThanOrEqual(155);
    expect(familia?.faq).toHaveLength(3);
    expect(`${familia?.intro_es} ${familia?.body_es.join(' ')}`).toContain('LiDAR');
    expect(familia?.body_es.join(' ')).not.toMatch(/PadBot 3/);
  });

  it('la página canónica renderiza el componente nuevo', () => {
    const es = readFileSync(
      new URL(
        '../pages/es/distribuidores-de-robots-e-ingenieria-robotica-en-colombia-y-latinoamerica.astro',
        import.meta.url
      ),
      'utf8'
    );
    const en = readFileSync(
      new URL(
        '../pages/en/robot-distributors-and-robotics-engineering-in-colombia-and-latin-america.astro',
        import.meta.url
      ),
      'utf8'
    );
    expect(es).toContain('RoboticaIngenieriaLanding');
    expect(en).toContain('RoboticaIngenieriaLanding');
  });
});
