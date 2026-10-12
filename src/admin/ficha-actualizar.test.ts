import { describe, expect, it } from 'vitest';
import {
  buscarCoincidencia,
  calcularCambiosFicha,
  construirActualizacion,
  normalizarClave,
  type CandidatoExistente,
} from './ficha-actualizar';

const catalogo: CandidatoExistente[] = [
  { id: '1', slug: 'monitor-uci-x', nombre_es: 'Monitor de paciente UCI X', sku: 'MON-100' },
  { id: '2', slug: 'bomba-infusion', nombre_es: 'Bomba de infusión', sku: null },
];

describe('normalizarClave', () => {
  it('ignora acentos, mayúsculas y puntuación', () => {
    expect(normalizarClave('  Bomba de Infusión!! ')).toBe('bomba de infusion');
  });
});

describe('buscarCoincidencia', () => {
  it('prioriza el slug exacto', () => {
    expect(buscarCoincidencia({ slug: 'Bomba-Infusion' }, catalogo)?.motivo).toBe('slug');
  });

  it('usa el SKU si el slug no coincide', () => {
    const hit = buscarCoincidencia({ slug: 'otro', sku: 'mon 100' }, catalogo);
    expect(hit).toMatchObject({ motivo: 'sku', producto: { id: '1' } });
  });

  it('cae al nombre normalizado', () => {
    const hit = buscarCoincidencia({ slug: 'nuevo', nombre_es: 'BOMBA DE INFUSION' }, catalogo);
    expect(hit).toMatchObject({ motivo: 'nombre', producto: { id: '2' } });
  });

  it('devuelve null si es un producto realmente nuevo', () => {
    expect(buscarCoincidencia({ slug: 'x', nombre_es: 'Desfibrilador' }, catalogo)).toBeNull();
  });

  it('no empareja por campos vacíos', () => {
    expect(buscarCoincidencia({ slug: '', nombre_es: '', sku: '' }, catalogo)).toBeNull();
  });
});

describe('calcularCambiosFicha', () => {
  const existente = {
    nombre_es: 'Monitor X',
    descripcion_corta_es: 'Descripción vieja',
    descripcion_larga_es: 'Larga vieja',
    especificaciones: [{ clave: 'Pantalla', valor: '10"', grupo: 'Display' }],
    aplicaciones_es: ['UCI'],
    atributos: { distribuidor: 'Dist. Andina', marca: 'Vieja' },
    ficha_pdf: 'https://cdn/old.pdf',
    imagen_principal: 'https://cdn/img.webp',
    familia_id: 'fam-1',
    tipo_id: null,
  };

  it('propone solo lo que la ficha cambia', () => {
    const cambios = calcularCambiosFicha(existente, {
      nombre_es: 'Monitor X',
      descripcion_corta_es: 'Descripción nueva',
      ficha_pdf: 'https://cdn/new.pdf',
    });
    expect(cambios.map(c => c.campo)).toEqual(['descripcion_corta_es', 'ficha_pdf']);
  });

  it('una ficha incompleta nunca borra contenido existente', () => {
    const cambios = calcularCambiosFicha(existente, {
      descripcion_corta_es: '',
      especificaciones: [],
      aplicaciones_es: [],
      atributos: {},
      ficha_pdf: null,
    });
    expect(cambios).toEqual([]);
  });

  it('detecta especificaciones y aplicaciones distintas', () => {
    const cambios = calcularCambiosFicha(existente, {
      especificaciones: [
        { clave: 'Pantalla', valor: '12"', grupo: 'Display' },
        { clave: 'Batería', valor: '4 h', grupo: '' },
      ],
      aplicaciones_es: ['UCI', 'Urgencias'],
    });
    expect(cambios.map(c => c.campo)).toEqual(['especificaciones', 'aplicaciones_es']);
    expect(cambios[0]?.despues).toContain('Batería: 4 h');
  });

  it('fusiona atributos conservando las claves que la ficha no trae', () => {
    const [cambio] = calcularCambiosFicha(existente, {
      atributos: { marca: 'Nueva', beneficios_es: ['Portátil'] },
    });
    expect(cambio?.campo).toBe('atributos');
    expect(cambio?.valor).toEqual({
      distribuidor: 'Dist. Andina',
      marca: 'Nueva',
      beneficios_es: ['Portátil'],
    });
  });

  it('imagen, familia y tipo solo se rellenan si estaban vacíos', () => {
    const cambios = calcularCambiosFicha(existente, {
      imagen_principal: 'https://cdn/otra.webp',
      familia_id: 'fam-2',
      tipo_id: 'tipo-9',
    });
    expect(cambios.map(c => c.campo)).toEqual(['tipo_id']);
  });

  it('nunca propone campos comerciales aunque vengan en la ficha', () => {
    const cambios = calcularCambiosFicha(existente, {
      precio: 1,
      stock: 5,
      activo: false,
      disponible: false,
      slug: 'otro-slug',
      sku: 'NUEVO',
    });
    expect(cambios).toEqual([]);
  });
});

describe('construirActualizacion', () => {
  it('incluye solo los campos que el usuario dejó marcados', () => {
    const cambios = calcularCambiosFicha(
      { descripcion_corta_es: 'a', ficha_pdf: 'x' },
      { descripcion_corta_es: 'b', ficha_pdf: 'y' }
    );
    expect(construirActualizacion(cambios, new Set(['ficha_pdf']))).toEqual({ ficha_pdf: 'y' });
    expect(construirActualizacion(cambios, new Set())).toEqual({});
  });
});
