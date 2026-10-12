import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MODALIDADES_ESTERILIZACION,
  MODALIDADES_IMAGEN,
  TELEPRESENCIA_SLUG,
  ULTRASONIDO_SLUGS,
  slugsDeModalidad,
} from './modalidades';

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
    ];
    for (const slug of slugs) {
      expect(activos.has(slug), slug).toBe(true);
    }
  });
});
