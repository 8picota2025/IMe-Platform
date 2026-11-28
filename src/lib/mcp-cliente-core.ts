/**
 * Superficie MCP pública con rol `client` (v1). Server only.
 *
 * Aislamiento: este módulo NO importa el núcleo de operación (mcp-comercio-core):
 * las herramientas de administración no existen en el bundle de `mcp-cliente`,
 * así que no pueden listarse ni invocarse aunque un agente conozca su nombre.
 *
 * Toda E/S pasa por `ClienteDeps` (inyectado), para probar la lógica de
 * seguridad sin red ni base de datos.
 */
import type { McpArgs, McpToolDefinition, McpToolRegistry } from './mcp-comercio-rpc.ts';

export const CLIENT_TOOLS = [
  'v1_client_list_catalog',
  'v1_client_search_catalog',
  'v1_client_get_product_sheet',
  'v1_client_register_client',
  'v1_client_request_quote',
  'v1_client_request_contact',
] as const;
export type ClientToolName = (typeof CLIENT_TOOLS)[number];

/** Herramientas con efectos o datos restringidos: exigen client_token válido. */
export const CLIENT_TOOLS_AUTH: ReadonlySet<ClientToolName> = new Set([
  'v1_client_get_product_sheet',
  'v1_client_request_quote',
  'v1_client_request_contact',
]);

export const CLIENT_SERVER_VERSION = '1.0.0';
export const SITIO = 'https://i-me.com.co';
const TOKEN_PREFIX = 'imec_';
export const CLIENT_TOKEN_RE = /^imec_[A-Za-z0-9_-]{43}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE =
  /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PHONE_RE = /^\+?[0-9][0-9 ().-]{5,24}[0-9]$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,128}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
export const RUTA_FICHA_RE =
  /^\/assets\/productos\/fichas\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.pdf$/;
const CLIENT_SESSION_DAYS = 30;

// ── Tipos de E/S ────────────────────────────────────────────────────────────
export interface ProductoPublicoRow {
  id: string;
  slug: string;
  sku: string | null;
  nombre_es: string;
  nombre_en: string | null;
  descripcion_corta_es: string | null;
  descripcion_corta_en: string | null;
  imagen_principal: string | null;
  ficha_pdf: string | null;
  fulfillment_mode: string;
  stock_estado: string;
  disponible: boolean;
  precio_publico: number | null;
  familia_slug: string | null;
}
export interface ClienteRow {
  id: string;
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
  pais: string | null;
  expira_en: string;
  revocado_at: string | null;
}
export interface NuevoCliente {
  token_hash: string;
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
  pais: string | null;
  agente: string | null;
  consentimiento_datos: true;
  ip_hash: string | null;
  expira_en: string;
}
export interface NuevaSolicitud {
  tipo_solicitud: 'cotizacion' | 'contacto';
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
  mensaje: string;
  productos: Array<{ slug: string; nombre: string; cantidad: number; url: string }>;
  locale: 'es' | 'en';
  pais: string | null;
  ciudad: string | null;
  mcp_cliente_id: string;
}
export type ReservaIdempotencia =
  | { estado: 'nueva' }
  | { estado: 'en_curso' }
  | { estado: 'conflicto' }
  | { estado: 'completada'; respuesta: McpArgs };

