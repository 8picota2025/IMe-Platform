/**
 * Utilidades puras (sin dependencias de Supabase/Deno) para el CMS
 * comercial `/comercial`. Se testean con vitest en `comercial-cms.test.ts`.
 *
 * Estas funciones son un espejo — intencionalmente duplicado — de lógica
 * equivalente en las Edge Functions (`supabase/functions/_shared/phone.ts`,
 * `comercial-templates.ts`, `twenty-crm.ts`): `src/` (Astro/Node, build de
 * sitio estático) y `supabase/functions` (Deno, deploy independiente) son
 * dos runtimes/pipelines separados y no se importan entre sí.
 *
 * Fuente de verdad del catálogo: tablas `productos`/`familias`/`tipos`.
 * "Especialidad" es una agrupación de UI (no existe tabla en la BD) — ver
 * `SPECIALTY_GROUPS`, espejo de `PRINCIPALES` en `taxonomia-catalogo.ts`.
 */

export type CommercialRole = 'owner' | 'admin' | 'catalogo' | 'ventas' | 'operaciones' | 'lectura';

// ============================================================
// Email
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NormalizeEmailResult {
  ok: boolean;
  email?: string;
  error?: string;
}

export function normalizeEmail(value: unknown): NormalizeEmailResult {
  if (typeof value !== 'string') return { ok: false, error: 'Email vacío' };
  const email = value.trim().toLowerCase();
  if (!email) return { ok: false, error: 'Email vacío' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email inválido' };
  return { ok: true, email };
}

// ============================================================
// Teléfono (E.164)
// ============================================================

const DEFAULT_COUNTRY_CODE = '57';

export interface NormalizePhoneResult {
  ok: boolean;
  e164?: string;
  error?: string;
}

function onlyDigits(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * Normaliza un teléfono a E.164 (`+<codigo><numero>`).
 * `countryCode` es el código de país SIN '+' (por defecto '57' = Colombia).
 */
export function normalizePhoneE164(
  phone: unknown,
  countryCode: string = DEFAULT_COUNTRY_CODE
): NormalizePhoneResult {
  if (typeof phone !== 'string' || !phone.trim()) {
    return { ok: false, error: 'Teléfono vacío' };
  }

  const raw = phone.trim();
  const country = onlyDigits(countryCode || DEFAULT_COUNTRY_CODE) || DEFAULT_COUNTRY_CODE;

  let digits: string;
  if (raw.startsWith('+')) {
    digits = onlyDigits(raw);
  } else {
    const local = onlyDigits(raw);
    digits =
      local.startsWith(country) && local.length > country.length + 6 ? local : `${country}${local}`;
  }

  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: 'Teléfono con longitud inválida' };
  }

  return { ok: true, e164: `+${digits}` };
}

/** Construye un enlace `wa.me` (modo link, sin WhatsApp Business API). */
export function buildWhatsAppLink(phoneE164: string, message: string): string {
  const digits = phoneE164.startsWith('+') ? phoneE164.slice(1) : phoneE164;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ============================================================
// Plantillas (email/WhatsApp)
// ============================================================

export interface ComercialTemplateVars {
  nombre_destinatario: string;
  nombre_comercial: string;
  centro_medico: string;
  mensaje: string;
  lista_productos_texto: string;
  lista_productos_html: string;
  correo_comercial: string;
  telefono_comercial: string;
}

const KNOWN_TEMPLATE_VARS = new Set<keyof ComercialTemplateVars>([
  'nombre_destinatario',
  'nombre_comercial',
  'centro_medico',
  'mensaje',
  'lista_productos_texto',
  'lista_productos_html',
  'correo_comercial',
  'telefono_comercial',
]);

export interface RenderTemplateResult {
  ok: boolean;
  text?: string;
  error?: string;
  unknownVars?: string[];
}

/**
 * Reemplaza `{{variable}}` en `body` usando `vars`. Solo se permiten
 * variables conocidas (`KNOWN_TEMPLATE_VARS`) — cualquier otra hace fallar
 * el render en vez de dejarla sin reemplazar silenciosamente.
 */
export function renderMessageTemplate(
  body: string,
  vars: Partial<ComercialTemplateVars>
): RenderTemplateResult {
  const unknownVars = new Set<string>();

  const text = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey as keyof ComercialTemplateVars;
    if (!KNOWN_TEMPLATE_VARS.has(key)) {
      unknownVars.add(rawKey);
      return '';
    }
    return vars[key] ?? '';
  });

  if (unknownVars.size > 0) {
    return {
      ok: false,
      error: `Variables desconocidas en plantilla: ${[...unknownVars].join(', ')}`,
      unknownVars: [...unknownVars],
    };
  }

  return { ok: true, text };
}

// ============================================================
// Especialidades (grupos UI, mirror de PRINCIPALES en taxonomia-catalogo.ts)
// ============================================================

export interface SpecialtyGroup {
  slug: string;
  nombre: string;
  /** Slugs de `familias` que componen esta especialidad. */
  familias: string[];
}

/** Familias exclusivas por especialidad (sin solapes — eyebrow comercial). */
export const SPECIALTY_GROUPS: SpecialtyGroup[] = [
  {
    slug: 'diagnostico-monitoreo',
    nombre: 'Diagnóstico y monitoreo',
    familias: ['monitores', 'cardiologia', 'ultrasonido', 'radiologia', 'imagenologia'],
  },
  {
    slug: 'terapia-soporte-vital',
    nombre: 'Terapia y soporte vital',
    familias: ['anestesia', 'soluciones-iv', 'neonatologia'],
  },
  {
    slug: 'quirofano-cuidado-critico',
    nombre: 'Quirófano y cuidado crítico',
    familias: ['sala-cirugia'],
  },
  {
    slug: 'infraestructura-clinica',
    nombre: 'Infraestructura clínica',
    familias: ['mobiliario'],
  },
];

