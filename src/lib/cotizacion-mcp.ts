/**
 * Lógica pura de las herramientas MCP de cotizaciones (`ime-comercio`):
 * buscar, obtener, actualizar. Sin acceso a BBDD, para poder probarla.
 */
import {
  calcularTotalOfertado,
  normalizarMonedaOferta,
  parseLineasOferta,
  quoteEditable,
  type CotizacionLineaOferta,
  type CotizacionOfertaRow,
} from './cotizacion-oferta.ts';
import { precioBajoPiso } from './comercio-operacion.ts';

export const COTIZACION_ESTADOS = [
  'nueva',
  'en_revision',
  'respondida',
  'enviada',
  'convertida',
  'expirada',
] as const;

const LIMITE_DEFECTO = 20;
const LIMITE_MAX = 50;
const PRECIO_MAX = 1_000_000_000_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

type Args = Record<string, unknown>;

function texto(value: unknown, max: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function fechaValida(value: unknown): string | null {
  const v = texto(value, 10);
  if (!FECHA_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

// ---------------------------------------------------------------- buscar

export interface FiltroCotizaciones {
  q: string;
  email: string;
  empresa: string;
  estados: string[];
  desde: string | null;
  hasta: string | null;
  limite: number;
}

/** Quita caracteres que rompen los filtros `or()`/`ilike` de PostgREST. */
export function limpiarTextoFiltro(value: unknown, max = 80): string {
  return texto(value, max)
    .replace(/[,()%*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarFiltroCotizaciones(
  args: Args
): { ok: true; filtro: FiltroCotizaciones } | { ok: false; error: string } {
  const estadoCrudo = limpiarTextoFiltro(args.estado, 120);
  const estados = estadoCrudo
    ? estadoCrudo
        .split(/[\s|]+/)
        .map(e => e.toLowerCase())
        .filter(Boolean)
    : [];
  const invalidos = estados.filter(e => !(COTIZACION_ESTADOS as readonly string[]).includes(e));
  if (invalidos.length > 0) {
    return {
      ok: false,
      error: `Estado no válido: ${invalidos.join(', ')}. Válidos: ${COTIZACION_ESTADOS.join(', ')}.`,
    };
  }
  let desde: string | null = null;
  let hasta: string | null = null;
  if (args.desde != null && args.desde !== '') {
    desde = fechaValida(args.desde);
    if (!desde) return { ok: false, error: 'desde debe ser una fecha YYYY-MM-DD.' };
  }
  if (args.hasta != null && args.hasta !== '') {
    hasta = fechaValida(args.hasta);
    if (!hasta) return { ok: false, error: 'hasta debe ser una fecha YYYY-MM-DD.' };
  }
  if (desde && hasta && desde > hasta) {
    return { ok: false, error: 'desde no puede ser posterior a hasta.' };
  }
  const limiteNum = Math.trunc(Number(args.limite ?? LIMITE_DEFECTO));
  const limite = Number.isFinite(limiteNum)
    ? Math.min(LIMITE_MAX, Math.max(1, limiteNum))
    : LIMITE_DEFECTO;
  return {
    ok: true,
    filtro: {
      q: limpiarTextoFiltro(args.q),
      email: limpiarTextoFiltro(args.email, 200),
      empresa: limpiarTextoFiltro(args.empresa, 200),
      estados,
      desde,
      hasta,
      limite,
    },
  };
}

export type FilaCotizacion = CotizacionOfertaRow & {
  updated_at?: string | null;
  created_at?: string | null;
  nit?: string | null;
  responsable_iva?: boolean | null;
  direccion_envio?: string | null;
  direccion_facturacion?: string | null;
  notas_internas?: string | null;
};

export interface AsesorVista {
  user_id: string | null;
  nombre: string | null;
  email: string | null;
}

function metadataDe(row: { metadata?: unknown }): Record<string, unknown> {
  return row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {};
}

function cadena(meta: Record<string, unknown>, clave: string): string | null {
  return typeof meta[clave] === 'string' ? (meta[clave] as string) : null;
}

export function resumenCotizacion(row: FilaCotizacion, asesor: AsesorVista | null) {
  const meta = metadataDe(row);
  return {
    id: row.id,
    numero: row.numero ?? cadena(meta, 'numero_presupuesto'),
    cliente: {
      nombre: row.nombre ?? null,
      empresa: row.empresa ?? null,
      email: row.email ?? null,
    },
    total: Number(
      row.precio_total_ofertado ?? calcularTotalOfertado(parseLineasOferta(row.productos))
    ),
    moneda: normalizarMonedaOferta(row.moneda),
    estado: row.estado ?? 'nueva',
    validez_hasta: row.validez_hasta ?? null,
    owner: asesor,
    updated_at: row.updated_at ?? row.created_at ?? null,
  };
}

/** Detalle completo. Nunca incluye el hash del token de formalización. */
export function detalleCotizacion(
  row: FilaCotizacion,
  asesor: AsesorVista | null,
  extra: { pdf_url?: string | null } = {}
) {
  const meta = metadataDe(row);
  const lineas = parseLineasOferta(row.productos);
  return {
    ...resumenCotizacion(row, asesor),
    cliente: {
      nombre: row.nombre ?? null,
      empresa: row.empresa ?? null,
      nit: row.nit ?? null,
      email: row.email ?? null,
      telefono: row.telefono ?? null,
      direccion_envio: row.direccion_envio ?? null,
      direccion_facturacion: row.direccion_facturacion ?? null,
      responsable_iva: row.responsable_iva ?? null,
    },
    lineas: lineas.map(l => ({
      slug: l.slug,
      nombre: l.nombre,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      subtotal: l.subtotal,
      moneda: l.moneda,
      precio_pendiente_validar: Boolean(l.precio_pendiente_validar),
      descripcion: l.notas ?? null,
    })),
    condiciones: row.condiciones ?? '',
    impuestos_incluidos: row.impuestos_incluidos ?? null,
    editable: !row.pedido_id && quoteEditable(row.estado),
    pedido_id: row.pedido_id ?? null,
    enlaces: {
      formalizar_url: cadena(meta, 'formalizacion_url'),
      pdf_url: extra.pdf_url ?? null,
    },
    ultimo_error_envio: row.send_error ?? cadena(meta, 'quote_send_error'),
    envio: {
      canal: cadena(meta, 'quote_send_channel'),
      message_id: cadena(meta, 'quote_send_message_id'),
      reply_to: cadena(meta, 'quote_send_reply_to'),
      oferta_enviada_at: (row as { oferta_enviada_at?: string | null }).oferta_enviada_at ?? null,
    },
    notas_internas: row.notas_internas ?? null,
    created_at: row.created_at ?? null,
  };
}

// ------------------------------------------------------------ actualizar

export interface ProductoCatalogo {
  id: string;
  slug: string;
  nombre_es: string;
}

/**
 * Construye las líneas de la oferta desde `lineas` del MCP.
 * Cada línea: producto_id (catálogo) o línea libre (nombre), cantidad ≥ 1,
 * precio_unitario > 0 (obligatorio: el MCP no deja líneas "pendiente de validar"),
 * descripcion opcional. `piso` opcional: un precio por debajo exige el flujo de aprobación.
 */
export function construirLineasCotizacion(
  items: unknown,
  catalogo: Map<string, ProductoCatalogo>,
  moneda: 'COP' | 'USD'
): { ok: true; lineas: CotizacionLineaOferta[] } | { ok: false; error: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'lineas debe ser una lista con al menos una línea.' };
  }
  if (items.length > 100) return { ok: false, error: 'Máximo 100 líneas por cotización.' };
  const lineas: CotizacionLineaOferta[] = [];
  for (const [i, crudo] of items.entries()) {
    const n = i + 1;
    const item = (crudo && typeof crudo === 'object' ? crudo : {}) as Args;
    const productoId = texto(item.producto_id, 64);
    const producto = productoId ? catalogo.get(productoId) : undefined;
    if (productoId && !producto) {
      return { ok: false, error: `Línea ${n}: producto_id ${productoId} no existe.` };
    }
    const nombre = texto(item.nombre, 300) || producto?.nombre_es || '';
    if (!nombre) {
      return { ok: false, error: `Línea ${n}: hace falta producto_id o nombre (línea libre).` };
    }
    const cantidad = Number(item.cantidad);
    if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 100000) {
      return { ok: false, error: `Línea ${n}: cantidad debe estar entre 1 y 100000.` };
    }
    const precio = Number(item.precio_unitario);
    if (!Number.isFinite(precio) || precio <= 0 || precio > PRECIO_MAX) {
      return { ok: false, error: `Línea ${n}: precio_unitario debe ser un número mayor que 0.` };
    }
    const piso = item.piso == null || item.piso === '' ? null : Number(item.piso);
    if (precioBajoPiso(precio, piso)) {
      return {
        ok: false,
        error: `Línea ${n}: precio ${precio} por debajo del piso ${piso}; usa preparar_precio_bajo_piso.`,
      };
    }
    const cant = Math.floor(cantidad);
    const linea: CotizacionLineaOferta = {
      slug: producto?.slug ?? texto(item.slug, 200),
      nombre,
      cantidad: cant,
      precio_unitario: precio,
      subtotal: Math.round(precio * cant * 100) / 100,
      moneda,
    };
    const descripcion = texto(item.descripcion, 2000);
    if (descripcion) linea.notas = descripcion;
    lineas.push(linea);
  }
  return { ok: true, lineas };
}

export interface CambiosCotizacion {
  patch: Record<string, unknown>;
  /** Campos modificados, para auditoría. */
  campos: string[];
}

/**
 * Construye el parche de `solicitudes_cotizacion` para `actualizar_cotizacion`.
 * `lineasNuevas` (ya validadas) reemplaza todas las líneas. Solo cotizaciones no
 * convertidas y en estado editable.
 */
export function construirCambiosCotizacion(
  args: Args,
  actual: FilaCotizacion,
  lineasNuevas: CotizacionLineaOferta[] | null,
  ahora = new Date()
): { ok: true; cambios: CambiosCotizacion } | { ok: false; error: string; code?: string } {
  if (actual.pedido_id || actual.estado === 'convertida') {
    return {
      ok: false,
      code: 'COTIZACION_YA_CONVERTIDA',
      error: 'La cotización ya fue convertida en pedido y no se puede modificar.',
    };
  }
  if (!quoteEditable(actual.estado)) {
    return {
      ok: false,
      code: 'COTIZACION_INMUTABLE',
      error: `La cotización está ${actual.estado}: su oferta ya salió al cliente. Crea una revisión desde /comercial.`,
    };
  }
  const patch: Record<string, unknown> = {};
  const campos: string[] = [];
  const set = (campo: string, valor: unknown) => {
    patch[campo] = valor;
    campos.push(campo);
  };

  const cliente = (args.cliente && typeof args.cliente === 'object' ? args.cliente : {}) as Args;
  if (cliente.nombre !== undefined) {
    const v = texto(cliente.nombre, 160);
    if (!v) return { ok: false, error: 'cliente.nombre no puede quedar vacío.' };
    set('nombre', v);
  }
  if (cliente.empresa !== undefined) set('empresa', texto(cliente.empresa, 200) || null);
  if (cliente.nit !== undefined) set('nit', texto(cliente.nit, 40) || null);
  if (cliente.email !== undefined) {
    const v = texto(cliente.email, 200).toLowerCase();
    if (!EMAIL_RE.test(v)) return { ok: false, error: 'cliente.email no es un email válido.' };
    set('email', v);
  }
  if (cliente.telefono !== undefined) {
    const v = texto(cliente.telefono, 40);
    if (!v) return { ok: false, error: 'cliente.telefono no puede quedar vacío.' };
    set('telefono', v);
  }
  if (cliente.direccion_facturacion !== undefined) {
    set('direccion_facturacion', texto(cliente.direccion_facturacion, 400) || null);
  }
  if (cliente.direccion_envio !== undefined || cliente.ciudad !== undefined) {
    const base =
      cliente.direccion_envio !== undefined
        ? texto(cliente.direccion_envio, 400)
        : texto(actual.direccion_envio, 400);
    const ciudad = texto(cliente.ciudad, 120);
    const completa =
      ciudad && !base.toLowerCase().includes(ciudad.toLowerCase())
        ? [base, ciudad].filter(Boolean).join(', ')
        : base;
    set('direccion_envio', completa || null);
  }

  if (args.condiciones !== undefined) {
    set('condiciones', texto(args.condiciones, 8000) || null);
  }
  if (args.validez_hasta !== undefined) {
    if (args.validez_hasta === null || args.validez_hasta === '') {
      set('validez_hasta', null);
    } else {
      const f = fechaValida(args.validez_hasta);
      if (!f) return { ok: false, error: 'validez_hasta debe ser YYYY-MM-DD.' };
      if (f < ahora.toISOString().slice(0, 10)) {
        return { ok: false, error: 'validez_hasta no puede estar en el pasado.' };
      }
      set('validez_hasta', f);
    }
  }
  if (args.impuestos_incluidos !== undefined) {
    if (typeof args.impuestos_incluidos !== 'boolean') {
      return { ok: false, error: 'impuestos_incluidos debe ser true o false.' };
    }
    set('impuestos_incluidos', args.impuestos_incluidos);
  }

  let moneda = normalizarMonedaOferta(actual.moneda);
  if (args.moneda !== undefined) {
    const m = texto(args.moneda, 3).toUpperCase();
    if (m !== 'COP' && m !== 'USD') return { ok: false, error: 'moneda debe ser COP o USD.' };
    moneda = m;
    set('moneda', moneda);
    set('mercado', moneda === 'USD' ? 'INTL' : 'CO');
  }

  let lineasFinales: CotizacionLineaOferta[] | null = lineasNuevas;
  if (!lineasFinales && args.moneda !== undefined) {
    // Cambio de moneda sin reemplazar líneas: se reetiquetan para no dejar moneda mixta.
    lineasFinales = parseLineasOferta(actual.productos).map(l => ({ ...l, moneda }));
  }
  if (lineasFinales) {
    set('productos', lineasFinales);
    set('precio_total_ofertado', calcularTotalOfertado(lineasFinales));
  }

  if (args.notas !== undefined) {
    const nota = texto(args.notas, 2000);
    if (nota) {
      const sello = ahora.toISOString().replace('T', ' ').slice(0, 16);
      const previas = String(actual.notas_internas ?? '').trim();
      const linea = `[${sello}] ${nota}`;
      set('notas_internas', previas ? `${previas}\n${linea}` : linea);
    }
  }

  if (campos.length === 0) {
    return { ok: false, error: 'No hay ningún campo que actualizar.' };
  }
  patch.leida = true;
  return { ok: true, cambios: { patch, campos } };
}
