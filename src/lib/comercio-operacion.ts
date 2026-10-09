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
  'nombre_en',
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

/**
 * Claves de `productos.atributos` que una propuesta puede tocar (contenido de
 * la landing en ES/EN). Se mezclan con lo existente al aplicar; nunca se
 * reemplaza el objeto completo.
 */
export const ATRIBUTOS_FICHA_PROPUESTA = [
  'beneficios_es',
  'beneficios_en',
  'valor_es',
  'valor_en',
  'preguntas_frecuentes_es',
  'preguntas_frecuentes_en',
  'seo_keywords_es',
  'seo_keywords_en',
] as const;

function esObjetoPlano(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function camposFichaPermitidos(payload: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = {};
  for (const key of CAMPOS_FICHA_PROPUESTA) {
    if (payload[key] !== undefined) limpio[key] = payload[key];
  }
  if (esObjetoPlano(payload['atributos'])) {
    const atributos: Record<string, unknown> = {};
    for (const key of ATRIBUTOS_FICHA_PROPUESTA) {
      const value = payload['atributos'][key];
      if (value !== undefined) atributos[key] = value;
    }
    if (Object.keys(atributos).length > 0) limpio['atributos'] = atributos;
  }
  return limpio;
}

/**
 * Cambios listos para `productos.update`: los atributos propuestos se mezclan
 * con los actuales para no borrar claves que la propuesta no trae.
 */
export function cambiosFichaAplicables(
  campos: Record<string, unknown>,
  atributosActuales: unknown
): Record<string, unknown> {
  if (!esObjetoPlano(campos['atributos'])) return campos;
  const base = esObjetoPlano(atributosActuales) ? atributosActuales : {};
  return { ...campos, atributos: { ...base, ...campos['atributos'] } };
}

const SLUG_PRODUCTO_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugProductoValido(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    slug.length >= 3 &&
    slug.length <= 120 &&
    SLUG_PRODUCTO_RE.test(slug)
  );
}

/**
 * Producto nuevo propuesto por un agente (p. ej. desde una ficha PDF). Solo
 * contenido: se crea siempre inactivo y sin precio; una persona lo revisa,
 * completa los datos comerciales y lo activa en el admin.
 */
export function productoNuevoPermitido(
  payload: Record<string, unknown>
): { ok: true; campos: Record<string, unknown> } | { ok: false; error: string } {
  const slug = typeof payload['slug'] === 'string' ? payload['slug'].trim() : '';
  const nombreEs = typeof payload['nombre_es'] === 'string' ? payload['nombre_es'].trim() : '';
  if (!slugProductoValido(slug)) {
    return { ok: false, error: 'slug inválido: minúsculas, números y guiones (3-120).' };
  }
  if (!nombreEs) return { ok: false, error: 'Falta nombre_es.' };
  const campos: Record<string, unknown> = {
    ...camposFichaPermitidos(payload),
    slug,
    nombre_es: nombreEs,
  };
  for (const key of ['sku', 'familia_slug', 'tipo_slug', 'marca'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) campos[key] = value.trim();
  }
  return { ok: true, campos };
}

/**
 * Fila para `productos.insert` a partir de una propuesta de producto nuevo.
 * Siempre inactiva y sin precio: familia/tipo se resuelven fuera (slug → id).
 */
export function filaProductoDesdePropuesta(
  campos: Record<string, unknown>,
  ids: { familiaId?: string | null; tipoId?: string | null } = {}
): Record<string, unknown> {
  const fila: Record<string, unknown> = { ...camposFichaPermitidos(campos) };
  fila['slug'] = campos['slug'];
  fila['nombre_es'] = campos['nombre_es'];
  if (typeof campos['sku'] === 'string' && campos['sku']) fila['sku'] = campos['sku'];
  const atributos: Record<string, unknown> = esObjetoPlano(fila['atributos'])
    ? { ...fila['atributos'] }
    : {};
  if (typeof campos['marca'] === 'string' && campos['marca']) atributos['marca'] = campos['marca'];
  atributos['origen'] = 'propuesta_agente_ficha_pdf';
  fila['atributos'] = atributos;
  fila['familia_id'] = ids.familiaId ?? null;
  fila['tipo_id'] = ids.tipoId ?? null;
  fila['activo'] = false;
  return fila;
}

