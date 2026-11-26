import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const htaccess = readFileSync(join(process.cwd(), 'public', '.htaccess'), 'utf8');

describe('htaccess indexación', () => {
  it('redirige anclas antiguas a la URL canónica en inglés', () => {
    expect(htaccess).toContain('RewriteRule ^contact/?$ /en/contact/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^about/?$ /en/about/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^privacy/?$ /en/legal/privacy/ [R=301,L]');
  });

  it('manda la paginación de catálogo inexistente a la raíz', () => {
    expect(htaccess).toContain('RewriteRule ^en/catalog/pagina/[0-9]+/?$ /en/catalog/? [R=301,L]');
    expect(htaccess).toContain(
      'RewriteRule ^es/catalogo/pagina/[0-9]+/?$ /es/catalogo/? [R=301,L]'
    );
  });

  it('manda fichas sin locale a la URL canónica y deja el índice de productos', () => {
    expect(htaccess).toContain('RewriteRule ^producto/([^/]+)/?$ /es/productos/$1/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^productos/([^/]+)/?$ /es/productos/$1/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^es/producto/([^/]+)/?$ /es/productos/$1/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^product/([^/]+)/?$ /en/products/$1/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^products/([^/]+)/?$ /en/products/$1/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^en/product/([^/]+)/?$ /en/products/$1/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^es/productos/?$ /es/catalogo/ [R=301,L]');
    expect(htaccess).toContain('RewriteRule ^en/products/?$ /en/catalog/ [R=301,L]');
  });

  it('el piloto CDN solo cachea el HTML de /es/catalogo/', () => {
    expect(htaccess).toContain('Header always set Cache-Control "public, max-age=0, s-maxage=3600"');
    expect(htaccess).toContain('Header always set Cache-Control "private, no-store"');
    expect(htaccess).toContain('RewriteRule ^es/catalogo/$ - [E=CDN_PILOTO_CATALOGO:1]');
    expect(htaccess).toContain('RewriteRule ^es/catalogo/index\\.html$ - [E=CDN_PILOTO_CATALOGO:1]');
    expect(htaccess).not.toMatch(/s-maxage=3600[\s\S]{0,80}pagina/);
    expect(htaccess).toContain('Header merge Vary Accept');
  });

  it('responde 410 al slug truncado g-g sin tocar las reglas g-gmrn', () => {
    expect(htaccess).toContain('RewriteRule ^(?:es/productos|en/products)/g-g/?$ - [G,L]');
    expect(htaccess).toContain('g-gmrn');
  });
});
