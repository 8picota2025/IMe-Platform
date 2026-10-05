import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { optimizeHtaccess } from './optimize-htaccess-redirects.mjs';

const SIMPLE =
  /^RewriteRule \^(es\/productos|en\/products)\/([a-z0-9._-]+)\/\?\$ (\/[a-z0-9._/-]+\/) \[R=301,L(?:,NE)?\]$/;
const GONE =
  /^RewriteRule \^\(\?:es\/productos\|en\/products\)\/\(\?:([^)]*)\)\(\?:\/index\\\.html\|\/\?\)\$ - \[G,L\]$/;
const GONE_ONE = /^RewriteRule \^(es\/productos|en\/products)\/([a-z0-9._-]+)\/\?\$ - \[G,L\]$/;

/** Simulador independiente: aplica la primera regla que coincide, como Apache con [L]. */
function parseRules(text) {
  const rules = [];
  let pendingCond = false;
  for (const line of text.split('\n')) {
    if (/^RewriteCond /.test(line)) {
      pendingCond = true;
      continue;
    }
    if (!/^RewriteRule /.test(line)) continue;
    const skip = pendingCond;
    pendingCond = false;
    if (skip) continue;
    let m = line.match(GONE);
    if (m) {
      rules.push({ type: 'gone', slugs: new Set(m[1].split('|')) });
      continue;
    }
    m = line.match(GONE_ONE);
    if (m) {
      rules.push({ type: 'gone', section: m[1], slugs: new Set([m[2]]) });
      continue;
    }
    m = line.match(SIMPLE);
    if (m) rules.push({ type: 'redirect', section: m[1], slug: m[2], target: m[3] });
  }
  return rules;
}

function follow(rules, startPath) {
  let current = startPath;
  let hops = 0;
  for (let i = 0; i < 12; i += 1) {
    const m = current.match(/^\/(es\/productos|en\/products)\/([a-z0-9._-]+)\/$/);
    if (!m) return { hops, status: 200, final: current };
    const [, section, slug] = m;
    const rule = rules.find(r =>
      r.type === 'gone'
        ? (!r.section || r.section === section) && r.slugs.has(slug)
        : r.section === section && r.slug === slug
    );
    if (!rule) return { hops, status: 200, final: current };
    if (rule.type === 'gone') return { hops, status: 410, final: current };
    hops += 1;
    current = rule.target;
  }
  return { hops, status: 'loop', final: current };
}

const SAMPLE = [
  'RewriteEngine On',
  'RewriteRule ^(?:es/productos|en/products)/(?:retirado)(?:/index\\.html|/?)$ - [G,L]',
  '# bloque A',
  'RewriteRule ^es/productos/a/?$ /es/productos/b/ [R=301,L]',
  'RewriteRule ^es/productos/b/?$ /es/productos/c/ [R=301,L]',
  'RewriteRule ^es/productos/c/?$ /es/productos/d/ [R=301,L]',
  'RewriteRule ^es/productos/a/?$ /es/productos/b/ [R=301,L]',
  'RewriteRule ^es/productos/a/?$ /es/productos/otro/ [R=301,L]',
  'RewriteRule ^en/products/x/?$ /en/products/retirado/ [R=301,L,NE]',
  'RewriteRule ^es/productos/retirado/?$ /es/productos/z/ [R=301,L]',
  'RewriteCond %{QUERY_STRING} ^q=1$',
  'RewriteRule ^es/productos/cond/?$ /es/productos/destino/ [R=301,L]',
  'RewriteRule ^es/productos/destino/?$ /es/productos/final/ [R=301,L]',
  'RewriteRule ^es/catalogo/?$ /es/catalogo/? [R=301,L]',
].join('\n');

describe('optimizeHtaccess', () => {
  const { text, stats, ignored } = optimizeHtaccess(SAMPLE);
  const antes = parseRules(SAMPLE);
  const despues = parseRules(text);

  it('lleva cada slug antiguo a su destino final en un solo salto', () => {
    expect(text).toContain('RewriteRule ^es/productos/a/?$ /es/productos/d/ [R=301,L]');
    expect(text).toContain('RewriteRule ^es/productos/b/?$ /es/productos/d/ [R=301,L]');
    expect(follow(despues, '/es/productos/a/').hops).toBe(1);
  });

  it('no cambia el destino final ni el estado de ninguna URL', () => {
    for (const origen of ['a', 'b', 'c', 'x', 'retirado']) {
      for (const section of ['es/productos', 'en/products']) {
        const p = `/${section}/${origen}/`;
        const a = follow(antes, p);
        const d = follow(despues, p);
        // En un 410 la "URL final" no es comparable (antes era el slug retirado, ahora el propio origen).
        expect(d.status).toBe(a.status);
        if (a.status !== 410) expect(d.final).toBe(a.final);
        expect(d.hops).toBeLessThanOrEqual(a.hops);
      }
    }
  });

  it('elimina duplicados idénticos, reglas con otro destino que nunca se ejecutan y reglas tras un 410', () => {
    expect(stats.duplicadasIdenticas).toBe(1);
    expect(stats.ignoradasOtroDestino).toBe(1);
    expect(ignored[0]).toEqual({
      origen: '/es/productos/a/',
      destinoEfectivo: '/es/productos/b/',
      destinoIgnorado: '/es/productos/otro/',
    });
    expect(stats.yaRetiradasPorLista410).toBe(1);
    expect(text).not.toContain('/es/productos/retirado/?$ /es/productos/z/');
  });

  it('convierte en 410 las cadenas que acaban en un producto retirado', () => {
    expect(text).toContain('RewriteRule ^en/products/x/?$ - [G,L]');
    expect(stats.convertidasA410).toBe(1);
  });

  it('no toca reglas con RewriteCond ni otras reglas', () => {
    expect(text).toContain('RewriteCond %{QUERY_STRING} ^q=1$');
    expect(text).toContain('RewriteRule ^es/productos/cond/?$ /es/productos/destino/ [R=301,L]');
    expect(text).toContain('RewriteRule ^es/catalogo/?$ /es/catalogo/? [R=301,L]');
    expect(text).toContain('# bloque A');
  });

  it('es idempotente', () => {
    expect(optimizeHtaccess(text).text).toBe(text);
  });
});

describe('public/.htaccess real', () => {
  it('ya está optimizado: sin cadenas, sin duplicados ni reglas inalcanzables', async () => {
    const real = await readFile(path.join(process.cwd(), 'public/.htaccess'), 'utf8');
    const { text, stats } = optimizeHtaccess(real);
    // Si falla: ejecuta `npm run htaccess:optimize` y revisa el diff.
    expect(stats.colapsadas + stats.convertidasA410).toBe(0);
    expect(stats.duplicadasIdenticas + stats.ignoradasOtroDestino + stats.yaRetiradasPorLista410).toBe(0);
    expect(text).toBe(real);

    const rules = parseRules(real);
    const redirects = rules.filter(r => r.type === 'redirect');
    const sinResolver = redirects.filter(r => follow(rules, `/${r.section}/${r.slug}/`).hops > 1);
    expect(sinResolver.map(r => `/${r.section}/${r.slug}/`)).toEqual([]);
  });
});
