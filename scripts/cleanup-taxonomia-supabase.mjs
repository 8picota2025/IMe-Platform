#!/usr/bin/env node
/**
 * Limpieza de taxonomía en Supabase (live) + opción de re-exportar mock.
 *
 * Acciones:
 * 1) Fusiona familias alias con productos hacia canónicas (con tipo inteligente).
 * 2) Corrige mismatch tipo.familia_id != producto.familia_id.
 * 3) Desactiva productos sandbox/test.
 * 4) Elimina familias/tipos vacíos sobrantes.
 *
 * Uso:
 *   node --env-file=.env scripts/cleanup-taxonomia-supabase.mjs            # dry-run
 *   node --env-file=.env scripts/cleanup-taxonomia-supabase.mjs --apply
 *   node --env-file=.env scripts/cleanup-taxonomia-supabase.mjs --apply --export-mock
 */
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const EXPORT_MOCK = process.argv.includes('--export-mock');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchAll(table, cols) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

/**
 * Score a product against candidate tipos using overlapping tokens.
 * Prefer explicit keyword rules when present.
 */
function pickTipo(product, tiposEnFamilia, preferredSlug) {
  if (preferredSlug) {
    const hit = tiposEnFamilia.find(t => t.slug === preferredSlug);
    if (hit) return hit;
  }
  const haystack = normalize(`${product.nombre_es} ${product.slug}`);
  let best = null;
  let bestScore = 0;
  for (const tipo of tiposEnFamilia) {
    const tokens = normalize(`${tipo.nombre_es} ${tipo.slug}`)
      .split(/\s+/)
      .filter(t => t.length >= 4);
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length >= 6 ? 3 : 1;
    }
    // Strong cues
    if (tipo.slug.includes('mesas') && haystack.includes('mesa')) score += 8;
    if (tipo.slug.includes('lamparas') && haystack.includes('lampara')) score += 8;
    if (tipo.slug.includes('desfibril') && haystack.includes('desfibril')) score += 8;
    if (score > bestScore) {
      bestScore = score;
      best = tipo;
    }
  }
  return bestScore > 0 ? best : null;
}

function productPreferredTarget(product) {
  const n = normalize(`${product.nombre_es} ${product.slug}`);
  if (n.includes('mesa de cirugia') || n.includes('mesa-de-cirugia')) {
    return { familiaSlug: 'sala-cirugia', tipoSlug: 'mesas-quirurgicas' };
  }
  if (n.includes('laparoscop')) {
    return { familiaSlug: 'sala-cirugia', tipoSlug: null };
  }
  if (n.includes('hipotermia') || n.includes('normotermia') || n.includes('criticool') || n.includes('allon')) {
    return { familiaSlug: 'sala-cirugia', tipoSlug: null };
  }
  return null;
}

/** Explicit alias-family merge map (fallback when productPreferredTarget is null). */
const ALIAS_FAMILIA = {
  'mobiliario-clinico': 'mobiliario',
  'quirofano-anestesia': 'sala-cirugia',
  cirugia: 'sala-cirugia',
};

const SANDBOX_SLUGS = new Set(['sandbox-wompi-consumible-20260618', 'test']);

const plan = {
  productMoves: [],
  deactivate: [],
  deleteTipos: [],
  deleteFamilias: [],
  createTipos: [],
  fixMismatch: [],
};

const [familias, tipos, productos] = await Promise.all([
  fetchAll('familias', 'id,slug,nombre_es,nombre_en,orden,activo'),
  fetchAll('tipos', 'id,slug,nombre_es,nombre_en,familia_id,orden,activo'),
  fetchAll('productos', 'id,slug,nombre_es,familia_id,tipo_id,activo'),
]);

const famById = new Map(familias.map(f => [f.id, f]));
const famBySlug = new Map(familias.map(f => [f.slug, f]));
const tipoById = new Map(tipos.map(t => [t.id, t]));
const tiposByFamiliaId = new Map();
for (const t of tipos) {
  const list = tiposByFamiliaId.get(t.familia_id) || [];
  list.push(t);
  tiposByFamiliaId.set(t.familia_id, list);
}

function ensureTipoPlan(familiaId, slug, nombreEs, nombreEn) {
  const existing = (tiposByFamiliaId.get(familiaId) || []).find(t => t.slug === slug);
  if (existing) return existing;
  const pending = plan.createTipos.find(t => t.familia_id === familiaId && t.slug === slug);
  if (pending) return pending;
  const draft = {
    id: `NEW:${familiaId}:${slug}`,
    familia_id: familiaId,
    slug,
    nombre_es: nombreEs,
    nombre_en: nombreEn,
    orden: 99,
    activo: true,
    _isNew: true,
  };
  plan.createTipos.push(draft);
  const list = tiposByFamiliaId.get(familiaId) || [];
  list.push(draft);
  tiposByFamiliaId.set(familiaId, list);
  return draft;
}

