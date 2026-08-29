/**
 * Capa de datos intercambiable.
 * Si hay env Supabase configurado: usa Supabase.
 * Si no: usa mocks JSON locales de F0.
 *
 * BLOQUEANTE_BACKEND: Supabase real en F2.
 */

import type { Locale } from '../i18n/utils';
import { emitAnalyticsEvent } from './analytics';
import { captureCommercialAttribution, type CommercialAttribution } from './commercial-attribution';
import { isSupabaseConfigured, getSupabaseClient } from './supabase';
import { resolveFamiliaIcono } from './familias';
import { resolveMarca } from './producto-origen';

import mockFamilias from '../data/mock-familias.json';
import mockArticulos from '../data/mock-articulos.json';
import { sanitizeArticuloSlug, isValidArticuloSlug } from './articulo-slug';
import mockProductos from '../data/mock-productos.json';
import mockTipos from '../data/mock-tipos.json';
import productImageManifest from '../data/product-image-manifest.json';

let supabaseDeshabilitadoPorError = false;
type RawRow = Record<string, unknown>;
const REQUIRE_LIVE_DATA = import.meta.env['REQUIRE_LIVE_DATA'] === 'true';

/**
 * Correcciones editoriales verificadas contra nombre, descripción y referencia
 * oficial disponible en catálogo. Mantener sincronizado con migración
 * 20260828010000_correct_product_families.sql.
 */
export const PRODUCT_FAMILY_CORRECTIONS: Readonly<Record<string, string>> = {
  'lampara-cielitica-led-x36': 'sala-cirugia',
  'lampara-cielitica-led-x3618-con-satelite': 'sala-cirugia',
  'lampara-cielitica-led-x3636-con-satelite': 'sala-cirugia',
  'led-x18-100k': 'sala-cirugia',
  'ventilador-mecanico-crius-v6': 'ventiladores',
  'ventilador-para-uci-v-1000': 'ventiladores',
  'ventilador-neonatal-pedriatrico-convencional-ref-6000-sle': 'ventiladores',
  'ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-teo-air-liquide': 'ventiladores',
  'ventilador-neonatal-pediatrico-alta-frecuencia-plus-convencional-ref-6000-sle': 'ventiladores',
  'ventilador-mecanico-neonatal-pediatrico-adulto-ref-tv-100-bio-med': 'ventiladores',
  'ventilador-neonatal-no-invasivo-ref-nc3-medin': 'ventiladores',
  'ventilador-mecanico-de-transporte-monnal-ref-t60-advanced-air-liquide': 'ventiladores',
  'ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide': 'ventiladores',
  'ventilador-mecanico-de-transporte-monnal-ref-t60-air-liquide': 'ventiladores',
  'ventilador-mecanico-uci-adulto-pediatrico': 'ventiladores',
  'monitor-modular-multiparametro-virgo': 'monitores',
  'monitor-multiparametrico-basico': 'monitores',
  'monitor-multiparametrico-uci-avanzado': 'monitores',
  'monitor-multiparametro-acuarius': 'monitores',
  'monitor-multiparametro-gemini': 'monitores',
  'monitor-multiparametro-pisces': 'monitores',
  'monitor-multiparametro-taurus': 'monitores',
  'monitor-multiparametro-venus': 'monitores',
  'electrocardiografo-ref-sk-em103-saikang': 'cardiologia',
  'monitor-de-paciente-ref-sk-em005-saikang': 'monitores',
  'monitor-fetal-ref-sk-em006-saikang': 'neonatologia',
  'carro-clinico-ref-skr-r10-saikang': 'mobiliario',
  'mesa-quirurgica-electrica-ref-skl-c-saikang': 'sala-cirugia',
  'mesa-quirurgica-electrica-ref-skl-d-saikang': 'sala-cirugia',
  'g-des-kbe1462ff-m23-d': 'insumos-accesorios',
  'g-desde-kbe1462ff-m23-d': 'insumos-accesorios',
  'g-kbe1432rf-mp23l-llt': 'insumos-accesorios',
  'g-kbe1462-fr': 'insumos-accesorios',
  'g-kbe1462ff-m23d-a': 'insumos-accesorios',
  'g-kbe1462ff-m23d-rp': 'insumos-accesorios',
  'g-kbe1462re-p23l-rp': 'insumos-accesorios',
  'g-kbo1432rf-mp23-fr': 'insumos-accesorios',
  'g-kbo1432rf-mp23-rp': 'insumos-accesorios',
  'g-srels-lt': 'insumos-accesorios',
  'g-srels-pad': 'insumos-accesorios',
  'g-srels-rpe': 'insumos-accesorios',
  'g-srels-rpr': 'insumos-accesorios',
  'skb-1a-skb2a10': 'emergencias-traslado-inmovilizacion',
  'skb-2a-skb2a11': 'emergencias-traslado-inmovilizacion',
  'skb-4a-skb2a12': 'emergencias-traslado-inmovilizacion',
};

