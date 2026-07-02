import { describe, expect, it } from 'vitest';
import {
  planificarAutoasignacionTipos,
  mensajeBloqueoEliminarFamilia,
  mensajeBloqueoEliminarTipo,
  validarFamiliaYTipoProducto,
} from './taxonomia-logic';

const familias = [
  {
    id: 'fam-1',
    slug: 'mobiliario',
    nombre_es: 'Mobiliario Hospitalario',
    nombre_en: 'Hospital Furniture',
  },
  { id: 'fam-2', slug: 'monitores', nombre_es: 'Monitores de Signos Vitales', nombre_en: null },
];

describe('planificarAutoasignacionTipos', () => {
  it('devuelve plan vacio si no hay productos pendientes', () => {
    const productos = [{ id: 'p1', familia_id: 'fam-1', tipo_id: 'tipo-existente' }];
    const tipos = [{ id: 'tipo-existente', familia_id: 'fam-1', nombre_es: 'Camillas' }];
    const plan = planificarAutoasignacionTipos(productos, tipos, familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([]);
  });

  it('ignora productos sin familia_id', () => {
    const productos = [{ id: 'p1', familia_id: null, tipo_id: null }];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([]);
  });

  it('ignora productos con familia_id huerfano (sin familia real)', () => {
    const productos = [{ id: 'p1', familia_id: 'fam-inexistente', tipo_id: null }];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([]);
  });

  it('usa el tipo existente cuyo nombre_es coincide con el de la familia', () => {
    const productos = [
      { id: 'p1', familia_id: 'fam-1', tipo_id: null },
      { id: 'p2', familia_id: 'fam-1', tipo_id: null },
    ];
    const tipos = [
      { id: 'tipo-generico', familia_id: 'fam-1', nombre_es: 'Mobiliario Hospitalario' },
      { id: 'tipo-otro', familia_id: 'fam-1', nombre_es: 'Camillas' },
    ];
    const plan = planificarAutoasignacionTipos(productos, tipos, familias);
    expect(plan.tiposACrear).toEqual([]);
    expect(plan.actualizacionesDirectas).toEqual([
      { tipoId: 'tipo-generico', productoIds: ['p1', 'p2'] },
    ]);
  });

  it('crea un tipo nuevo con los datos de la familia si no existe uno homonimo', () => {
    const productos = [{ id: 'p1', familia_id: 'fam-2', tipo_id: null }];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([
      {
        familiaId: 'fam-2',
        productoIds: ['p1'],
        tipo: {
          familia_id: 'fam-2',
          slug: 'monitores',
          nombre_es: 'Monitores de Signos Vitales',
          nombre_en: null,
          orden: 0,
          activo: true,
        },
      },
    ]);
  });

  it('agrupa varios productos pendientes de familias distintas en entradas separadas', () => {
    const productos = [
      { id: 'p1', familia_id: 'fam-1', tipo_id: null },
      { id: 'p2', familia_id: 'fam-2', tipo_id: null },
    ];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.tiposACrear).toHaveLength(2);
    expect(plan.tiposACrear.map(t => t.familiaId).sort()).toEqual(['fam-1', 'fam-2']);
  });
});

describe('mensajeBloqueoEliminarFamilia', () => {
  it('devuelve null cuando no hay tipos ni productos asociados', () => {
    expect(mensajeBloqueoEliminarFamilia(0, 0)).toBeNull();
  });

  it('bloquea y explica cuantos tipos/productos hay cuando existen dependientes', () => {
    expect(mensajeBloqueoEliminarFamilia(3, 12)).toBe(
      'No se puede eliminar: tiene 3 tipos y 12 productos asociados. Reasigna primero.'
    );
  });

  it('bloquea aunque solo haya tipos y cero productos', () => {
    expect(mensajeBloqueoEliminarFamilia(1, 0)).toBe(
      'No se puede eliminar: tiene 1 tipos y 0 productos asociados. Reasigna primero.'
    );
  });
});

describe('mensajeBloqueoEliminarTipo', () => {
  it('devuelve null cuando no hay productos asociados', () => {
    expect(mensajeBloqueoEliminarTipo(0)).toBeNull();
  });

  it('bloquea y explica cuantos productos hay asociados', () => {
    expect(mensajeBloqueoEliminarTipo(5)).toBe(
      'No se puede eliminar: tiene 5 productos asociados. Reasigna primero.'
    );
  });
});

describe('validarFamiliaYTipoProducto', () => {
  it('devuelve null cuando familia_id y tipo_id son strings no vacios', () => {
    expect(validarFamiliaYTipoProducto({ familia_id: 'fam-1', tipo_id: 'tipo-1' })).toBeNull();
  });

  it('bloquea cuando falta familia_id', () => {
    expect(validarFamiliaYTipoProducto({ familia_id: null, tipo_id: 'tipo-1' })).toBe(
      'Familia y tipo son obligatorios para guardar el producto.'
    );
  });

  it('bloquea cuando falta tipo_id', () => {
    expect(validarFamiliaYTipoProducto({ familia_id: 'fam-1', tipo_id: null })).toBe(
      'Familia y tipo son obligatorios para guardar el producto.'
    );
  });

  it('bloquea cuando ambos son string vacio', () => {
    expect(validarFamiliaYTipoProducto({ familia_id: '', tipo_id: '' })).toBe(
      'Familia y tipo son obligatorios para guardar el producto.'
    );
  });

  it('bloquea cuando faltan las claves por completo', () => {
    expect(validarFamiliaYTipoProducto({})).toBe(
      'Familia y tipo son obligatorios para guardar el producto.'
    );
  });
});
