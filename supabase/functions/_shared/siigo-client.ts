/**
 * Cliente Siigo API para facturación electrónica DIAN.
 * Ver docs/superpowers/specs/2026-07-07-facturacion-electronica-siigo-design.md.
 *
 * Sin caché de token entre invocaciones: la emisión es post-pago, asíncrona y
 * de bajo volumen, así que se re-autentica en cada emisión en vez de añadir
 * infraestructura de caché.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { resolverDivipola } from './divipola.ts';

const SIIGO_BASE_URL = 'https://api.siigo.com';

export interface SiigoConfig {
  username: string;
  accessKey: string;
  partnerId: string;
  documentTypeId: number;
  sellerId: number;
  paymentTypeId: number;
  accountGroupId: number;
  /** tarifa IVA en % ("19"|"5"|"0", tal como llega de fiscal.ts) -> id de impuesto Siigo */
  taxMap: Record<string, number>;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Config Siigo incompleta: falta ${name}`);
  return value;
}

export function getSiigoConfig(): SiigoConfig {
  const taxMapRaw = requireEnv('SIIGO_TAX_MAP');
  let taxMap: Record<string, number>;
  try {
    taxMap = JSON.parse(taxMapRaw);
  } catch {
    throw new Error('SIIGO_TAX_MAP no es JSON valido');
  }

  return {
    username: requireEnv('SIIGO_USERNAME'),
    accessKey: requireEnv('SIIGO_ACCESS_KEY'),
    partnerId: requireEnv('SIIGO_PARTNER_ID'),
    documentTypeId: Number(requireEnv('SIIGO_DOCUMENT_TYPE_ID')),
    sellerId: Number(requireEnv('SIIGO_SELLER_ID')),
    paymentTypeId: Number(requireEnv('SIIGO_PAYMENT_TYPE_ID')),
    accountGroupId: Number(requireEnv('SIIGO_ACCOUNT_GROUP_ID')),
    taxMap,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = Number(Deno.env.get('SIIGO_TIMEOUT_MS') ?? 20000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function siigoHeaders(token: string, partnerId: string): Record<string, string> {
  return {
    // Siigo espera el access_token crudo en Authorization, sin prefijo "Bearer"
    // (confirmado contra la cuenta real, ver scripts/siigo-discover-config.mjs).
    Authorization: token,
    'Partner-Id': partnerId,
    'Content-Type': 'application/json',
  };
}

function extraerLista(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (
    body &&
    typeof body === 'object' &&
    Array.isArray((body as { results?: unknown[] }).results)
  ) {
    return (body as { results: unknown[] }).results;
  }
  return [];
}

function extraerMensajeError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const errores = (body as { Errors?: Array<{ Message?: string }> }).Errors;
    if (Array.isArray(errores) && errores[0]?.Message) return errores[0].Message;
    const mensaje = (body as { message?: string }).message;
    if (mensaje) return mensaje;
  }
  return `HTTP ${status}`;
}

/** POST /auth — devuelve access_token, valido ~24h. */
export async function autenticar(config: SiigoConfig): Promise<string> {
  const res = await fetchWithTimeout(`${SIIGO_BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.username, access_key: config.accessKey }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Autenticacion Siigo fallo: ${extraerMensajeError(body, res.status)}`);
  }
  return body.access_token;
}

export interface SiigoDireccionInput {
  direccion: string;
  ciudad: string;
  departamento?: string | null;
}

export interface SiigoClienteInput {
  tipo_documento: string;
  numero_documento: string;
  tipo_persona: string;
  razon_social: string;
  email: string;
  responsable_iva: boolean;
  direccion: SiigoDireccionInput;
}

/** Códigos DIAN de tipo de identificación que Siigo exige en id_type (catálogo público, no específico de cuenta). */
const ID_TYPE_POR_TIPO_DOCUMENTO: Record<string, string> = {
  CC: '13',
  NIT: '31',
  CE: '22',
  PP: '41',
};

/** Siigo exige nombre en 2 campos para personas naturales; separa razon_social por el primer espacio. */
function dividirNombrePersona(razonSocial: string): [string, string] {
  const limpio = razonSocial.trim();
  const espacio = limpio.indexOf(' ');
  if (espacio === -1) return [limpio, limpio];
  return [limpio.slice(0, espacio), limpio.slice(espacio + 1).trim()];
}

/**
 * GET /v1/customers?identification=X; si no existe, POST /v1/customers.
 * Nunca inventa código DIVIPOLA: si ciudad/departamento no resuelven de forma
 * inequívoca contra el catálogo oficial, lanza error (ver divipola.ts).
 */
export async function resolverCliente(
  token: string,
  config: SiigoConfig,
  cliente: SiigoClienteInput
): Promise<{ identification: string }> {
  const headers = siigoHeaders(token, config.partnerId);

  const identification = cliente.numero_documento.replace(/\D/g, '') || cliente.numero_documento;

  const buscarRes = await fetchWithTimeout(
    `${SIIGO_BASE_URL}/v1/customers?identification=${encodeURIComponent(identification)}`,
    { headers }
  );
  if (buscarRes.ok) {
    const buscarBody = await buscarRes.json().catch(() => null);
    if (extraerLista(buscarBody).length > 0) return { identification };
  }

  const idType = ID_TYPE_POR_TIPO_DOCUMENTO[cliente.tipo_documento];
  if (!idType) {
    throw new Error(`Tipo de documento sin mapeo Siigo id_type: ${cliente.tipo_documento}`);
  }

  const ubicacion = resolverDivipola(
    cliente.direccion.departamento ?? '',
    cliente.direccion.ciudad
  );
  if (!ubicacion) {
    throw new Error(
      `No se pudo resolver codigo DIVIPOLA para ciudad="${cliente.direccion.ciudad}" departamento="${cliente.direccion.departamento ?? ''}"`
    );
  }

  const esJuridica = cliente.tipo_persona === 'juridica';
  const [nombre, apellido] = dividirNombrePersona(cliente.razon_social);

  const payload = {
    type: 'Customer',
    person_type: esJuridica ? 'Company' : 'Person',
    id_type: idType,
    identification,
    name: esJuridica ? [cliente.razon_social] : [nombre, apellido],
    vat_responsible: cliente.responsable_iva,
    fiscal_responsibilities: [{ code: 'R-99-PN', name: 'No responsable' }],
    address: {
      address: cliente.direccion.direccion,
      city: {
        country_code: 'Co',
        state_code: ubicacion.stateCode,
        city_code: ubicacion.cityCode,
      },
    },
    contacts: [
      {
        first_name: esJuridica ? cliente.razon_social : nombre,
        last_name: esJuridica ? '' : apellido,
        email: cliente.email,
      },
    ],
  };

  const crearRes = await fetchWithTimeout(`${SIIGO_BASE_URL}/v1/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const crearBody = await crearRes.json().catch(() => ({}));
  if (!crearRes.ok) {
    throw new Error(
      `Creacion de cliente Siigo fallo: ${extraerMensajeError(crearBody, crearRes.status)}`
    );
  }

  return { identification };
}

