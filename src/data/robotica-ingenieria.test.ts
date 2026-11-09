import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { getCampaignLanding } from './comercial-landings';
import { getFamiliaSeo } from './familia-seo';
import { PROMO_PADBOT_EN, PROMO_PADBOT_ES } from './promo-padbot';
import {
  FAQS,
  LAYERS,
  PAGE,
  PHONE_DISPLAY,
  PROJECTS,
  ROBOTICA_COPY,
  ROBOTICA_PATH,
  ROBOTS,
  UNIX_COPY,
  UNIX_ROBOTS,
  VERTICALS,
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
      const lists = graph['@graph'].filter(
        node => node['@type'] === 'ItemList'
      ) as unknown as Array<{
        name: string;
        itemListElement: unknown[];
      }>;
      expect(lists).toHaveLength(2);
      expect(lists[1]?.itemListElement).toHaveLength(3);
      expect(lists[1]?.name).toMatch(/Rehabilitación de la marcha|Gait rehabilitation/);
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

  it('no atribuye uso clínico, diagnóstico ni terapéutico a PadBot ni a Cruzr', () => {
    const texto = JSON.stringify({
      PAGE,
      FAQS,
      ROBOTS,
      VERTICALS,
      PROJECTS,
      LAYERS,
      ROBOTICA_COPY,
      PROMO_PADBOT_ES,
      PROMO_PADBOT_EN,
    });
    expect(texto).toContain('Telepresencia y comunicación en instalaciones');
    expect(texto).toContain('Telepresence and on-site communication');
    expect(texto).toContain('transporte interno de insumos y documentos');
    expect(texto).toContain('internal transport of supplies and documents');
    expect(texto).not.toMatch(/Telepresencia médica|rondas clínicas|medicamentos/);
    expect(texto).not.toMatch(/Medical telepresence|clinical rounds|samples, medication/);
    expect(texto).not.toMatch(/pediátrico|pediatric companionship|HIS, ERP/);
    const p2 = ROBOTS.find(robot => robot.sku === 'PADBOT-P2');
    const w2 = ROBOTS.find(robot => robot.sku === 'PADBOT-W2');
    expect(p2?.role.es).toBe('Telepresencia y comunicación en instalaciones');
    expect(p2?.role.en).toBe('Telepresence and on-site communication');
    expect(w2?.summary.es).toContain('transporte interno de insumos y documentos');
    expect(w2?.summary.en).toContain('internal transport of supplies and documents');
  });

  it('añade ZW568, ZW598 y ZW518 sin precio ni 110 V', () => {
    const texto = textoPublico();
    expect(texto).toContain('ZW568');
    expect(texto).toContain('ZW598');
    expect(texto).toContain('ZW518');
    expect(texto).not.toMatch(/110\s*V/);
    expect(PAGE.es.rehabTitle).toContain('Rehabilitación de la marcha');
    expect(PAGE.en.rehabTitle).toContain('Gait rehabilitation');
  });
});

