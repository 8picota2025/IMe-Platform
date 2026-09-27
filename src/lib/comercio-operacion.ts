/**
 * Operación compartida del admin y del MCP ime-comercio.
 * La decisión de compra sigue a isPurchasable; el tipo (carrito, consultar,
 * cotización) es el mismo que getAccionComercial.
 */
import { isPurchasable, type CommerceProductSignals } from './commerce-policy.ts';

export type DecisionCompra = 'carrito' | 'consultar' | 'cotizacion';

export interface DecisionCompraResultado {
  tipo: DecisionCompra;
  tienePrecio: boolean;
  comprable: boolean;
  motivo: string;
}

export interface SiguientePasoPedido {
  accion: string;
  detalle: string;
  cerrado: boolean;
}

const CERRADOS = new Set(['cancelado', 'reembolsado', 'rechazado', 'expirado']);

function tienePrecioPublico(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

/** Misma rama que getAccionComercial, sin depender de los JSON de i18n. */
export function decidirCompra(product: CommerceProductSignals): DecisionCompraResultado {
  const purchase = isPurchasable(product, { quantity: 1 });
  const tienePrecio = tienePrecioPublico(product.precio);
  let tipo: DecisionCompra = 'cotizacion';
  if (purchase.ok) tipo = 'carrito';
  else if (tienePrecio) tipo = 'consultar';
  return {
    tipo,
    tienePrecio,
    comprable: purchase.ok,
    motivo: purchase.reason,
  };
}

export function siguientePasoPedido(input: {
  estado: string;
  proveedorPago?: string | null;
  tieneGuia?: boolean;
  facturaEstado?: string | null;
}): SiguientePasoPedido {
  const estado = input.estado.trim().toLowerCase();
  const pago = (input.proveedorPago ?? '').trim().toLowerCase();
  const factura = (input.facturaEstado ?? '').trim().toLowerCase();
  if (CERRADOS.has(estado)) {
    return {
      accion: 'Cerrado',
      detalle: 'Este pedido no tiene una acción pendiente.',
      cerrado: true,
    };
  }
  if (estado === 'pendiente_validacion' || (estado === 'pendiente' && pago === 'transferencia')) {
    return {
      accion: 'Validar transferencia',
      detalle: 'Revisa el comprobante antes de preparar el equipo.',
      cerrado: false,
    };
  }
  if (estado === 'pendiente' || estado === 'error_verificacion') {
    return {
      accion: 'Cobrar',
      detalle: 'El checkout sigue abierto o el pago no se confirmó.',
      cerrado: false,
    };
  }
  if (estado === 'pagado' || estado === 'procesando') {
    return {
      accion: 'Preparar',
      detalle: 'El pago está confirmado. Pasa el pedido a preparación.',
      cerrado: false,
    };
  }
  if (estado === 'preparando') {
    return input.tieneGuia
      ? {
          accion: 'Marcar enviado',
          detalle: 'Ya hay guía. Avisa el envío al cliente.',
          cerrado: false,
        }
      : {
          accion: 'Cargar la guía',
          detalle: 'No marques enviado sin número o URL de tracking.',
          cerrado: false,
        };
  }
  if (estado === 'enviado') {
    return {
      accion: 'Marcar entregado',
      detalle: 'Confirma la entrega cuando el cliente reciba el equipo.',
      cerrado: false,
    };
  }
  if (estado === 'retrasado') {
    return {
      accion: 'Avisar la rotura',
      detalle: 'El cliente ya pagó y el stock falló. Escribe y reponen o reembolsa.',
      cerrado: false,
    };
  }
  if (estado === 'entregado') {
    if (factura === 'emitida' || factura === 'aceptada') {
      return { accion: 'Cerrado', detalle: 'Entregado y con factura.', cerrado: true };
    }
    return {
      accion: 'Emitir factura',
      detalle: 'La factura electrónica espera confirmación de una persona.',
      cerrado: false,
    };
  }
  return {
    accion: 'Revisar estado',
    detalle: `Estado «${estado || 'vacío'}» sin una acción automática.`,
    cerrado: false,
  };
}

/** True cuando el precio propuesto queda por debajo del piso comercial. */
export function precioBajoPiso(precio: number, piso: number | null | undefined): boolean {
  if (piso == null || !Number.isFinite(piso)) return false;
  return Number.isFinite(precio) && precio < piso;
}

/** Etapas que admite el CHECK de crm_opportunities.etapa (migración 20260809090000). */
export const CRM_ETAPAS_DB = [
  'nuevo',
  'contactado',
  'calificacion',
  'reunion',
  'demo',
  'cotizando',
  'negociacion',
  'checkout_pendiente',
  'ganado',
  'perdido',
  'nutrir',
  'posventa',
] as const;

export function cambioEtapaCrm(
  etapa: string,
  motivo: string
): { ok: true; cierra: boolean } | { ok: false; error: string } {
  if (!(CRM_ETAPAS_DB as readonly string[]).includes(etapa)) {
    return { ok: false, error: `Etapa no admitida: ${etapa || 'vacía'}.` };
  }
  const cierra = etapa === 'ganado' || etapa === 'perdido';
  if (cierra && !motivo.trim()) {
    return { ok: false, error: 'Ganar o perder una oportunidad exige un motivo.' };
  }
  return { ok: true, cierra };
}

/** Unidades que se pueden reservar. null = sin límite (no gestiona stock). */
export function unidadesReservables(
  stock: number | null,
  gestionarStock: boolean,
  reservadas: number
): number | null {
  if (!gestionarStock || stock == null || !Number.isFinite(stock)) return null;
  return Math.max(0, stock - Math.max(0, reservadas));
}

/** Campos que una propuesta de ficha puede tocar. Nunca activo, precio ni dropship. */
export const CAMPOS_FICHA_PROPUESTA = [
  'descripcion_corta_es',
  'descripcion_corta_en',
  'descripcion_larga_es',
  'descripcion_larga_en',
  'especificaciones',
  'aplicaciones_es',
  'aplicaciones_en',
  'imagen_principal',
  'ficha_pdf',
  'dian_codigo',
  'peso_kg',
] as const;

export function camposFichaPermitidos(payload: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {};
  for (const key of CAMPOS_FICHA_PROPUESTA) {
    if (payload[key] !== undefined) limpio[key] = payload[key];
  }
  return limpio;
}

export const MCP_TOOLS = [
  'bandeja_trabajo',
  'decidir_compra',
  'buscar_productos',
  'fichas_incompletas',
  'buscar_clientes',
  'ficha_cliente',
  'buscar_pedidos',
  'ficha_pedido',
  'buscar_proveedores',
  'tarifas_envio',
  'crear_borrador_cotizacion',
  'proponer_stock',
  'proponer_precio',
  'proponer_ficha',
  'reservar_stock',
  'registrar_handoff',
  'actualizar_etapa_crm',
  'redactar_recordatorio_carrito',
  'proponer_fulfillment',
  'preparar_factura',
  'confirmar_factura',
  'preparar_anulacion_factura',
  'confirmar_anulacion_factura',
  'preparar_reembolso',
  'confirmar_reembolso',
  'preparar_precio_bajo_piso',
  'confirmar_precio_bajo_piso',
  'preparar_afirmacion_invima',
  'confirmar_afirmacion_invima',
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number];

const SECRETOS = ['webhook_url', 'api_config', 'api_token', 'precio_costo'];

export function filaSinSecretos<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const key of SECRETOS) delete copy[key];
  return copy;
}
