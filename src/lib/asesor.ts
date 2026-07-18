/**
 * IMEIA — cliente del asesor conversacional (Edge Function `asesor`).
 * Persona: ingeniera biomédica senior con perfil comercial (imeia-soul).
 * Dev: PUBLIC_OLLAMA_URL → Ollama + Supabase local.
 *
 * REGLA RECTORA: asesor comercial, no clínico. Solo recomienda productos
 * recuperados del catálogo y solo afirma datos reales.
 */

import { getSupabaseClient } from './supabase';
import {
  buildAsesorStaticFallback,
  esConsultaSitioOLegal,
  getAsesorKnowledgeBase,
} from './asesor-knowledge';
import {
  buildImeiaSoulPrompt,
  EMPTY_IMEIA_LEAD,
  extractLeadHintsFromText,
  mergeImeiaLead,
  parseImeiaStructuredReply,
  type ImeiaFase,
  type ImeiaLeadSlots,
} from './imeia-soul';
import type { Locale } from '../i18n/utils';

const OLLAMA_URL = (import.meta.env['PUBLIC_OLLAMA_URL'] as string | undefined) ?? '';
const OLLAMA_CHAT_MODEL =
  (import.meta.env['PUBLIC_OLLAMA_CHAT_MODEL'] as string | undefined) ?? 'gemma4:12b';
const OLLAMA_EMBED_MODEL =
  (import.meta.env['PUBLIC_OLLAMA_EMBED_MODEL'] as string | undefined) ?? 'mxbai-embed-large';
const IMEIA_API_URL = (import.meta.env['PUBLIC_IMEIA_API_URL'] as string | undefined) ?? '';
const FORCE_DIRECT_IMEIA_IN_BROWSER =
  ((import.meta.env['PUBLIC_FORCE_DIRECT_IMEIA_IN_BROWSER'] as string | undefined) ?? '') === '1';
export const ASESOR_CLIENT_VERSION = '2026-07-18-imeia-soul-v4';
const MAX_HANDOFF_SUMMARY_CHARS = 400;
const LEAD_STORAGE_KEY = 'ime_asesor_lead';
const CATALOGO_INDEX_URL: Record<Locale, string> = {
  es: '/data/catalogo-index.es.json',
  en: '/data/catalogo-index.en.json',
};

export interface MensajeAsesor {
  rol: 'usuario' | 'asesor';
  contenido: string;
  timestamp: Date;
}

export type ModoAsesor = 'rag' | 'keyword_degradado' | 'sin_resultados';
export type TipoHandoff = 'whatsapp' | 'cotizacion';

export interface ProductoSugerido {
  slug: string;
  nombre: string;
  imagen: string | null;
  urlLanding: string;
  score: number;
}

export interface AccionHandoff {
  tipo: TipoHandoff;
  resumen: string;
}

export type AsesorPageType =
  | 'home'
  | 'catalog'
  | 'product'
  | 'service'
  | 'knowledge'
  | 'legal'
  | 'contact'
  | 'other';

export interface AsesorNavigationContext {
  locale: Locale;
  current_url: string;
  page_type: AsesorPageType;
  page_title: string;
  product_id: string | null;
  product_slug: string | null;
  product_name: string | null;
  category_id: string | null;
  category_name: string | null;
  visible_product_ids: string[];
  comparison_product_ids: string[];
  quote_list_product_ids: string[];
  cart_product_ids: string[];
  referrer: string;
  session_id: string;
  conversation_id: string;
}

export interface RespuestaAsesor {
  texto: string;
  productos: ProductoSugerido[];
  accionHandoff: AccionHandoff | null;
  modo: ModoAsesor;
  lead: ImeiaLeadSlots;
  fase: ImeiaFase;
  mostrarCapturaLead: boolean;
}

export type { ImeiaFase, ImeiaLeadSlots };

interface CatalogoPublicadoItem {
  slug: string;
  nombre: string;
  familia: { slug: string; nombre: string };
  tipo: { slug: string; nombre: string } | null;
  descripcion_corta: string;
  imagen_principal: string | null;
  texto_busqueda: string;
}

interface CatalogoPublicadoMatch extends ProductoSugerido {
  descripcionCorta: string;
  familiaNombre: string;
  tipoNombre: string | null;
}

export type ErrorAsesor =
  | { tipo: 'rate_limited'; retryAfterSegundos: number | null }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' };

export type ResultadoAsesor =
  | { ok: true; respuesta: RespuestaAsesor }
  | { ok: false; error: ErrorAsesor };

export type AsesorTransport = 'local_ollama' | 'imeia_direct' | 'supabase';

interface AsesorApiResponse {
  texto: string;
  productos: Array<{
    slug: string;
    nombre: string;
    imagen: string | null;
    url_landing: string;
    score: number;
  }>;
  accion_handoff: { tipo: TipoHandoff; resumen: string } | null;
  modo: ModoAsesor;
  lead?: Partial<ImeiaLeadSlots> | null;
  fase?: ImeiaFase;
  mostrar_captura_lead?: boolean;
}

const SESSION_STORAGE_KEY = 'ime_asesor_session';
const HISTORIAL_STORAGE_KEY = 'ime_asesor_historial';
const catalogoPublicadoCache = new Map<Locale, Promise<CatalogoPublicadoItem[]>>();
const QUERY_STOPWORDS = new Set([
  'al',
  'con',
  'de',
  'del',
  'el',
  'en',
  'es',
  'la',
  'las',
  'le',
  'lo',
  'los',
  'me',
  'mi',
  'otros',
  'para',
  'por',
  'que',
  'se',
  'su',
  'sus',
  'un',
  'una',
  'y',
  'and',
  'are',
  'for',
  'of',
  'the',
  'to',
  'with',
]);
/** Tope de mensajes persistidos (8 turnos usuario+asesor = 16 mensajes), acorde
 * al MAX_HISTORIAL_TURNOS del Edge Function asesor. */
const MAX_HISTORIAL_MENSAJES = 16;

/** Identificador de sesión persistido en localStorage, usado para rate-limit y métricas. */
export function getSessionId(): string {
  try {
    const existente = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existente) return existente;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, nuevo);
    return nuevo;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Consulta al Asesor RAG. Devuelve un resultado tipado con error explícito
 * (rate-limit, no disponible, error genérico) para que la UI elija el estado adecuado.
 * Si PUBLIC_OLLAMA_URL está configurado, usa Ollama + Supabase directo (modo dev local).
 */
