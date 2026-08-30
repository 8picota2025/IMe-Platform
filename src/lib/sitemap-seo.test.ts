import { describe, expect, it } from 'vitest';
import { serializeSitemapItem, chunkProducts, chunkKnowledge } from '../../scripts/sitemap-seo.mjs';

describe('sitemap-seo', () => {
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
