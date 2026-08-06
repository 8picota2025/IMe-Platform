/**
 * Adaptadores para consultar contribuyente DIAN por NIT.
 * Providers: verifik | coresoft | generic | siigo (enriquecimiento).
 */

import {
  verificarNitCampo,
  type ContribuyenteDian,
  type NitVerificacion,
  type TipoDocumentoFiscal,
} from './nit-verificacion.ts';
import { autenticar, getSiigoConfig } from './siigo-client.ts';

export interface ConsultaNitResultado {
  ok: boolean;
  verificacion: NitVerificacion;
  contribuyente: ContribuyenteDian | null;
  fuentes_intentadas: string[];
  mensaje: string;
}

function providerName(): string {
  return (Deno.env.get('DIAN_PROVIDER_NAME') ?? '').trim().toLowerCase();
}

function providerUrl(): string {
  return (Deno.env.get('DIAN_PROVIDER_API_URL') ?? '').trim();
}

function providerToken(): string {
  return (Deno.env.get('DIAN_PROVIDER_API_TOKEN') ?? '').trim();
}

async function fetchJson(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function mapVerifik(body: unknown, nit: string): ContribuyenteDian | null {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const data =
    root?.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  if (!data) return null;
  const razon = String(data.nombreRazon ?? data.razon_social ?? data.razonSocial ?? '').trim();
  if (!razon) return null;
  const estado = String(data.estado ?? data.descripcion ?? '').trim() || null;
  const esNatural = /persona\s*natural/i.test(estado ?? '') || Boolean(data.firstName);
  return {
    nit,
    razon_social: razon,
    tipo_persona: esNatural ? 'natural' : 'juridica',
    estado,
    email: String(data.email ?? data.correo ?? '').trim() || null,
    direccion: String(data.direccion ?? data.address ?? '').trim() || null,
    ciudad: String(data.ciudad ?? data.city ?? '').trim() || null,
    departamento: String(data.departamento ?? data.state ?? '').trim() || null,
    responsable_iva: typeof data.vatResponsible === 'boolean' ? data.vatResponsible : null,
    fuente: 'verifik',
    raw: body,
  };
}

function mapCoresoft(body: unknown, nit: string): ContribuyenteDian | null {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const data =
    root?.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  if (!data) return null;
  const razon = String(data.razon_social ?? data.razonSocial ?? data.nombre ?? '').trim();
  if (!razon) return null;
  const regimen = String(data.regimen ?? '').toUpperCase();
  return {
    nit,
    razon_social: razon,
    tipo_persona: /NATURAL/.test(regimen) ? 'natural' : 'juridica',
    estado: String(data.estado ?? '').trim() || null,
    email: String(data.email ?? data.correo ?? '').trim() || null,
    direccion: String(data.direccion ?? '').trim() || null,
    ciudad: String(data.ciudad ?? '').trim() || null,
    departamento: String(data.departamento ?? '').trim() || null,
    responsable_iva: /RESPONSABLE\s*IVA/.test(regimen) ? true : null,
    fuente: 'coresoft',
    raw: body,
  };
}

function mapGeneric(body: unknown, nit: string): ContribuyenteDian | null {
  return mapVerifik(body, nit) ?? mapCoresoft(body, nit);
}

async function lookupVerifik(nitBase: string, nitFull: string): Promise<ContribuyenteDian | null> {
  const token = providerToken();
  if (!token) return null;
  const baseUrl = providerUrl() || 'https://api.verifik.co/v2/co/company/dian';
  const url = new URL(baseUrl);
  url.searchParams.set('documentType', 'NIT');
  url.searchParams.set('documentNumber', nitBase);
  const { ok, body } = await fetchJson(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!ok) return null;
  return mapVerifik(body, nitFull);
}

async function lookupCoresoft(nitFull: string): Promise<ContribuyenteDian | null> {
  const token = providerToken();
  const url = providerUrl() || 'https://api.coresoft.co/v1/rut';
  if (!token) return null;
  const { ok, body } = await fetchJson(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documento: nitFull }),
  });
  if (!ok) return null;
  return mapCoresoft(body, nitFull);
}

async function lookupGeneric(nitBase: string, nitFull: string): Promise<ContribuyenteDian | null> {
  const token = providerToken();
  const url = providerUrl();
  if (!url) return null;
  const method = (Deno.env.get('DIAN_PROVIDER_METHOD') ?? 'GET').trim().toUpperCase();
  if (method === 'POST') {
    const { ok, body } = await fetchJson(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ nit: nitFull, documento: nitBase, documentNumber: nitBase }),
    });
    if (!ok) return null;
    return mapGeneric(body, nitFull);
  }
  const u = new URL(url);
  u.searchParams.set('documentType', 'NIT');
  u.searchParams.set('documentNumber', nitBase);
  u.searchParams.set('nit', nitFull);
  const { ok, body } = await fetchJson(u.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!ok) return null;
  return mapGeneric(body, nitFull);
}

