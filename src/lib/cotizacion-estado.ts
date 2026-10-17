/**
 * Cambio de estado y archivo recuperable de cotizaciones.
 *
 * El POST de guardado (`comercial-cotizacion` y el save del PWA) ignora `estado`:
 * el cuerpo puede traerlo y no entra en el parche. El único camino que antes
 * escribía `enviada` era `enviar-cotizacion`, que sí contacta al cliente.
 * `planCambioEstado` cambia el estado comercial sin correo, WhatsApp ni PDF.
 */
export const COTIZACION_ESTADOS = [
  'nueva',
  'en_revision',
  'respondida',
  'enviada',
  'convertida',
  'expirada',
  'perdida',
  'declinada',
] as const;

export type CotizacionEstado = (typeof COTIZACION_ESTADOS)[number];

export const COTIZACION_ESTADOS_CERRADAS = ['perdida', 'declinada', 'expirada'] as const;

/** Columnas que el guardado de oferta puede escribir. `estado` no está. */
export const CAMPOS_GUARDADO_COTIZACION = [
  'nombre',
  'empresa',
  'email',
  'telefono',
  'moneda',
  'mercado',
  'productos',
  'condiciones',
  'validez_hasta',
  'precio_total_ofertado',
  'locale',
  'leida',
  'impuestos_incluidos',
  'cuenta_recaudo',
  'condicion_pago',
  'condicion_pago_en',
  'nit',
  'direccion_facturacion',
  'direccion_envio',
  'ciudad',
  'pais',
  'idioma',
  'condiciones_en',
] as const;

const MOTIVO_MAX = 500;

export type FiltroArchivo = 'activas' | 'todas' | 'solo_archivadas';

export interface FilaEstadoCotizacion {
  estado?: string | null;
  pedido_id?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  archived_reason?: string | null;
  notas_internas?: string | null;
}

export interface ContextoCambio {
  motivo: string;
  /** Quién queda en la nota y en la auditoría (email o nombre del agente). */
  actor: string;
  ahora?: Date;
  /** UUID de auth.users cuando se conoce (CMS). El MCP puede omitirlo. */
  archivedBy?: string | null;
}

export interface AuditoriaPlan {
  herramienta: 'cambiar_estado_cotizacion' | 'archivar_cotizacion' | 'desarchivar_cotizacion';
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
  motivo: string;
}

export type PlanOk = {
  ok: true;
  patch: Record<string, unknown>;
  auditoria: AuditoriaPlan;
};

export type PlanErr = {
  ok: false;
  code: string;
  error: string;
  status: number;
};

export type PlanCotizacion = PlanOk | PlanErr;

function fallo(code: string, error: string, status: number): PlanErr {
  return { ok: false, code, error, status };
}

export function motivoLimpio(value: unknown): string | null {
  const limpio = String(value ?? '').trim();
  if (!limpio) return null;
  return limpio.slice(0, MOTIVO_MAX);
}

function exigirMotivo(value: unknown): { ok: true; motivo: string } | PlanErr {
  const motivo = motivoLimpio(value);
  if (!motivo) return fallo('MOTIVO_REQUERIDO', 'Hace falta un motivo.', 422);
  return { ok: true, motivo };
}

export function normalizarEstadoCotizacion(value: unknown): CotizacionEstado | null {
  const crudo = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]+/g, '_');
  return (COTIZACION_ESTADOS as readonly string[]).includes(crudo)
    ? (crudo as CotizacionEstado)
    : null;
}

export function selloSeguimiento(ahora: Date): string {
  return ahora.toISOString().replace('T', ' ').slice(0, 16);
}

export function anexarNota(previas: string | null | undefined, linea: string): string {
  const base = String(previas ?? '').trim();
  return base ? `${base}\n${linea}` : linea;
}

function nota(fila: FilaEstadoCotizacion, ahora: Date, texto: string): string {
  return anexarNota(fila.notas_internas, `[${selloSeguimiento(ahora)}] ${texto}`);
}

/**
 * Quita `estado` (y cualquier campo fuera de la allowlist) del parche de guardado.
 * Así un POST de save no puede marcar enviada/perdida ni disparar un envío.
 */
export function proyectarGuardadoCotizacion(
  canon: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const campo of CAMPOS_GUARDADO_COTIZACION) {
    if (Object.prototype.hasOwnProperty.call(canon, campo)) out[campo] = canon[campo];
  }
  return out;
}

export function resolverFiltroArchivo(args: {
  incluir_archivadas?: unknown;
  solo_archivadas?: unknown;
  archivadas?: unknown;
}): FiltroArchivo {
  const solo =
    args.solo_archivadas === true ||
    args.solo_archivadas === '1' ||
    args.solo_archivadas === 1 ||
    args.archivadas === 'solo';
  if (solo) return 'solo_archivadas';
  const incluir =
    args.incluir_archivadas === true ||
    args.incluir_archivadas === '1' ||
    args.incluir_archivadas === 1 ||
    args.archivadas === '1' ||
    args.archivadas === 1 ||
    args.archivadas === true;
  if (incluir) return 'todas';
  return 'activas';
}