export interface SiigoProductoInput {
  productoId?: string | undefined;
  slug?: string | undefined;
  nombre: string;
  tarifaIvaPct: number;
}

/**
 * GET /v1/products?code=<sku|slug>; si no existe, POST /v1/products.
 * Creación perezosa: cada producto se sincroniza la primera vez que aparece
 * en una factura.
 */
export async function resolverProducto(
  token: string,
  config: SiigoConfig,
  supabase: SupabaseClient,
  item: SiigoProductoInput
): Promise<{ code: string }> {
  let sku: string | null = null;
  if (item.productoId) {
    const { data } = await supabase
      .from('productos')
      .select('sku')
      .eq('id', item.productoId)
      .maybeSingle();
    sku = (data as { sku: string | null } | null)?.sku ?? null;
  }

  const code = sku ?? item.slug;
  if (!code) {
    throw new Error(
      `No se pudo determinar codigo de producto para Siigo (sin sku ni slug): ${item.nombre}`
    );
  }

  const headers = siigoHeaders(token, config.partnerId);
  const buscarRes = await fetchWithTimeout(
    `${SIIGO_BASE_URL}/v1/products?code=${encodeURIComponent(code)}`,
    { headers }
  );
  if (buscarRes.ok) {
    const buscarBody = await buscarRes.json().catch(() => null);
    if (extraerLista(buscarBody).length > 0) return { code };
  }

  const taxId = config.taxMap[String(item.tarifaIvaPct)];
  if (taxId === undefined) {
    throw new Error(`Sin mapeo SIIGO_TAX_MAP para tarifa IVA ${item.tarifaIvaPct}%`);
  }

  const payload = {
    code,
    name: item.nombre,
    account_group: config.accountGroupId,
    type: 'Product',
    stock_control: false,
    taxes: [{ id: taxId }],
  };

  const crearRes = await fetchWithTimeout(`${SIIGO_BASE_URL}/v1/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const crearBody = await crearRes.json().catch(() => ({}));
  if (!crearRes.ok) {
    throw new Error(
      `Creacion de producto Siigo fallo: ${extraerMensajeError(crearBody, crearRes.status)}`
    );
  }

  return { code };
}

export interface SiigoInvoicePayload {
  document: { id: number };
  date: string;
  customer: { identification: string; branch_office: number };
  seller: number;
  items: Array<{
    code: string;
    description: string;
    quantity: number;
    price: number;
    taxes: Array<{ id: number }>;
  }>;
  payments: Array<{ id: number; value: number }>;
  observations?: string;
  stamp: { send: boolean };
  mail: { send: boolean };
}

export interface SiigoInvoiceResult {
  ok: boolean;
  raw: unknown;
  estadoStamp: string;
  numeroFactura?: string;
  cufe?: string;
  error?: string;
}

/** POST /v1/invoices. */
export async function crearFactura(
  token: string,
  config: SiigoConfig,
  payload: SiigoInvoicePayload
): Promise<SiigoInvoiceResult> {
  const headers = siigoHeaders(token, config.partnerId);
  const res = await fetchWithTimeout(`${SIIGO_BASE_URL}/v1/invoices`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    name?: string;
    stamp?: { status?: string; cufe?: string; errors?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      raw: body,
      estadoStamp: 'error',
      error: extraerMensajeError(body, res.status),
    };
  }

  return {
    ok: true,
    raw: body,
    estadoStamp: body.stamp?.status ?? 'Accepted',
    numeroFactura: body.name,
    cufe: body.stamp?.cufe,
    error: body.stamp?.errors,
  };
}

export interface SiigoCreditNotePayload {
  document: { id: number };
  date: string;
  invoice: string;
  reason: number;
  seller?: number;
  observations?: string;
  items: Array<{
    code: string;
    description?: string;
    quantity: number;
    price: number;
    taxes?: Array<{ id: number }>;
  }>;
  payments: Array<{ id: number; value: number }>;
  stamp?: { send: boolean };
  mail?: { send: boolean };
}

export interface SiigoCreditNoteResult {
  ok: boolean;
  raw: unknown;
  estadoStamp: string;
  numeroNota?: string;
  cude?: string;
  error?: string;
}

/** Lista tipos de documento Siigo (FV, NC, …). */
export async function listarTiposDocumento(
  token: string,
  config: SiigoConfig,
  type: string
): Promise<Array<{ id: number; name?: string; type?: string; electronic?: boolean }>> {
  const headers = siigoHeaders(token, config.partnerId);
  const res = await fetchWithTimeout(
    `${SIIGO_BASE_URL}/v1/document-types?type=${encodeURIComponent(type)}`,
    { method: 'GET', headers }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`document-types fallo: ${extraerMensajeError(body, res.status)}`);
  }
  return extraerLista(body) as Array<{
    id: number;
    name?: string;
    type?: string;
    electronic?: boolean;
  }>;
}

/** Lista medios de pago para un tipo de documento. */
export async function listarMediosPago(
  token: string,
  config: SiigoConfig,
  documentType: string
): Promise<Array<{ id: number; name?: string }>> {
  const headers = siigoHeaders(token, config.partnerId);
  const res = await fetchWithTimeout(
    `${SIIGO_BASE_URL}/v1/payment-types?document_type=${encodeURIComponent(documentType)}`,
    { method: 'GET', headers }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`payment-types fallo: ${extraerMensajeError(body, res.status)}`);
  }
  return extraerLista(body) as Array<{ id: number; name?: string }>;
}

/** POST /v1/credit-notes — anulación / devolución de factura. */
export async function crearNotaCredito(
  token: string,
  config: SiigoConfig,
  payload: SiigoCreditNotePayload
): Promise<SiigoCreditNoteResult> {
  const headers = siigoHeaders(token, config.partnerId);
  const res = await fetchWithTimeout(`${SIIGO_BASE_URL}/v1/credit-notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    name?: string;
    stamp?: { status?: string; cude?: string; cufe?: string; errors?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      raw: body,
      estadoStamp: 'error',
      error: extraerMensajeError(body, res.status),
    };
  }

  return {
    ok: true,
    raw: body,
    estadoStamp: body.stamp?.status ?? 'Accepted',
    numeroNota: body.name,
    cude: body.stamp?.cude ?? body.stamp?.cufe,
    error: body.stamp?.errors,
  };
}
