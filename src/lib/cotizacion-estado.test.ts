import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_GUARDADO_COTIZACION,
  COTIZACION_ESTADOS,
  estadosDeBandeja,
  normalizarEstadoCotizacion,
  planArchivo,
  planCambioEstado,
  planDesarchivo,
  proyectarGuardadoCotizacion,
  resolverFiltroArchivo,
  type FilaEstadoCotizacion,
} from './cotizacion-estado';

const ahora = new Date('2026-10-11T14:30:00.000Z');
const fila: FilaEstadoCotizacion = {
  estado: 'nueva',
  pedido_id: null,
  archived_at: null,
  notas_internas: 'Nota previa',
};

describe('guardado ignora el estado', () => {
  it('la allowlist no incluye estado ni campos de envío', () => {
    expect(CAMPOS_GUARDADO_COTIZACION).not.toContain('estado');
    expect(CAMPOS_GUARDADO_COTIZACION).not.toContain('oferta_enviada_at');
    expect(CAMPOS_GUARDADO_COTIZACION).not.toContain('archived_at');
  });

  it('la allowlist no incluye marca de aprobación de envío', () => {
    for (const campo of [
      'aprobado_por',
      'aprobado_at',
      'aprobacion_tipo',
      'aprobacion_ref',
      'margen_validado',
      'aprobacion_hash',
    ]) {
      expect(CAMPOS_GUARDADO_COTIZACION).not.toContain(campo);
    }
  });

  it('proyectarGuardadoCotizacion descarta estado aunque el body lo traiga', () => {
    const patch = proyectarGuardadoCotizacion({
      nombre: 'Ana',
      estado: 'enviada',
      oferta_enviada_at: '2026-10-11T00:00:00Z',
      leida: true,
      aprobado_por: 'shoky',
      aprobado_at: '2026-10-31',
      aprobacion_hash: 'forjado',
    });
    expect(patch).toEqual({ nombre: 'Ana', leida: true });
    expect(patch).not.toHaveProperty('estado');
    expect(patch).not.toHaveProperty('aprobado_por');
    expect(patch).not.toHaveProperty('aprobacion_hash');
  });
});


describe('planCambioEstado', () => {
  it('cambia a perdida, declinada o enviada sin campos de envío', () => {
    for (const estado of ['perdida', 'declinada', 'enviada', 'en revision', 'Enviada'] as const) {
      const plan = planCambioEstado(fila, estado, {
        motivo: '  El cliente no compró  ',
        actor: 'comercial1@i-me.com.co',
        ahora,
      });
      expect(plan.ok).toBe(true);
      if (!plan.ok) continue;
      expect(Object.keys(plan.patch).sort()).toEqual(['estado', 'leida', 'notas_internas']);
      expect(plan.patch.leida).toBe(true);
      expect(plan.patch).not.toHaveProperty('oferta_enviada_at');
      expect(plan.auditoria.antes).toEqual({ estado: 'nueva' });
      expect(plan.auditoria.herramienta).toBe('cambiar_estado_cotizacion');
      expect(plan.auditoria.motivo).toBe('El cliente no compró');
      expect(String(plan.patch.notas_internas)).toContain('Nota previa');
      expect(String(plan.patch.notas_internas)).toContain('comercial1@i-me.com.co');
    }
    const enviada = planCambioEstado(fila, 'enviada', {
      motivo: 'Marca interna',
      actor: 'cms',
      ahora,
    });
    expect(enviada.ok && enviada.patch.estado).toBe('enviada');
    const perdida = planCambioEstado(fila, 'pérdida', { motivo: 'Precio', actor: 'cms', ahora });
    expect(perdida.ok && perdida.patch.estado).toBe('perdida');
  });

  it('rechaza motivo vacío, estado inventado, el mismo estado, archivada y con pedido', () => {
    expect(planCambioEstado(fila, 'perdida', { motivo: '  ', actor: 'a' }).ok).toBe(false);
    expect(planCambioEstado(fila, 'ganada', { motivo: 'x', actor: 'a' })).toMatchObject({
      ok: false,
      code: 'ESTADO_INVALIDO',
    });
    expect(planCambioEstado(fila, 'nueva', { motivo: 'x', actor: 'a' })).toMatchObject({
      code: 'ESTADO_IGUAL',
    });
    expect(
      planCambioEstado({ ...fila, archived_at: '2026-10-01T00:00:00Z' }, 'perdida', {
        motivo: 'x',
        actor: 'a',
      })
    ).toMatchObject({ code: 'COTIZACION_ARCHIVADA' });
    expect(
      planCambioEstado({ ...fila, pedido_id: 'ped-1', estado: 'convertida' }, 'perdida', {
        motivo: 'x',
        actor: 'a',
      })
    ).toMatchObject({ code: 'COTIZACION_YA_CONVERTIDA' });
  });

  it('acepta los estados existentes y los nuevos', () => {
    expect(COTIZACION_ESTADOS).toEqual([
      'nueva',
      'en_revision',
      'respondida',
      'enviada',
      'convertida',
      'expirada',
      'perdida',
      'declinada',
    ]);
    expect(normalizarEstadoCotizacion('declinada')).toBe('declinada');
  });
});