export function correctedFamilySlug(productSlug: string, currentFamilySlug: string): string {
  return PRODUCT_FAMILY_CORRECTIONS[productSlug] ?? currentFamilySlug;
}

function debeUsarSupabase(): boolean {
  return isSupabaseConfigured() && !supabaseDeshabilitadoPorError;
}

function registrarErrorSupabase(scope: string, error: { message?: string } | null): void {
  supabaseDeshabilitadoPorError = true;
  if (REQUIRE_LIVE_DATA) {
    throw new Error(
      `[datos] Build estricto: Supabase ${scope} falló: ${error?.message ?? 'error desconocido'}`
    );
  }
  console.error(
    `[datos] Supabase ${scope} error, falling back to mock:`,
    error?.message ?? 'error desconocido'
  );
}

function registrarVacioSupabase(scope: string): void {
  if (REQUIRE_LIVE_DATA) {
    throw new Error(`[datos] Build estricto: Supabase ${scope} devolvió 0 filas`);
  }
  console.warn(`[datos] Supabase ${scope} devolvió 0 filas, usando mock como respaldo`);
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function publicImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const src = value.trim();
  if (!src) return null;
  if (src.startsWith('public/')) return `/${src.replace(/^public\//, '')}`;
  if (src.startsWith('assets/')) return `/${src}`;
  if (src.startsWith('/77/assets/')) return src.replace('/77/assets/', '/assets/');
  if (src.startsWith('https://i-me.com.co/77/assets/')) {
    return src.replace('https://i-me.com.co/77/assets/', '/assets/');
  }
  if (/^Img\d+\.(jpg|jpeg|png|webp)$/i.test(src)) return `/assets/img/portfolio/${src}`;
  if (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://')) return src;
  return null;
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}

function localProductImage(slug: unknown): string | null {
  if (typeof slug !== 'string') return null;
  const aliases: Record<string, string> = {
    'sk-c1-v2k': 'sk-c1',
    'sk-c1-r00': 'sk-c1-r000w',
    'led-rx18': 'led-rx18-100k',
    'led-rx36-160k': 'led-rx36',
    ske001: 'ske001-19',
  };
  const manifest = productImageManifest as Record<string, string>;
  return manifest[slug] ?? manifest[aliases[slug]] ?? null;
}

const ROBOT_IMPORT_GALLERY_COUNT: Record<string, number> = {
  'padbot-x3-robot-recepcion': 2,
  'padbot-x2-robot-servicio-interactivo': 2,
  'padbot-p2-robot-telepresencia': 2,
  'padbot-w2-robot-delivery-institucional': 2,
  'padbot-w3s-robot-delivery-alimentos': 2,
  'c3-robot-limpieza-autonoma': 2,
  'padbot-t2-robot-educativo-social': 2,
  'cruzr-robot-comercial-inteligente-ahuman-future': 1,
};

const ROBOT_MEDIA_SEO_SLUG: Record<string, string> = {
  'cruzr-robot-comercial-inteligente-ahuman-future':
    'robot-asistencial-recepcion-hospitalaria-cruzr-ahuman-future',
  'padbot-x3-robot-recepcion': 'robot-asistencial-recepcion-clinicas-hospitales-padbot-x3',
  'padbot-x2-robot-servicio-interactivo':
    'robot-asistencial-servicio-interactivo-clinicas-hospitales-padbot-x2',
  'padbot-p2-robot-telepresencia': 'robot-telepresencia-telemedicina-tercera-edad-padbot-p2',
  'padbot-w2-robot-delivery-institucional':
    'robot-delivery-hospitalario-industrial-logistica-padbot-w2',
  'padbot-w3s-robot-delivery-alimentos':
    'robot-delivery-alimentos-restaurantes-hospitales-padbot-w3s',
  'c3-robot-limpieza-autonoma': 'robot-limpieza-industrial-hospitalaria-autonoma-c3',
  'padbot-t2-robot-educativo-social': 'robot-educativo-social-tercera-edad-padbot-t2',
};

function robotImportedAssetPath(slug: unknown, filename: string): string | null {
  if (typeof slug !== 'string' || !(slug in ROBOT_IMPORT_GALLERY_COUNT)) return null;
  return `/assets/productos/importados/${slug}/${filename}`;
}

function robotMediaFilename(
  slug: string,
  role: 'robot-producto' | 'robot-galeria',
  index?: number
): string {
  const seoSlug = ROBOT_MEDIA_SEO_SLUG[slug] ?? slug;
  const suffix = typeof index === 'number' ? `-${String(index).padStart(2, '0')}` : '';
  return `${role}-${seoSlug}${suffix}.webp`;
}

function robotImportedMainImage(slug: unknown): string | null {
  if (typeof slug !== 'string' || !(slug in ROBOT_IMPORT_GALLERY_COUNT)) return null;
  return robotImportedAssetPath(slug, robotMediaFilename(slug, 'robot-producto'));
}

function robotImportedGallery(slug: unknown): string[] | null {
  if (typeof slug !== 'string' || !(slug in ROBOT_IMPORT_GALLERY_COUNT)) return null;
  const main = robotImportedMainImage(slug);
  if (!main) return null;
  const count = ROBOT_IMPORT_GALLERY_COUNT[slug];
  return [
    main,
    ...Array.from(
      { length: count },
      (_, index) =>
        `/assets/productos/importados/${slug}/${robotMediaFilename(slug, 'robot-galeria', index + 2)}`
    ),
  ];
}

function robotImportedPdf(slug: unknown, value: unknown): string | null {
  if (typeof slug !== 'string' || !(slug in ROBOT_IMPORT_GALLERY_COUNT)) return publicImage(value);
  if (typeof value === 'string' && value.trim()) {
    const filename = value.split('/').pop();
    if (filename) return `/assets/productos/importados/${slug}/${filename}`;
  }
  return null;
}

// Cache de mapeo familia_id <-> familia_slug, resuelto vía Supabase (productos.familia_id
// es FK a familias.id; no existe columna familia_slug en la tabla productos).
let familiaIdPorSlug: Record<string, string> | null = null;
let familiaSlugPorId: Record<string, string> | null = null;

async function cargarMapaFamilias(supabase: ReturnType<typeof getSupabaseClient>): Promise<void> {
  if (familiaIdPorSlug && familiaSlugPorId) return;
  const { data, error } = await supabase!.from('familias').select('id, slug');
  if (!error && data && data.length > 0) {
    familiaIdPorSlug = {};
    familiaSlugPorId = {};
    for (const f of data as { id: string; slug: string }[]) {
      familiaIdPorSlug[f.slug] = f.id;
      familiaSlugPorId[f.id] = f.slug;
    }
  }
}

/**
 * Resuelve la marca de un producto desde Supabase, usando fallback desde atributos.
 * Función pura sin dependencias en caché global.
 */
export function resolveMarcaSupabase(raw: {
  marca?: unknown;
  atributos?: { marca?: unknown; fabricante?: unknown };
}): string | null {
  return resolveMarca(raw);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductoSupabase(raw: any, locale: Locale): Producto {
  const originalFamilySlug = familiaSlugPorId?.[raw.familia_id] ?? '';
  const familySlug = correctedFamilySlug(raw.slug, originalFamilySlug);
  const familyWasCorrected = familySlug !== originalFamilySlug;
  return {
    id: raw.id,
    slug: raw.slug,
    familia_id: familyWasCorrected
      ? (familiaIdPorSlug?.[familySlug] ?? raw.familia_id)
      : raw.familia_id,
    familia_slug: familySlug,
    tipo_id: familyWasCorrected ? null : raw.tipo_id,
    nombre: locale === 'en' ? raw.nombre_en : raw.nombre_es,
    descripcion_corta: locale === 'en' ? raw.descripcion_corta_en : raw.descripcion_corta_es,
    descripcion_larga: locale === 'en' ? raw.descripcion_larga_en : raw.descripcion_larga_es,
    especificaciones: raw.especificaciones ?? [],
    aplicaciones: (locale === 'en' ? raw.aplicaciones_en : raw.aplicaciones_es) ?? [],
    beneficios:
      (locale === 'en' ? raw.atributos?.beneficios_en : raw.atributos?.beneficios_es) ?? [],
    valor: (locale === 'en' ? raw.atributos?.valor_en : raw.atributos?.valor_es) ?? null,
    preguntas_frecuentes:
      (locale === 'en'
        ? raw.atributos?.preguntas_frecuentes_en
        : raw.atributos?.preguntas_frecuentes_es) ?? [],
    seo_keywords:
      (locale === 'en' ? raw.atributos?.seo_keywords_en : raw.atributos?.seo_keywords_es) ?? [],
    marca: resolveMarcaSupabase(raw),
    imagen_principal:
      robotImportedMainImage(raw.slug) ??
      localProductImage(raw.slug) ??
      publicImage(raw.imagen_principal),
    galeria:
      robotImportedGallery(raw.slug) ??
      (Array.isArray(raw.galeria) ? raw.galeria.map(publicImage).filter(isString) : []),
    ficha_pdf: robotImportedPdf(raw.slug, raw.ficha_pdf),
    tipo_comercial: raw.tipo_comercial,
    fulfillment_mode: raw.fulfillment_mode,
    precio: raw.precio,
    moneda: raw.moneda,
    sku: typeof raw.sku === 'string' ? raw.sku : null,
    stock: raw.stock ?? null,
    disponible: raw.disponible ?? true,
    destacado: raw.destacado,
    nuevo: raw.nuevo,
    activo: raw.activo,
    orden: raw.orden,
  };
}

/* ============================================================
   Tipos
   ============================================================ */

export interface Familia {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  icono?: string;
  orden: number;
  activo: boolean;
}

export interface Tipo {
  id: string;
  familia_id: string;
  slug: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface Producto {
  id: string;
  slug: string;
  familia_id: string;
  familia_slug: string;
  tipo_id: string | null;
  nombre: string;
  descripcion_corta: string;
  descripcion_larga: string;
  especificaciones: unknown[];
  aplicaciones: string[];
  beneficios: string[];
  valor: string | null;
  preguntas_frecuentes: Array<{ q: string; a: string }>;
  seo_keywords: string[];
  marca: string | null;
  imagen_principal: string | null;
  galeria: string[];
  ficha_pdf: string | null;
  tipo_comercial: 'consumible' | 'equipo';
  fulfillment_mode: 'dropship' | 'cotizacion' | 'individualizado';
  precio: number | null;
  moneda: string;
  sku: string | null;
  stock: number | null;
  // Escenario A: el proveedor flaguea disponibilidad en tiempo real.
  // false → fuera de carrito/checkout (independiente de `activo`/catálogo).
  disponible: boolean;
  destacado: boolean;
  nuevo: boolean;
  activo: boolean;
  orden: number;
}

export interface FiltrosProductos {
  familia?: string;
  tipo?: string;
  destacado?: boolean;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface CotizacionProducto {
  slug: string;
  nombre: string;
  cantidad: number;
}

export interface CotizacionPayload extends CommercialAttribution {
  locale?: 'es' | 'en';
  /** Punto del embudo que originó la solicitud; sin PII. */
  origen?: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa?: string;
  mensaje: string;
  consentimiento_datos: boolean;
  productos?: CotizacionProducto[];
}

export interface Articulo {
  id: string;
  slug: string;
  titulo: string;
  cuerpo: string;
  imagen?: string;
  publicado: boolean;
  created_at: string;
  updated_at: string;
}

/* ============================================================
   Helpers de mapeo desde mock
   ============================================================ */

function mapFamilia(raw: (typeof mockFamilias)[0], locale: Locale): Familia {
  return {
    id: raw.id,
    slug: raw.slug,
    nombre: locale === 'en' ? raw.nombre_en : raw.nombre_es,
    descripcion: locale === 'en' ? raw.descripcion_en : raw.descripcion_es,
    icono: resolveFamiliaIcono(raw.slug, raw.icono),
    orden: raw.orden,
    activo: raw.activo,
  };
}

function mapProducto(raw: (typeof mockProductos)[0], locale: Locale): Producto {
  const familySlug = correctedFamilySlug(raw.slug, raw.familia_slug);
  const familyWasCorrected = familySlug !== raw.familia_slug;
  const correctedFamily = familyWasCorrected
    ? mockFamilias.find(family => family.slug === familySlug)
    : undefined;
  return {
    id: raw.id,
    slug: raw.slug,
    familia_id: correctedFamily?.id ?? raw.familia_id,
    familia_slug: familySlug,
    tipo_id: familyWasCorrected ? null : raw.tipo_id,
    nombre: locale === 'en' ? raw.nombre_en : raw.nombre_es,
    descripcion_corta: locale === 'en' ? raw.descripcion_corta_en : raw.descripcion_corta_es,
    descripcion_larga: locale === 'en' ? raw.descripcion_larga_en : raw.descripcion_larga_es,
    especificaciones: raw.especificaciones,
    aplicaciones:
      (locale === 'en'
        ? (raw as { aplicaciones_en?: string[] }).aplicaciones_en
        : (raw as { aplicaciones_es?: string[] }).aplicaciones_es) ?? [],
    beneficios:
      (locale === 'en'
        ? (raw as { beneficios_en?: string[] }).beneficios_en
        : (raw as { beneficios_es?: string[] }).beneficios_es) ?? [],
    valor:
      (locale === 'en'
        ? (raw as { valor_en?: string }).valor_en
        : (raw as { valor_es?: string }).valor_es) ?? null,
    preguntas_frecuentes:
      (locale === 'en'
        ? (raw as { preguntas_frecuentes_en?: Array<{ q: string; a: string }> })
            .preguntas_frecuentes_en
        : (raw as { preguntas_frecuentes_es?: Array<{ q: string; a: string }> })
            .preguntas_frecuentes_es) ?? [],
    seo_keywords:
      (locale === 'en'
        ? (raw as { seo_keywords_en?: string[] }).seo_keywords_en
        : (raw as { seo_keywords_es?: string[] }).seo_keywords_es) ?? [],
    marca: (raw as { marca?: string }).marca ?? null,
    imagen_principal: publicImage(raw.imagen_principal),
    galeria: raw.galeria.map(publicImage).filter(isString),
    ficha_pdf: raw.ficha_pdf,
    tipo_comercial: raw.tipo_comercial as Producto['tipo_comercial'],
    fulfillment_mode: raw.fulfillment_mode as Producto['fulfillment_mode'],
    precio: raw.precio,
    moneda: raw.moneda,
    sku: typeof raw.sku === 'string' ? raw.sku : null,
    stock: (raw as { stock?: number | null }).stock ?? null,
    disponible: (raw as { disponible?: boolean }).disponible ?? true,
    destacado: raw.destacado,
    nuevo: raw.nuevo,
    activo: raw.activo,
    orden: raw.orden,
  };
}

/* ============================================================
   API pública
   ============================================================ */

export async function getFamilias(locale: Locale): Promise<Familia[]> {
  const mockFamiliasPorSlug = new Map(
    mockFamilias.filter(f => f.activo).map(f => [f.slug, f] as const)
  );
  // Slugs de BD que no coinciden exactamente con el mock por diferente algoritmo de slugificación
  const SLUG_ALIASES: Record<string, string> = {
    'radiolog-a-y-diagn-stico-por-imagen': 'radiolia',
  };
  const esPlaceholder = (value: unknown): boolean =>
    typeof value === 'string' && value.toUpperCase().includes('COPY_CLIENTE_REVISAR');
  const textoUsable = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
  const slugToTitulo = (s: string): string =>
    s
      .split('-')
      .filter(w => w.length > 1)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('familias')
      .select('*')
      .eq('activo', true)
      .order('orden');
    if (error) {
      registrarErrorSupabase('getFamilias', error);
    } else if (data && data.length > 0) {
      return data
        .map(raw => {
          const slug = raw.slug as string;
          // Busca mock por slug exacto o por alias (slugs de BD que difieren del mock)
          const mock =
            mockFamiliasPorSlug.get(slug) ?? mockFamiliasPorSlug.get(SLUG_ALIASES[slug] ?? '');
          if (mock) {
            const base = mapFamilia(mock, locale);
            return {
              ...base,
              id: raw.id as string,
              slug, // Siempre usa el slug de BD para coincidir con producto.familia_slug
              orden: raw.orden as number,
              activo: raw.activo as boolean,
              icono: resolveFamiliaIcono(slug, stringValue((raw as RawRow).icono) || mock.icono),
            };
          }
          const nombreDb = locale === 'en' ? raw.nombre_en : raw.nombre_es;
          const descripcionDb = locale === 'en' ? raw.descripcion_en : raw.descripcion_es;
          const nombre =
            textoUsable(nombreDb) && !esPlaceholder(nombreDb)
              ? textoUsable(nombreDb)
              : slugToTitulo(slug);
          const descripcion =
            textoUsable(descripcionDb) && !esPlaceholder(descripcionDb)
              ? textoUsable(descripcionDb)
              : nombre;

          return {
            id: raw.id as string,
            slug,
            nombre,
            descripcion,
            icono: resolveFamiliaIcono(slug, stringValue((raw as RawRow).icono)),
            orden: raw.orden as number,
            activo: raw.activo as boolean,
          };
        })
        .filter(familia => Boolean(familia.nombre));
    } else if (data) {
      registrarVacioSupabase('getFamilias');
    }
  }
  return mockFamilias.filter(f => f.activo).map(f => mapFamilia(f, locale));
}

export async function getTipos(familiaSlug: string, locale: Locale): Promise<Tipo[]> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    const { data: familiaData, error: familiaError } = await supabase
      .from('familias')
      .select('id')
      .eq('slug', familiaSlug)
      .maybeSingle();
    if (familiaError) registrarErrorSupabase('getTipos/familia', familiaError);
    if (familiaData) {
      const { data, error } = await supabase
        .from('tipos')
        .select('*')
        .eq('familia_id', familiaData.id)
        .eq('activo', true)
        .order('orden');
      if (!error && data && data.length > 0) {
        return data.map(raw => ({
          id: raw.id as string,
          familia_id: raw.familia_id as string,
          slug: raw.slug as string,
          nombre: (locale === 'en' ? raw.nombre_en : raw.nombre_es) as string,
          orden: raw.orden as number,
          activo: raw.activo as boolean,
        }));
      }
      if (error) registrarErrorSupabase('getTipos', error);
    }
  }
  return mockTipos
    .filter(t => {
      const familiaObj = mockFamilias.find(f => f.slug === familiaSlug);
      return (
        familiaObj &&
        (t as { familia_id: string }).familia_id === familiaObj.id &&
        (t as { activo: boolean }).activo
      );
    })
    .map(t => ({
      id: (t as { id: string }).id,
      familia_id: (t as { familia_id: string }).familia_id,
      slug: (t as { slug: string }).slug,
      nombre:
        (locale === 'en'
          ? (t as { nombre_en?: string }).nombre_en
          : (t as { nombre_es?: string }).nombre_es) ?? '',
      orden: (t as { orden: number }).orden,
      activo: (t as { activo: boolean }).activo,
    }));
}

export async function getProductos(filtros: FiltrosProductos, locale: Locale): Promise<Producto[]> {
  const { familia, tipo, destacado, query, page = 1, pageSize = 24 } = filtros;

  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    await cargarMapaFamilias(supabase);
    let req = supabase.from('productos').select('*').eq('activo', true);
    if (familia) {
      const familiaId = familiaIdPorSlug?.[familia];
      // Familia sin equivalente en Supabase: no hay filas que coincidan.
      req = req.eq('familia_id', familiaId ?? '00000000-0000-0000-0000-000000000000');
    }
    if (destacado !== undefined) req = req.eq('destacado', destacado);
    req = req.order('orden').range((page - 1) * pageSize, page * pageSize - 1);
    const { data, error } = await req;
    if (!error && data && data.length > 0) {
      return data.map(raw => mapProductoSupabase(raw, locale));
    }
    if (error) registrarErrorSupabase('getProductos', error);
    else if (data && !familia) registrarVacioSupabase('getProductos');
  }

  let lista = mockProductos.filter(p => p.activo);
  if (familia) lista = lista.filter(p => p.familia_slug === familia);
  if (tipo) lista = lista.filter(p => p.tipo_id === tipo);
  if (destacado !== undefined) lista = lista.filter(p => p.destacado === destacado);
  if (query) {
    const q = query.toLowerCase();
    lista = lista.filter(
      p => p.nombre_es.toLowerCase().includes(q) || p.descripcion_corta_es.toLowerCase().includes(q)
    );
  }
  const start = (page - 1) * pageSize;
  return lista.slice(start, start + pageSize).map(p => mapProducto(p, locale));
}

