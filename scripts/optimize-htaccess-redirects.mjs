#!/usr/bin/env node
/**
 * Optimiza las redirecciones 301 de producto de `public/.htaccess` sin cambiar a dónde
 * llega cada URL:
 *
 *  1. Colapsa cadenas (slug A → B → C) para que cada slug antiguo llegue a su destino
 *     final en UN salto. Si el destino final es un producto retirado (lista 410), la regla
 *     pasa a responder 410 directamente.
 *  2. Elimina reglas que nunca se ejecutan: duplicados exactos, reglas con el mismo origen
 *     pero otro destino (en Apache gana la primera) y reglas cuyo origen ya responde 410
 *     en una lista anterior.
 *
 * Solo toca reglas de la forma
 *   RewriteRule ^(es/productos|en/products)/<slug>/?$ /<misma sección>/<slug>/ [R=301,L]
 * que no vayan precedidas de un RewriteCond. Todo lo demás (comentarios, otras reglas,
 * condiciones) queda exactamente igual. Es idempotente: volver a ejecutarlo no cambia nada.
 *
 * Uso:
 *   node scripts/optimize-htaccess-redirects.mjs            # reescribe public/.htaccess
 *   node scripts/optimize-htaccess-redirects.mjs --check    # no escribe; sale con 1 si hay cambios pendientes
 *   node scripts/optimize-htaccess-redirects.mjs --report ruta.csv   # lista las reglas ignoradas
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SIMPLE_RULE =
  /^RewriteRule \^(es\/productos|en\/products)\/([a-z0-9._-]+)\/\?\$ (\/(?:es\/productos|en\/products)\/[a-z0-9._-]+\/) (\[R=301,L(?:,NE)?\])$/;
const GONE_LIST =
  /^RewriteRule \^\(\?:es\/productos\|en\/products\)\/\(\?:([^)]*)\)\(\?:\/index\\\.html\|\/\?\)\$ - \[G,L\]$/;

const keyOf = (section, slug) => `${section}/${slug}`;

function targetKey(target) {
  const m = target.match(/^\/(es\/productos|en\/products)\/([a-z0-9._-]+)\/$/);
  return m ? keyOf(m[1], m[2]) : null;
}

/**
 * @param {string} text contenido de .htaccess
 * @returns {{ text: string, stats: object, ignored: Array<object> }}
 */