export async function preguntarAsesor(params: {
  mensaje: string;
  historial: MensajeAsesor[];
  locale: Locale;
  turnstileToken?: string | undefined;
  navigationContext?: AsesorNavigationContext | undefined;
  leadParcial?: Partial<ImeiaLeadSlots> | undefined;
}): Promise<ResultadoAsesor> {
  const leadParcial = mergeImeiaLead(
    obtenerLeadParcial(),
    mergeImeiaLead(params.leadParcial, extractLeadHintsFromText(params.mensaje))
  );

  const fallbackSitio = esConsultaSitioOLegal(params.mensaje)
    ? buildAsesorStaticFallback(params.locale, params.mensaje)
    : null;
  if (fallbackSitio) {
    return {
      ok: true,
      respuesta: withLeadDefaults({
        texto: fallbackSitio,
        productos: [],
        accionHandoff: null,
        modo: 'rag',
        lead: leadParcial,
        fase: 'descubrimiento',
        mostrarCapturaLead: false,
      }),
    };
  }

  const transport = resolveAsesorTransport();
  const paramsConLead = { ...params, leadParcial };

  if (transport === 'local_ollama') {
    try {
      const respuesta = await preguntarAsesorLocal(paramsConLead);
      guardarLeadParcial(respuesta.lead);
      return { ok: true, respuesta };
    } catch {
      const respuesta = await buildResilientFallbackResponse(paramsConLead);
      guardarLeadParcial(respuesta.lead);
      return { ok: true, respuesta };
    }
  }

  if (transport === 'imeia_direct') {
    try {
      const respuesta = await preguntarAsesorImeia(paramsConLead);
      guardarLeadParcial(respuesta.lead);
      return { ok: true, respuesta };
    } catch {
      // continua con Edge Functions / fallback resiliente
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    const respuesta = await buildResilientFallbackResponse(paramsConLead);
    guardarLeadParcial(respuesta.lead);
    return { ok: true, respuesta };
  }

  const historial = params.historial.slice(-8).map(m => ({ rol: m.rol, contenido: m.contenido }));

  const { data, error } = await supabase.functions.invoke('asesor', {
    body: {
      mensaje: params.mensaje,
      historial,
      locale: params.locale,
      turnstileToken: params.turnstileToken,
      sessionId: getSessionId(),
      navigationContext: params.navigationContext,
      leadParcial,
    },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      if (context.status === 429) {
        const retryAfter = context.headers.get('Retry-After');
        return {
          ok: false,
          error: {
            tipo: 'rate_limited',
            retryAfterSegundos: retryAfter ? Number(retryAfter) : null,
          },
        };
      }
      if (context.status === 403 || context.status === 503) {
        const respuesta = await buildResilientFallbackResponse(paramsConLead);
        guardarLeadParcial(respuesta.lead);
        return { ok: true, respuesta };
      }
    }
    const respuesta = await buildResilientFallbackResponse(paramsConLead);
    guardarLeadParcial(respuesta.lead);
    return { ok: true, respuesta };
  }

  if (!data) {
    const respuesta = await buildResilientFallbackResponse(paramsConLead);
    guardarLeadParcial(respuesta.lead);
    return { ok: true, respuesta };
  }
  const json = data as AsesorApiResponse;
  const lead = mergeImeiaLead(leadParcial, json.lead);
  const respuesta = withLeadDefaults({
    texto: json.texto,
    productos: (json.productos ?? []).map(p => ({
      slug: p.slug,
      nombre: p.nombre,
      imagen: p.imagen,
      urlLanding: p.url_landing,
      score: p.score,
    })),
    accionHandoff: json.accion_handoff,
    modo: json.modo,
    lead,
    fase: json.fase ?? 'descubrimiento',
    mostrarCapturaLead: Boolean(json.mostrar_captura_lead || lead.listo_para_captura),
  });
  guardarLeadParcial(respuesta.lead);
  return { ok: true, respuesta };
}

export function resolveAsesorTransport(
  hostname?: string,
  options?: {
    hasLocalOllamaUrl?: boolean;
    hasDirectImeiaUrl?: boolean;
    forceDirectImeiaInBrowser?: boolean;
  }
): AsesorTransport {
  if (shouldUseLocalOllama(hostname, options?.hasLocalOllamaUrl)) return 'local_ollama';
  if (
    shouldUseDirectImeiaInBrowser(
      hostname,
      options?.hasDirectImeiaUrl,
      options?.forceDirectImeiaInBrowser
    )
  ) {
    return 'imeia_direct';
  }
  return 'supabase';
}

function getBrowserHostname(hostname?: string): string | null {
  if (hostname) return hostname.toLowerCase();
  if (typeof window === 'undefined') return null;
  return window.location.hostname.toLowerCase();
}

function shouldUseLocalOllama(hostname?: string, hasLocalOllamaUrl = Boolean(OLLAMA_URL)): boolean {
  if (!hasLocalOllamaUrl) return false;
  const browserHostname = getBrowserHostname(hostname);
  if (!browserHostname) return false;
  return ['localhost', '127.0.0.1', '::1'].includes(browserHostname);
}

function isImeProductionHostname(hostname?: string): boolean {
  const browserHostname = getBrowserHostname(hostname);
  if (!browserHostname) return false;
  return browserHostname === 'i-me.com.co' || browserHostname === 'www.i-me.com.co';
}

function shouldUseDirectImeiaInBrowser(
  hostname?: string,
  hasDirectImeiaUrl = Boolean(IMEIA_API_URL),
  forceDirectImeiaInBrowser = FORCE_DIRECT_IMEIA_IN_BROWSER
): boolean {
  if (!hasDirectImeiaUrl) return false;
  if (isImeProductionHostname(hostname) && !forceDirectImeiaInBrowser) return false;
  return true;
}

/** Llama al endpoint IMEIA vía Nginx (preview / no producción) */
async function preguntarAsesorImeia(params: {
  mensaje: string;
  historial: MensajeAsesor[];
  locale: Locale;
  turnstileToken?: string | undefined;
  navigationContext?: AsesorNavigationContext | undefined;
  leadParcial?: Partial<ImeiaLeadSlots> | undefined;
}): Promise<RespuestaAsesor> {
  const historial = params.historial.slice(-8).map(m => ({ rol: m.rol, contenido: m.contenido }));
  const leadParcial = mergeImeiaLead(EMPTY_IMEIA_LEAD, params.leadParcial);

  const res = await fetch(`${IMEIA_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'imeia',
      messages: [
        { role: 'system', content: buildImeiaSoulPrompt(params.locale) },
        {
          role: 'system',
          content: `CONTEXTO:\n${JSON.stringify({
            navigation: params.navigationContext ?? null,
            lead_parcial: leadParcial,
            historial,
          })}`,
        },
        { role: 'user', content: params.mensaje },
      ],
      stream: false,
      temperature: 0.55,
      max_tokens: 1600,
    }),
  });

  if (!res.ok) {
    throw new Error(`IMEIA API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const parsed = parseStructuredAsesorResponse(content, params.locale);
  const productos = await cargarProductosSugeridos(parsed.productosCitados, params.locale);
  const lead = mergeImeiaLead(leadParcial, parsed.lead);
  const accionHandoff = normalizarAccionHandoff(parsed.accionHandoff, params, parsed.texto);

  return withLeadDefaults({
    texto: parsed.texto,
    productos,
    accionHandoff,
    modo: 'rag',
    lead,
    fase: parsed.fase,
    mostrarCapturaLead: lead.listo_para_captura || Boolean(accionHandoff?.tipo === 'cotizacion'),
  });
}

export function parseStructuredAsesorResponse(texto: string, _locale: Locale) {
  const parsed = parseImeiaStructuredReply(texto);
  return {
    texto: parsed.texto,
    productosCitados: parsed.productos_citados,
    accionHandoff: parsed.accion_handoff,
    lead: parsed.lead,
    fase: parsed.fase,
  };
}

function withLeadDefaults(respuesta: RespuestaAsesor): RespuestaAsesor {
  return {
    ...respuesta,
    lead: mergeImeiaLead(EMPTY_IMEIA_LEAD, respuesta.lead),
    fase: respuesta.fase || 'descubrimiento',
    mostrarCapturaLead: Boolean(respuesta.mostrarCapturaLead),
  };
}

export function obtenerLeadParcial(): ImeiaLeadSlots {
  try {
    const raw = sessionStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) return { ...EMPTY_IMEIA_LEAD };
    return mergeImeiaLead(EMPTY_IMEIA_LEAD, JSON.parse(raw) as Partial<ImeiaLeadSlots>);
  } catch {
    return { ...EMPTY_IMEIA_LEAD };
  }
}

export function guardarLeadParcial(lead: Partial<ImeiaLeadSlots> | null | undefined): void {
  try {
    const merged = mergeImeiaLead(obtenerLeadParcial(), lead);
    sessionStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export function resetLeadParcial(): void {
  try {
    sessionStorage.removeItem(LEAD_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Limpia el contenido de la conversación persistida (no la sessionId de rate-limit/métricas). */
export function resetHistorial(): void {
  try {
    sessionStorage.removeItem(HISTORIAL_STORAGE_KEY);
  } catch {
    // ignore
  }
  resetLeadParcial();
}

export function resetCatalogoPublicadoCache(): void {
  catalogoPublicadoCache.clear();
}

/**
 * Persiste el historial de la conversación actual en sessionStorage (por
 * pestaña, se pierde al cerrarla — evita que sobreviva indefinidamente como
 * localStorage). Antes esta función no existía y una recarga de página
 * perdía todo el contexto de la conversación sin aviso.
 */
export function guardarHistorial(historial: MensajeAsesor[]): void {
  try {
    const recortado = historial.slice(-MAX_HISTORIAL_MENSAJES);
    sessionStorage.setItem(HISTORIAL_STORAGE_KEY, JSON.stringify(recortado));
  } catch {
    // ignore (modo privado, cuota excedida, etc.)
  }
}

export function obtenerHistorial(): MensajeAsesor[] {
  try {
    const raw = sessionStorage.getItem(HISTORIAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      rol: 'usuario' | 'asesor';
      contenido: string;
      timestamp: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { rol: 'usuario' | 'asesor'; contenido: string; timestamp: string } =>
          !!item &&
          (item.rol === 'usuario' || item.rol === 'asesor') &&
          typeof item.contenido === 'string'
      )
      .map(item => ({
        rol: item.rol,
        contenido: item.contenido,
        timestamp: new Date(item.timestamp),
      }));
  } catch {
    return [];
  }
}

function inferHandoffType(texto: string): TipoHandoff | null {
  if (
    /\b(cotizaci[oó]n|cotizar|quote|pricing|precio|availability|disponibilidad|formulario|contact form)\b/i.test(
      texto
    )
  ) {
    return 'cotizacion';
  }
  if (/\b(whats?app|asesor comercial|sales team|hablar con|contactar)\b/i.test(texto)) {
    return 'whatsapp';
  }
  return null;
}

function buildHandoffSummary(params: { mensaje: string; historial: MensajeAsesor[] }): string {
  const turns = [...params.historial, { rol: 'usuario' as const, contenido: params.mensaje }]
    .filter(turno => turno.rol === 'usuario')
    .slice(-4)
    .map(turno => turno.contenido.trim())
    .filter(Boolean);
  return turns.join(' | ').slice(0, MAX_HANDOFF_SUMMARY_CHARS);
}

function normalizarAccionHandoff(
  accionHandoff: AccionHandoff | null,
  params: { mensaje: string; historial: MensajeAsesor[] },
  texto: string
): AccionHandoff | null {
  const tipo = accionHandoff?.tipo ?? inferHandoffType(`${params.mensaje}\n${texto}`);
  if (!tipo) return null;
  const resumen =
    accionHandoff?.resumen?.trim().slice(0, MAX_HANDOFF_SUMMARY_CHARS) ||
    buildHandoffSummary(params);
  return { tipo, resumen };
}

async function cargarProductosSugeridos(
  slugs: string[],
  locale: Locale
): Promise<ProductoSugerido[]> {
  const unicos = [...new Set(slugs.map(slug => slug.trim()).filter(Boolean))].slice(0, 4);
  if (unicos.length === 0) return [];

  const supabase = getSupabaseClient();
  if (!supabase) {
    return unicos.map((slug, index) => ({
      slug,
      nombre: slug,
      imagen: null,
      urlLanding: locale === 'en' ? `/en/products/${slug}` : `/es/productos/${slug}`,
      score: 1 - index * 0.05,
    }));
  }

  try {
    const { data, error } = await supabase
      .from('productos')
      .select('slug, nombre_es, nombre_en, imagen_principal')
      .in('slug', unicos);
    if (error || !data) return [];

    const porSlug = new Map(data.map(producto => [String(producto.slug), producto]));
    return unicos
      .filter(slug => porSlug.has(slug))
      .map((slug, index) => {
        const producto = porSlug.get(slug)!;
        return {
          slug,
          nombre:
            locale === 'en'
              ? String(producto.nombre_en ?? producto.nombre_es ?? slug)
              : String(producto.nombre_es ?? slug),
          imagen: typeof producto.imagen_principal === 'string' ? producto.imagen_principal : null,
          urlLanding: locale === 'en' ? `/en/products/${slug}` : `/es/productos/${slug}`,
          score: 1 - index * 0.05,
        };
      });
  } catch {
    return [];
  }
}

async function cargarCatalogoPublicado(locale: Locale): Promise<CatalogoPublicadoItem[]> {
  if (typeof fetch !== 'function') return [];

  let promise = catalogoPublicadoCache.get(locale);
  if (!promise) {
    promise = fetch(CATALOGO_INDEX_URL[locale], {
      headers: { Accept: 'application/json' },
    })
      .then(async response => {
        if (!response.ok) return [];
        const data = (await response.json()) as unknown;
        if (!Array.isArray(data)) return [];
        return data.filter(
          (item): item is CatalogoPublicadoItem =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as { slug?: unknown }).slug === 'string' &&
            typeof (item as { nombre?: unknown }).nombre === 'string'
        );
      })
      .catch(() => []);
    catalogoPublicadoCache.set(locale, promise);
  }

  return promise;
}

function tokenizarConsulta(texto: string): string[] {
  return normalizeSearchText(texto)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2 && !QUERY_STOPWORDS.has(token));
}

function detectarIntencionCatalogo(texto: string): {
  infusion: boolean;
  camaDomiciliaria: boolean;
} {
  const normalizado = normalizeSearchText(texto);
  return {
    infusion: /\b(infusion|bomba|bombas|jeringa|jeringas|volumetrica|microdosis|uci)\b/.test(
      normalizado
    ),
    camaDomiciliaria: /\b(cama|camas|domicilio|domiciliaria|domiciliario|homecare|bed|beds)\b/.test(
      normalizado
    ),
  };
}

function esProductoTerapiaInfusion(item: CatalogoPublicadoItem): boolean {
  const nombre = normalizeSearchText(item.nombre);
  const familia = normalizeSearchText(item.familia.nombre);
  const tipo = normalizeSearchText(item.tipo?.nombre ?? '');
  const descripcion = normalizeSearchText(item.descripcion_corta);

  return (
    familia.includes('terapia de infusion') ||
    tipo.includes('bombas de infusion') ||
    tipo.includes('bombas de jeringa') ||
    nombre.includes('bomba de infusion') ||
    nombre.includes('bomba de jeringa') ||
    nombre.includes('volumetrica') ||
    descripcion.includes('microdosis') ||
    descripcion.includes('infusion')
  );
}

function esFalsoPositivoInfusion(item: CatalogoPublicadoItem): boolean {
  const searchable = normalizeSearchText(
    [item.nombre, item.familia.nombre, item.tipo?.nombre ?? '', item.descripcion_corta].join(' ')
  );

  return (
    searchable.includes('bomba de calor') ||
    searchable.includes('cuna de calor') ||
    searchable.includes('calor radiante') ||
    searchable.includes('carro de infusion') ||
    searchable.includes('carros de infusion') ||
    searchable.includes('desinfeccion') ||
    searchable.includes('esteriliz') ||
    searchable.includes('control de infecciones') ||
    searchable.includes('mobiliario')
  );
}

function puntuarCatalogoPublicado(item: CatalogoPublicadoItem, consulta: string): number {
  const consultaNormalizada = normalizeSearchText(consulta);
  const tokens = tokenizarConsulta(consulta);
  if (!consultaNormalizada || tokens.length === 0) return 0;
  const intencion = detectarIntencionCatalogo(consulta);

  const nombre = normalizeSearchText(item.nombre);
  const familia = normalizeSearchText(item.familia.nombre);
  const tipo = normalizeSearchText(item.tipo?.nombre ?? '');
  const descripcion = normalizeSearchText(item.descripcion_corta);
  const searchable = item.texto_busqueda || [nombre, familia, tipo, descripcion].join(' ');

  let score = 0;
  if (searchable.includes(consultaNormalizada)) score += 220;

  for (const token of tokens) {
    if (nombre === token) score += 80;
    else if (nombre.includes(token)) score += 55;

    if (tipo === token) score += 60;
    else if (tipo.includes(token)) score += 40;

    if (familia === token) score += 45;
    else if (familia.includes(token)) score += 30;

    if (descripcion.includes(token)) score += 18;
    if (searchable.includes(token)) score += 12;
  }

  if (
    tokens.some(token => ['cama', 'camas', 'bed', 'beds'].includes(token)) &&
    nombre.includes('cama')
  ) {
    score += 120;
  }

  if (
    tokens.some(token =>
      ['domicilio', 'domiciliario', 'home', 'homecare', 'domiciliary'].includes(token)
    ) &&
    searchable.includes('domicili')
  ) {
    score += 160;
  }

  if (intencion.infusion) {
    const pareceTerapiaInfusion = esProductoTerapiaInfusion(item);
    const candidatoNoEquivalente = esFalsoPositivoInfusion(item);

    if (pareceTerapiaInfusion) score += 260;
    if (tokens.some(token => token === 'bomba' || token === 'bombas') && nombre.includes('bomba')) {
      score += 90;
    }
    if (consultaNormalizada.includes('infusion') && pareceTerapiaInfusion) score += 100;
    if (consultaNormalizada.includes('jeringa') && tipo.includes('jeringa')) score += 140;
    if (consultaNormalizada.includes('volumetrica') && nombre.includes('volumetrica')) score += 140;
    if (consultaNormalizada.includes('uci') && descripcion.includes('uci')) score += 90;
    if (candidatoNoEquivalente) score -= 600;
    if (!pareceTerapiaInfusion) score -= 260;
  }

  if (intencion.camaDomiciliaria) {
    const pareceCamaDomiciliaria =
      nombre.includes('cama') &&
      (nombre.includes('domicili') || tipo.includes('domicili') || descripcion.includes('casa'));
    if (pareceCamaDomiciliaria) score += 180;
  }

  return score;
}

function buscarProductosMencionadosExplicitamente(
  items: CatalogoPublicadoItem[],
  mensaje: string
): CatalogoPublicadoItem[] {
  const consultaNormalizada = ` ${normalizeSearchText(mensaje)} `;
  if (!consultaNormalizada.trim()) return [];

  return items.filter(item => {
    const slug = normalizeSearchText(item.slug);
    const nombre = normalizeSearchText(item.nombre);
    const nombreTokens = nombre.split(' ').filter(token => token.length >= 3);
    const codigos = nombreTokens.filter(token => /^(?=.*\d)[a-z0-9]{2,}$/.test(token));
    const frasesCodigo = [slug, nombre]
      .flatMap(texto => {
        const tokens = texto.split(' ').filter(Boolean);
        return tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`);
      })
      .filter(
        frase => /[a-z]/.test(frase) && /\d/.test(frase) && frase.replace(/\s+/g, '').length >= 4
      );

    if (slug && consultaNormalizada.includes(` ${slug} `)) return true;
    if (nombre && nombre.length >= 8 && consultaNormalizada.includes(` ${nombre} `)) return true;

    return (
      codigos.some(codigo => consultaNormalizada.includes(` ${codigo} `)) ||
      frasesCodigo.some(frase => consultaNormalizada.includes(` ${frase} `))
    );
  });
}

function perteneceAlMismoGrupoCatalogo(
  item: CatalogoPublicadoItem,
  productosBase: CatalogoPublicadoItem[]
): boolean {
  return productosBase.some(
    base =>
      item.slug === base.slug ||
      item.tipo?.slug === base.tipo?.slug ||
      item.familia.slug === base.familia.slug
  );
}

async function buscarCatalogoPublicado(
  mensaje: string,
  locale: Locale
): Promise<CatalogoPublicadoMatch[]> {
  const items = await cargarCatalogoPublicado(locale);
  if (items.length === 0) return [];
  const intencion = detectarIntencionCatalogo(mensaje);
  const productosExplicitos = buscarProductosMencionadosExplicitamente(items, mensaje);

  let matches = items
    .map(item => ({ item, score: puntuarCatalogoPublicado(item, mensaje) }))
    .map(match => ({
      ...match,
      score: productosExplicitos.some(producto => producto.slug === match.item.slug)
        ? match.score + 500
        : match.score,
    }))
    .filter(match => match.score >= 70)
    .sort((a, b) => b.score - a.score);

  if (productosExplicitos.length > 0) {
    matches = matches.filter(
      ({ item, score }) => score >= 110 && perteneceAlMismoGrupoCatalogo(item, productosExplicitos)
    );
  }

  if (intencion.infusion) {
    matches = matches.filter(
      ({ item, score }) =>
        score >= 120 && esProductoTerapiaInfusion(item) && !esFalsoPositivoInfusion(item)
    );
  }

  return matches.slice(0, 4).map(({ item, score }, index) => ({
    slug: item.slug,
    nombre: item.nombre,
    imagen: item.imagen_principal,
    urlLanding: locale === 'en' ? `/en/products/${item.slug}` : `/es/productos/${item.slug}`,
    score: Math.min(1, Math.max(0.55, score / 300)) - index * 0.03,
    descripcionCorta: item.descripcion_corta,
    familiaNombre: item.familia.nombre,
    tipoNombre: item.tipo?.nombre ?? null,
  }));
}

function buildCatalogoPublicadoFollowUp(locale: Locale, mensaje: string): string {
  const normalizado = normalizeSearchText(mensaje);

  if (locale === 'en') {
    if (normalizado.includes('bed') || normalizado.includes('home')) {
      return 'If you tell us whether this is for recovery at home, long-term care or reduced mobility, we can narrow down which option fits best.';
    }
    return 'If you share the intended service or use scenario, we can narrow down which of these options fits best without overcomplicating the process.';
  }

  if (normalizado.includes('cama') || normalizado.includes('domicili')) {
    return 'Si nos cuenta si la necesita para recuperación en casa, cuidado prolongado o apoyo a movilidad, le acotamos enseguida cuál encaja mejor.';
  }

  return 'Si nos comparte el entorno de uso o el servicio clínico, le afinamos cuál de estas opciones encaja mejor sin convertir esto en un cuestionario.';
}

function renderCatalogoPublicadoTexto(
  productos: CatalogoPublicadoMatch[],
  locale: Locale,
  mensaje: string
): string {
  const consultaNormalizada = normalizeSearchText(mensaje);
  const preguntaExistencia =
    /\b(tienen|tienes|hay|manejan|cuentan con|disponen de|do you have|have you got)\b/i.test(
      mensaje
    );
  const apertura =
    locale === 'en'
      ? preguntaExistencia
        ? 'Yes — from our catalog, these are the options I would put on the table first:'
        : 'Looking at your need, these are the catalog options I would start with:'
      : preguntaExistencia
        ? 'Sí — en nuestro catálogo, estas son las opciones con las que empezaría:'
        : 'Con lo que me cuenta, estas son las opciones del catálogo con las que empezaría:';

  const lineas = productos.map((producto, index) => {
    const detalle =
      producto.descripcionCorta || producto.tipoNombre || producto.familiaNombre || producto.slug;
    return `${index + 1}. **${producto.nombre}** — ${detalle}`;
  });

  const followUp =
    productos.length >= 3 && consultaNormalizada.includes('compar')
      ? locale === 'en'
        ? 'If you like, we can compare the two strongest fits and then prepare a quote with our team.'
        : 'Si le parece, comparamos las dos que mejor encajan y después preparamos una cotización con el equipo.'
      : buildCatalogoPublicadoFollowUp(locale, mensaje);

  return [apertura, '', ...lineas, '', followUp].join('\n');
}

async function buildCatalogoPublicadoFallbackResponse(params: {
  mensaje: string;
  historial: MensajeAsesor[];
  locale: Locale;
  leadParcial?: Partial<ImeiaLeadSlots> | undefined;
}): Promise<RespuestaAsesor | null> {
  const productos = await buscarCatalogoPublicado(params.mensaje, params.locale);
  if (productos.length === 0) return null;

  const texto = renderCatalogoPublicadoTexto(productos, params.locale, params.mensaje);
  const tipo = inferHandoffType(params.mensaje);
  const lead = mergeImeiaLead(
    EMPTY_IMEIA_LEAD,
    mergeImeiaLead(params.leadParcial, extractLeadHintsFromText(params.mensaje))
  );

  return withLeadDefaults({
    texto,
    productos: productos.map(
      ({ slug, nombre, imagen, urlLanding, score }): ProductoSugerido => ({
        slug,
        nombre,
        imagen,
        urlLanding,
        score,
      })
    ),
    accionHandoff: tipo
      ? normalizarAccionHandoff({ tipo, resumen: buildHandoffSummary(params) }, params, texto)
      : null,
    modo: 'keyword_degradado',
    lead: {
      ...lead,
      necesidad: lead.necesidad ?? params.mensaje.slice(0, 280),
    },
    fase: 'recomendacion',
    mostrarCapturaLead: false,
  });
}

export async function buildResilientFallbackResponse(params: {
  mensaje: string;
  historial: MensajeAsesor[];
  locale: Locale;
  leadParcial?: Partial<ImeiaLeadSlots> | undefined;
}): Promise<RespuestaAsesor> {
  const esConsultaSitio = esConsultaSitioOLegal(params.mensaje);
  if (!esConsultaSitio) {
    const catalogoFallback = await buildCatalogoPublicadoFallbackResponse(params);
    if (catalogoFallback) return catalogoFallback;
  }

  const lead = mergeImeiaLead(
    EMPTY_IMEIA_LEAD,
    mergeImeiaLead(params.leadParcial, extractLeadHintsFromText(params.mensaje))
  );

  const texto =
    buildAsesorStaticFallback(params.locale, params.mensaje) ??
    buildBiomedicalFallback([], params.locale, params.mensaje) ??
    (params.locale === 'en'
      ? 'I can help you frame this properly. Tell me the clinical service or care setting and what you need the equipment to do day to day — then we can shortlist catalog options and, when you are ready, leave your details for a formal quote.'
      : 'Puedo ayudarle a encuadrarlo bien. Cuénteme el servicio clínico o el entorno de uso y qué necesita que el equipo resuelva en el día a día; con eso acotamos el catálogo y, cuando quiera, dejamos sus datos para una cotización formal.');

  return withLeadDefaults({
    texto,
    productos: [],
    accionHandoff: esConsultaSitio
      ? null
      : normalizarAccionHandoff(
          { tipo: 'cotizacion', resumen: buildHandoffSummary(params) },
          params,
          texto
        ),
    modo: 'keyword_degradado',
    lead: {
      ...lead,
      necesidad: lead.necesidad ?? params.mensaje.slice(0, 280),
    },
    fase: 'descubrimiento',
    mostrarCapturaLead: false,
  });
}

// ── Modo local Ollama (dev sin Edge Functions) ────────────────────────────────

interface ProductoMatch {
  id: string;
  slug: string;
  nombre_es: string;
  nombre_en: string | null;
  descripcion_corta_es: string | null;
  descripcion_corta_en: string | null;
  imagen_principal: string | null;
  tipo_comercial: string;
  score: number;
}

interface ProductoDetalle {
  slug: string;
  descripcion_larga_es: string | null;
  descripcion_larga_en: string | null;
  especificaciones: Array<{ clave?: string; valor?: string; grupo?: string }> | null;
  aplicaciones_es: string[] | null;
  aplicaciones_en: string[] | null;
}

interface ArticuloMatch {
  slug: string;
  titulo_es: string;
  titulo_en: string | null;
  cuerpo_es: string | null;
  cuerpo_en: string | null;
  score: number;
}

const COMPARE_QUERY_REGEX =
  /\b(compara|comparar|comparativa|comparacion|vs|versus|diferencias?)\b/i;

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function esConsultaComparativa(texto: string): boolean {
  return COMPARE_QUERY_REGEX.test(texto);
}

async function buscarProductosPorNombreEnMensaje(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  mensaje: string
): Promise<ProductoMatch[]> {
  const mensajeNormalizado = normalizeSearchText(mensaje);
  if (!mensajeNormalizado) return [];

  const { data, error } = await supabase
    .from('productos')
    .select(
      'id, slug, nombre_es, nombre_en, descripcion_corta_es, descripcion_corta_en, imagen_principal, tipo_comercial'
    )
    .eq('activo', true);
  if (error) return [];

  return ((data ?? []) as ProductoMatch[])
    .map(producto => {
      const nombres = [producto.nombre_es, producto.nombre_en ?? '']
        .map(nombre => normalizeSearchText(nombre))
        .filter(Boolean);
      let score = 0;
      for (const nombre of nombres) {
        if (nombre.length >= 8 && mensajeNormalizado.includes(nombre)) {
          score = Math.max(score, 1);
          continue;
        }

        const mensajeTokens = mensajeNormalizado.split(' ').filter(token => token.length > 2);
        const nombreTokens = nombre.split(' ').filter(token => token.length > 2);
        const overlap = nombreTokens.filter(token => mensajeTokens.includes(token)).length;
        if (overlap >= 2) score = Math.max(score, overlap / Math.max(1, nombreTokens.length));
      }

      return score >= 0.6 ? { ...producto, score: Math.max(producto.score ?? 0, score) } : null;
    })
    .filter((producto): producto is ProductoMatch => Boolean(producto))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function buildAsesorSystemPrompt(locale: Locale = 'es'): string {
  return `${buildImeiaSoulPrompt(locale)}

REGLA LOCAL (Ollama): usa exclusivamente la BASE DE CONOCIMIENTO DEL SITIO, ARTICULOS RELACIONADOS y CONTEXTO RECUPERADO que te pasan en el mensaje de usuario. No inventes productos fuera de ese contexto.
/no_think`;
}

function buildAsesorUserPrompt(params: {
  mensaje: string;
  historial: MensajeAsesor[];
  locale: Locale;
  contexto: Array<{
    slug: string;
    nombre: string;
    descripcion_corta: string;
    descripcion_larga: string;
    tipo_comercial: string;
    especificaciones: Array<{ clave?: string; valor?: string; grupo?: string }>;
    aplicaciones: string[];
  }>;
  articulos?: Array<{ slug: string; titulo: string; cuerpo: string }>;
}): string {
  const historialTexto = params.historial.length
    ? params.historial
        .slice(-8)
        .map(m => `${m.rol}: ${m.contenido}`)
        .join('\n')
    : '(sin historial previo)';

  const articulosTexto = params.articulos?.length
    ? `\nARTICULOS RELACIONADOS:\n${params.articulos.map(a => `[${a.titulo}]\n${a.cuerpo.slice(0, 800)}`).join('\n\n')}`
    : '\nARTICULOS RELACIONADOS:\n(sin articulos recuperados)';

  return `IDIOMA DEL USUARIO: ${params.locale}

BASE DE CONOCIMIENTO DEL SITIO:
${getAsesorKnowledgeBase(params.locale)}

CONTEXTO RECUPERADO (productos reales del catalogo):
${JSON.stringify(params.contexto)}
${articulosTexto}

HISTORIAL RECIENTE:
${historialTexto}

MENSAJE DEL USUARIO:
${params.mensaje}`;
}

function buildFallbackTexto(
  contexto: Array<{
    slug: string;
    nombre: string;
    descripcion_corta: string;
    descripcion_larga: string;
    tipo_comercial: string;
    especificaciones: Array<{ clave?: string; valor?: string; grupo?: string }>;
    aplicaciones: string[];
  }>,
  locale: Locale,
  modo: ModoAsesor,
  consultaSitioOLegal: boolean,
  textoConsulta: string
): string {
  const staticFallback = consultaSitioOLegal
    ? buildAsesorStaticFallback(locale, textoConsulta)
    : null;
  const biomedicalFallback = buildBiomedicalFallback(contexto, locale, textoConsulta);
  const consultaComparativa = esConsultaComparativa(textoConsulta);

  if (biomedicalFallback && (!contexto.length || modo === 'sin_resultados')) {
    return biomedicalFallback;
  }

  if (modo === 'sin_resultados') {
    if (staticFallback) return staticFallback;
    return locale === 'en'
      ? 'I do not have enough product context to make a catalog recommendation, but I can still help qualify the technical need. Tell me the clinical service, expected workload, patient profile, infrastructure constraints and whether you need regulatory documentation for Colombia.'
      : 'No tengo suficiente contexto de producto para recomendar una referencia concreta, pero sí puedo ayudarte a cualificar la necesidad técnica. Indícame servicio clínico, volumen de uso, perfil de pacientes, restricciones de infraestructura y si necesitas soporte documental para Colombia.';
  }

  if (staticFallback && !contexto.length) return staticFallback;

  if (consultaComparativa && contexto.length >= 2) {
    const comparados = contexto.slice(0, 2);
    if (locale === 'en') {
      return [
        'With the currently available catalog context, I can compare these products at a descriptive level:',
        ...comparados.map(
          (producto, index) =>
            `${index + 1}. **${producto.nombre}** — ${producto.descripcion_corta || producto.descripcion_larga || 'No additional published description is available.'}`
        ),
        'For exact technical specifications, pricing, availability or a formal recommendation, please contact us on WhatsApp or request a quote.',
      ].join('\n');
    }

    return [
      'Con el contexto de catálogo disponible, puedo compararlos a nivel descriptivo:',
      ...comparados.map(
        (producto, index) =>
          `${index + 1}. **${producto.nombre}** — ${producto.descripcion_corta || producto.descripcion_larga || 'No hay una descripción adicional publicada disponible.'}`
      ),
      'Para especificaciones técnicas exactas, precio, disponibilidad o una recomendación formal, contáctanos por WhatsApp o solicita una cotización.',
    ].join('\n');
  }

  const top = contexto.slice(0, 3);
  if (!top.length) {
    return locale === 'en'
      ? 'Please contact us on WhatsApp for personalized advice.'
      : 'Contáctanos por WhatsApp para asesoría personalizada.';
  }

  const partes: string[] = [];
  if (locale === 'en') {
    partes.push(`Here are the catalog products that best match your request:\n`);
    top.forEach((p, i) => {
      partes.push(`${i + 1}. **${p.nombre}** — ${p.descripcion_corta}`);
      if (p.aplicaciones.length)
        partes.push(`   Applications: ${p.aplicaciones.slice(0, 3).join(', ')}.`);
      if (p.especificaciones.length) {
        const specs = p.especificaciones
          .slice(0, 3)
          .map(s => `${s.clave}: ${s.valor}`)
          .join(' · ');
        if (specs) partes.push(`   Specs: ${specs}.`);
      }
    });
    partes.push(
      `\nFor pricing, availability or a formal comparison, please contact us on WhatsApp or request a quote.`
    );
  } else {
    partes.push(`Estos son los productos del catálogo que mejor se ajustan a tu consulta:\n`);
    top.forEach((p, i) => {
      partes.push(`${i + 1}. **${p.nombre}** — ${p.descripcion_corta}`);
      if (p.aplicaciones.length)
        partes.push(`   Aplicaciones: ${p.aplicaciones.slice(0, 3).join(', ')}.`);
      if (p.especificaciones.length) {
        const specs = p.especificaciones
          .slice(0, 3)
          .map(s => `${s.clave}: ${s.valor}`)
          .filter(Boolean)
          .join(' · ');
        if (specs) partes.push(`   Especificaciones: ${specs}.`);
      }
    });
    partes.push(
      `\nPara precios, disponibilidad o una comparativa formal, contáctanos por WhatsApp o solicita una cotización.`
    );
  }
  return partes.join('\n');
}

export function buildBiomedicalFallback(
  contexto: Array<{
    nombre: string;
    descripcion_corta: string;
    descripcion_larga: string;
    especificaciones: Array<{ clave?: string; valor?: string; grupo?: string }>;
    aplicaciones: string[];
  }>,
  locale: Locale,
  textoConsulta: string
): string | null {
  const text = normalizeSearchText(textoConsulta);
  const has = (...terms: string[]) => terms.some(term => text.includes(normalizeSearchText(term)));

  if (locale === 'en') return null;

  if (has('invima', 'importar', 'registro sanitario', 'clasificacion')) {
    return [
      'Para importar o comercializar un equipo biomédico en Colombia, lo primero es confirmar **clasificación de riesgo INVIMA** y uso previsto del producto. En términos prácticos debes validar: registro sanitario o permiso aplicable, documentación del fabricante, ficha técnica, certificado de libre venta o equivalente, soporte de calidad, rotulado/manuales en español cuando aplique, trazabilidad del lote o serie y responsable de tecnovigilancia.',
      'Para un **monitor multiparamétrico**, normalmente se trata como dispositivo de riesgo moderado y la validación final depende de la referencia, accesorios, software, módulos y documentación vigente.',
      'Antes de comprar o importar, pide a I-ME o al fabricante: referencia exacta, país de origen, certificados vigentes, declaración de conformidad, manual técnico, accesorios incluidos, garantía, plan de mantenimiento y soporte local.',
    ].join('\n\n');
  }

  if (has('bomba') && has('volumetrica', 'jeringa', 'uci', 'infusion')) {
    return [
      'En UCI, una **bomba volumétrica** y una **bomba de jeringa** no reemplazan la misma necesidad. La volumétrica se usa para administrar volúmenes mayores y terapias continuas como hidratación, antibióticos o nutrición enteral/parenteral según protocolo institucional. La bomba de jeringa se usa cuando necesitas **microdosis precisas**, fármacos de alto riesgo, sedación, vasoactivos o medicamentos donde pequeños cambios de flujo importan.',
      'Para dimensionar una UCI de 10 camas, no basta contar camas: hay que estimar simultaneidad de terapias, criticidad del paciente, alarmas, biblioteca de medicamentos, batería, consumibles, compatibilidad de jeringas/equipos de infusión, mantenimiento preventivo y disponibilidad de repuestos.',
      'Como regla operativa, conviene levantar un inventario por cama: cuántas líneas IV promedio, cuántas drogas vasoactivas, cuántos turnos con sedación y qué protocolos de seguridad de medicación exige la institución.',
    ].join('\n\n');
  }

  if (has('ecografo', 'ecografo portatil', 'ultrasonido', 'dicom')) {
    return [
      'Para cotizar un **ecógrafo portátil con DICOM**, necesito cualificar el caso antes de recomendar referencia: servicio clínico (urgencias, UCI, gineco-obstetricia, vascular, anestesia, POCUS), tipos de estudio, volumen diario, transductores requeridos, necesidad de batería, conectividad WiFi/LAN, integración DICOM/PACS/HIS y nivel de portabilidad esperado.',
      'También hay que validar documentación regulatoria para Colombia, garantía, capacitación, disponibilidad de transductores y costo total de propiedad. En ecografía, el error típico es comprar el equipo base sin asegurar los transductores correctos; esos accesorios pueden definir si el equipo sirve o no para el flujo clínico.',
      'Si me das servicio clínico, ciudad, presupuesto orientativo y estudios principales, puedo ayudarte a estructurar una solicitud de cotización precisa.',
    ].join('\n\n');
  }

  if (has('monitor') && has('triage', 'urgencias', 'observacion', 'uci', 'multiparametrico')) {
    if (has('comparame', 'compara', 'comparar', 'basico', 'avanzado')) {
      return [
        'Un **monitor multiparamétrico básico** suele ser suficiente para observación, hospitalización o triage cuando necesitas constantes principales: ECG, SpO2, presión no invasiva, frecuencia respiratoria y temperatura. Lo crítico ahí es facilidad de uso, alarmas claras, batería, portabilidad y mantenimiento simple.',
        'Un **monitor de UCI avanzado** debe soportar pacientes críticos: más módulos, mejor gestión de alarmas, tendencias, conectividad a central de monitoreo, posibilidad de capnografía/EtCO2, presión invasiva u otros parámetros según protocolo. La diferencia no es solo “más funciones”; es continuidad de monitoreo, integración y seguridad operativa en pacientes inestables.',
        'Para decidir, dime si el uso será triage/observación o UCI, número de camas, si habrá monitor central, edad de pacientes y parámetros obligatorios.',
      ].join('\n\n');
    }

    return [
      'Para triage y observación en urgencias, yo miraría primero **robustez operativa**, no solo cantidad de parámetros. Mínimo: ECG, SpO2, NIBP, frecuencia respiratoria, temperatura, alarmas configurables, batería, pantalla legible, accesorios adulto/pediátrico y facilidad de limpieza entre pacientes.',
      'Si el flujo tiene pacientes inestables, traslados internos o alta rotación, pesan mucho la portabilidad, autonomía de batería, rapidez de toma de presión, tolerancia a movimiento en SpO2, disponibilidad de consumibles y soporte técnico local.',
      'Si nos comparte el volumen diario aproximado, si será triage puro u observación prolongada y si necesita integración o soporte documental INVIMA, le acotamos la referencia más adecuada sin hacerle perder tiempo.',
    ].join('\n\n');
  }

  if (has('cotizar', 'cotizacion', 'ips', 'hospital', 'clinica')) {
    const nombres = contexto
      .slice(0, 3)
      .map(producto => producto.nombre)
      .filter(Boolean);
    return [
      'Para una cotización institucional útil necesito estos datos: tipo de institución, ciudad, servicio clínico, uso previsto, volumen estimado, cantidad requerida, infraestructura disponible, accesorios/consumibles necesarios, requisitos de instalación, capacitación, garantía, mantenimiento y documentos regulatorios exigidos.',
      nombres.length
        ? `Con lo recuperado, podríamos revisar estas opciones del catálogo: **${nombres.join('**, **')}**.`
        : 'Si aún no hay una referencia definida, primero conviene cerrar especificaciones mínimas y luego comparar opciones reales del catálogo.',
      'Si nos comparte ese contexto en una sola respuesta, lo convertimos en una solicitud técnica útil para cotizar bien desde el inicio.',
    ].join('\n\n');
  }

  return null;
}

async function preguntarAsesorLocal(params: {
  mensaje: string;
  historial: MensajeAsesor[];
  locale: Locale;
}): Promise<RespuestaAsesor> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('no_disponible');

  const textoConsulta = [
    ...params.historial
      .filter(m => m.rol === 'usuario')
      .slice(-2)
      .map(m => m.contenido),
    params.mensaje,
  ]
    .join('\n')
    .slice(0, 2000);
  const consultaSitioOLegal = esConsultaSitioOLegal(params.mensaje);
  const consultaComparativa = esConsultaComparativa(params.mensaje);

  let productos: ProductoMatch[] = [];
  let articulos: ArticuloMatch[] = [];
  let modo: ModoAsesor = 'keyword_degradado';
  let vector: number[] | null = null;

  // 1. Embedding vectorial con Ollama
  try {
    const embedRes = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, input: [textoConsulta] }),
    });
    if (embedRes.ok) {
      const embedJson = (await embedRes.json()) as { embeddings?: number[][] };
      vector = embedJson.embeddings?.[0] ?? null;
    }
  } catch {
    /* continúa sin vector */
  }

  // 2. Búsqueda vectorial de productos
  if (vector?.length) {
    try {
      const { data } = await supabase.rpc('match_productos', {
        query_embedding: vector,
        match_count: 5,
        filtro: null,
      });
      if (Array.isArray(data) && data.length > 0) {
        productos = data as ProductoMatch[];
        modo = 'rag';
      }
    } catch {
      /* keyword fallback */
    }
  }

  // 3. Búsqueda vectorial de artículos (en paralelo con productos)
  if (vector?.length) {
    try {
      const { data } = await supabase.rpc('match_articulos', {
        query_embedding: vector,
        match_count: 2,
      });
      articulos = (Array.isArray(data) ? data : []) as ArticuloMatch[];
    } catch {
      /* articulos sin embeddings aún, intenta keyword */
      try {
        const { data } = await supabase.rpc('buscar_articulos_keyword', {
          query_text: params.mensaje,
          match_count: 2,
        });
        articulos = (Array.isArray(data) ? data : []) as ArticuloMatch[];
      } catch {
        /* ignore */
      }
    }
  }

  // 4. Fallback keyword para productos
  if (!productos.length) {
    const { data } = await supabase.rpc('buscar_productos_keyword', {
      query_text: params.mensaje,
      match_count: 5,
      filtro: null,
    });
    productos = (Array.isArray(data) ? data : []) as ProductoMatch[];
  }

  if (!productos.length || (consultaComparativa && productos.length < 2)) {
    const directos = await buscarProductosPorNombreEnMensaje(supabase, params.mensaje);
    if (directos.length) {
      const merged = new Map(productos.map(producto => [producto.slug, producto]));
      for (const producto of directos) merged.set(producto.slug, producto);
      productos = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 6);
      if (productos.length) modo = 'keyword_degradado';
    }
  }

  if (!articulos.length && consultaSitioOLegal) {
    try {
      const { data } = await supabase.rpc('buscar_articulos_keyword', {
        query_text: params.mensaje,
        match_count: 2,
      });
      articulos = (Array.isArray(data) ? data : []) as ArticuloMatch[];
    } catch {
      /* ignore */
    }
  }

  if (!productos.length && !articulos.length && !consultaSitioOLegal) modo = 'sin_resultados';

  // 5. Fetch detalles completos de los productos encontrados
  let detalles: ProductoDetalle[] = [];
  if (productos.length) {
    try {
      const { data } = await supabase
        .from('productos')
        .select(
          'slug, descripcion_larga_es, descripcion_larga_en, especificaciones, aplicaciones_es, aplicaciones_en'
        )
        .in(
          'slug',
          productos.map(p => p.slug)
        );
      detalles = (data ?? []) as ProductoDetalle[];
    } catch {
      /* contexto parcial, continúa */
    }
  }
  const detalleMap = new Map(detalles.map(d => [d.slug, d]));

  // 6. Contexto enriquecido para el LLM
  const contexto = productos.map(p => {
    const d = detalleMap.get(p.slug);
    const descLarga = d
      ? ((params.locale === 'en'
          ? d.descripcion_larga_en || d.descripcion_larga_es
          : d.descripcion_larga_es) ?? '')
      : '';
    return {
      slug: p.slug,
      nombre: params.locale === 'en' ? p.nombre_en || p.nombre_es : p.nombre_es,
      descripcion_corta:
        params.locale === 'en'
          ? p.descripcion_corta_en || p.descripcion_corta_es || ''
          : p.descripcion_corta_es || '',
      descripcion_larga: descLarga.slice(0, 300),
      tipo_comercial: p.tipo_comercial,
      especificaciones: (d?.especificaciones ?? []).slice(0, 12),
      aplicaciones: (d
        ? ((params.locale === 'en' ? d.aplicaciones_en || d.aplicaciones_es : d.aplicaciones_es) ??
          [])
        : []
      ).slice(0, 6),
    };
  });

  const articulosCtx = articulos.map(a => ({
    slug: a.slug,
    titulo: (params.locale === 'en' ? a.titulo_en || a.titulo_es : a.titulo_es) ?? '',
    cuerpo: ((params.locale === 'en' ? a.cuerpo_en || a.cuerpo_es : a.cuerpo_es) ?? '').slice(
      0,
      1200
    ),
  }));

  const toTarjeta = (p: ProductoMatch): ProductoSugerido => ({
    slug: p.slug,
    nombre: params.locale === 'en' ? p.nombre_en || p.nombre_es : p.nombre_es,
    imagen: p.imagen_principal,
    urlLanding: params.locale === 'en' ? `/en/products/${p.slug}` : `/es/productos/${p.slug}`,
    score: p.score,
  });

  const textoFallback = buildFallbackTexto(
    contexto,
    params.locale,
    modo,
    consultaSitioOLegal,
    params.mensaje
  );

  // 7. Chat con Ollama (timeout extendido porque los modelos locales en CPU pueden tardar)
  const abortCtrl = new AbortController();
  const abortTimer = setTimeout(() => abortCtrl.abort(), 25_000);
  try {
    const chatRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortCtrl.signal,
      body: JSON.stringify({
        model: OLLAMA_CHAT_MODEL,
        messages: [
          { role: 'system', content: buildAsesorSystemPrompt(params.locale) },
          {
            role: 'user',
            content: buildAsesorUserPrompt({
              mensaje: params.mensaje,
              historial: params.historial,
              locale: params.locale,
              contexto,
              articulos: articulosCtx,
            }),
          },
        ],
        stream: false,
        options: { temperature: 0.55, num_predict: 700, num_ctx: 4096 },
      }),
    });
    if (chatRes.ok) {
      const chatJson = (await chatRes.json()) as { message?: { content?: string } };
      const content = stripThink(chatJson.message?.content ?? '');
      const slugsSet = new Set(productos.map(p => p.slug));
      const structured = parseImeiaStructuredReply(content);
      const productosCitados = structured.productos_citados.filter(s => slugsSet.has(s));
      const citados = productos.filter(p => productosCitados.includes(p.slug));
      const lead = mergeImeiaLead(
        EMPTY_IMEIA_LEAD,
        mergeImeiaLead(
          (params as { leadParcial?: Partial<ImeiaLeadSlots> }).leadParcial,
          structured.lead
        )
      );
      return withLeadDefaults({
        texto: structured.texto,
        productos: (citados.length ? citados : productos.slice(0, 3)).map(toTarjeta),
        accionHandoff: structured.accion_handoff,
        modo,
        lead: {
          ...lead,
          necesidad: lead.necesidad ?? params.mensaje.slice(0, 280),
        },
        fase: structured.fase,
        mostrarCapturaLead: lead.listo_para_captura,
      });
    }
  } catch {
    /* degraded — timeout o error de red */
  } finally {
    clearTimeout(abortTimer);
  }

  const leadFallback = mergeImeiaLead(
    EMPTY_IMEIA_LEAD,
    (params as { leadParcial?: Partial<ImeiaLeadSlots> }).leadParcial
  );
  return withLeadDefaults({
    texto: textoFallback,
    productos: productos.slice(0, 3).map(toTarjeta),
    accionHandoff:
      consultaSitioOLegal && productos.length === 0
        ? null
        : { tipo: 'cotizacion', resumen: params.mensaje.slice(0, 280) },
    modo:
      consultaSitioOLegal && productos.length === 0
        ? 'rag'
        : modo === 'rag'
          ? 'keyword_degradado'
          : modo,
    lead: {
      ...leadFallback,
      necesidad: leadFallback.necesidad ?? params.mensaje.slice(0, 280),
    },
    fase: 'descubrimiento',
    mostrarCapturaLead: false,
  });
}

export interface AsesorModule {
  preguntarAsesor: (params: {
    mensaje: string;
    historial: MensajeAsesor[];
    locale: Locale;
    turnstileToken?: string;
  }) => Promise<ResultadoAsesor>;
  resetHistorial: () => void;
  obtenerHistorial: () => MensajeAsesor[];
}
