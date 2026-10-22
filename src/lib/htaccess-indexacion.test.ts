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

  it('responde 410 al slug truncado g-g sin tocar las reglas g-gmrn', () => {
    expect(htaccess).toContain('RewriteRule ^(?:es/productos|en/products)/g-g/?$ - [G,L]');
    expect(htaccess).toContain('g-gmrn');
  });
});
