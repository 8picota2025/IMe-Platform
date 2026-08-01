export interface FamiliaRow {
  id: string;
  slug: string;
  nombre_es: string;
  nombre_en: string | null;
}

export interface TipoRow {
  id: string;
  familia_id: string;
  nombre_es: string;
}

export interface ProductoTaxonomiaRow {
  id: string;
  familia_id: string | null;
  tipo_id: string | null;
}

export interface TipoACrear {
  familia_id: string;
  slug: string;
  nombre_es: string;
  nombre_en: string | null;
  orden: number;
  activo: boolean;
}

export interface PlanAutoasignacion {
  actualizacionesDirectas: Array<{ tipoId: string; productoIds: string[] }>;
  tiposACrear: Array<{ familiaId: string; tipo: TipoACrear; productoIds: string[] }>;
}

/**
 * Regla: cada producto sin tipo (pero con familia) se asigna al tipo de su
 * misma familia cuyo nombre_es sea identico al nombre_es de la familia. Si
 * no existe ese tipo todavia, se propone crearlo con los datos de la familia.
 */
export function planificarAutoasignacionTipos(
  productos: ProductoTaxonomiaRow[],
  tipos: TipoRow[],
  familias: FamiliaRow[]
): PlanAutoasignacion {
  const porFamilia = new Map<string, string[]>();
  for (const producto of productos) {
    if (producto.tipo_id || !producto.familia_id) continue;
    const lista = porFamilia.get(producto.familia_id) ?? [];
    lista.push(producto.id);
    porFamilia.set(producto.familia_id, lista);
  }

  const actualizacionesDirectas: PlanAutoasignacion['actualizacionesDirectas'] = [];
  const tiposACrear: PlanAutoasignacion['tiposACrear'] = [];

  for (const [familiaId, productoIds] of porFamilia) {
    const familia = familias.find(f => f.id === familiaId);
    if (!familia) continue;
    const tipoExistente = tipos.find(
      t => t.familia_id === familiaId && t.nombre_es === familia.nombre_es
    );
    if (tipoExistente) {
      actualizacionesDirectas.push({ tipoId: tipoExistente.id, productoIds });
    } else {
      tiposACrear.push({
        familiaId,
        productoIds,
        tipo: {
          familia_id: familiaId,
          slug: familia.slug,
          nombre_es: familia.nombre_es,
          nombre_en: familia.nombre_en,
          orden: 0,
          activo: true,
        },
      });
    }
  }

  return { actualizacionesDirectas, tiposACrear };
}

export function mensajeBloqueoEliminarFamilia(
  tiposCount: number,
  productosCount: number
): string | null {
  if (tiposCount === 0 && productosCount === 0) return null;
  return `No se puede eliminar: tiene ${tiposCount} tipos y ${productosCount} productos asociados. Reasigna primero.`;
}

export function mensajeBloqueoEliminarTipo(productosCount: number): string | null {
  if (productosCount === 0) return null;
  return `No se puede eliminar: tiene ${productosCount} productos asociados. Reasigna primero.`;
}

export function validarFamiliaYTipoProducto(payload: {
  familia_id?: unknown;
  tipo_id?: unknown;
}): string | null {
  const familiaId = typeof payload.familia_id === 'string' ? payload.familia_id : '';
  const tipoId = typeof payload.tipo_id === 'string' ? payload.tipo_id : '';
  if (!familiaId || !tipoId) {
    return 'Familia y tipo son obligatorios para guardar el producto.';
  }
  return null;
}

export function validarTipoEditable(payload: {
  familia_id?: unknown;
  slug?: unknown;
  nombre_es?: unknown;
}): string | null {
  const familiaId = typeof payload.familia_id === 'string' ? payload.familia_id : '';
  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  const nombreEs = typeof payload.nombre_es === 'string' ? payload.nombre_es.trim() : '';
  if (!familiaId) return 'La familia es obligatoria para guardar el tipo.';
  if (!slug) return 'El slug del tipo es obligatorio.';
  if (!nombreEs) return 'El nombre ES del tipo es obligatorio.';
  return null;
}

export function validarFamiliaEditable(payload: {
  slug?: unknown;
  nombre_es?: unknown;
}): string | null {
  const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';
  const nombreEs = typeof payload.nombre_es === 'string' ? payload.nombre_es.trim() : '';
  if (!slug) return 'El slug de la familia es obligatorio.';
  if (!nombreEs) return 'El nombre ES de la familia es obligatorio.';
  return null;
}
