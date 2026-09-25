import { describe, expect, it } from 'vitest';
import { serializeSitemapItem, chunkProducts, chunkKnowledge } from '../../scripts/sitemap-seo.mjs';
import { isIndexableSitemapUrl } from '../../scripts/sitemap-indexability.mjs';
import { getLocalizedPath } from '../i18n/utils';

describe('sitemap-seo', () => {
  it('da las mismas alternas que la web (getLocalizedPath) en rutas con par de sección o anidado', () => {
    const rutas = [
      '/es/conocimiento/tema/monitoreo-uci/',
      '/en/knowledge/topic/monitoreo-uci/',
      '/es/recursos/checklist-recepcion-monitor/',
      '/en/resources/monitor-receiving-checklist/',
      '/es/dotacion-monitoreo-uci/',
      '/en/icu-monitoring-projects/',
      '/es/conocimiento/publicar/',
      '/es/monitores-biolight-uci/',
    ];
    for (const ruta of rutas) {
      const links = serializeSitemapItem({ url: `https://i-me.com.co${ruta}` }).links ?? [];
      const es = links.find(l => l.lang === 'es')?.url;
      const en = links.find(l => l.lang === 'en')?.url;
      expect(es, ruta).toBe(`https://i-me.com.co${getLocalizedPath(ruta, 'es')}`);
      expect(en, ruta).toBe(`https://i-me.com.co${getLocalizedPath(ruta, 'en')}`);
    }
  });

  it('assigns high priority and hreflang to GSC campaign landings', () => {
    const item = serializeSitemapItem({
      url: 'https://i-me.com.co/es/monitores-biolight-uci/',
    });
    expect(item.priority).toBe(0.9);
    expect(item.changefreq).toBe('weekly');
    expect(item.lastmod).toBeTruthy();
    expect(item.links?.some(l => l.lang === 'en' && l.url.includes('biolight-icu-monitors'))).toBe(
      true
    );
  });

  it('links EN campaign URL back to ES hreflang', () => {
    const item = serializeSitemapItem({
      url: 'https://i-me.com.co/en/fisher-paykel-high-flow/',
    });
    expect(
      item.links?.some(l => l.lang === 'es' && l.url.includes('alto-flujo-fisher-paykel'))
    ).toBe(true);
  });

  it('maps conocimiento/publicar ↔ knowledge/publish for hreflang', () => {
    const item = serializeSitemapItem({
      url: 'https://i-me.com.co/es/conocimiento/publicar/',
    });
    expect(item.links?.some(l => l.lang === 'en' && l.url.endsWith('/en/knowledge/publish/'))).toBe(
      true
    );
  });

  it('chunks products and knowledge separately', () => {
    const product = chunkProducts({ url: 'https://i-me.com.co/es/productos/foo/' });
    const article = chunkKnowledge({
      url: 'https://i-me.com.co/es/conocimiento/caminadores-para-adultos-guia-compra-colombia/',
    });
    const page = chunkProducts({ url: 'https://i-me.com.co/es/servicios/' });
    expect(product?.url).toContain('/productos/');
    expect(article?.url).toContain('/conocimiento/');
    expect(page).toBeUndefined();
  });
});

describe('sitemap-indexability', () => {
  it('excludes private and legacy prefixes without substring false positives', () => {
    expect(isIndexableSitemapUrl('https://i-me.com.co/es/conocimiento/')).toBe(true);
    expect(isIndexableSitemapUrl('https://i-me.com.co/es/catalogo/')).toBe(true);
    expect(isIndexableSitemapUrl('https://i-me.com.co/admin/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/es/pago/xyz/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/en/payment/xyz/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/77/catalogo.html')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/1old/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/blog/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/es/conocimiento/publicar/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/es/cotizacion/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/es/productos/test/')).toBe(false);
    expect(isIndexableSitemapUrl('https://i-me.com.co/en/products/test/')).toBe(false);
    expect(
      isIndexableSitemapUrl('https://i-me.com.co/es/productos/test-de-pasarela-de-pagos/')
    ).toBe(false);
    expect(
      isIndexableSitemapUrl(
        'https://i-me.com.co/es/productos/lampara-quirurgica-ref-ainno-saikang/'
      )
    ).toBe(false);
    expect(
      isIndexableSitemapUrl('https://i-me.com.co/en/products/lampara-quirurgica-ref-ainno-saikang/')
    ).toBe(false);
    expect(
      isIndexableSitemapUrl('https://i-me.com.co/es/productos/monitor-administrativo-demo/')
    ).toBe(true);
  });
});