/** `null` = sin filtro de estado (bandeja «todas»). */
export function estadosDeBandeja(tab: string | null | undefined): readonly string[] | null {
  switch (tab) {
    case 'enviadas':
      return ['enviada', 'convertida'];
    case 'expiradas':
      return ['expirada'];
    case 'cerradas':
      return COTIZACION_ESTADOS_CERRADAS;
    case 'todas':
      return null;
    default:
      return ['nueva', 'en_revision', 'respondida'];
  }
}

function bloqueada(fila: FilaEstadoCotizacion): PlanErr | null {
  if (fila.archived_at) {
    return fallo(
      'COTIZACION_ARCHIVADA',
      'La cotización está archivada. Desarchívala antes de cambiar el estado.',
      409
    );
  }
  if (fila.pedido_id) {
    return fallo(
      'COTIZACION_YA_CONVERTIDA',
      'La cotización ya está vinculada a un pedido. El estado no se cambia por aquí.',
      409
    );
  }
  return null;
}

/**
 * Parche de estado. No incluye `oferta_enviada_at`, token de formalización,
 * ni nada que dispare correo o WhatsApp.
 */
export function planCambioEstado(
  fila: FilaEstadoCotizacion,
  estadoNuevo: unknown,
  ctx: ContextoCambio
): PlanCotizacion {
  const motivo = exigirMotivo(ctx.motivo);
  if (!motivo.ok) return motivo;
  const bloqueo = bloqueada(fila);
  if (bloqueo) return bloqueo;
  const nuevo = normalizarEstadoCotizacion(estadoNuevo);
  if (!nuevo) {
    return fallo(
      'ESTADO_INVALIDO',
      `Estado no válido. Válidos: ${COTIZACION_ESTADOS.join(', ')}.`,
      422
    );
  }
  const anterior = String(fila.estado ?? 'nueva');
  if (anterior === nuevo) {
    return fallo('ESTADO_IGUAL', `La cotización ya está en ${nuevo}.`, 409);
  }
  const ahora = ctx.ahora ?? new Date();
  const actor = String(ctx.actor ?? '').trim() || 'desconocido';
  return {
    ok: true,
    patch: {
      estado: nuevo,
      notas_internas: nota(
        fila,
        ahora,
        `Estado: ${anterior} -> ${nuevo} | ${motivo.motivo} (${actor})`
      ),
      leida: true,
    },
    auditoria: {
      herramienta: 'cambiar_estado_cotizacion',
      antes: { estado: anterior },
      despues: { estado: nuevo },
      motivo: motivo.motivo,
    },
  };
}

/** Soft delete. No borra la fila, el PDF ni el pedido vinculado. */
export function planArchivo(fila: FilaEstadoCotizacion, ctx: ContextoCambio): PlanCotizacion {
  const motivo = exigirMotivo(ctx.motivo);
  if (!motivo.ok) return motivo;
  if (fila.archived_at) {
    return fallo('YA_ARCHIVADA', 'La cotización ya está archivada.', 409);
  }
  const ahora = ctx.ahora ?? new Date();
  const actor = String(ctx.actor ?? '').trim() || 'desconocido';
  const archivedAt = ahora.toISOString();
  const archivedBy = ctx.archivedBy ?? null;
  const estado = String(fila.estado ?? 'nueva');
  return {
    ok: true,
    patch: {
      archived_at: archivedAt,
      archived_by: archivedBy,
      archived_reason: motivo.motivo,
      notas_internas: nota(fila, ahora, `Archivada | ${motivo.motivo} (${actor})`),
      leida: true,
    },
    auditoria: {
      herramienta: 'archivar_cotizacion',
      antes: { estado, archived_at: null },
      despues: {
        estado,
        archived_at: archivedAt,
        archived_by: archivedBy,
        archived_reason: motivo.motivo,
      },
      motivo: motivo.motivo,
    },
  };
}

export function planDesarchivo(fila: FilaEstadoCotizacion, ctx: ContextoCambio): PlanCotizacion {
  const motivo = exigirMotivo(ctx.motivo);
  if (!motivo.ok) return motivo;
  if (!fila.archived_at) {
    return fallo('NO_ARCHIVADA', 'La cotización no está archivada.', 409);
  }
  const ahora = ctx.ahora ?? new Date();
  const actor = String(ctx.actor ?? '').trim() || 'desconocido';
  const estado = String(fila.estado ?? 'nueva');
  return {
    ok: true,
    patch: {
      archived_at: null,
      archived_by: null,
      archived_reason: null,
      notas_internas: nota(fila, ahora, `Desarchivada | ${motivo.motivo} (${actor})`),
      leida: true,
    },
    auditoria: {
      herramienta: 'desarchivar_cotizacion',
      antes: {
        estado,
        archived_at: fila.archived_at,
        archived_reason: fila.archived_reason ?? null,
      },
      despues: { estado, archived_at: null, archived_by: null, archived_reason: null },
      motivo: motivo.motivo,
    },
  };
}