/** Ruta en el bucket `fichas` donde un agente deja un PDF pendiente de revisión. */
export function rutaFichaPropuesta(slug: string, huella: string): string {
  const limpia = huella
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '')
    .slice(0, 16);
  return `propuestas/${slug}/${limpia || 'sin-huella'}.pdf`;
}

/** Objetos de Twenty que el agente puede borrar, siempre tras confirmación humana. */
export const OBJETOS_TWENTY_BORRABLES = ['opportunities', 'people', 'companies'] as const;
export type ObjetoTwentyBorrable = (typeof OBJETOS_TWENTY_BORRABLES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida el objetivo de un borrado en Twenty antes de crear la confirmación. */
export function objetivoBorradoCrm(
  objeto: unknown,
  id: unknown
): { ok: true; objeto: ObjetoTwentyBorrable; id: string } | { ok: false; error: string } {
  if (!OBJETOS_TWENTY_BORRABLES.includes(objeto as ObjetoTwentyBorrable)) {
    return { ok: false, error: `objeto debe ser uno de: ${OBJETOS_TWENTY_BORRABLES.join(', ')}.` };
  }
  const limpio = String(id ?? '').trim();
  if (!UUID_RE.test(limpio)) return { ok: false, error: 'entidad_id debe ser el UUID de Twenty.' };
  return { ok: true, objeto: objeto as ObjetoTwentyBorrable, id: limpio.toLowerCase() };
}

/** Una aprobación del CMS caduca si el agente no la ejecuta a tiempo. */
export const APROBACION_VIGENTE_MS = 24 * 60 * 60 * 1000;

/**
 * El MCP solo ejecuta una confirmación que un owner/admin activo aprobó en el
 * CMS (estado `aprobada`, fijado por trigger con auth.uid()). El `rol` que
 * declare quien llama a la herramienta no cuenta.
 */
export function confirmacionEjecutable(
  fila: {
    estado: string;
    herramienta: string;
    aprobada_por: string | null;
    aprobada_en: string | null;
  },
  herramienta: string,
  aprobador: { rol: string; activo: boolean } | null,
  ahora = Date.now()
): { ok: true } | { ok: false; error: string } {
  if (fila.herramienta !== herramienta) {
    return { ok: false, error: 'La confirmación no corresponde a esta herramienta.' };
  }
  if (fila.estado === 'pendiente') {
    return {
      ok: false,
      error: 'Pendiente de aprobación: un owner o admin debe aprobarla en el CMS (Dashboard).',
    };
  }
  if (fila.estado !== 'aprobada') return { ok: false, error: `Estado ${fila.estado}.` };
  if (!fila.aprobada_por || !fila.aprobada_en) {
    return { ok: false, error: 'La aprobación no tiene responsable.' };
  }
  if (!aprobador?.activo || !['owner', 'admin'].includes(aprobador.rol)) {
    return { ok: false, error: 'Quien aprobó ya no es owner/admin activo.' };
  }
  if (ahora - new Date(fila.aprobada_en).getTime() > APROBACION_VIGENTE_MS) {
    return { ok: false, error: 'La aprobación caducó (más de 24 h). Pide una nueva.' };
  }
  return { ok: true };
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
  'buscar_cotizaciones',
  'obtener_cotizacion',
  'actualizar_cotizacion',
  'preparar_envio_cotizacion',
  'confirmar_envio_cotizacion',
  'proponer_stock',
  'proponer_precio',
  'proponer_ficha',
  'proponer_producto',
  'subir_ficha_pdf',
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
  'preparar_borrado_crm',
  'confirmar_borrado_crm',
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number];

const SECRETOS = ['webhook_url', 'api_config', 'api_token', 'precio_costo'];

export function filaSinSecretos<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row };
  for (const key of SECRETOS) delete copy[key];
  return copy;
}