export async function getProductoBySlug(slug: string, locale: Locale): Promise<Producto | null> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    await cargarMapaFamilias(supabase);
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('slug', slug)
      .eq('activo', true)
      .maybeSingle();
    if (!error && data) {
      return mapProductoSupabase(data, locale);
    }
    if (error) registrarErrorSupabase('getProductoBySlug', error);
  }
  const found = mockProductos.find(p => p.slug === slug && p.activo);
  return found ? mapProducto(found, locale) : null;
}

export async function getProductosDestacados(locale: Locale): Promise<Producto[]> {
  return getProductos({ destacado: true, pageSize: 12 }, locale);
}

export async function getProductosBySlugs(slugs: string[], locale: Locale): Promise<Producto[]> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    await cargarMapaFamilias(supabase);
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .in('slug', slugs)
      .eq('activo', true);
    if (!error && data && data.length > 0) {
      return data.map(raw => mapProductoSupabase(raw, locale));
    }
    if (error) registrarErrorSupabase('getProductosBySlugs', error);
    else if (data) registrarVacioSupabase('getProductosBySlugs');
  }
  return mockProductos
    .filter(p => slugs.includes(p.slug) && p.activo)
    .map(p => mapProducto(p, locale));
}

export async function buscarProductos(query: string, locale: Locale): Promise<Producto[]> {
  return getProductos({ query, pageSize: 20 }, locale);
}