/** Devuelve el nombre de la especialidad UI que agrupa una `familia` (o null). */
export function specialtyForFamiliaSlug(familiaSlug: string): string | null {
  const grupo = SPECIALTY_GROUPS.find(g => g.familias.includes(familiaSlug));
  return grupo?.nombre ?? null;
}

// ============================================================
// Filtro jerárquico de productos (especialidad → familia → subfamilia → sección)
// ============================================================

export type SeccionComercial = 'equipo' | 'consumible';

export interface ProductoFiltrable {
  id: string;
  nombre: string;
  familiaSlug: string;
  tipoSlug?: string | null;
  seccion: SeccionComercial;
  activo?: boolean;
}

export interface FiltrosComercialCatalogo {
  specialtySlug?: string;
  familiaSlug?: string;
  tipoSlug?: string;
  seccion?: SeccionComercial;
  query?: string;
}

/**
 * Filtra productos siguiendo la jerarquía especialidad → familia →
 * subfamilia (tipo) → sección (`tipo_comercial`). Cada nivel es opcional e
 * independiente: si se pasa `familiaSlug` sin `specialtySlug`, solo se
 * aplica el filtro de familia.
 */
export function filterProductsHierarchical<T extends ProductoFiltrable>(
  productos: T[],
  filtros: FiltrosComercialCatalogo
): T[] {
  return productos.filter(producto => {
    if (producto.activo === false) return false;

    if (filtros.specialtySlug) {
      const grupo = SPECIALTY_GROUPS.find(g => g.slug === filtros.specialtySlug);
      if (!grupo || !grupo.familias.includes(producto.familiaSlug)) return false;
    }

    if (filtros.familiaSlug && producto.familiaSlug !== filtros.familiaSlug) return false;
    if (filtros.tipoSlug && producto.tipoSlug !== filtros.tipoSlug) return false;
    if (filtros.seccion && producto.seccion !== filtros.seccion) return false;

    if (filtros.query?.trim()) {
      const q = filtros.query.trim().toLowerCase();
      if (!producto.nombre.toLowerCase().includes(q)) return false;
    }

    return true;
  });
}

// ============================================================
// Idempotencia
// ============================================================

export interface BuildIdempotencyKeyInput {
  userId: string;
  channel: 'email' | 'whatsapp';
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  productIds: string[];
}

/**
 * Genera una clave de idempotencia determinista: mismo usuario + canal +
 * destinatario + conjunto de productos ⇒ misma clave (el orden de
 * `productIds` no importa, se ordenan antes de unir).
 * Formato: `share:<userId>:<channel>:<destinatario>:<productos-ordenados>`
 */
export function buildIdempotencyKey(input: BuildIdempotencyKeyInput): string {
  const recipient = (input.channel === 'email' ? input.recipientEmail : input.recipientPhone) ?? '';
  const productsPart = [...input.productIds].sort().join(',');
  return ['share', input.userId, input.channel, recipient.trim().toLowerCase(), productsPart]
    .join(':')
    .slice(0, 200);
}

const IDEMPOTENCY_KEY_RE = /^share:[^:]+:(email|whatsapp):[^:]*:[^:]*$/;

/** Valida el formato producido por `buildIdempotencyKey` (defensivo, para input externo). */
export function isValidIdempotencyKey(key: unknown): boolean {
  return (
    typeof key === 'string' && key.length > 0 && key.length <= 200 && IDEMPOTENCY_KEY_RE.test(key)
  );
}

// ============================================================
// Permisos (mirror de is_admin()/is_comercial_user() — RLS en SQL)
// ============================================================

const COMERCIAL_ROLES: readonly CommercialRole[] = ['ventas', 'admin', 'owner'];
const ADMIN_ROLES: readonly CommercialRole[] = ['admin', 'owner'];

/** Igual que `is_comercial_user()` en SQL: ventas/admin/owner activos. */
export function isComercialUser(rol: string | null | undefined, activo: boolean): boolean {
  return activo === true && COMERCIAL_ROLES.includes(rol as CommercialRole);
}

/** admin/owner activos — pueden ver/gestionar todo el CMS comercial. */
export function isCommercialAdmin(rol: string | null | undefined, activo: boolean): boolean {
  return activo === true && ADMIN_ROLES.includes(rol as CommercialRole);
}

/** Reparar/enlazar Twenty: solo supervisor, no perfil comercial. */
export function canManageTwentyBridge(rol: string | null | undefined, activo = true): boolean {
  return isCommercialAdmin(rol, activo);
}

/** Ventas/admin/owner activos pueden reasignarse leads y clientes entre sí. */
export function canReassignCommercialLeads(rol: string | null | undefined, activo = true): boolean {
  return isComercialUser(rol, activo);
}

export interface CommercialViewer {
  userId: string;
  rol: string | null | undefined;
  activo: boolean;
}

/**
 * Mirror de las policies RLS de `commercial_shares`: ventas ve solo lo
 * propio, admin/owner ven todo. No es la barrera de seguridad real (esa es
 * la RLS de Postgres) — se usa para gatear la UI (mostrar/ocultar botones).
 */
export function canAccessShare(viewer: CommercialViewer, share: { userId: string }): boolean {
  if (!isComercialUser(viewer.rol, viewer.activo)) return false;
  if (isCommercialAdmin(viewer.rol, viewer.activo)) return true;
  return viewer.userId === share.userId;
}

/** Solo owner/admin pueden crear/editar/desactivar plantillas comerciales. */
export function canManageCommercialTemplates(viewer: CommercialViewer): boolean {
  return isCommercialAdmin(viewer.rol, viewer.activo);
}