// 1) Deactivate sandbox/test products and clear lingering taxonomy FKs
for (const p of productos) {
  if (!SANDBOX_SLUGS.has(p.slug)) continue;
  if (p.activo === false && !p.familia_id && !p.tipo_id) continue;
  plan.deactivate.push({
    id: p.id,
    slug: p.slug,
    reason: p.activo === false ? 'clear sandbox taxonomy FKs' : 'sandbox/test product',
    clearOnly: p.activo === false,
  });
}

// 2) Move products out of alias familias (smarter targets)
for (const [aliasSlug, fallbackCanonical] of Object.entries(ALIAS_FAMILIA)) {
  const aliasFam = famBySlug.get(aliasSlug);
  if (!aliasFam) continue;
  const aliasProducts = productos.filter(p => p.familia_id === aliasFam.id);
  for (const product of aliasProducts) {
    if (SANDBOX_SLUGS.has(product.slug)) continue;
    const preferred = productPreferredTarget(product);
    const targetSlug = preferred?.familiaSlug || fallbackCanonical;
    const targetFam = famBySlug.get(targetSlug);
    if (!targetFam) {
      throw new Error(`Familia canónica no encontrada: ${targetSlug}`);
    }
    let tipo =
      pickTipo(product, tiposByFamiliaId.get(targetFam.id) || [], preferred?.tipoSlug) ||
      null;
    if (!tipo) {
      // Last resort: create a meaningful tipo from product cues, not a blunt familia clone
      if (normalize(product.nombre_es).includes('laparoscop')) {
        tipo = ensureTipoPlan(
          targetFam.id,
          'torres-laparoscopia',
          'Torres de laparoscopia',
          'Laparoscopy towers'
        );
      } else if (
        normalize(product.nombre_es).includes('hipotermia') ||
        normalize(product.nombre_es).includes('normotermia')
      ) {
        tipo = ensureTipoPlan(
          targetFam.id,
          'gestion-temperatura-perioperatoria',
          'Gestión de temperatura perioperatoria',
          'Perioperative temperature management'
        );
      } else {
        tipo = ensureTipoPlan(
          targetFam.id,
          `${targetFam.slug}-general`,
          `${targetFam.nombre_es} (general)`,
          targetFam.nombre_en ? `${targetFam.nombre_en} (general)` : null
        );
      }
    }
    if (product.familia_id === targetFam.id && product.tipo_id === (tipo._isNew ? null : tipo.id)) {
      continue;
    }
    plan.productMoves.push({
      id: product.id,
      slug: product.slug,
      fromFamilia: aliasSlug,
      toFamilia: targetFam.slug,
      fromTipo: tipoById.get(product.tipo_id)?.slug || null,
      toTipo: tipo.slug,
      toFamiliaId: targetFam.id,
      toTipoId: tipo.id,
      toTipoIsNew: Boolean(tipo._isNew),
    });
  }
}

// 3) Fix mismatches for remaining products
for (const product of productos) {
  if (!product.tipo_id || !product.familia_id) continue;
  if (SANDBOX_SLUGS.has(product.slug)) continue;
  if (plan.productMoves.some(m => m.id === product.id)) continue;
  const tipo = tipoById.get(product.tipo_id);
  if (!tipo || tipo.familia_id === product.familia_id) continue;
  const targetFam = famById.get(product.familia_id);
  const picked =
    pickTipo(product, tiposByFamiliaId.get(product.familia_id) || [], null) ||
    ensureTipoPlan(
      product.familia_id,
      `${targetFam.slug}-general`,
      `${targetFam.nombre_es} (general)`,
      targetFam.nombre_en ? `${targetFam.nombre_en} (general)` : null
    );
  plan.fixMismatch.push({
    id: product.id,
    slug: product.slug,
    familia: targetFam.slug,
    fromTipo: tipo.slug,
    fromTipoFamilia: famById.get(tipo.familia_id)?.slug,
    toTipo: picked.slug,
    toTipoId: picked.id,
    toTipoIsNew: Boolean(picked._isNew),
  });
}

// Simulate post-state for prune
const simulatedProducts = productos.map(p => ({ ...p }));
const byId = new Map(simulatedProducts.map(p => [p.id, p]));
for (const d of plan.deactivate) {
  const row = byId.get(d.id);
  if (row) row.activo = false;
}
for (const m of plan.productMoves) {
  const row = byId.get(m.id);
  if (!row) continue;
  row.familia_id = m.toFamiliaId;
  row.tipo_id = m.toTipoIsNew ? `RESOLVED:${m.toTipo}` : m.toTipoId;
}
for (const m of plan.fixMismatch) {
  const row = byId.get(m.id);
  if (!row) continue;
  row.tipo_id = m.toTipoIsNew ? `RESOLVED:${m.toTipo}` : m.toTipoId;
}

