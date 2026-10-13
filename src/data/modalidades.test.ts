import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MODALIDADES_ESTERILIZACION,
  MODALIDADES_IMAGEN,
  TELEPRESENCIA_SLUG,
  ULTRASONIDO_SLUGS,
  slugsDeModalidad,
} from './modalidades';
import { PROMO_PADBOT_EN, PROMO_PADBOT_ES, SLUGS_PROMO_PADBOT } from './promo-padbot';

const productos = JSON.parse(
  readFileSync(new URL('./mock-productos.json', import.meta.url), 'utf8')
) as Array<{
  slug: string;
  activo: boolean;
}>;
const activos = new Set(
  productos.filter(producto => producto.activo).map(producto => producto.slug)
);

describe('modalidades', () => {
  it('solo enlaza slugs activos del catálogo', () => {
    const slugs = [
      ...MODALIDADES_IMAGEN.flatMap(slugsDeModalidad),
      ...MODALIDADES_ESTERILIZACION.flatMap(slugsDeModalidad),
      ...ULTRASONIDO_SLUGS,
      TELEPRESENCIA_SLUG,
      ...SLUGS_PROMO_PADBOT,
    ];
    for (const slug of slugs) {
      expect(activos.has(slug), slug).toBe(true);
    }
  });

  it('no publica plasma ni lavadoras sin modelo activo', () => {
    const slugs = MODALIDADES_ESTERILIZACION.map(pagina => pagina.slug);
    expect(slugs).toEqual(['autoclaves-hospitalarios']);
  });

  it('la promoción nombra P2 o X3 y no promete los dos robots', () => {
    for (const texto of [PROMO_PADBOT_ES, PROMO_PADBOT_EN]) {
      expect(texto).toMatch(/P2 o X3|P2 or X3/);
      expect(texto.toLowerCase()).not.toMatch(/ambos|both robots|los dos/);
    }
  });
});