export async function getArticulos(locale: Locale): Promise<Articulo[]> {
  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('articulos')
      .select('*')
      .eq('publicado', true)
      .order('created_at', { ascending: false });
    if (error) {
      registrarErrorSupabase('getArticulos', error);
    } else if (data) {
      return (data as RawRow[])
        .map(raw => {
          const imagen = stringValue(raw.imagen);
          const slug = sanitizeArticuloSlug(stringValue(raw.slug));
          return {
            id: stringValue(raw.id),
            slug,
            titulo:
              locale === 'en'
                ? stringValue(raw.titulo_en) || stringValue(raw.titulo_es)
                : stringValue(raw.titulo_es),
            cuerpo:
              locale === 'en'
                ? stringValue(raw.cuerpo_en) || stringValue(raw.cuerpo_es)
                : stringValue(raw.cuerpo_es),
            ...(imagen ? { imagen } : {}),
            publicado: Boolean(raw.publicado),
            created_at: stringValue(raw.created_at),
            updated_at: stringValue(raw.updated_at),
          };
        })
        .filter(articulo => isValidArticuloSlug(articulo.slug));
    }
  }
  return mockArticulos
    .filter(articulo => articulo.publicado)
    .map(articulo => ({
      id: articulo.id,
      slug: articulo.slug,
      titulo: locale === 'en' ? articulo.titulo_en || articulo.titulo_es : articulo.titulo_es,
      cuerpo: locale === 'en' ? articulo.cuerpo_en || articulo.cuerpo_es : articulo.cuerpo_es,
      publicado: articulo.publicado,
      created_at: articulo.created_at,
      updated_at: articulo.updated_at,
    }));
}