export interface ClienteDeps {
  listarProductos(filtro: {
    familia: string | null;
    limite: number;
    desplazamiento: number;
  }): Promise<{ filas: ProductoPublicoRow[]; total: number | null }>;
  buscarProductos(texto: string, limite: number): Promise<ProductoPublicoRow[]>;
  productoPorSlug(slug: string): Promise<ProductoPublicoRow | null>;
  productosPorSlugs(slugs: string[]): Promise<ProductoPublicoRow[]>;
  crearCliente(fila: NuevoCliente): Promise<{ id: string }>;
  clientePorTokenHash(hash: string): Promise<ClienteRow | null>;
  tocarCliente(id: string): Promise<void>;
  registrarDescarga(clienteId: string, producto: ProductoPublicoRow): Promise<void>;
  /** Copia (si falta) la ficha pública al bucket privado y devuelve URL firmada. */
  firmarFicha(rutaPublica: string): Promise<{ url: string; expira_en: string } | null>;
  reservarIdempotencia(
    clienteId: string,
    herramienta: ClientToolName,
    clave: string,
    huella: string
  ): Promise<ReservaIdempotencia>;
  completarIdempotencia(
    clienteId: string,
    herramienta: ClientToolName,
    clave: string,
    respuesta: McpArgs
  ): Promise<void>;
  liberarIdempotencia(clienteId: string, herramienta: ClientToolName, clave: string): Promise<void>;
  crearSolicitud(fila: NuevaSolicitud): Promise<{ id: string }>;
  /** Solo avisos internos a ventas; nunca correo al cliente (decisión de producto). */
  notificarVentas(solicitudId: string, fila: NuevaSolicitud): Promise<boolean>;
  sha256(value: string): Promise<string>;
  randomToken(): string;
  now(): Date;
}

export interface ClienteContexto {
  ipHash: string | null;
  /** Token recibido por cabecera Authorization (alternativa a client_token). */
  bearer: string | null;
}

// ── Errores estructurados ───────────────────────────────────────────────────
export type CodigoError =
  | 'UNAUTHORIZED'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'SHEET_UNAVAILABLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS';

const STATUS: Record<CodigoError, number> = {
  UNAUTHORIZED: 401,
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  SHEET_UNAVAILABLE: 404,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
};

export function errorCliente(code: CodigoError, message: string, extra: McpArgs = {}): McpArgs {
  return { ok: false, status: STATUS[code], code, error: message, ...extra };
}

const noAutorizado = () =>
  errorCliente(
    'UNAUTHORIZED',
    'Client identification required. Call v1_client_register_client first and pass the returned client_token.',
    { next_step: 'v1_client_register_client' }
  );

// ── Sanitización ────────────────────────────────────────────────────────────
// Controles C0/C1 (salvo \n y \t), anuladores de dirección bidi y caracteres
// de ancho cero: evitan inyección en correos, CRM y paneles del CMS.
const CONTROL_RE =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

export function limpiarTexto(
  value: unknown,
  { max, min = 0, multilinea = false }: { max: number; min?: number; multilinea?: boolean }
): string | null {
  if (typeof value !== 'string') return null;
  let clean = value.normalize('NFC').replace(CONTROL_RE, '');
  clean = multilinea
    ? clean
        .replace(/\r\n?/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
    : clean.replace(/\s+/g, ' ');
  clean = clean.trim();
  if (clean.length < min || clean.length > max) return null;
  return clean;
}

type Validacion<T> = { ok: true; valor: T } | { ok: false; error: McpArgs };

function invalido(campo: string, detalle: string): { ok: false; error: McpArgs } {
  return {
    ok: false,
    error: errorCliente('INVALID_ARGUMENT', `${campo}: ${detalle}`, { field: campo }),
  };
}

/** Rechaza campos desconocidos: un agente no puede colar columnas al CMS. */
function soloCampos(args: McpArgs, permitidos: readonly string[]): McpArgs | null {
  const extra = Object.keys(args).filter(k => !permitidos.includes(k));
  return extra.length
    ? errorCliente('INVALID_ARGUMENT', `Unknown argument(s): ${extra.slice(0, 5).join(', ')}`)
    : null;
}

function enteroEnRango(value: unknown, def: number, min: number, max: number): number | null {
  if (value === undefined || value === null) return def;
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
}

function leerLocale(value: unknown): 'es' | 'en' | null {
  if (value === undefined) return 'es';
  return value === 'es' || value === 'en' ? value : null;
}

function esSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && SLUG_RE.test(value);
}

