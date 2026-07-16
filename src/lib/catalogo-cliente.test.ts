import { describe, expect, it } from 'vitest';
import {
  collectTiposFromCards,
  matchesBase,
  parseStateFromUrl,
  serializeState,
} from './catalogo-cliente';

function card(attrs: Record<string, string>): HTMLElement {
  return { dataset: { ...attrs } } as unknown as HTMLElement;
}

describe('catalogo-cliente tipo URL state', () => {
  it('parsea familia, cat alias y tipo desde la query', () => {
    expect(parseStateFromUrl('?familia=monitores&tipo=oximetros-de-pulso')).toMatchObject({
      familia: 'monitores',
      tipo: 'oximetros-de-pulso',
    });
    expect(parseStateFromUrl('?cat=radiologia')).toMatchObject({
      familia: 'radiologia',
      tipo: '',
    });
  });

  it('serializa tipo solo cuando está presente', () => {
    const qs = serializeState({
      familia: 'sala-cirugia',
      tipo: 'mesas-quirurgicas',
      q: '',
      comercial: new Set(),
      destacado: false,
      nuevo: false,
      disponible: '',
      modalidades: new Set(),
      facetas: new Map(),
      pagina: 1,
      todos: false,
      orden: 'relevancia',
    });
    expect(qs).toBe('familia=sala-cirugia&tipo=mesas-quirurgicas');
  });
});

describe('matchesBase tipo filter', () => {
  const base = {
    familia: 'monitores',
    tipo: '',
    q: '',
    comercial: new Set<string>(),
    destacado: false,
    nuevo: false,
    disponible: '',
    modalidades: new Set<string>(),
    facetas: new Map(),
    pagina: 1,
    todos: false,
    orden: 'relevancia',
  };

  it('filtra por slug de tipo', () => {
    const a = card({
      familias: 'monitores',
      tipo: 'oximetros-de-pulso',
      tipoNombre: 'Oxímetros',
    });
    const b = card({
      familias: 'monitores',
      tipo: 'monitores-de-paciente-multiparametro',
      tipoNombre: 'Monitores',
    });
    expect(matchesBase(a, { ...base, tipo: 'oximetros-de-pulso' })).toBe(true);
    expect(matchesBase(b, { ...base, tipo: 'oximetros-de-pulso' })).toBe(false);
  });

  it('usa __general__ para productos sin tipo', () => {
    const sinTipo = card({ familias: 'monitores', tipo: '', tipoNombre: '' });
    const conTipo = card({ familias: 'monitores', tipo: 'oximetros-de-pulso' });
    expect(matchesBase(sinTipo, { ...base, tipo: '__general__' })).toBe(true);
    expect(matchesBase(conTipo, { ...base, tipo: '__general__' })).toBe(false);
  });
});

describe('collectTiposFromCards', () => {
  it('agrega conteos y General cuando hay sin tipo', () => {
    const cards = [
      card({ tipo: 'a', tipoNombre: 'Alpha' }),
      card({ tipo: 'a', tipoNombre: 'Alpha' }),
      card({ tipo: 'b', tipoNombre: 'Beta' }),
      card({ tipo: '', tipoNombre: '' }),
    ];
    const tipos = collectTiposFromCards(cards);
    expect(tipos.find(t => t.slug === 'a')).toEqual({ slug: 'a', nombre: 'Alpha', count: 2 });
    expect(tipos.find(t => t.slug === '__general__')?.count).toBe(1);
  });
});