export async function getArticuloBySlug(slug: string, locale: Locale): Promise<Articulo | null> {
  const safeSlug = sanitizeArticuloSlug(slug);
  if (!isValidArticuloSlug(safeSlug)) return null;

  if (debeUsarSupabase()) {
    const supabase = getSupabaseClient()!;
    let row: RawRow | null = null;
    const { data: bySafe, error: errSafe } = await supabase
      .from('articulos')
      .select('*')
      .eq('slug', safeSlug)
      .eq('publicado', true)
      .maybeSingle();
    if (errSafe) {
      registrarErrorSupabase('getArticuloBySlug', errSafe);
    } else if (bySafe) {
      row = bySafe as RawRow;
    } else if (slug !== safeSlug) {
      const { data: byRaw, error: errRaw } = await supabase
        .from('articulos')
        .select('*')
        .eq('slug', slug)
        .eq('publicado', true)
        .maybeSingle();
      if (errRaw) registrarErrorSupabase('getArticuloBySlug', errRaw);
      else if (byRaw) row = byRaw as RawRow;
    }
    if (row) {
      const imagen = stringValue(row.imagen);
      return {
        id: stringValue(row.id),
        slug: safeSlug,
        titulo:
          locale === 'en'
            ? stringValue(row.titulo_en) || stringValue(row.titulo_es)
            : stringValue(row.titulo_es),
        cuerpo:
          locale === 'en'
            ? stringValue(row.cuerpo_en) || stringValue(row.cuerpo_es)
            : stringValue(row.cuerpo_es),
        ...(imagen ? { imagen } : {}),
        publicado: Boolean(row.publicado),
        created_at: stringValue(row.created_at),
        updated_at: stringValue(row.updated_at),
      };
    }
  }
  const found = mockArticulos.find(
    articulo => sanitizeArticuloSlug(articulo.slug) === safeSlug && articulo.publicado
  );
  if (!found) return null;
  return {
    id: found.id,
    slug: found.slug,
    titulo: locale === 'en' ? found.titulo_en || found.titulo_es : found.titulo_es,
    cuerpo: locale === 'en' ? found.cuerpo_en || found.cuerpo_es : found.cuerpo_es,
    publicado: found.publicado,
    created_at: found.created_at,
    updated_at: found.updated_at,
  };
}

