import { describe, expect, it } from 'vitest';
import {
  assertOwnerDelete,
  assertOwnerHierarchyMutation,
  canManageCmsUsers,
  wouldRemoveLastActiveOwner,
} from './admin-users-authz';

const owner = { userId: 'o1', rol: 'owner' as const, activo: true };
const admin = { userId: 'a1', rol: 'admin' as const, activo: true };
const ventas = { userId: 'v1', rol: 'ventas' as const, activo: true };

describe('canManageCmsUsers', () => {
  it('permite owner y admin activos', () => {
    expect(canManageCmsUsers(owner)).toBe(true);
    expect(canManageCmsUsers(admin)).toBe(true);
  });

  it('niega ventas e inactivos', () => {
    expect(canManageCmsUsers(ventas)).toBe(false);
    expect(canManageCmsUsers({ ...admin, activo: false })).toBe(false);
  });
});

describe('assertOwnerHierarchyMutation', () => {
  it('bloquea que admin se auto-promueva a owner', () => {
    const r = assertOwnerHierarchyMutation({
      actor: admin,
      nextRol: 'owner',
      target: { userId: 'a1', email: 'admin@i-me.com.co', rol: 'admin', activo: true },
      setsPassword: false,
    });
    expect(r.ok).toBe(false);
  });

  it('bloquea que admin asigne owner a un tercero', () => {
    const r = assertOwnerHierarchyMutation({
      actor: admin,
      nextRol: 'owner',
      target: null,
      setsPassword: false,
    });
    expect(r.ok).toBe(false);
  });

  it('bloquea que admin degrade, reactive o desactive un owner', () => {
    const active = {
      userId: 'o1',
      email: 'owner@i-me.com.co',
      rol: 'owner',
      activo: true,
    };
    const inactive = { ...active, activo: false };
    expect(
      assertOwnerHierarchyMutation({
        actor: admin,
        nextRol: 'lectura',
        target: active,
        setsPassword: false,
      }).ok
    ).toBe(false);
    expect(
      assertOwnerHierarchyMutation({
        actor: admin,
        nextRol: 'owner',
        target: inactive,
        setsPassword: false,
      }).ok
    ).toBe(false);
    expect(
      assertOwnerHierarchyMutation({
        actor: admin,
        nextRol: 'ventas',
        target: inactive,
        setsPassword: false,
      }).ok
    ).toBe(false);
  });

  it('bloquea reset de password de owner por admin', () => {
    const r = assertOwnerHierarchyMutation({
      actor: admin,
      nextRol: 'owner',
      target: { userId: 'o1', email: 'owner@i-me.com.co', rol: 'owner', activo: true },
      setsPassword: true,
    });
    expect(r.ok).toBe(false);
  });

  it('permite que admin gestione roles no-owner', () => {
    const r = assertOwnerHierarchyMutation({
      actor: admin,
      nextRol: 'ventas',
      target: { userId: 'v1', email: 'v@i-me.com.co', rol: 'lectura', activo: true },
      setsPassword: true,
    });
    expect(r).toEqual({ ok: true });
  });

  it('permite que owner asigne owner', () => {
    const r = assertOwnerHierarchyMutation({
      actor: owner,
      nextRol: 'owner',
      target: null,
      setsPassword: false,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe('wouldRemoveLastActiveOwner', () => {
  it('bloquea degradar al último owner activo', () => {
    const r = wouldRemoveLastActiveOwner({
      target: { userId: 'o1', rol: 'owner', activo: true },
      nextRol: 'admin',
      nextActivo: true,
      otherActiveOwners: 0,
    });
    expect(r.ok).toBe(false);
  });

  it('permite degradar si queda otro owner', () => {
    const r = wouldRemoveLastActiveOwner({
      target: { userId: 'o1', rol: 'owner', activo: true },
      nextRol: 'admin',
      nextActivo: true,
      otherActiveOwners: 1,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe('assertOwnerDelete', () => {
  it('niega delete de owner por admin', () => {
    const r = assertOwnerDelete({
      actor: admin,
      target: { userId: 'o1', rol: 'owner', activo: true },
    });
    expect(r.ok).toBe(false);
  });

  it('permite delete de owner por owner', () => {
    const r = assertOwnerDelete({
      actor: owner,
      target: { userId: 'o2', rol: 'owner', activo: true },
    });
    expect(r).toEqual({ ok: true });
  });
});
