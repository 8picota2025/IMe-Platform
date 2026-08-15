#!/usr/bin/env node
/**
 * Espejo local: recibe foto OCR y la guarda en
 * `/home/shoky/0 IME/presupuestos comp/{quoteId}__{oppId}__{stamp}.ext`
 *
 * Uso: node scripts/presupuesto-comp-mirror-server.mjs
 * Escucha 127.0.0.1:3847
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PRESUPUESTO_COMP_MIRROR_PORT || 3847);
const DIR =
  process.env.PRESUPUESTOS_COMP_DIR ||
  path.join(process.env.HOME || '/home/shoky', '0 IME', 'presupuestos comp');

fs.mkdirSync(DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, dir: DIR }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/mirror') {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    res.writeHead(400);
    res.end('bad json');
    return;
  }

  const filename = String(body.filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const b64 = String(body.image_base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!filename || !b64) {
    res.writeHead(400);
    res.end('filename + image_base64 required');
    return;
  }
  const buf = Buffer.from(b64, 'base64');
  const imagePath = path.join(DIR, filename);
  fs.writeFileSync(imagePath, buf);
  const sidecar = {
    ...(body.meta && typeof body.meta === 'object' ? body.meta : {}),
    local_path: imagePath,
    mirrored_at: new Date().toISOString(),
  };
  const jsonPath = imagePath.replace(/\.[^.]+$/, '') + '.json';
  fs.writeFileSync(jsonPath, JSON.stringify(sidecar, null, 2));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, path: imagePath, sidecar: jsonPath }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[presupuesto-comp-mirror] ${DIR} ← http://127.0.0.1:${PORT}/mirror`);
});
