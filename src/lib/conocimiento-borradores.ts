/**
 * Artículos del Centro de Conocimiento para las páginas, con preview de
 * borradores (Fase 2 del Growth Engine).
 *
 * SÓLO para el frontmatter de páginas .astro (se ejecuta al construir). No
 * importar desde código que llegue al navegador: con PREVIEW_DRAFTS los
 * borradores sin publicar se cargan aquí.
 *
 * Con PREVIEW_DRAFTS=true (build local, nunca en CI) se suman:
 * - los borradores de src/data/conocimiento-borradores/*.md;
 * - la asignación de temas pendiente de migrar
 *   (src/data/conocimiento-borradores/asignacion-temas.json), para ver en el
 *   preview el resultado de la migración antes de aplicarla.
 * Sin PREVIEW_DRAFTS devuelve exactamente getArticulos().
 */
import type { Locale } from '../i18n/utils';
import { getArticulos, getTopicClusters, type Articulo } from './datos';
import { parseBorrador, type TopicClusterRef } from './conocimiento-clusters';

export const PREVIEW_DRAFTS = import.meta.env['PREVIEW_DRAFTS'] === 'true';

const borradoresRaw = import.meta.glob<string>('../data/conocimiento-borradores/*.md', {
  query: '?raw',
  import: 'default',
});
const asignacionRaw = import.meta.glob<Record<string, string>>(
  '../data/conocimiento-borradores/asignacion-temas.json',
  { import: 'default' }
);

async function cargarBorradores(
  locale: Locale,
  temas: Map<string, TopicClusterRef>
): Promise<Articulo[]> {
  const ahora = new Date().toISOString();
  const archivos = await Promise.all(Object.values(borradoresRaw).map(cargar => cargar()));
  return archivos.flatMap(raw => {
    const borrador = parseBorrador(raw);
    if (!borrador) return [];
    const en = locale === 'en';
    return [
      {
        id: `borrador:${borrador.slug}`,
        slug: borrador.slug,
        titulo: en ? borrador.titulo_en || borrador.titulo_es : borrador.titulo_es,
        cuerpo: en ? borrador.cuerpo_en || borrador.cuerpo_es : borrador.cuerpo_es,
        publicado: true,
        created_at: ahora,
        updated_at: ahora,
        cluster: temas.get(borrador.cluster) ?? {
          slug: borrador.cluster,
          nombre: borrador.cluster,
        },
        tags: [...borrador.tags, 'borrador'],
      },
    ];
  });
}

export async function getArticulosConocimiento(locale: Locale): Promise<Articulo[]> {
  const publicados = await getArticulos(locale);
  if (!PREVIEW_DRAFTS) return publicados;

  const temas = new Map((await getTopicClusters(locale)).map(t => [t.slug, t]));
  const [cargarAsignacion] = Object.values(asignacionRaw);
  const asignacion = cargarAsignacion ? await cargarAsignacion() : {};
  const conAsignacion = publicados.map(articulo => {
    const slugTema = asignacion[articulo.slug];
    if (!slugTema || articulo.cluster) return articulo;
    return { ...articulo, cluster: temas.get(slugTema) ?? { slug: slugTema, nombre: slugTema } };
  });

  const borradores = await cargarBorradores(locale, temas);
  const slugsBorrador = new Set(borradores.map(b => b.slug));
  // Un borrador con el slug de un artículo publicado es su reescritura: lo reemplaza.
  return [...borradores, ...conAsignacion.filter(a => !slugsBorrador.has(a.slug))];
}

export function esBorrador(articulo: Pick<Articulo, 'tags'>): boolean {
  return PREVIEW_DRAFTS && articulo.tags.includes('borrador');
}