// ── Presentación pública de productos ───────────────────────────────────────
const MODALIDAD: Record<string, string> = {
  dropship: 'online_purchase',
  cotizacion: 'quote_required',
  individualizado: 'personalized_attention',
};

export function urlProducto(slug: string, loc: 'es' | 'en'): string {
  return `${SITIO}/${loc}/${loc === 'en' ? 'products' : 'productos'}/${slug}/`;
}
function urlAbsoluta(ruta: string | null): string | null {
  if (!ruta) return null;
  if (ruta.startsWith('/') && !ruta.startsWith('//')) return `${SITIO}${ruta}`;
  return /^https:\/\//.test(ruta) ? ruta : null;
}

/** Lista blanca de campos públicos: nunca precio, precio_costo, stock ni proveedor. */
export function productoPublico(row: ProductoPublicoRow, loc: 'es' | 'en'): McpArgs {
  return {
    slug: row.slug,
    sku: row.sku,
    name: (loc === 'en' && row.nombre_en) || row.nombre_es,
    summary: (loc === 'en' && row.descripcion_corta_en) || row.descripcion_corta_es || null,
    family: row.familia_slug,
    purchase_mode: MODALIDAD[row.fulfillment_mode] ?? 'quote_required',
    // Mismo precio público que la web (COP, IVA incluido). Sin precio = cotizar.
    public_price_cop: row.precio_publico,
    availability: !row.disponible
      ? 'unavailable'
      : row.stock_estado === 'outofstock'
        ? 'out_of_stock'
        : row.stock_estado === 'onbackorder'
          ? 'on_backorder'
          : 'in_stock',
    url: urlProducto(row.slug, loc),
    image_url: urlAbsoluta(row.imagen_principal),
    has_product_sheet: Boolean(row.ficha_pdf && RUTA_FICHA_RE.test(row.ficha_pdf)),
  };
}

// ── Auth por token de cliente ───────────────────────────────────────────────
export async function autenticarCliente(
  args: McpArgs,
  ctx: ClienteContexto,
  deps: ClienteDeps
): Promise<ClienteRow | null> {
  const candidato = typeof args.client_token === 'string' ? args.client_token : (ctx.bearer ?? '');
  if (!CLIENT_TOKEN_RE.test(candidato)) return null;
  const cliente = await deps.clientePorTokenHash(await deps.sha256(candidato));
  if (!cliente || cliente.revocado_at) return null;
  if (new Date(cliente.expira_en).getTime() <= deps.now().getTime()) return null;
  return cliente;
}

