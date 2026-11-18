/**
 * Reglas de autorización para gestión de usuarios CMS (admin-users).
 * owner puede asignar cualquier rol; admin gestiona todo excepto la jerarquía owner.
 */

export type AdminManageRole = 'owner' | 'admin' | 'catalogo' | 'ventas' | 'operaciones' | 'lectura';

export interface AdminActor {
  userId: string;
  rol: AdminManageRole;
  activo: boolean;
}

export interface AdminTargetProfile {
  userId?: string | null;
  email?: string | null;
  rol: string;
  activo: boolean;
}

/** Quién puede abrir el endpoint de gestión de usuarios. */
export function canManageCmsUsers(actor: Pick<AdminActor, 'rol' | 'activo'>): boolean {
  return actor.activo === true && (actor.rol === 'owner' || actor.rol === 'admin');
}

export function isOwnerActor(actor: Pick<AdminActor, 'rol' | 'activo'>): boolean {
  return actor.activo === true && actor.rol === 'owner';
}

/**
 * Solo un owner activo puede:
 * - asignar rol owner
 * - modificar / desactivar / eliminar un perfil que ya es owner
 * - fijar contraseña de un perfil owner
 */
export function assertOwnerHierarchyMutation(params: {
  actor: AdminActor;
  nextRol: AdminManageRole;
  target: AdminTargetProfile | null;
  setsPassword: boolean;
}): { ok: true } | { ok: false; message: string } {
  const { actor, nextRol, target, setsPassword } = params;
  if (isOwnerActor(actor)) return { ok: true };

  // Cualquier fila con rol owner (activo o no) es jerarquía reservada.
  if (target?.rol === 'owner') {
    return {
      ok: false,
      message: setsPassword
        ? 'Solo un owner puede restablecer la contraseña de otro owner.'
        : 'Solo un owner puede modificar, reactivar o desactivar un perfil owner.',
    };
  }

  if (nextRol === 'owner') {
    return { ok: false, message: 'Solo un owner puede asignar el rol owner.' };
  }

  return { ok: true };
}

/**
 * Impide dejar el CMS sin owner activo al degradar/desactivar en upsert
 * (el delete ya tenía esta guarda).
 */
export function wouldRemoveLastActiveOwner(params: {
  target: AdminTargetProfile | null;
  nextRol: AdminManageRole;
  nextActivo: boolean;
  otherActiveOwners: number;
}): { ok: true } | { ok: false; message: string } {
  const { target, nextRol, nextActivo, otherActiveOwners } = params;
  if (!target || target.rol !== 'owner' || target.activo !== true) return { ok: true };

  const remainsActiveOwner = nextRol === 'owner' && nextActivo === true;
  if (remainsActiveOwner) return { ok: true };
  if (otherActiveOwners > 0) return { ok: true };

  return {
    ok: false,
    message: 'No puedes dejar el CMS sin al menos un owner activo.',
  };
}

export function assertOwnerDelete(params: {
  actor: AdminActor;
  target: AdminTargetProfile | null;
}): { ok: true } | { ok: false; message: string } {
  const { actor, target } = params;
  if (!target || target.rol !== 'owner' || target.activo !== true) return { ok: true };
  if (isOwnerActor(actor)) return { ok: true };
  return { ok: false, message: 'Solo un owner puede eliminar un perfil owner.' };
}
