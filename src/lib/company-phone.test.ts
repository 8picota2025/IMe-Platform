import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IME_WHATSAPP_DISPLAY } from './contacto-oficial';
import { getLegalPages } from './legal';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skipDirs = new Set(['node_modules', 'dist', '.git', '.astro', 'coverage']);
const oldPhone = new RegExp(
  `${['300', '717', '2757'].join('[\\s.\\-()]*')}|${['57', '300', '717', '2757'].join('')}`
);

function filesWithOldPhone(dir: string, hits: string[]): void {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      filesWithOldPhone(path, hits);
      continue;
    }
    if (info.size > 5_000_000) continue;
    if (!/\.(astro|css|html|js|json|md|mjs|sql|ts|tsx|txt|yml|yaml|svg)$/i.test(name)) continue;
    if (oldPhone.test(readFileSync(path, 'utf8'))) hits.push(relative(root, path));
  }
}

describe('teléfono comercial', () => {
  it('no deja el número anterior en el repositorio', () => {
    const hits: string[] = [];
    filesWithOldPhone(root, hits);
    expect(hits).toEqual([]);
  });

  it('publica +57 313 724 7353 en las políticas, incluida cookies', () => {
    for (const locale of ['es', 'en'] as const) {
      const pages = getLegalPages(locale);
      const cookies = pages.find(page => page.kind === 'cookies');
      expect(
        cookies?.sections.some(section =>
          section.body.some(line => line.includes(IME_WHATSAPP_DISPLAY))
        )
      ).toBe(true);
      const blob = pages.flatMap(page => page.sections.flatMap(section => section.body)).join('\n');
      expect(blob).toContain(IME_WHATSAPP_DISPLAY);
      expect(oldPhone.test(blob)).toBe(false);
    }
  });
});
