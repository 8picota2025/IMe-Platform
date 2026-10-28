/**
 * Aislamiento horizontal F-06 para cotizaciones.
 * Ventas: solo filas propias; filas web sin `created_by` son reclamables.
 * Admin/owner/service_role: bandeja completa.
 */

export type CotizacionActorRol = 'ventas' | 'admin' | 'owner' | 'service_role' | string;

export function esSupervisorCotizacion(rol: CotizacionActorRol | null | undefined): boolean {
  return rol === 'admin' || rol === 'owner' || rol === 'service_role';
}

/**
 * ¿Puede este actor leer/mutar la fila?
 * - Supervisores: sí.
 * - Ventas: sí si `created_by` es null (lead web) o coincide con su userId.
 * - Sin userId (solo service_role sin actor): denegar salvo supervisor.
 */
export function puedeOperarCotizacion(args: {
  rol: CotizacionActorRol | null | undefined;
  userId: string | null | undefined;
  createdBy: string | null | undefined;
}): boolean {
  if (esSupervisorCotizacion(args.rol)) return true;
  if (args.rol !== 'ventas') return false;
  const userId = String(args.userId ?? '').trim();
  if (!userId) return false;
  const owner = String(args.createdBy ?? '').trim();
  if (!owner) return true;
  return owner === userId;
}

/**
 * Listado "equipo": supervisores ven todo; ventas solo propias + sin dueño
 * (solicitudes web). Nunca la bandeja privada de otro comercial.
 */
export function filtroListadoEquipo(args: {
  rol: CotizacionActorRol | null | undefined;
  userId: string | null | undefined;
  equipo: boolean;
}): { mode: 'all' | 'own' | 'own_or_unassigned' } {
  if (esSupervisorCotizacion(args.rol)) {
    return { mode: args.equipo ? 'all' : 'own' };
  }
  if (args.rol === 'ventas' && args.equipo) return { mode: 'own_or_unassigned' };
  return { mode: 'own' };
}