export async function submitCotizacion(datos: CotizacionPayload): Promise<{
  ok: boolean;
  error?: string;
  emails?: { interno?: boolean; cliente?: boolean };
}> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()!;
    const { normalizarPayloadCotizacion, interpretarErrorEdgeFunction } =
      await import('./cotizacion-submit');
    const payload = normalizarPayloadCotizacion({
      ...captureCommercialAttribution(datos.campaign),
      ...datos,
    });
    if (!payload.mensaje.trim()) {
      return {
        ok: false,
        error:
          payload.locale === 'en'
            ? 'Message is required when no products are selected.'
            : 'El mensaje es obligatorio si no hay productos en la solicitud.',
      };
    }
    // Edge Function: registra la solicitud y envia emails (interno + cliente)
    const { data, error } = await supabase.functions.invoke('registrar-cotizacion', {
      body: payload,
    });
    if (error) {
      return { ok: false, error: await interpretarErrorEdgeFunction(error, data) };
    }
    const result = data as {
      ok?: boolean;
      error?: string | { message?: string };
      emails?: { interno?: boolean; cliente?: boolean };
    } | null;
    if (!result?.ok) {
      const edgeError =
        typeof result?.error === 'string'
          ? result.error
          : result?.error?.message
            ? result.error.message
            : await interpretarErrorEdgeFunction(null, data);
      return { ok: false, error: edgeError };
    }
    emitAnalyticsEvent('quote_submit', {
      origin: datos.origen,
      has_products: Array.isArray(datos.productos) && datos.productos.length > 0,
      item_count: datos.productos?.reduce((acc, producto) => acc + producto.cantidad, 0) ?? 0,
      products: datos.productos?.map(producto => `${producto.slug}:${producto.cantidad}`).join(','),
    });
    if (result.emails) {
      return { ok: true, emails: result.emails };
    }
    return { ok: true };
  }
  // Mock: siempre OK en desarrollo sin Supabase
  console.warn('[datos] submitCotizacion mock (sin Supabase):', datos.email);
  emitAnalyticsEvent('quote_submit', {
    origin: datos.origen,
    has_products: Array.isArray(datos.productos) && datos.productos.length > 0,
    item_count: datos.productos?.reduce((acc, producto) => acc + producto.cantidad, 0) ?? 0,
    products: datos.productos?.map(producto => `${producto.slug}:${producto.cantidad}`).join(','),
  });
  return { ok: true };
}