// After moves, alias familias should be empty → delete their tipos then familias
for (const aliasSlug of Object.keys(ALIAS_FAMILIA)) {
  const fam = famBySlug.get(aliasSlug);
  if (!fam) continue;
  const remaining = simulatedProducts.filter(p => p.familia_id === fam.id && p.activo !== false);
  if (remaining.length > 0) {
    console.warn(`WARN: alias ${aliasSlug} still has ${remaining.length} active products after plan`);
    continue;
  }
  for (const t of tipos.filter(t => t.familia_id === fam.id)) {
    plan.deleteTipos.push({ id: t.id, slug: t.slug, familia: aliasSlug });
  }
  plan.deleteFamilias.push({ id: fam.id, slug: aliasSlug });
}

// Also prune any other empty tipos (safety) except ones we just created
const keptTipoIds = new Set(
  simulatedProducts.filter(p => p.tipo_id && !String(p.tipo_id).startsWith('RESOLVED:')).map(p => p.tipo_id)
);
for (const created of plan.createTipos) {
  // creations will get real ids on apply; mark as kept via slug usage in moves
  void created;
}
for (const t of tipos) {
  if (plan.deleteTipos.some(d => d.id === t.id)) continue;
  const used = keptTipoIds.has(t.id) || plan.productMoves.some(m => !m.toTipoIsNew && m.toTipoId === t.id) || plan.fixMismatch.some(m => !m.toTipoIsNew && m.toTipoId === t.id);
  if (!used) {
    // Don't prune shared/active taxonomic tipos aggressively if familia still exists with only generic usage
    // Only prune if truly zero products reference them in simulated state
    const refs = simulatedProducts.filter(p => p.tipo_id === t.id).length;
    if (refs === 0 && !Object.keys(ALIAS_FAMILIA).includes(famById.get(t.familia_id)?.slug)) {
      // leave untouched unless belonging to deleted alias (already handled)
    }
  }
}

console.log(JSON.stringify({ mode: APPLY ? 'APPLY' : 'DRY_RUN', plan }, null, 2));

if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to mutate Supabase.');
  process.exit(0);
}

// --- APPLY ---
const createdTipoIdByKey = new Map();

for (const draft of plan.createTipos) {
  const { data, error } = await sb
    .from('tipos')
    .insert({
      familia_id: draft.familia_id,
      slug: draft.slug,
      nombre_es: draft.nombre_es,
      nombre_en: draft.nombre_en,
      orden: draft.orden,
      activo: true,
    })
    .select('id,slug,familia_id')
    .single();
  if (error) throw new Error(`create tipo ${draft.slug}: ${error.message}`);
  createdTipoIdByKey.set(`NEW:${draft.familia_id}:${draft.slug}`, data.id);
  console.log('created tipo', data.slug, data.id);
}

function resolveTipoId(maybeId, familiaId, slug, isNew) {
  if (!isNew) return maybeId;
  return createdTipoIdByKey.get(`NEW:${familiaId}:${slug}`);
}

for (const m of plan.productMoves) {
  const tipoId = resolveTipoId(m.toTipoId, m.toFamiliaId, m.toTipo, m.toTipoIsNew);
  const { error } = await sb
    .from('productos')
    .update({ familia_id: m.toFamiliaId, tipo_id: tipoId })
    .eq('id', m.id);
  if (error) throw new Error(`move ${m.slug}: ${error.message}`);
  console.log('moved', m.slug, '→', m.toFamilia, '/', m.toTipo);
}

for (const m of plan.fixMismatch) {
  const fam = famBySlug.get(m.familia);
  const tipoId = resolveTipoId(m.toTipoId, fam.id, m.toTipo, m.toTipoIsNew);
  const { error } = await sb.from('productos').update({ tipo_id: tipoId }).eq('id', m.id);
  if (error) throw new Error(`fix mismatch ${m.slug}: ${error.message}`);
  console.log('fixed mismatch', m.slug, '→', m.toTipo);
}

for (const d of plan.deactivate) {
  const { error } = await sb
    .from('productos')
    .update({ activo: false, familia_id: null, tipo_id: null })
    .eq('id', d.id);
  if (error) throw new Error(`deactivate ${d.slug}: ${error.message}`);
  console.log('deactivated', d.slug);
}

for (const t of plan.deleteTipos) {
  const { error } = await sb.from('tipos').delete().eq('id', t.id);
  if (error) throw new Error(`delete tipo ${t.slug}: ${error.message}`);
  console.log('deleted tipo', t.slug);
}

for (const f of plan.deleteFamilias) {
  const { error } = await sb.from('familias').delete().eq('id', f.id);
  if (error) throw new Error(`delete familia ${f.slug}: ${error.message}`);
  console.log('deleted familia', f.slug);
}

console.log('\nApply complete.');

if (EXPORT_MOCK) {
  const envFile = process.env.DOTENV_PATH;
  const args = [join(ROOT, 'scripts/export-mock-from-supabase.mjs')];
  const result = spawnSync(
    process.execPath,
    envFile ? [`--env-file=${envFile}`, ...args] : args,
    { stdio: 'inherit', cwd: ROOT, env: process.env }
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
