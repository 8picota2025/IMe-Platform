#!/usr/bin/env node
/**
 * Aplica un archivo SQL al proyecto Supabase remoto vía Management API.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-supabase-sql.mjs path/to/file.sql
 *
 * Vars:
 *   SUPABASE_ACCESS_TOKEN  (requerido)
 *   SUPABASE_PROJECT_REF   (default: nnfbucwiasuggyfoyydo)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = (process.env.SUPABASE_PROJECT_REF ?? 'nnfbucwiasuggyfoyydo').trim();
const fileArg = process.argv[2];

if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}
if (!fileArg) {
  console.error('Uso: node scripts/apply-supabase-sql.mjs <archivo.sql>');
  process.exit(1);
}

const filePath = resolve(fileArg);
const query = readFileSync(filePath, 'utf8');
if (!query.trim()) {
  console.error(`Archivo vacio: ${filePath}`);
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
console.log(`Aplicando ${filePath} -> ${projectRef} (${query.length} chars)`);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ query }),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error(`Error HTTP ${res.status}`);
  console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log('OK');
if (body !== undefined) {
  console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}