describe('línea UniX AI en la landing de robots', () => {
  const productos = JSON.parse(
    readFileSync(new URL('../data/mock-productos.json', import.meta.url), 'utf8')
  ) as Array<Record<string, unknown>>;
  const publicDir = new URL('../../public/', import.meta.url);

  it('publica exactamente Wanda 2.0 Pro, Panther Pro y Pioneer H, sin entrar en ROBOTS', () => {
    expect(UNIX_ROBOTS.map(robot => robot.model)).toEqual([
      'UniX Wanda 2.0 Pro',
      'UniX Panther Pro',
      'UniX Pioneer H',
    ]);
    expect(ROBOTS).toHaveLength(8);
    expect(ROBOTS.some(robot => robot.sku.startsWith('UNIX'))).toBe(false);
  });

  it('enlaza cada modelo a una ficha de producto activa, por cotización y sin precio', () => {
    for (const robot of UNIX_ROBOTS) {
      const producto = productos.find(item => item.slug === robot.slug);
      expect(producto, robot.slug).toBeDefined();
      expect(producto?.sku).toBe(robot.sku);
      expect(producto?.activo).toBe(true);
      expect(producto?.precio).toBeNull();
      expect(producto?.fulfillment_mode).toBe('cotizacion');
      expect(producto?.tipo_comercial).toBe('equipo');
      expect(producto?.marca).toBe('UniX');
      expect(producto?.familia_slug).toBe('robots');
    }
  });

  it('referencia solo archivos que existen en public/', () => {
    const rutas = [...UNIX_ROBOTS.flatMap(robot => [robot.image, robot.pdf])];
    for (const ruta of rutas) {
      expect(existsSync(new URL(`.${ruta}`, publicDir)), ruta).toBe(true);
    }
    for (const robot of UNIX_ROBOTS) {
      const producto = productos.find(item => item.slug === robot.slug);
      expect(producto?.ficha_pdf).toBe(robot.pdf);
      expect(producto?.imagen_principal).toBe(robot.image);
    }
  });

  it('copia cifras literales de las fichas del fabricante', () => {
    const wanda = UNIX_ROBOTS[0]!;
    expect(wanda.specs.map(spec => spec.value).join(' ')).toContain('527 × 620 × 1680 mm');
    expect(wanda.specs.map(spec => spec.value).join(' ')).toContain('12 kg');
    const panther = UNIX_ROBOTS[1]!;
    expect(panther.specs.map(spec => spec.value).join(' ')).toContain('6 kg');
    const pioneer = UNIX_ROBOTS[2]!;
    expect(pioneer.specs.map(spec => spec.value).join(' ')).toContain('25 kg');
    expect(pioneer.specs.map(spec => spec.value).join(' ')).toContain('IP67');
  });

  it('no publica Wanda 3.0, Martian, KEENON, Unitree, Reeman, Pudu, SDK ni precios', () => {
    const texto = JSON.stringify({ UNIX_ROBOTS, UNIX_COPY });
    expect(texto).not.toMatch(/Wanda 3|Martian|KEENON|Keenon|Unitree|Reeman|Pudu|SDK/);
    expect(texto).not.toMatch(/Equitronic|Northern|Monnal/);
    expect(texto).not.toMatch(/\$\s?\d{2,}|COP\s?\d/);
    expect(texto).not.toMatch(/275 TOPS/);
    expect(texto).not.toMatch(/clínic|clinic|telepresencia médica/i);
    expect(PAGE.es.lead).not.toMatch(/Wanda 3|Martian|KEENON|Unitree|Reeman|Pudu/);
    expect(PAGE.en.lead).not.toMatch(/Wanda 3|Martian|KEENON|Unitree|Reeman|Pudu/);
  });

  it('no publica certificados emitidos para Wanda 2.0 Ultra en la ficha del Pro', () => {
    // FCC SDoC, CE EMC, CE RED y CE Máquinas nombran solo «Wanda 2.0 Ultra».
    // Se retiran hasta que el fabricante confirme que aplican al Pro.
    expect(
      existsSync(
        new URL('./assets/productos/importados/unix-wanda-2-0-pro/certificados/', publicDir)
      )
    ).toBe(false);
    const wanda = productos.find(item => item.slug === UNIX_ROBOTS[0]!.slug);
    const texto = JSON.stringify({ UNIX_ROBOTS, UNIX_COPY, wanda });
    expect(texto).not.toMatch(/Ultra|certificado-|FCC|EMC/);
  });

  it('rotula las aplicaciones de robots sin lenguaje clínico', () => {
    expect(es.producto.aplicaciones_titulo_servicio).toBe('Aplicaciones');
    expect(en.producto.aplicaciones_titulo_servicio).toBe('Applications');
    expect(es.producto.aplicaciones_titulo_servicio).not.toMatch(/clínic/i);
    expect(en.producto.aplicaciones_titulo_servicio).not.toMatch(/clinic/i);
  });
});
