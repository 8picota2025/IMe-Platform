import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import mockProductos from '../data/mock-productos.json';
import { primaryProductSlugs } from './producto-seo-slug';

const RULE_RE =
  /^RewriteRule \^(es\/productos|en\/products)\/(.+?)\/\?\$ \/\1\/(.+?)\/ \[R=301,L\]$/;

function parseEsHops(htaccess: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of htaccess.split('\n')) {
    const match = RULE_RE.exec(line);
    if (!match || match[1] !== 'es/productos') continue;
    const source = match[2]!;
    const target = match[3]!;
    if (!map.has(source)) map.set(source, target);
  }
  return map;
}

function resolveFinal(slug: string, hops: Map<string, string>): string {
  let cur = slug;
  const seen = new Set<string>();
  while (hops.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = hops.get(cur)!;
  }
  return cur;
}

describe('public/.htaccess product redirects', () => {
  it('never 301s a live primary away, and every chain ends on a live primary', () => {
    const htaccess = readFileSync(path.join(process.cwd(), 'public/.htaccess'), 'utf8');
    const primaries = primaryProductSlugs(mockProductos as Array<{ slug: string }>);
    const hops = parseEsHops(htaccess);

    const stolen: string[] = [];
    const dead: string[] = [];
    for (const [source, target] of hops) {
      if (primaries.has(source)) stolen.push(`${source}→${target}`);
      const final = resolveFinal(source, hops);
      if (!primaries.has(final)) dead.push(`${source}→…→${final}`);
    }

    expect(stolen, `live PDP URLs stolen by redirects:\n${stolen.join('\n')}`).toEqual([]);
    expect(dead, `redirect chains ending off-catalog:\n${dead.join('\n')}`).toEqual([]);
  });

  it('keeps high-risk commerce URLs on their own product', () => {
    const htaccess = readFileSync(path.join(process.cwd(), 'public/.htaccess'), 'utf8');
    const hops = parseEsHops(htaccess);

    expect(hops.has('lampara-quirurgica-ref-ainno-saikang')).toBe(false);
    expect(hops.has('silla-de-ruedas-de-transporte-en-aluminio-tipo-avion')).toBe(false);
    expect(hops.has('compresor-nebulizador-nube-3000-plus')).toBe(false);

    expect(resolveFinal('g-gmrn-211', hops)).toBe('compresor-nebulizador-nube-3000-plus');
    expect(resolveFinal('g-kp9806l', hops)).toBe(
      'silla-de-ruedas-de-transporte-en-aluminio-tipo-avion'
    );
    expect(resolveFinal('saikang-ainno', hops)).toBe('lampara-quirurgica-ref-ainno-saikang');
  });
});
