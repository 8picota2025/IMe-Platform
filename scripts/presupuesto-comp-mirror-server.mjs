#!/usr/bin/env node
/**
 * Espejo local: recibe foto OCR y la guarda en
 * `/home/shoky/0 IME/presupuestos comp/{quoteId}__{oppId}__{stamp}.ext`
 *
 * Uso: node scripts/presupuesto-comp-mirror-server.mjs
 * Escucha 127.0.0.1:3847 — UI en http://127.0.0.1:3847/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PRESUPUESTO_COMP_MIRROR_PORT || 3847);
const DIR =
  process.env.PRESUPUESTOS_COMP_DIR ||
  path.join(process.env.HOME || '/home/shoky', '0 IME', 'presupuestos comp');

fs.mkdirSync(DIR, { recursive: true });

function listFiles() {
  try {
    return fs
      .readdirSync(DIR)
      .filter(n => !n.startsWith('.') && n !== 'README.md')
      .map(name => {
        const full = path.join(DIR, name);
        const st = fs.statSync(full);
        return { name, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  } catch {
    return [];
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusHtml() {
  const files = listFiles();
  const rows = files.length
    ? files
        .map(
          f =>
            `<tr><td><a href="/file/${encodeURIComponent(f.name)}">${escapeHtml(f.name)}</a></td><td>${Math.round(f.size / 1024)} KB</td><td>${escapeHtml(f.mtime)}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3">Aún no hay fotos. Usa OCR en comercial → se guardan aquí.</td></tr>';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Presupuestos competencia — mirror local</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:920px;margin:32px auto;padding:0 16px;color:#102a33;background:#f4f7f8}
    h1{font-size:1.4rem;margin:0 0 8px}
    .ok{display:inline-block;background:#0b7a4b;color:#fff;padding:4px 10px;border-radius:999px;font-size:12px}
    .card{background:#fff;border:1px solid #d7e2e6;border-radius:12px;padding:16px;margin:16px 0}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{text-align:left;padding:8px;border-bottom:1px solid #eef2f4}
    a{color:#0b5c6b}
    code{background:#eef5f7;padding:2px 6px;border-radius:4px}
  </style>
</head>
<body>
  <span class="ok">mirror OK · :${PORT}</span>
  <h1>Presupuestos competencia</h1>
  <p>Carpeta: <code>${escapeHtml(DIR)}</code></p>
  <div class="card">
    <p><strong>Esto no es el CMS.</strong> Solo guarda fotos OCR. La UI de presupuestos está en:</p>
    <p><a href="https://i-me.com.co/comercial/#/cotizaciones" target="_blank" rel="noopener">https://i-me.com.co/comercial/#/cotizaciones</a></p>
    <p>Botones: <em>Foto competencia</em> / <em>Galería OCR</em></p>
  </div>
  <div class="card">
    <h2 style="font-size:1rem;margin:0 0 12px">Archivos guardados (${files.length})</h2>
    <table>
      <thead><tr><th>Archivo</th><th>Tamaño</th><th>Fecha</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(statusHtml());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, dir: DIR, files: listFiles().length }));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/file/')) {
    const name = decodeURIComponent(url.pathname.slice('/file/'.length));
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      res.writeHead(400);
      res.end('bad name');
      return;
    }
    const full = path.join(DIR, name);
    if (!full.startsWith(DIR) || !fs.existsSync(full)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(name).toLowerCase();
    const type =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.json'
            ? 'application/json'
            : 'image/jpeg';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(full).pipe(res);
    return;
  }

  if (req.method !== 'POST' || url.pathname !== '/mirror') {
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
  console.log(`[presupuesto-comp-mirror] UI http://127.0.0.1:${PORT}/`);
  console.log(`[presupuesto-comp-mirror] dir ${DIR}`);
});
