import { describe, expect, it, vi } from 'vitest';

vi.mock('./conocimiento-imagen-manifest', () => ({
  imagenMirrorParaArticulo: (slug: string) => {
    if (slug === 'con-mirror') {
      return {
        src: '/assets/img/conocimiento/con-mirror.webp',
        width: 800,
        height: 450,
        og_src: '/assets/img/conocimiento/con-mirror-og-red-social-equipos-biomedicos-ime.webp',
        og_width: 1200,
        og_height: 630,
      };
    }
    return undefined;
  },
}));

import {
  absoluteImagenUrl,
  imagenParaArticulo,
  resolverImagenArticulo,
  resolverOgImagenArticulo,
} from './conocimiento-imagenes';

describe('resolverImagenArticulo', () => {
  it('prioriza mirror cuando hay imagen CMS', () => {
    const img = resolverImagenArticulo({
      slug: 'con-mirror',
      imagen: 'https://cdn.example/storage/foto.jpg',
    });
    expect(img.src).toBe('/assets/img/conocimiento/con-mirror.webp');
  });

  it('usa URL CMS si hay imagen y no hay mirror (nunca fallback keyword)', () => {
    const img = resolverImagenArticulo({
      slug: 'guia-monitores-multiparametricos-uci',
      imagen: 'https://cdn.example/storage/nueva-uci.jpg',
    });
    expect(img.src).toBe('https://cdn.example/storage/nueva-uci.jpg');
    expect(img.src).not.toContain('hospital-uci-pasillo');
  });

  it('solo usa fallback por slug si no hay imagen CMS', () => {
    const img = resolverImagenArticulo({
      slug: 'guia-monitores-multiparametricos-uci',
      imagen: null,
    });
    expect(img.src).toBe(imagenParaArticulo('guia-monitores-multiparametricos-uci').src);
  });

  it('guía caminadores usa assets editoriales ES/EN', () => {
    const es = resolverImagenArticulo(
      {
        slug: 'caminadores-para-adultos-guia-compra-colombia',
        imagen: 'https://cdn.example/x.jpg',
      },
      'es'
    );
    const en = resolverImagenArticulo(
      {
        slug: 'caminadores-para-adultos-guia-compra-colombia',
        imagen: 'https://cdn.example/x.jpg',
      },
      'en'
    );
    expect(es.src).toBe('/assets/img/guia-compra-caminadores-es.webp');
    expect(en.src).toBe('/assets/img/buying-guide-adult-walkers-en.webp');
  });
});

describe('resolverOgImagenArticulo', () => {
  it('prioriza variante OG del mirror', () => {
    const og = resolverOgImagenArticulo({
      slug: 'con-mirror',
      imagen: 'https://cdn.example/storage/foto.jpg',
    });
    expect(og.src).toContain('og-red-social');
    expect(og.width).toBe(1200);
    expect(og.height).toBe(630);
  });
});

describe('absoluteImagenUrl', () => {
  it('deja absolutas intactas', () => {
    expect(absoluteImagenUrl('https://cdn.example/a.webp')).toBe('https://cdn.example/a.webp');
  });

  it('prefija sitio en rutas relativas', () => {
    expect(absoluteImagenUrl('/assets/img/x.webp')).toBe('https://i-me.com.co/assets/img/x.webp');
  });
});
