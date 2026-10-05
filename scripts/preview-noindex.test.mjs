import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = file => readFile(path.join(root, file), 'utf8');

describe('vistas previas de PR: no indexables', () => {
  it('el workflow construye con PUBLIC_NOINDEX=1, añade la cabecera y apaga el robots.txt', async () => {
    const wf = await read('.github/workflows/deploy-preview.yml');
    expect(wf).toMatch(/PUBLIC_NOINDEX:\s*'1'/);
    expect(wf).toContain('Header always set X-Robots-Tag "noindex, nofollow"');
    expect(wf).toMatch(/>>\s*dist\/\.htaccess/);
    expect(wf).toMatch(/>\s*dist\/robots\.txt/);
  });

  it('el paso de marcado va antes del despliegue FTP, y el build antes del marcado', async () => {
    const wf = await read('.github/workflows/deploy-preview.yml');
    const build = wf.indexOf('name: Build');
    const marcar = wf.indexOf('Marcar la vista previa como no indexable');
    const deploy = wf.indexOf('Deploy to Hostinger Preview');
    expect(build).toBeGreaterThan(-1);
    expect(marcar).toBeGreaterThan(build);
    expect(deploy).toBeGreaterThan(marcar);
  });

  it('el comentario del PR no sale cortado cuando falta el secreto del dominio', async () => {
    const wf = await read('.github/workflows/deploy-preview.yml');
    expect(wf).toContain('PREVIEW_DOMAIN: ${{ secrets.HOSTINGER_PREVIEW_DOMAIN }}');
    expect(wf).toContain('`https://i-me.com.co/${pr}/es/`');
    // La URL ya no se arma directamente con el secreto dentro de la plantilla.
    expect(wf).not.toContain('${{ secrets.HOSTINGER_PREVIEW_DOMAIN }}`');
  });

  it('robots.txt bloquea las carpetas numéricas (/<PR>/) de las vistas previas', async () => {
    const robots = await read('public/robots.txt');
    for (const digito of '123456789') {
      expect(robots).toContain(`Disallow: /${digito}*/`);
    }
  });

  it('robots.txt conserva lo imprescindible: /_astro/ sin bloquear y el sitemap', async () => {
    const robots = await read('public/robots.txt');
    expect(robots).not.toMatch(/Disallow:\s*\/_astro/);
    expect(robots).toContain('Sitemap: https://i-me.com.co/sitemap-index.xml');
  });

  it('ninguna ruta real de public/ empieza por un dígito (el patrón la bloquearía)', async () => {
    const entradas = await readdir(path.join(root, 'public'));
    const conDigito = entradas.filter(nombre => /^[1-9]/.test(nombre));
    // /404.md es un archivo suelto: no coincide con /4*/ porque no lleva "/" después.
    // /77/ y /1old/ son legados que ya estaban bloqueados.
    const permitidas = new Set(['404.md', '77', '1old']);
    expect(conDigito.filter(nombre => !permitidas.has(nombre))).toEqual([]);
  });
});
