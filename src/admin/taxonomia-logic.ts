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