async function lookupSiigo(nitFull: string): Promise<ContribuyenteDian | null> {
  try {
    const config = getSiigoConfig();
    const token = await autenticar(config);
    const res = await fetch(
      `https://api.siigo.com/v1/customers?identification=${encodeURIComponent(nitFull)}`,
      {
        headers: {
          Authorization: token,
          'Partner-Id': config.partnerId,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const list = Array.isArray(body)
      ? body
      : body && typeof body === 'object' && Array.isArray((body as { results?: unknown[] }).results)
        ? ((body as { results: unknown[] }).results ?? [])
        : [];
    const first = list[0];
    if (!first || typeof first !== 'object') return null;
    const row = first as Record<string, unknown>;
    const name = row.name;
    let razon = '';
    if (Array.isArray(name)) razon = name.filter(Boolean).join(' ').trim();
    else if (typeof name === 'string') razon = name.trim();
    if (!razon) return null;
    const address =
      row.address && typeof row.address === 'object'
        ? (row.address as Record<string, unknown>)
        : null;
    const contacts = Array.isArray(row.contacts) ? row.contacts : [];
    const contact0 =
      contacts[0] && typeof contacts[0] === 'object'
        ? (contacts[0] as Record<string, unknown>)
        : null;
    return {
      nit: nitFull,
      razon_social: razon,
      tipo_persona: row.person_type === 'Person' ? 'natural' : 'juridica',
      estado: 'SIIGO',
      email: contact0 ? String(contact0.email ?? '').trim() || null : null,
      direccion: address ? String(address.address ?? '').trim() || null : null,
      ciudad: null,
      departamento: null,
      responsable_iva: typeof row.vat_responsible === 'boolean' ? row.vat_responsible : null,
      fuente: 'siigo',
      raw: row,
    };
  } catch {
    return null;
  }
}

export async function consultarContribuyentePorNit(args: {
  nit: string;
  tipo_documento?: TipoDocumentoFiscal;
}): Promise<ConsultaNitResultado> {
  const tipo = args.tipo_documento ?? 'NIT';
  const verificacion = verificarNitCampo(args.nit, tipo);
  const fuentes: string[] = ['local'];

  if (!verificacion.ok || !verificacion.numero) {
    return {
      ok: false,
      verificacion,
      contribuyente: null,
      fuentes_intentadas: fuentes,
      mensaje: verificacion.errores[0] ?? 'NIT invalido',
    };
  }

  const nitFull = verificacion.numero;
  const nitBase = verificacion.nit_base ?? nitFull.slice(0, -1);
  let contribuyente: ContribuyenteDian | null = null;
  const name = providerName();

  try {
    if (name === 'verifik' || (!name && providerUrl().includes('verifik'))) {
      fuentes.push('verifik');
      contribuyente = await lookupVerifik(nitBase, nitFull);
    } else if (name === 'coresoft' || (!name && providerUrl().includes('coresoft'))) {
      fuentes.push('coresoft');
      contribuyente = await lookupCoresoft(nitFull);
    } else if (providerUrl()) {
      fuentes.push(name || 'generic');
      contribuyente = await lookupGeneric(nitBase, nitFull);
    }
  } catch {
    /* provider remoto falló — seguimos con Siigo / local */
  }

  if (!contribuyente) {
    fuentes.push('siigo');
    contribuyente = await lookupSiigo(nitFull);
  }

  if (contribuyente) {
    return {
      ok: true,
      verificacion,
      contribuyente,
      fuentes_intentadas: fuentes,
      mensaje: `NIT ${verificacion.numero_formateado} valido. Datos desde ${contribuyente.fuente}.`,
    };
  }

  const tieneProvider = Boolean(providerToken() || providerUrl());
  return {
    ok: true,
    verificacion,
    contribuyente: null,
    fuentes_intentadas: fuentes,
    mensaje: tieneProvider
      ? `NIT ${verificacion.numero_formateado} valido, pero el proveedor DIAN no devolvio datos.`
      : `NIT ${verificacion.numero_formateado} valido (digito OK). Configura DIAN_PROVIDER_NAME/URL/TOKEN (verifik|coresoft) en Supabase secrets para importar razon social desde DIAN.`,
  };
}
