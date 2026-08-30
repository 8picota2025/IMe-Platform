import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const jsBudgetKiB = Number(process.env.PERFORMANCE_JS_BUDGET_KIB ?? 3500);
const cssBudgetKiB = Number(process.env.PERFORMANCE_CSS_BUDGET_KIB ?? 500);

async function totalBytes(path, extension) {
  const info = await stat(path);
  if (info.isFile()) return path.endsWith(extension) ? info.size : 0;
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(entry => totalBytes(join(path, entry.name), extension))
    )
  ).reduce((total, size) => total + size, 0);
}

const jsBytes = await totalBytes(dist, '.js');
const cssBytes = await totalBytes(dist, '.css');
const jsKiB = jsBytes / 1024;
const cssKiB = cssBytes / 1024;

console.log(
  `Performance build: JS ${jsKiB.toFixed(1)} KiB / ${jsBudgetKiB} KiB · CSS ${cssKiB.toFixed(1)} KiB / ${cssBudgetKiB} KiB`
);

if (jsKiB > jsBudgetKiB || cssKiB > cssBudgetKiB) {
  throw new Error('Performance build budget exceeded');
}
