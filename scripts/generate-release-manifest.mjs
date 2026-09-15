import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'dist');
const commit = process.env.GITHUB_SHA || 'local';
const criticalFiles = [
  'index.html',
  'es/index.html',
  'es/catalogo/index.html',
  'es/familias/robots/index.html',
  'robots.txt',
  'sitemap-index.xml',
];

async function sha256(path) {
  const buffer = await readFile(join(root, path));
  return createHash('sha256').update(buffer).digest('hex');
}

async function countFiles(path) {
  const info = await stat(path);
  if (info.isFile()) return 1;
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => countFiles(join(path, entry.name))))).reduce(
    (total, count) => total + count,
    0
  );
}

const manifest = {
  schema: 1,
  commit,
  generated_at: new Date().toISOString(),
  file_count: await countFiles(root),
  critical_files: Object.fromEntries(
    await Promise.all(criticalFiles.map(async path => [path, await sha256(path)]))
  ),
};

// Alias /sitemap.xml → same bytes as sitemap-index.xml (common bot entrypoint).
try {
  const indexXml = await readFile(join(root, 'sitemap-index.xml'));
  await writeFile(join(root, 'sitemap.xml'), indexXml);
} catch {
  console.warn('release-manifest: sitemap-index.xml missing; skipped sitemap.xml alias');
}

await writeFile(join(root, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `release-manifest: ${manifest.commit} · ${manifest.file_count} files · ${relative(process.cwd(), join(root, 'release-manifest.json'))}`
);
