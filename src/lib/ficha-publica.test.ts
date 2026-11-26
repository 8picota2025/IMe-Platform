import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { corregirTypoPortatil } from './copy-publico';
import { fichaSinSchemaProducto } from './ficha-publica';
import { parseBorrador } from './conocimiento-clusters';

describe('fichas que no deben emitir Product', () => {
  it('la mesa BenQ 7000S y los redirects no emiten schema de producto', () => {
    expect(fichaSinSchemaProducto('es', 'mesa-de-cirugia-ref-7000s-benq')).toBe(true);
    expect(fichaSinSchemaProducto('es', 'lampara-cielitica-ref-led-x36-ilumitec')).toBe(false);
    expect(fichaSinSchemaProducto('es', 'sistema-radiografico-3d-ref-wr-3d-angell')).toBe(true);
  });
});

describe('typo Portátil', () => {
  it('corrige Pórtatil y el mock del catálogo ya no lo trae', () => {
    expect(corregirTypoPortatil('Aspirador De Secreciones Pórtatil ADS100')).toBe(
      'Aspirador De Secreciones Portátil ADS100'
    );
    const mock = readFileSync(join(process.cwd(), 'src/data/mock-productos.json'), 'utf8');
    expect(mock).not.toContain('Pórtatil');
    expect(mock).toContain('Aspirador De Secreciones Portátil ADS100');
  });
});

describe('borradores de posicionamiento', () => {
  it('se parsean, no se publican solos y no nombran competidores ni inventan precio', () => {
    const root = process.cwd();
    for (const file of [
      'src/data/conocimiento-borradores/como-elegir-cama-hospitalaria-electrica.md',
      'src/data/conocimiento-borradores/aspirador-de-secreciones-guia-compra-colombia.md',
    ]) {
      const raw = readFileSync(join(root, file), 'utf8');
      const borrador = parseBorrador(raw);
      expect(borrador).not.toBeNull();
      expect(raw).not.toMatch(/Equitronic|Pórtatil/i);
      expect(raw).toContain('+57 313 724 7353');
      expect(raw).not.toMatch(/\$\s*\d/);
      expect(`${borrador?.cuerpo_es} ${borrador?.cuerpo_en}`).toMatch(
        /no se garantiza|not guaranteed/i
      );
    }
    const articulos = readFileSync(join(root, 'src/data/mock-articulos.json'), 'utf8');
    expect(articulos).not.toContain('como-elegir-cama-hospitalaria-electrica');
    expect(articulos).not.toContain('aspirador-de-secreciones-guia-compra-colombia');
    const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).not.toMatch(/PREVIEW_DRAFTS:\s*['"]?true/);
  });
});