export function optimizeHtaccess(text) {
  const lines = text.split('\n');

  // Productos retirados (410) y la línea donde aparece cada lista.
  const goneAt = new Map(); // slug -> índice de línea de la lista
  lines.forEach((line, i) => {
    const m = line.match(GONE_LIST);
    if (m) for (const slug of m[1].split('|')) if (!goneAt.has(slug)) goneAt.set(slug, i);
  });

  // Primera aparición de cada regla simple (las que llevan RewriteCond delante no se tocan).
  const first = new Map(); // key -> { i, target }
  const simpleAt = new Map(); // i -> { section, slug, target, flags, key }
  let pendingCond = false;
  lines.forEach((line, i) => {
    if (/^RewriteCond /.test(line)) {
      pendingCond = true;
      return;
    }
    if (!/^RewriteRule /.test(line)) return;
    const m = !pendingCond ? line.match(SIMPLE_RULE) : null;
    pendingCond = false;
    if (!m) return;
    const [, section, slug, target, flags] = m;
    const key = keyOf(section, slug);
    simpleAt.set(i, { section, slug, target, flags, key });
    if (!first.has(key)) first.set(key, { i, target });
  });

  // Resuelve la cadena de cada origen siguiendo SOLO la primera regla de cada uno.
  const resolved = new Map(); // key -> { hops, final, loop, gone }
  const resolve = key => {
    if (resolved.has(key)) return resolved.get(key);
    const seen = new Set();
    let cur = key;
    let hops = 0;
    let final = null;
    let loop = false;
    while (first.has(cur)) {
      if (seen.has(cur)) {
        loop = true;
        break;
      }
      seen.add(cur);
      final = first.get(cur).target;
      hops += 1;
      const next = targetKey(final);
      if (!next) break;
      cur = next;
    }
    const slugFinal = final ? (targetKey(final) ?? '').split('/')[2] : '';
    const out = { hops, final, loop, gone: !loop && goneAt.has(slugFinal) };
    resolved.set(key, out);
    return out;
  };

  const stats = {
    reglasAntes: 0,
    reglasDespues: 0,
    duplicadasIdenticas: 0,
    ignoradasOtroDestino: 0,
    yaRetiradasPorLista410: 0,
    colapsadas: 0,
    convertidasA410: 0,
    saltosAntes: {},
    saltosDespues: {},
  };
  const ignored = [];
  const out = [];

  lines.forEach((line, i) => {
    const rule = simpleAt.get(i);
    if (!rule) {
      out.push(line);
      return;
    }
    stats.reglasAntes += 1;
    const firstRule = first.get(rule.key);

    // 1) Duplicadas o en conflicto: nunca se ejecutan (gana la primera).
    if (firstRule.i !== i) {
      if (firstRule.target === rule.target) stats.duplicadasIdenticas += 1;
      else {
        stats.ignoradasOtroDestino += 1;
        ignored.push({
          origen: `/${rule.section}/${rule.slug}/`,
          destinoEfectivo: firstRule.target,
          destinoIgnorado: rule.target,
        });
      }
      return;
    }

    // 2) El origen ya responde 410 en una lista anterior: la regla es inalcanzable.
    const goneLine = goneAt.get(rule.slug);
    if (goneLine !== undefined && goneLine < i) {
      stats.yaRetiradasPorLista410 += 1;
      return;
    }

    const r = resolve(rule.key);
    const hopsKey = String(r.hops);
    stats.saltosAntes[hopsKey] = (stats.saltosAntes[hopsKey] ?? 0) + 1;

    if (r.loop) {
      // Bucle: no se toca (no debería existir).
      out.push(line);
      stats.saltosDespues[hopsKey] = (stats.saltosDespues[hopsKey] ?? 0) + 1;
      stats.reglasDespues += 1;
      return;
    }
    if (r.gone) {
      out.push(`RewriteRule ^${rule.section}/${rule.slug}/?$ - [G,L]`);
      stats.convertidasA410 += 1;
      stats.saltosDespues['410'] = (stats.saltosDespues['410'] ?? 0) + 1;
    } else if (r.final !== rule.target) {
      out.push(`RewriteRule ^${rule.section}/${rule.slug}/?$ ${r.final} ${rule.flags}`);
      stats.colapsadas += 1;
      stats.saltosDespues['1'] = (stats.saltosDespues['1'] ?? 0) + 1;
    } else {
      out.push(line);
      stats.saltosDespues['1'] = (stats.saltosDespues['1'] ?? 0) + 1;
    }
    stats.reglasDespues += 1;
  });

  return { text: out.join('\n'), stats, ignored };
}

function toCsv(rows) {
  const head = 'origen,destino_efectivo,destino_ignorado';
  return [head, ...rows.map(r => [r.origen, r.destinoEfectivo, r.destinoIgnorado].join(','))].join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const reportIdx = args.indexOf('--report');
  const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : null;
  const file = path.join(process.cwd(), 'public/.htaccess');
  const original = await readFile(file, 'utf8');
  const { text, stats, ignored } = optimizeHtaccess(original);

  console.log(JSON.stringify(stats, null, 2));
  if (reportPath) {
    await writeFile(reportPath, toCsv(ignored));
    console.log(`Reglas ignoradas (${ignored.length}) → ${reportPath}`);
  }
  if (text === original) {
    console.log('public/.htaccess ya está optimizado.');
    return;
  }
  if (check) {
    console.error('public/.htaccess tiene redirecciones por optimizar. Ejecuta: npm run htaccess:optimize');
    process.exitCode = 1;
    return;
  }
  await writeFile(file, text);
  console.log('public/.htaccess actualizado.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
