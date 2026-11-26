#!/usr/bin/env node
/**
 * Ping IndexNow de las URLs prioritarias.
 * Por defecto es dry-run y no llama a la red.
 * --send solo envía si INDEXNOW_SEND=1 (el workflow de producción, tras el FTP).
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildIndexNowPayload,
  INDEXNOW_ENDPOINT,
  INDEXNOW_PRIORITY_PATHS,
} from './indexnow-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readKey() {
  const wellKnown = await readFile(join(root, 'public/.well-known/indexnow-key.txt'), 'utf8');
  const key = wellKnown.trim();
  const rootFile = await readFile(join(root, 'public', `${key}.txt`), 'utf8');
  if (rootFile.trim() !== key) {
    throw new Error('La clave de /.well-known/indexnow-key.txt no coincide con /<clave>.txt');
  }
  return key;
}

async function main() {
  const send = process.argv.includes('--send');
  const key = await readKey();
  const payload = buildIndexNowPayload(key, INDEXNOW_PRIORITY_PATHS);
  if (!send || process.env.INDEXNOW_SEND !== '1') {
    if (send && process.env.INDEXNOW_SEND !== '1') {
      console.error('IndexNow: INDEXNOW_SEND no es 1. No se envió el ping.');
      process.exitCode = 1;
    }
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          endpoint: INDEXNOW_ENDPOINT,
          urlCount: payload.urlList.length,
          payload,
        },
        null,
        2
      )
    );
    return;
  }
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  console.log(`IndexNow: HTTP ${response.status} ${body.slice(0, 500)}`);
  if (response.status !== 200 && response.status !== 202) process.exitCode = 1;
}

const invoked = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (invoked) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
