import { describe, expect, it } from 'vitest';
import { draftQuoteAnnex, quoteAnnexHasSpecContent } from './quote-pdf-annex';

const linea = 'Linea suelta';

describe('draftQuoteAnnex', () => {
  it('omite la línea si no hay producto de catálogo', () => {
    expect(
      draftQuoteAnnex({
        linked: false,
        nombreLinea: linea,
        descripcionLarga: 'No debería usarse',
        especificaciones: [{ clave: 'Peso', valor: '2 kg' }],
      })
    ).toBeNull();
  });

  it('omite ficha sin descripción larga ni especificaciones ni aplicaciones', () => {
    expect(
      draftQuoteAnnex({
        linked: true,
        nombreLinea: linea,
        nombreProducto: 'Monitor vacío',
        descripcionCorta: 'Solo un resumen corto',
        descripcionLarga: '   ',
        especificaciones: [],
        aplicaciones: [],
      })
    ).toBeNull();
  });

  it('omite la descripción larga que solo repite el nombre', () => {
    expect(
      draftQuoteAnnex({
        linked: true,
        nombreLinea: linea,
        nombreProducto: 'Monitor vacío',
        descripcionLarga: '<p>Monitor   vacío.</p>',
      })
    ).toBeNull();
  });

  it('conserva la descripción larga distinta del nombre', () => {
    expect(
      draftQuoteAnnex({
        linked: true,
        nombreLinea: linea,
        nombreProducto: 'Monitor',
        descripcionCorta: 'Corta',
        descripcionLarga: '<p>Pantalla de 15 pulgadas.</p>',
      })
    ).toEqual({
      nombre: 'Monitor',
      descripcion: 'Pantalla de 15 pulgadas.',
      resumen: 'Corta',
      caracteristicas: [],
    });
  });

  it('conserva especificaciones y aplicaciones aunque no haya descripción larga', () => {
    expect(
      draftQuoteAnnex({
        linked: true,
        nombreLinea: linea,
        nombreProducto: 'Bomba',
        descripcionCorta: '',
        especificaciones: [
          null,
          { clave: ' ', valor: ' ' },
          { clave: 'Peso', valor: '2 kg' },
          { valor: 'Portátil' },
        ],
        aplicaciones: ['UCI', '  '],
      })
    ).toEqual({
      nombre: 'Bomba',
      descripcion: '',
      resumen: 'Bomba',
      caracteristicas: ['Peso: 2 kg', 'Portátil', 'UCI'],
    });
  });
});

describe('quoteAnnexHasSpecContent', () => {
  it('rechaza el anexo que solo trae el nombre o la descripción corta', () => {
    expect(
      quoteAnnexHasSpecContent({ nombre: 'Monitor', descripcion: 'Monitor', caracteristicas: [] })
    ).toBe(false);
    expect(
      quoteAnnexHasSpecContent({ nombre: 'Monitor', descripcion: '', caracteristicas: ['  '] })
    ).toBe(false);
  });

  it('acepta descripción larga o una característica', () => {
    expect(
      quoteAnnexHasSpecContent({
        nombre: 'Monitor',
        descripcion: 'Pantalla de 15 pulgadas.',
      })
    ).toBe(true);
    expect(
      quoteAnnexHasSpecContent({
        nombre: 'Monitor',
        descripcion: '',
        caracteristicas: ['Peso: 2 kg'],
      })
    ).toBe(true);
  });
});
