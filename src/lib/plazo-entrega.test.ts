import { describe, expect, it } from 'vitest';
import {
  fraseEntrega,
  plazoCompartido,
  plazoEntregaCarrito,
  plazoEntregaDesdeAtributos,
} from './plazo-entrega';

const PREDETERMINADO = 'Menos de 10 días hábiles';

describe('plazoEntregaDesdeAtributos', () => {
  it('lee el plazo del idioma pedido', () => {
    const atributos = {
      plazo_entrega_es: 'Entrega en 5 a 7 días hábiles',
      plazo_entrega_en: 'Delivery in 5 to 7 business days',
    };
    expect(plazoEntregaDesdeAtributos(atributos, 'es')).toBe('Entrega en 5 a 7 días hábiles');
    expect(plazoEntregaDesdeAtributos(atributos, 'en')).toBe('Delivery in 5 to 7 business days');
  });

  it('devuelve null si la clave del idioma no existe', () => {
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_en: 'Delivery in 5 days' }, 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos({ marca: 'X' }, 'en')).toBeNull();
  });

  it('ignora atributos ausentes, vacíos o de tipo no texto', () => {
    expect(plazoEntregaDesdeAtributos(null, 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos(undefined, 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos('texto', 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_es: '' }, 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_es: '   ' }, 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_es: 7 }, 'es')).toBeNull();
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_es: null }, 'es')).toBeNull();
  });

  it('colapsa espacios y rechaza textos demasiado largos', () => {
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_es: '  Entrega   en 5 días  ' }, 'es')).toBe(
      'Entrega en 5 días'
    );
    expect(plazoEntregaDesdeAtributos({ plazo_entrega_es: 'x'.repeat(161) }, 'es')).toBeNull();
  });
});

describe('fraseEntrega', () => {
  it('usa el texto fijo cuando no hay plazo del producto', () => {
    expect(fraseEntrega(null, 'Entrega en menos de 10 días hábiles.')).toBe(
      'Entrega en menos de 10 días hábiles.'
    );
    expect(fraseEntrega(undefined, 'Fijo.')).toBe('Fijo.');
  });

  it('usa el plazo del producto con punto final', () => {
    expect(fraseEntrega('Entrega en 5 a 7 días hábiles', 'Fijo.')).toBe(
      'Entrega en 5 a 7 días hábiles.'
    );
    expect(fraseEntrega('Entrega en 5 días.', 'Fijo.')).toBe('Entrega en 5 días.');
  });
});

describe('plazoCompartido', () => {
  it('devuelve el plazo si todos los productos lo comparten', () => {
    expect(
      plazoCompartido([
        { plazo_entrega: 'Entrega en 5 días' },
        { plazo_entrega: 'Entrega en 5 días' },
      ])
    ).toBe('Entrega en 5 días');
  });

  it('devuelve null si difieren, si alguno no tiene plazo o si no hay productos', () => {
    expect(
      plazoCompartido([
        { plazo_entrega: 'Entrega en 5 días' },
        { plazo_entrega: 'Entrega en 9 días' },
      ])
    ).toBeNull();
    expect(
      plazoCompartido([{ plazo_entrega: 'Entrega en 5 días' }, { plazo_entrega: null }])
    ).toBeNull();
    expect(plazoCompartido([{}, { plazo_entrega: null }])).toBeNull();
    expect(plazoCompartido([])).toBeNull();
  });
});

describe('plazoEntregaCarrito', () => {
  it('usa el predeterminado si ninguna línea tiene plazo propio', () => {
    expect(plazoEntregaCarrito([{ plazo_entrega: null }, {}], PREDETERMINADO)).toBe(PREDETERMINADO);
    expect(plazoEntregaCarrito([], PREDETERMINADO)).toBe(PREDETERMINADO);
  });

  it('muestra el plazo propio cuando todas las líneas lo comparten', () => {
    expect(
      plazoEntregaCarrito(
        [{ plazo_entrega: '5 a 7 días' }, { plazo_entrega: '5 a 7 días' }],
        PREDETERMINADO
      )
    ).toBe('5 a 7 días');
  });

  it('lista los plazos distintos y usa el predeterminado en las líneas sin plazo', () => {
    expect(
      plazoEntregaCarrito(
        [{ plazo_entrega: '5 a 7 días' }, { plazo_entrega: null }, { plazo_entrega: '2 días' }],
        PREDETERMINADO
      )
    ).toBe(`5 a 7 días · ${PREDETERMINADO} · 2 días`);
  });
});
