import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  agruparPorTema,
  parseBorrador,
  relacionadosEnTema,
  rutasConocimiento,
  type ArticuloConCluster,
} from './conocimiento-clusters';

const monitoreo = { slug: 'monitoreo-uci', nombre: 'Monitoreo / UCI' };
const invima = { slug: 'invima-regulacion', nombre: 'INVIMA / regulación' };

function art(
  slug: string,
  cluster: ArticuloConCluster['cluster'],
  created_at: string,
  tags: string[] = []
): ArticuloConCluster {
  return { slug, titulo: slug, cluster, tags, created_at };
}

const articulos = [
  art('guia-monitores', monitoreo, '2026-08-16T00:00:00Z'),
  art('central-vs-individual', monitoreo, '2026-09-20T00:00:00Z'),
  art('pilar-monitoreo', monitoreo, '2026-01-01T00:00:00Z', ['pilar']),
  art('registro-sanitario', invima, '2026-09-24T00:00:00Z'),
  art('quienes-somos', null, '2026-06-17T00:00:00Z'),
];

describe('agruparPorTema', () => {
  it('agrupa sólo artículos con tema, el tema con más artículos primero', () => {
    const temas = agruparPorTema(articulos);
    expect(temas.map(t => [t.cluster.slug, t.articulos.length])).toEqual([
      ['monitoreo-uci', 3],
      ['invima-regulacion', 1],
    ]);
  });

  it('dentro de un tema pone el pilar primero y luego del más reciente al más antiguo', () => {
    const [monitoreoTema] = agruparPorTema(articulos);
    expect(monitoreoTema?.articulos.map(a => a.slug)).toEqual([
      'pilar-monitoreo',
      'central-vs-individual',
      'guia-monitores',
    ]);
  });
});

describe('relacionadosEnTema', () => {
  it('devuelve los otros artículos del mismo tema, pilar primero, sin el propio', () => {
    const base = articulos[0]!;
    expect(relacionadosEnTema(base, articulos).map(a => a.slug)).toEqual([
      'pilar-monitoreo',
      'central-vs-individual',
    ]);
  });

  it('respeta el límite', () => {
    expect(relacionadosEnTema(articulos[0]!, articulos, 1)).toHaveLength(1);
  });

  it('vacío si el artículo no tiene tema', () => {
    expect(relacionadosEnTema(articulos[4]!, articulos)).toEqual([]);
  });
});

describe('rutasConocimiento', () => {
  it('usa /es/conocimiento/tema y /en/knowledge/topic', () => {
    expect(rutasConocimiento.tema('es', 'monitoreo-uci')).toBe(
      '/es/conocimiento/tema/monitoreo-uci'
    );
    expect(rutasConocimiento.tema('en', 'monitoreo-uci')).toBe('/en/knowledge/topic/monitoreo-uci');
    expect(rutasConocimiento.articulo('en', 'x')).toBe('/en/knowledge/x');
    expect(rutasConocimiento.indice('es')).toBe('/es/conocimiento');
  });
});

describe('parseBorrador', () => {
  const valido = [
    '---',
    'slug: registro-sanitario',
    'titulo_es: Qué es el registro sanitario',
    'titulo_en: What a sanitary registration is',
    'cluster: invima-regulacion',
    'tags: pilar, registro-sanitario',
    '---',
    '# Cuerpo ES',
    '',
    'Texto: con dos puntos.',
    '<!-- en -->',
    '# EN body',
  ].join('\n');

  it('lee cabecera, etiquetas y los dos cuerpos', () => {
    expect(parseBorrador(valido)).toEqual({
      slug: 'registro-sanitario',
      titulo_es: 'Qué es el registro sanitario',
      titulo_en: 'What a sanitary registration is',
      cluster: 'invima-regulacion',
      tags: ['pilar', 'registro-sanitario'],
      cuerpo_es: '# Cuerpo ES\n\nTexto: con dos puntos.',
      cuerpo_en: '# EN body',
    });
  });

  it('el cuerpo en inglés es opcional', () => {
    const soloEs = valido.split('\n<!-- en -->')[0]!;
    expect(parseBorrador(soloEs)?.cuerpo_en).toBe('');
  });

  it('rechaza borradores sin campos obligatorios', () => {
    expect(parseBorrador(valido.replace('cluster: invima-regulacion\n', ''))).toBeNull();
    expect(parseBorrador('# sin cabecera')).toBeNull();
  });
});

describe('contenido del repo', () => {
  const dir = resolve(__dirname, '../data/conocimiento-borradores');

  it('todos los borradores .md son válidos', () => {
    const archivos = readdirSync(dir).filter(f => f.endsWith('.md'));
    for (const archivo of archivos) {
      const borrador = parseBorrador(readFileSync(resolve(dir, archivo), 'utf8'));
      expect(borrador, archivo).not.toBeNull();
      expect(`${borrador!.slug}.md`, 'el archivo se llama como su slug').toBe(archivo);
    }
  });

  it('la asignación de temas del preview coincide con la migración', () => {
    const asignacion = JSON.parse(
      readFileSync(resolve(dir, 'asignacion-temas.json'), 'utf8')
    ) as Record<string, string>;
    const sql = readFileSync(
      resolve(__dirname, '../../supabase/migrations/20260924120000_asignar_temas_articulos.sql'),
      'utf8'
    );
    const enSql = Object.fromEntries(
      [...sql.matchAll(/\('([a-z0-9-]+)', '([a-z0-9-]+)'\)/g)].map(m => [m[1], m[2]])
    );
    expect(enSql).toEqual(asignacion);
  });
});