/** Huella estable de los argumentos de negocio (orden de claves canónico). */
function canonico(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonico).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as McpArgs;
    return `{${Object.keys(obj)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonico(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

// ── Validadores por herramienta ─────────────────────────────────────────────
interface Registro {
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
  pais: string | null;
  agente: string | null;
}
function validarRegistro(args: McpArgs): Validacion<Registro> {
  const nombre = limpiarTexto(args.name, { min: 2, max: 120 });
  if (!nombre) return invalido('name', '2-120 characters required');
  const email = limpiarTexto(args.email, { min: 6, max: 200 })?.toLowerCase() ?? null;
  if (!email || !EMAIL_RE.test(email)) return invalido('email', 'valid email required');
  const empresa = limpiarTexto(args.company, { min: 2, max: 160 });
  if (!empresa) return invalido('company', '2-160 characters required');
  const telefono = limpiarTexto(args.phone, { min: 7, max: 40 });
  if (!telefono || !PHONE_RE.test(telefono))
    return invalido('phone', 'digits, spaces, + ( ) . - only; 7-26 chars');
  let pais: string | null = null;
  if (args.country !== undefined) {
    pais = typeof args.country === 'string' ? args.country.trim().toUpperCase() : '';
    if (!COUNTRY_RE.test(pais)) return invalido('country', 'ISO 3166-1 alpha-2 code');
  }
  let agente: string | null = null;
  if (args.agent_name !== undefined) {
    agente = limpiarTexto(args.agent_name, { min: 1, max: 80 });
    if (!agente) return invalido('agent_name', '1-80 characters');
  }
  if (args.data_processing_consent !== true) {
    return invalido(
      'data_processing_consent',
      'must be true: the human client accepts the I-ME personal data policy (Colombia, Ley 1581 de 2012)'
    );
  }
  return { ok: true, valor: { nombre, email, empresa, telefono, pais, agente } };
}

interface Solicitud {
  clave: string;
  mensaje: string;
  loc: 'es' | 'en';
  ciudad: string | null;
  items: Array<{ slug: string; cantidad: number }>;
}
function validarSolicitud(args: McpArgs, tipo: 'cotizacion' | 'contacto'): Validacion<Solicitud> {
  const clave = typeof args.idempotency_key === 'string' ? args.idempotency_key : '';
  if (!IDEMPOTENCY_RE.test(clave))
    return invalido('idempotency_key', 'required, 16-128 chars [A-Za-z0-9_-] (e.g. a UUID)');
  const mensaje =
    args.message === undefined && tipo === 'cotizacion'
      ? ''
      : limpiarTexto(args.message, {
          min: tipo === 'contacto' ? 10 : 0,
          max: 2000,
          multilinea: true,
        });
  if (mensaje === null)
    return invalido('message', tipo === 'contacto' ? '10-2000 characters required' : 'max 2000');
  const loc = leerLocale(args.locale);
  if (!loc) return invalido('locale', "'es' or 'en'");
  let ciudad: string | null = null;
  if (args.city !== undefined) {
    ciudad = limpiarTexto(args.city, { min: 2, max: 80 });
    if (!ciudad) return invalido('city', '2-80 characters');
  }
  const items: Array<{ slug: string; cantidad: number }> = [];
  if (tipo === 'cotizacion') {
    if (!Array.isArray(args.items) || args.items.length < 1 || args.items.length > 50)
      return invalido('items', '1-50 items required');
    const vistos = new Set<string>();
    for (const [i, raw] of args.items.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return invalido(`items[${i}]`, 'object required');
      const item = raw as McpArgs;
      const extra = Object.keys(item).filter(k => k !== 'slug' && k !== 'quantity');
      if (extra.length) return invalido(`items[${i}]`, `unknown field ${extra[0]}`);
      if (!esSlug(item.slug)) return invalido(`items[${i}].slug`, 'catalog slug');
      if (vistos.has(item.slug)) return invalido(`items[${i}].slug`, 'duplicated');
      vistos.add(item.slug);
      const cantidad = enteroEnRango(item.quantity, 1, 1, 9999);
      if (cantidad === null) return invalido(`items[${i}].quantity`, 'integer 1-9999');
      items.push({ slug: item.slug, cantidad });
    }
  } else if (args.product_slug !== undefined) {
    if (!esSlug(args.product_slug)) return invalido('product_slug', 'catalog slug');
    items.push({ slug: args.product_slug, cantidad: 1 });
  }
  return { ok: true, valor: { clave, mensaje, loc, ciudad, items } };
}

// ── Ejecutores ──────────────────────────────────────────────────────────────
export interface ResultadoCliente {
  result: McpArgs;
  clienteId: string | null;
  entidadId?: string | null;
}

const PERMITIDOS: Record<ClientToolName, readonly string[]> = {
  v1_client_list_catalog: ['family', 'limit', 'offset', 'locale'],
  v1_client_search_catalog: ['query', 'limit', 'locale'],
  v1_client_get_product_sheet: ['client_token', 'slug'],
  v1_client_register_client: [
    'name',
    'email',
    'company',
    'phone',
    'country',
    'agent_name',
    'data_processing_consent',
  ],
  v1_client_request_quote: [
    'client_token',
    'idempotency_key',
    'items',
    'message',
    'city',
    'locale',
  ],
  v1_client_request_contact: [
    'client_token',
    'idempotency_key',
    'product_slug',
    'message',
    'city',
    'locale',
  ],
};

export async function ejecutarCliente(
  nombre: ClientToolName,
  args: McpArgs,
  ctx: ClienteContexto,
  deps: ClienteDeps
): Promise<ResultadoCliente> {
  // 1) Auth ANTES de validar: un agente sin registro siempre recibe 401 con la
  //    instrucción, nunca detalles de validación de herramientas protegidas.
  let cliente: ClienteRow | null = null;
  if (CLIENT_TOOLS_AUTH.has(nombre)) {
    cliente = await autenticarCliente(args, ctx, deps);
    if (!cliente) return { result: noAutorizado(), clienteId: null };
  }
  const clienteId = cliente?.id ?? null;
  const fallo = (result: McpArgs): ResultadoCliente => ({ result, clienteId });

  const extra = soloCampos(args, PERMITIDOS[nombre]);
  if (extra) return fallo(extra);

  switch (nombre) {
    case 'v1_client_list_catalog': {
      const limite = enteroEnRango(args.limit, 20, 1, 50);
      if (limite === null) return fallo(invalido('limit', 'integer 1-50').error);
      const desplazamiento = enteroEnRango(args.offset, 0, 0, 5000);
      if (desplazamiento === null) return fallo(invalido('offset', 'integer 0-5000').error);
      const loc = leerLocale(args.locale);
      if (!loc) return fallo(invalido('locale', "'es' or 'en'").error);
      if (args.family !== undefined && !esSlug(args.family))
        return fallo(invalido('family', 'family slug').error);
      const familia = (args.family as string | undefined) ?? null;
      const { filas, total } = await deps.listarProductos({ familia, limite, desplazamiento });
      return {
        result: {
          ok: true,
          products: filas.map(f => productoPublico(f, loc)),
          total,
          next_offset: filas.length === limite ? desplazamiento + limite : null,
        },
        clienteId: null,
      };
    }

    case 'v1_client_search_catalog': {
      const texto = limpiarTexto(args.query, { min: 2, max: 120 });
      if (!texto) return fallo(invalido('query', '2-120 characters').error);
      const limite = enteroEnRango(args.limit, 10, 1, 25);
      if (limite === null) return fallo(invalido('limit', 'integer 1-25').error);
      const loc = leerLocale(args.locale);
      if (!loc) return fallo(invalido('locale', "'es' or 'en'").error);
      const filas = await deps.buscarProductos(texto, limite);
      return {
        result: { ok: true, query: texto, products: filas.map(f => productoPublico(f, loc)) },
        clienteId: null,
      };
    }

    case 'v1_client_register_client': {
      const v = validarRegistro(args);
      if (!v.ok) return fallo(v.error);
      const token = deps.randomToken();
      if (!CLIENT_TOKEN_RE.test(token)) throw new Error('token generator misconfigured');
      const expira = new Date(deps.now().getTime() + CLIENT_SESSION_DAYS * 86_400_000);
      const creado = await deps.crearCliente({
        token_hash: await deps.sha256(token),
        nombre: v.valor.nombre,
        email: v.valor.email,
        empresa: v.valor.empresa,
        telefono: v.valor.telefono,
        pais: v.valor.pais,
        agente: v.valor.agente,
        consentimiento_datos: true,
        ip_hash: ctx.ipHash,
        expira_en: expira.toISOString(),
      });
      return {
        result: {
          ok: true,
          client_id: creado.id,
          client_token: token,
          expires_at: expira.toISOString(),
          usage:
            'Pass client_token as an argument (or Authorization: Bearer) to v1_client_get_product_sheet, v1_client_request_quote and v1_client_request_contact. Keep it secret: it identifies this client.',
        },
        clienteId: creado.id,
        entidadId: creado.id,
      };
    }

    case 'v1_client_get_product_sheet': {
      const c = cliente as ClienteRow;
      if (!esSlug(args.slug)) return fallo(invalido('slug', 'catalog slug').error);
      const producto = await deps.productoPorSlug(args.slug);
      if (!producto) return fallo(errorCliente('NOT_FOUND', 'Product not found'));
      if (!producto.ficha_pdf || !RUTA_FICHA_RE.test(producto.ficha_pdf)) {
        return fallo(
          errorCliente('SHEET_UNAVAILABLE', 'This product has no downloadable sheet.', {
            next_step: 'v1_client_request_contact',
          })
        );
      }
      const firmada = await deps.firmarFicha(producto.ficha_pdf);
      if (!firmada)
        return fallo(errorCliente('SHEET_UNAVAILABLE', 'Sheet temporarily unavailable.'));
      await deps.registrarDescarga(c.id, producto);
      await deps.tocarCliente(c.id);
      return {
        result: {
          ok: true,
          slug: producto.slug,
          name: producto.nombre_es,
          sheet_url: firmada.url,
          expires_at: firmada.expira_en,
          content_type: 'application/pdf',
          note: 'Private signed link valid for a few minutes. Do not republish it.',
        },
        clienteId: c.id,
        entidadId: producto.slug,
      };
    }

    case 'v1_client_request_quote':
    case 'v1_client_request_contact': {
      const c = cliente as ClienteRow;
      const tipo = nombre === 'v1_client_request_quote' ? 'cotizacion' : 'contacto';
      const v = validarSolicitud(args, tipo);
      if (!v.ok) return fallo(v.error);
      const { clave, mensaje, loc, ciudad, items } = v.valor;

      const huella = await deps.sha256(canonico({ items, mensaje, loc, ciudad }));
      const reserva = await deps.reservarIdempotencia(c.id, nombre, clave, huella);
      if (reserva.estado === 'completada')
        return fallo({ ...reserva.respuesta, idempotent_replay: true });
      if (reserva.estado === 'conflicto')
        return fallo(
          errorCliente(
            'IDEMPOTENCY_CONFLICT',
            'idempotency_key already used with different arguments.'
          )
        );
      if (reserva.estado === 'en_curso')
        return fallo(
          errorCliente('IDEMPOTENCY_IN_PROGRESS', 'Same request in progress; retry shortly.')
        );

      try {
        const productos = items.length ? await deps.productosPorSlugs(items.map(i => i.slug)) : [];
        const porSlug = new Map(productos.map(p => [p.slug, p]));
        const faltan = items.filter(i => !porSlug.has(i.slug)).map(i => i.slug);
        if (faltan.length) {
          await deps.liberarIdempotencia(c.id, nombre, clave);
          return fallo(
            errorCliente('NOT_FOUND', `Unknown product slug(s): ${faltan.slice(0, 5).join(', ')}`)
          );
        }
        const fila: NuevaSolicitud = {
          tipo_solicitud: tipo,
          nombre: c.nombre,
          email: c.email,
          empresa: c.empresa,
          telefono: c.telefono,
          mensaje,
          productos: items.map(i => {
            const p = porSlug.get(i.slug) as ProductoPublicoRow;
            return {
              slug: p.slug,
              nombre: p.nombre_es,
              cantidad: i.cantidad,
              url: urlProducto(p.slug, loc),
            };
          }),
          locale: loc,
          pais: c.pais,
          ciudad,
          mcp_cliente_id: c.id,
        };
        const creada = await deps.crearSolicitud(fila);
        const avisado = await deps.notificarVentas(creada.id, fila).catch(() => false);
        const respuesta: McpArgs = {
          ok: true,
          request_id: creada.id,
          type: tipo === 'cotizacion' ? 'quote' : 'contact',
          status: 'received',
          sales_notified: avisado,
          message:
            tipo === 'cotizacion'
              ? 'Quote request registered. I-ME sales will reply to the registered contact. Prices are only binding in the formal quote.'
              : 'Contact request registered. I-ME sales will reply to the registered contact.',
        };
        await deps.completarIdempotencia(c.id, nombre, clave, respuesta);
        await deps.tocarCliente(c.id);
        return { result: respuesta, clienteId: c.id, entidadId: creada.id };
      } catch (error) {
        await deps.liberarIdempotencia(c.id, nombre, clave).catch(() => undefined);
        throw error;
      }
    }
  }
}

// ── Registro MCP (schemas publicados en tools/list) ─────────────────────────
const TOKEN_PROP = {
  type: 'string',
  pattern: CLIENT_TOKEN_RE.source,
  description:
    'client_token returned by v1_client_register_client (alternatively send Authorization: Bearer <token>).',
};
const LOCALE_PROP = { type: 'string', enum: ['es', 'en'], default: 'es' };
const SLUG_PROP = { type: 'string', pattern: SLUG_RE.source, maxLength: 200 };
const PRODUCT_OUT = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    sku: { type: ['string', 'null'] },
    name: { type: 'string' },
    summary: { type: ['string', 'null'] },
    family: { type: ['string', 'null'] },
    purchase_mode: {
      type: 'string',
      enum: ['online_purchase', 'quote_required', 'personalized_attention'],
    },
    public_price_cop: {
      type: ['number', 'null'],
      description: 'Public web price in COP, VAT included. null = quote required.',
    },
    availability: {
      type: 'string',
      enum: ['in_stock', 'out_of_stock', 'on_backorder', 'unavailable'],
    },
    url: { type: 'string' },
    image_url: { type: ['string', 'null'] },
    has_product_sheet: { type: 'boolean' },
  },
};
const BASE_OUT = {
  ok: { type: 'boolean' },
  status: { type: 'integer', description: 'HTTP-like status on errors (401, 400, 404, 409)' },
  code: { type: 'string' },
  error: { type: 'string' },
  next_step: { type: 'string' },
};
const SOLICITUD_OUT = {
  type: 'object',
  properties: {
    ...BASE_OUT,
    request_id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['quote', 'contact'] },
    status: { type: ['string', 'integer'] },
    sales_notified: { type: 'boolean' },
    message: { type: 'string' },
    idempotent_replay: { type: 'boolean' },
  },
  required: ['ok'],
};
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const CLIENT_TOOL_DEFINITIONS: Record<ClientToolName, McpToolDefinition> = {
  v1_client_list_catalog: {
    name: 'v1_client_list_catalog',
    description:
      'List active I-ME medical equipment catalog products (read-only, no registration). Paginate with offset/next_offset.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        family: { ...SLUG_PROP, description: 'Product family slug filter' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        offset: { type: 'integer', minimum: 0, maximum: 5000, default: 0 },
        locale: LOCALE_PROP,
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        ...BASE_OUT,
        products: { type: 'array', items: PRODUCT_OUT },
        total: { type: ['integer', 'null'] },
        next_offset: { type: ['integer', 'null'] },
      },
      required: ['ok'],
    },
    annotations: { title: 'List catalog', ...READ_ONLY },
  },
  v1_client_search_catalog: {
    name: 'v1_client_search_catalog',
    description: 'Full-text search over the active I-ME catalog (read-only, no registration).',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 2, maxLength: 120 },
        limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
        locale: LOCALE_PROP,
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        ...BASE_OUT,
        query: { type: 'string' },
        products: { type: 'array', items: PRODUCT_OUT },
      },
      required: ['ok'],
    },
    annotations: { title: 'Search catalog', ...READ_ONLY },
  },
  v1_client_get_product_sheet: {
    name: 'v1_client_get_product_sheet',
    description:
      'Get a private, short-lived download link to a product datasheet (PDF). Requires client_token; without it returns status 401 and next_step v1_client_register_client.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['slug'],
      properties: { client_token: TOKEN_PROP, slug: SLUG_PROP },
    },
    outputSchema: {
      type: 'object',
      properties: {
        ...BASE_OUT,
        slug: { type: 'string' },
        name: { type: 'string' },
        sheet_url: { type: 'string', format: 'uri' },
        expires_at: { type: 'string', format: 'date-time' },
        content_type: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['ok'],
    },
    annotations: {
      title: 'Get product sheet',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  v1_client_register_client: {
    name: 'v1_client_register_client',
    description:
      "Register the human client's B2B contact details and obtain a client_token valid for 30 days. Requires the human's explicit consent to data processing (Colombia, Ley 1581 de 2012). Never invent data.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'email', 'company', 'phone', 'data_processing_consent'],
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 120 },
        email: { type: 'string', format: 'email', maxLength: 200 },
        company: { type: 'string', minLength: 2, maxLength: 160 },
        phone: {
          type: 'string',
          pattern: PHONE_RE.source,
          description: 'International format preferred, e.g. +57 300 000 0000',
        },
        country: { type: 'string', pattern: COUNTRY_RE.source, description: 'ISO 3166-1 alpha-2' },
        agent_name: {
          type: 'string',
          maxLength: 80,
          description: 'Name of the AI agent or platform acting for the client',
        },
        data_processing_consent: { type: 'boolean', const: true },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        ...BASE_OUT,
        client_id: { type: 'string', format: 'uuid' },
        client_token: { type: 'string', pattern: CLIENT_TOKEN_RE.source },
        expires_at: { type: 'string', format: 'date-time' },
        usage: { type: 'string' },
      },
      required: ['ok'],
    },
    annotations: {
      title: 'Register client',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  v1_client_request_quote: {
    name: 'v1_client_request_quote',
    description:
      'Request a formal quote for catalog products on behalf of the registered client. Requires client_token and idempotency_key (retrying with the same key returns the original result). Never commits prices.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['idempotency_key', 'items'],
      properties: {
        client_token: TOKEN_PROP,
        idempotency_key: { type: 'string', pattern: IDEMPOTENCY_RE.source },
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['slug'],
            properties: {
              slug: SLUG_PROP,
              quantity: { type: 'integer', minimum: 1, maximum: 9999, default: 1 },
            },
          },
        },
        message: { type: 'string', maxLength: 2000 },
        city: { type: 'string', minLength: 2, maxLength: 80 },
        locale: LOCALE_PROP,
      },
    },
    outputSchema: SOLICITUD_OUT,
    annotations: {
      title: 'Request quote',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  v1_client_request_contact: {
    name: 'v1_client_request_contact',
    description:
      'Send a contact request to I-ME sales on behalf of the registered client. Requires client_token and idempotency_key.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['idempotency_key', 'message'],
      properties: {
        client_token: TOKEN_PROP,
        idempotency_key: { type: 'string', pattern: IDEMPOTENCY_RE.source },
        message: { type: 'string', minLength: 10, maxLength: 2000 },
        product_slug: SLUG_PROP,
        city: { type: 'string', minLength: 2, maxLength: 80 },
        locale: LOCALE_PROP,
      },
    },
    outputSchema: SOLICITUD_OUT,
    annotations: {
      title: 'Request contact',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
};

export const CLIENTE_REGISTRY: McpToolRegistry<ClientToolName> = {
  serverInfo: { name: 'ime-cliente', version: CLIENT_SERVER_VERSION },
  instructions:
    'I-ME public client surface (role: client). Browse the catalog freely. To download datasheets, request quotes or contact sales, first call v1_client_register_client with the human client details and consent, then pass client_token. Never invent client data, prices or clinical claims.',
  list: () => CLIENT_TOOLS.map(name => CLIENT_TOOL_DEFINITIONS[name]),
  has: (name: unknown): name is ClientToolName => CLIENT_TOOLS.includes(name as ClientToolName),
};

/** Token opaco: prefijo + 32 bytes aleatorios en base64url (43 caracteres). */
export function generarTokenCliente(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return TOKEN_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
