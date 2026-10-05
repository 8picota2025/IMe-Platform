import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = file => readFile(path.join(root, file), 'utf8');

describe('vistas previas de PR: no indexables', () => {
  it('el workflow construye con PUBLIC_NOINDEX=1 y apaga el robots.txt de la copia', async () => {
    const wf = await read('.github/workflows/deploy-preview.yml');
    expect(wf).toMatch(/PUBLIC_NOINDEX:\s*'1'/);
    expect(wf).toMatch(/>\s*dist\/robots\.txt/);
  });

  it('la cabecera X-Robots-Tag sale de la regla de public/.htaccess, no de un parche del workflow', async () => {
    const wf = await read('.github/workflows/deploy-preview.yml');
    expect(wf).not.toMatch(/>>\s*dist\/\.htaccess/);
    // La sonda de herencia fue solo para validar la regla en el hosting real; no debe quedar.
    expect(wf).not.toContain('__sonda-noindex');
    const ht = await read('public/.htaccess');
    expect(ht).toContain('SetEnvIf Request_URI "^/[1-9][0-9]*/" NOINDEX_PREVIEW');
    expect(ht).toContain('Header always set X-Robots-Tag "noindex, nofollow" env=NOINDEX_PREVIEW');
  });

  it('el patrón de la regla coincide con las carpetas de vista previa y con ninguna ruta real', async () => {
    const ht = await read('public/.htaccess');
    const patron = ht.match(/^SetEnvIf Request_URI "([^"]+)" NOINDEX_PREVIEW$/m)?.[1];
    expect(patron).toBeTruthy();
    const re = new RegExp(patron);
    for (const ruta of ['/166/es/', '/12/', '/9/', '/100/es/catalogo/pagina/7/', '/77/']) {
      expect(re.test(ruta), ruta).toBe(true);
    }
    for (const ruta of [
      '/',
      '/es/',
      '/en/products/',
      '/es/productos/monitor-de-paciente-ref-sk-em005-saikang/',
      '/_astro/Layout.abc123.js',
      '/assets/img/1.png',
      '/404.md',
      '/1old/',
      '/sitemap-index.xml',
      '/robots.txt',
    ]) {
      expect(re.test(ruta), ruta).toBe(false);
    }
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
