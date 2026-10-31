/** Reglas puras del panel vivo. No envían nada y no conocen secretos. */

export const COLUMNAS = [
  { id: 'por_aprobar', titulo: 'Por aprobar' },
  { id: 'aprobado_en_cola', titulo: 'Aprobado/en cola' },
  { id: 'en_ejecucion', titulo: 'En ejecución' },
  { id: 'hecho', titulo: 'Hecho' },
  { id: 'bloqueado', titulo: 'Bloqueado' },
] as const;

export type ColumnaId = (typeof COLUMNAS)[number]['id'];
export type OrigenAccion = 'cotizacion' | 'tarea';
export type TipoAprobacion = 'ok_shoky' | 'validacion_costeo_margen';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_ENVIAR_RE = /\bNO[\s._:-]*ENVIA/;

export class PanelAccionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'PanelAccionError';
  }
}

export interface TarjetaPanel {
  id: string;
  origen: string;
  tipo: string;
  titulo: string;
  ref: string | null;
  columna: string;
  estado: string | null;
  total: number | null;
  moneda: string | null;
  aprobado_por: string | null;
  aprobado_at: string | null;
  aprobacion_tipo: string | null;
  validez_hasta: string | null;
  send_error: string | null;
  notas_internas: string | null;
  empresa: string | null;
  bot_dueno: string | null;
  updated_at: string | null;
}

export interface CuerpoAprobacion {
  accion: 'aprobar';
  origen: OrigenAccion;
  id: string;
  aprobacion_tipo: TipoAprobacion | null;
  ref: string;
  margen: number | null;
  confirmado: true;
}

export interface MarcaCotizacion {
  aprobado_por?: string | null;
  aprobado_at?: string | null;
  aprobacion_tipo?: string | null;
  aprobacion_hash?: string | null;
}

export function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function marcaNoEnviar(valor: unknown): boolean {
  return NO_ENVIAR_RE.test(normalizarTexto(valor));
}

export function alertasDeTarjeta(
  fila: Pick<TarjetaPanel, 'notas_internas' | 'send_error'>
): string[] {
  const alertas: string[] = [];
  if (marcaNoEnviar(fila.notas_internas)) alertas.push('NO ENVIAR');
  if (String(fila.send_error ?? '').trim()) alertas.push('send_error');
  return alertas;
}

export function agruparTarjetas(tarjetas: TarjetaPanel[]): Record<ColumnaId, TarjetaPanel[]> {
  const grupos: Record<ColumnaId, TarjetaPanel[]> = {
    por_aprobar: [],
    aprobado_en_cola: [],
    en_ejecucion: [],
    hecho: [],
    bloqueado: [],
  };
  for (const tarjeta of tarjetas) {
    const conocida = COLUMNAS.find(columna => columna.id === tarjeta.columna);
    grupos[conocida?.id ?? 'por_aprobar'].push(tarjeta);
  }
  return grupos;
}

export function puedeAprobar(tarjeta: TarjetaPanel): boolean {
  if (tarjeta.origen === 'twenty') return false;
  if (tarjeta.origen !== 'cotizacion' && tarjeta.origen !== 'tarea') return false;
  return tarjeta.columna !== 'hecho';
}

export function accesoPanel(auth: {
  ok: boolean;
  userId?: string | null;
  role?: string | null;
}): 'ok' | 'forbidden' {
  if (!auth.ok || !auth.userId) return 'forbidden';
  if (auth.role !== 'admin' && auth.role !== 'owner') return 'forbidden';
  return 'ok';
}

export function esIdempotenteCotizacion(fila: MarcaCotizacion, tipo: TipoAprobacion): boolean {
  return Boolean(
    String(fila.aprobado_por ?? '').trim() &&
    String(fila.aprobado_at ?? '').trim() &&
    fila.aprobacion_tipo === tipo &&
    String(fila.aprobacion_hash ?? '').trim()
  );
}

export function esIdempotenteTarea(fila: {
  columna?: string | null;
  estado?: string | null;
}): boolean {
  const columna = fila.columna ?? '';
  const estado = fila.estado ?? '';
  return (
    estado === 'en_cola' ||
    columna === 'aprobado_en_cola' ||
    columna === 'en_ejecucion' ||
    columna === 'hecho'
  );
}

export function validarCuerpo(input: unknown): CuerpoAprobacion {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PanelAccionError(400, 'BAD_REQUEST', 'Cuerpo invalido');
  }
  const body = input as Record<string, unknown>;
  if (body.origen === 'twenty') {
    throw new PanelAccionError(
      400,
      'SOLO_LECTURA',
      'Twenty es solo lectura. Lo escribe el bot CRM.'
    );
  }
  if (body.accion !== 'aprobar') {
    throw new PanelAccionError(400, 'BAD_REQUEST', 'Accion no soportada');
  }
  if (body.origen !== 'cotizacion' && body.origen !== 'tarea') {
    throw new PanelAccionError(400, 'BAD_REQUEST', 'Origen no soportado');
  }
  if (body.confirmado !== true) {
    throw new PanelAccionError(400, 'CONFIRMACION', 'Falta la confirmacion del modal');
  }
  const id = String(body.id ?? '').trim();
  if (!UUID_RE.test(id)) throw new PanelAccionError(400, 'BAD_REQUEST', 'Id invalido');

  if (body.origen === 'tarea') {
    return {
      accion: 'aprobar',
      origen: 'tarea',
      id,
      aprobacion_tipo: null,
      ref: String(body.ref ?? '').trim(),
      margen: null,
      confirmado: true,
    };
  }

  const tipo = body.aprobacion_tipo;
  if (tipo !== 'ok_shoky' && tipo !== 'validacion_costeo_margen') {
    throw new PanelAccionError(400, 'BAD_REQUEST', 'Tipo de aprobacion invalido');
  }
  const ref = String(body.ref ?? '').trim();
  if (!ref) throw new PanelAccionError(400, 'BAD_REQUEST', 'aprobacion_ref requerido');
  let margen: number | null = null;
  if (tipo === 'validacion_costeo_margen') {
    const valor = typeof body.margen === 'number' ? body.margen : Number(body.margen);
    if (!Number.isFinite(valor)) {
      throw new PanelAccionError(400, 'BAD_REQUEST', 'Margen requerido');
    }
    margen = valor;
  }
  return {
    accion: 'aprobar',
    origen: 'cotizacion',
    id,
    aprobacion_tipo: tipo,
    ref,
    margen,
    confirmado: true,
  };
}

export async function hashAccion(partes: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(partes.join('|'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