describe('archivo recuperable', () => {
  it('archiva sin borrar y guarda quién y el motivo', () => {
    const plan = planArchivo(fila, {
      motivo: 'Duplicada de IME-Q-2026-000010',
      actor: 'gestor',
      archivedBy: '11111111-1111-4111-8111-111111111111',
      ahora,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch.archived_at).toBe('2026-10-11T14:30:00.000Z');
    expect(plan.patch.archived_by).toBe('11111111-1111-4111-8111-111111111111');
    expect(plan.patch.archived_reason).toBe('Duplicada de IME-Q-2026-000010');
    expect(plan.patch).not.toHaveProperty('estado');
    expect(plan.auditoria.antes).toEqual({ estado: 'nueva', archived_at: null });
    expect(plan.auditoria.despues).toMatchObject({ estado: 'nueva' });
    expect(
      planArchivo({ ...fila, archived_at: '2026-01-01' }, { motivo: 'x', actor: 'a' })
    ).toMatchObject({
      code: 'YA_ARCHIVADA',
    });
  });

  it('desarchiva limpiando archived_at, archived_by y el motivo', () => {
    const archivada: FilaEstadoCotizacion = {
      ...fila,
      estado: 'perdida',
      archived_at: '2026-10-01T00:00:00Z',
      archived_by: '11111111-1111-4111-8111-111111111111',
      archived_reason: 'Duplicada',
    };
    const plan = planDesarchivo(archivada, { motivo: 'El cliente retomó', actor: 'cms', ahora });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch).toMatchObject({
      archived_at: null,
      archived_by: null,
      archived_reason: null,
    });
    expect(plan.patch).not.toHaveProperty('estado');
    expect(plan.auditoria.antes).toMatchObject({
      estado: 'perdida',
      archived_at: '2026-10-01T00:00:00Z',
    });
    expect(planDesarchivo(fila, { motivo: 'x', actor: 'a' })).toMatchObject({
      code: 'NO_ARCHIVADA',
    });
  });
});

describe('listas', () => {
  it('oculta archivadas salvo opt-in', () => {
    expect(resolverFiltroArchivo({})).toBe('activas');
    expect(resolverFiltroArchivo({ incluir_archivadas: '1' })).toBe('todas');
    expect(resolverFiltroArchivo({ incluir_archivadas: true })).toBe('todas');
    expect(resolverFiltroArchivo({ solo_archivadas: '1' })).toBe('solo_archivadas');
    expect(resolverFiltroArchivo({ archivadas: 'solo', incluir_archivadas: '1' })).toBe(
      'solo_archivadas'
    );
  });

  it('bandeja cerradas incluye perdida y declinada', () => {
    expect(estadosDeBandeja('pendientes')).toEqual(['nueva', 'en_revision', 'respondida']);
    expect(estadosDeBandeja('cerradas')).toEqual(['perdida', 'declinada', 'expirada']);
    expect(estadosDeBandeja('todas')).toBeNull();
    expect(estadosDeBandeja(null)).toEqual(['nueva', 'en_revision', 'respondida']);
  });
});

describe('cableado API y MCP', () => {
  const edge = readFileSync(
    new URL('../../supabase/functions/comercial-cotizacion/index.ts', import.meta.url),
    'utf8'
  );
  const mcp = readFileSync(new URL('./mcp-comercio-core.ts', import.meta.url), 'utf8');

  it('la función comercial no envía ni borra filas', () => {
    expect(edge).not.toContain('enviar-cotizacion');
    expect(edge).toContain('planCambioEstado');
    expect(edge).toContain('planArchivo');
    expect(edge).toContain('planDesarchivo');
    expect(edge).toContain('envio_cliente: false');
    expect(edge).toContain('proyectarGuardadoCotizacion');
    expect(edge).not.toMatch(/from\('solicitudes_cotizacion'\)\s*\.delete\(/);
  });

  it('las herramientas MCP de estado y archivo no llaman al envío', () => {
    const desde = mcp.indexOf("nombre === 'cambiar_estado_cotizacion'");
    const hasta = mcp.indexOf("nombre === 'preparar_envio_cotizacion'");
    expect(desde).toBeGreaterThan(-1);
    expect(hasta).toBeGreaterThan(desde);
    const bloque = mcp.slice(desde, hasta);
    expect(bloque).toContain('planCambioEstado');
    expect(bloque).toContain('planArchivo');
    expect(bloque).toContain('planDesarchivo');
    expect(bloque).toContain('envio_cliente: false');
    expect(bloque).not.toContain('enviar-cotizacion');
  });
});
