/**
 * Única fuente de columnas, validación y mapeo del directorio de proveedores.
 * La plantilla Excel, la exportación, el formulario y la Edge Function
 * admin-import deben usar estas listas. No incluye secretos
 * (webhook_url, api_config, tokens ni costos).
 */

export const PROVEEDOR_TIPOS = ['fabricante', 'distribuidor', 'proveedor', 'logistica'] as const;

export const PROVEEDOR_LIFECYCLES = [
  'prospect',
  'contactado',
  'calificado',
  'onboarding',
  'aprobado',
  'suspendido',
  'rechazado',
] as const;

export const PROVEEDOR_CANALES = ['email', 'whatsapp', 'webhook', 'api', 'manual'] as const;

export const PROVEEDOR_ESTADOS_INVIMA = [
  'titular_marca',
  'titular_tercero',
  'titular_otro_distribuidor',
  'en_modificacion',
  'sin_iniciar',
] as const;

export const PROVEEDOR_CONTACTO_TIPOS = [
  'comercial',
  'ventas',
  'pedidos',
  'soporte',
  'tecnico',
  'logistica',
  'finanzas',
  'devoluciones',
  'regulatorio',
  'direccion',
  'general',
] as const;

export const PROVEEDOR_INTERACCION_TIPOS = [
  'nota',
  'reunion',
  'llamada',
  'email',
  'whatsapp',
  'seguimiento',
  'importacion',
] as const;

/** Columnas de la plantilla pública. Sin secretos y sin dropship_enabled. */
export const PROVEEDOR_IMPORT_COLUMNS = [
  'slug',
  'nombre',
  'razon_social',
  'tipo_entidad',
  'sitio_web',
  'pais',
  'ciudad',
  'direccion_comercial',
  'contacto_email',
  'contacto_whatsapp',
  'canal',
  'lifecycle_status',
  'lineas_equipos',
  'estado_invima',
  'invima_titular',
  'distribuidor_local',
  'notas',
  'activo',
] as const;

export const PROVEEDOR_CONTACTO_IMPORT_COLUMNS = [
  'slug_proveedor',
  'nombre',
  'cargo',
  'tipo',
  'email',
  'telefono',
  'whatsapp',
  'es_principal',
  'source_note',
] as const;

export const PROVEEDOR_INTERACCION_IMPORT_COLUMNS = [
  'slug_proveedor',
  'fecha',
  'tipo',
  'resumen',
  'proximo_paso',
  'responsable',
] as const;

export const PROVEEDOR_SENSITIVE_COLUMNS = [
  'webhook_url',
  'api_config',
  'api_token',
  'precio_costo',
] as const;

/**
 * Campos de routing/estado que la importación no puede reescribir en un
 * proveedor con dropshipping activo (notificar-proveedor lee canal + contactos).
 */
export const DROPSHIP_PROTECTED_IMPORT_FIELDS = [
  'canal',
  'contacto_email',
  'contacto_whatsapp',
  'activo',
  'lifecycle_status',
] as const;

/** Quita campos operativos del payload cuando el proveedor ya tiene dropship. */
export function sanitizeDropshipImportPayload(
  payload: Record<string, unknown>,
  current: { dropship_enabled: boolean } | undefined
): Record<string, unknown> {
  if (!current?.dropship_enabled) return payload;
  const next: Record<string, unknown> = { ...payload };
  for (const field of DROPSHIP_PROTECTED_IMPORT_FIELDS) {
    delete next[field];
  }
  return next;
}

export const PROVEEDOR_TEMPLATE_SAMPLE: Record<string, string | boolean> = {
  slug: 'proveedor-ejemplo',
  nombre: 'Proveedor ejemplo',
  razon_social: 'Proveedor ejemplo S.A.S.',
  tipo_entidad: 'proveedor',
  sitio_web: 'https://proveedor.ejemplo.com',
  pais: 'Colombia',
  ciudad: 'Bogotá D.C.',
  direccion_comercial: '',
  contacto_email: 'proveedor@ejemplo.com',
  contacto_whatsapp: '+573000000000',
  canal: 'email',
  lifecycle_status: 'prospect',
  lineas_equipos: 'Monitores, ventiladores',
  estado_invima: 'sin_iniciar',
  invima_titular: '',
  distribuidor_local: '',
  notas: 'Condiciones internas',
  activo: false,
};

export const PROVEEDOR_CONTACTO_TEMPLATE_SAMPLE: Record<string, string | boolean> = {
  slug_proveedor: 'proveedor-ejemplo',
  nombre: 'Ana Pérez',
  cargo: 'Gerente comercial',
  tipo: 'comercial',
  email: 'ana@proveedor.ejemplo.com',
  telefono: '+5715550100',
  whatsapp: '+573000000000',
  es_principal: true,
  source_note: 'Hoja de contactos',
};

export type EstadoInvima = (typeof PROVEEDOR_ESTADOS_INVIMA)[number];

export interface ImportFieldError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export interface PreparedImportRow {
  rowNumber: number;
  ok: boolean;
  payload: Record<string, unknown>;
  errors: ImportFieldError[];
}

export interface ContactSuggestion {
  nombre: string | null;
  cargo: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  tipo: (typeof PROVEEDOR_CONTACTO_TIPOS)[number];
  es_principal: boolean;
  source_note: string;
}

export interface CanvaMappedRow {
  proveedor: Record<string, unknown>;
  contactoPrincipal: ContactSuggestion | null;
  interaccion: { tipo: 'importacion' | 'seguimiento'; resumen: string } | null;
  contactosSugeridos: ContactSuggestion[];
  invimaTitularSugerido: string | null;
  distribuidorLocalSugerido: string | null;
}

export interface DuplicateMember {
  id: string;
  slug: string;
  nombre: string;
  sitio_web: string;
  contacto_email: string;
}

export interface DuplicateGroup {
  reason: string;
  members: DuplicateMember[];
}

const IMPORT_COLUMN_SET = new Set<string>(PROVEEDOR_IMPORT_COLUMNS);
const SENSITIVE_COLUMN_SET = new Set<string>(PROVEEDOR_SENSITIVE_COLUMNS);
const CONTACT_COLUMN_SET = new Set<string>(PROVEEDOR_CONTACTO_IMPORT_COLUMNS);
const INTERACTION_COLUMN_SET = new Set<string>(PROVEEDOR_INTERACCION_IMPORT_COLUMNS);

const INVIMA_LABELS: Record<string, EstadoInvima> = {
  'a nombre de la marca': 'titular_marca',
  titular_marca: 'titular_marca',
  'a nombre de otro titular': 'titular_tercero',
  titular_tercero: 'titular_tercero',
  'titular otro distribuidor': 'titular_otro_distribuidor',
  titular_otro_distribuidor: 'titular_otro_distribuidor',
  'en proceso de modificacion': 'en_modificacion',
  en_modificacion: 'en_modificacion',
  'sin iniciar': 'sin_iniciar',
  sin_iniciar: 'sin_iniciar',
};

const CANVA_HEADER_TO_FIELD: Record<string, string> = {
  origen: 'pais',
  marca: 'nombre',
  fabricante: 'razon_social',
  sitio_web: 'sitio_web',
  contacto: 'contacto_nombre',
  whatsapp: 'contacto_whatsapp',
  email: 'contacto_email',
  equipos: 'lineas_equipos',
  estado_invima: 'estado_invima',
  notas: 'notas',
};

const CANVA_FIELD_SET = new Set<string>([
  ...Object.values(CANVA_HEADER_TO_FIELD),
  'contacto_nombre',
]);

const NAME_SKIP =
  /^(otro|contacto|colombia|whatsapp|correo|gerente|ventas|https|notas|pendiente)$/i;

export function slugifyProveedor(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function normalizeExcelKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeNombre(value: string): string {
  return slugifyProveedor(
    value.replace(
      /\b(s\.?a\.?s\.?|s\.?a\.?|ltda\.?|ltd\.?|limited|inc\.?|corp\.?|co\.?|gmbh|medical|technology|technologies|equipment|industrial|biomedical)\b/gi,
      ' '
    )
  );
}

export function websiteDomain(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

export function cellText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  return '';
}

function isBlank(value: unknown): boolean {
  return cellText(value) === '';
}

/** `https://wa.me/57300...`, espacios y guiones pasan a E.164 (`+57300...`). */
export function normalizeWhatsapp(
  value: unknown
): { ok: true; value: string | null } | { ok: false; raw: string } {
  const raw = cellText(value);
  if (!raw) return { ok: true, value: null };
  const fromWa = raw.match(/wa\.me\/(\+?\d+)/i);
  const source = fromWa?.[1] ?? raw;
  let digits = source.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+') && /^\d{8,15}$/.test(digits)) digits = `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) return { ok: false, raw };
  return { ok: true, value: digits };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseActivo(
  value: unknown
): { ok: true; value: boolean | null } | { ok: false; raw: string } {
  const raw = cellText(value).toLowerCase();
  if (!raw) return { ok: true, value: null };
  if (['1', 'true', 'yes', 'y', 'si', 'sí', 'x'].includes(raw)) return { ok: true, value: true };
  if (['0', 'false', 'no', 'n'].includes(raw)) return { ok: true, value: false };
  return { ok: false, raw: cellText(value) };
}

/**
 * `pais` sigue siendo TEXT para no romper lecturas existentes.
 * "China/Alemania" se normaliza a "China / Alemania".
 */
export function normalizePais(value: unknown): string | null {
  const raw = cellText(value);
  if (!raw) return null;
  const parts = raw
    .split(/[/,;|]/)
    .map(part => part.trim())
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

export function mapEstadoInvima(
  value: unknown
): { ok: true; value: EstadoInvima | null } | { ok: false; raw: string } {
  const raw = cellText(value);
  if (!raw) return { ok: true, value: null };
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const mapped = INVIMA_LABELS[key];
  if (!mapped) return { ok: false, raw };
  return { ok: true, value: mapped };
}

export function estadoInvimaLabel(value: string): string {
  const labels: Record<string, string> = {
    titular_marca: 'A nombre de la marca',
    titular_tercero: 'A nombre de otro titular',
    titular_otro_distribuidor: 'Titular otro distribuidor',
    en_modificacion: 'En proceso de modificación',
    sin_iniciar: 'Sin iniciar',
  };
  return labels[value] ?? value;
}

function enumError(
  row: number,
  column: string,
  value: string,
  allowed: readonly string[]
): ImportFieldError {
  return {
    row,
    column,
    value,
    message: `Fila ${row}, columna ${column}: "${value}" no es válido. Usa ${allowed.join(' | ')}.`,
  };
}

export function omitEmptyFields(
  row: Record<string, unknown>,
  clearEmpty: boolean
): Record<string, unknown> {
  if (clearEmpty) return row;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    next[key] = value;
  }
  return next;
}

export function assertDropshipRule(
  lifecycleStatus: unknown,
  dropshipEnabled: unknown
): string | null {
  const enabled =
    dropshipEnabled === true ||
    dropshipEnabled === 'true' ||
    dropshipEnabled === 1 ||
    dropshipEnabled === '1' ||
    dropshipEnabled === 'si';
  if (enabled && cellText(lifecycleStatus) !== 'aprobado') {
    return 'Dropshipping solo se habilita si el estado de validación es aprobado. Marcar aprobado no activa dropshipping.';
  }
  return null;
}

export function prepareProveedorImportRow(
  rawRow: Record<string, unknown>,
  rowNumber: number,
  options: { clearEmpty?: boolean } = {}
): PreparedImportRow {
  const errors: ImportFieldError[] = [];
  const normalized: Record<string, unknown> = {};
  let dropshipEnabled: unknown;
  for (const [key, value] of Object.entries(rawRow)) {
    const column = normalizeExcelKey(key);
    if (!column) continue;
    if (column === 'dropship_enabled') {
      dropshipEnabled = value;
      continue;
    }
    if (SENSITIVE_COLUMN_SET.has(column)) {
      errors.push({
        row: rowNumber,
        column,
        value: '',
        message: `Fila ${rowNumber}, columna ${column}: no se importa. Los secretos no viajan por Excel.`,
      });
      continue;
    }
    if (!IMPORT_COLUMN_SET.has(column)) {
      errors.push({
        row: rowNumber,
        column,
        value: cellText(value).slice(0, 80),
        message: `Fila ${rowNumber}, columna ${column}: no está en la plantilla de proveedores.`,
      });
      continue;
    }
    normalized[column] = value;
  }

  const payload: Record<string, unknown> = {};
  const nombre = cellText(normalized.nombre);
  const slug = slugifyProveedor(cellText(normalized.slug) || nombre);
  if (!slug) {
    errors.push({
      row: rowNumber,
      column: 'slug',
      value: '',
      message: `Fila ${rowNumber}, columna slug: falta slug o nombre para identificar al proveedor.`,
    });
  } else payload.slug = slug;
  if (!nombre) {
    errors.push({
      row: rowNumber,
      column: 'nombre',
      value: '',
      message: `Fila ${rowNumber}, columna nombre: es obligatoria.`,
    });
  } else payload.nombre = nombre;

  for (const column of [
    'razon_social',
    'ciudad',
    'direccion_comercial',
    'lineas_equipos',
    'invima_titular',
    'distribuidor_local',
    'notas',
  ] as const) {
    if (!(column in normalized)) continue;
    const value = cellText(normalized[column]);
    payload[column] = value || null;
  }

  if ('pais' in normalized) payload.pais = normalizePais(normalized.pais);

  if ('tipo_entidad' in normalized && !isBlank(normalized.tipo_entidad)) {
    const value = cellText(normalized.tipo_entidad);
    if (!(PROVEEDOR_TIPOS as readonly string[]).includes(value)) {
      errors.push(enumError(rowNumber, 'tipo_entidad', value, PROVEEDOR_TIPOS));
    } else payload.tipo_entidad = value;
  }

  if ('lifecycle_status' in normalized && !isBlank(normalized.lifecycle_status)) {
    const value = cellText(normalized.lifecycle_status);
    if (!(PROVEEDOR_LIFECYCLES as readonly string[]).includes(value)) {
      errors.push(enumError(rowNumber, 'lifecycle_status', value, PROVEEDOR_LIFECYCLES));
    } else payload.lifecycle_status = value;
  }

  if ('canal' in normalized && !isBlank(normalized.canal)) {
    const value = cellText(normalized.canal);
    if (!(PROVEEDOR_CANALES as readonly string[]).includes(value)) {
      errors.push(enumError(rowNumber, 'canal', value, PROVEEDOR_CANALES));
    } else payload.canal = value;
  }

  if ('estado_invima' in normalized && !isBlank(normalized.estado_invima)) {
    const mapped = mapEstadoInvima(normalized.estado_invima);
    if (!mapped.ok) {
      errors.push(enumError(rowNumber, 'estado_invima', mapped.raw, PROVEEDOR_ESTADOS_INVIMA));
    } else if (mapped.value) payload.estado_invima = mapped.value;
  } else if ('estado_invima' in normalized) payload.estado_invima = null;

  if ('contacto_email' in normalized) {
    const email = cellText(normalized.contacto_email).toLowerCase();
    if (!email) payload.contacto_email = null;
    else if (!isValidEmail(email)) {
      errors.push({
        row: rowNumber,
        column: 'contacto_email',
        value: email,
        message: `Fila ${rowNumber}, columna contacto_email: "${email}" no es un correo válido.`,
      });
    } else payload.contacto_email = email;
  }

  if ('contacto_whatsapp' in normalized) {
    const whatsapp = normalizeWhatsapp(normalized.contacto_whatsapp);
    if (!whatsapp.ok) {
      errors.push({
        row: rowNumber,
        column: 'contacto_whatsapp',
        value: whatsapp.raw,
        message: `Fila ${rowNumber}, columna contacto_whatsapp: "${whatsapp.raw}" no está en formato E.164 (+ y dígitos).`,
      });
    } else payload.contacto_whatsapp = whatsapp.value;
  }

  if ('sitio_web' in normalized) {
    const site = cellText(normalized.sitio_web);
    if (!site) payload.sitio_web = null;
    else if (!isValidHttpUrl(site)) {
      errors.push({
        row: rowNumber,
        column: 'sitio_web',
        value: site,
        message: `Fila ${rowNumber}, columna sitio_web: "${site}" no es una URL http(s) válida.`,
      });
    } else payload.sitio_web = site;
  }

  if ('activo' in normalized) {
    const activo = parseActivo(normalized.activo);
    if (!activo.ok) {
      errors.push({
        row: rowNumber,
        column: 'activo',
        value: activo.raw,
        message: `Fila ${rowNumber}, columna activo: "${activo.raw}" no es booleano. Usa true/false, si/no o 1/0.`,
      });
    } else if (activo.value !== null) payload.activo = activo.value;
  }

  const dropshipMessage = assertDropshipRule(payload.lifecycle_status, dropshipEnabled);
  if (dropshipMessage) {
    errors.push({
      row: rowNumber,
      column: 'dropship_enabled',
      value: cellText(dropshipEnabled),
      message: `Fila ${rowNumber}: ${dropshipMessage}`,
    });
  }

  if (errors.length) return { rowNumber, ok: false, payload: {}, errors };
  return {
    rowNumber,
    ok: true,
    payload: omitEmptyFields(payload, options.clearEmpty === true),
    errors: [],
  };
}

export function prepareContactoImportRow(
  rawRow: Record<string, unknown>,
  rowNumber: number
): PreparedImportRow {
  const errors: ImportFieldError[] = [];
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const column = normalizeExcelKey(key);
    if (!column) continue;
    if (!CONTACT_COLUMN_SET.has(column)) {
      errors.push({
        row: rowNumber,
        column,
        value: cellText(value).slice(0, 80),
        message: `Fila ${rowNumber}, hoja contactos, columna ${column}: no está permitida.`,
      });
      continue;
    }
    normalized[column] = value;
  }
  const slug = slugifyProveedor(cellText(normalized.slug_proveedor));
  if (!slug) {
    errors.push({
      row: rowNumber,
      column: 'slug_proveedor',
      value: '',
      message: `Fila ${rowNumber}, hoja contactos: falta slug_proveedor.`,
    });
  }
  const email = cellText(normalized.email).toLowerCase();
  const telefonoRaw = cellText(normalized.telefono);
  const whatsapp = normalizeWhatsapp(normalized.whatsapp);
  if (email && !isValidEmail(email)) {
    errors.push({
      row: rowNumber,
      column: 'email',
      value: email,
      message: `Fila ${rowNumber}, hoja contactos, columna email: "${email}" no es válido.`,
    });
  }
  if (!whatsapp.ok) {
    errors.push({
      row: rowNumber,
      column: 'whatsapp',
      value: whatsapp.raw,
      message: `Fila ${rowNumber}, hoja contactos, columna whatsapp: "${whatsapp.raw}" no está en E.164.`,
    });
  }
  const telefonoNormalized = telefonoRaw
    ? normalizeWhatsapp(telefonoRaw)
    : { ok: true as const, value: null };
  const telefono = telefonoNormalized.ok ? telefonoNormalized.value : telefonoRaw || null;
  if (!email && !telefono && !(whatsapp.ok && whatsapp.value)) {
    errors.push({
      row: rowNumber,
      column: 'email',
      value: '',
      message: `Fila ${rowNumber}, hoja contactos: indica email, teléfono o WhatsApp.`,
    });
  }
  const tipo = cellText(normalized.tipo) || 'comercial';
  if (!(PROVEEDOR_CONTACTO_TIPOS as readonly string[]).includes(tipo)) {
    errors.push(enumError(rowNumber, 'tipo', tipo, PROVEEDOR_CONTACTO_TIPOS));
  }
  const principal = parseActivo(normalized.es_principal);
  if (!principal.ok) {
    errors.push({
      row: rowNumber,
      column: 'es_principal',
      value: principal.raw,
      message: `Fila ${rowNumber}, columna es_principal: "${principal.raw}" no es booleano.`,
    });
  }
  if (errors.length || !slug) return { rowNumber, ok: false, payload: {}, errors };
  return {
    rowNumber,
    ok: true,
    payload: {
      slug_proveedor: slug,
      nombre: cellText(normalized.nombre) || null,
      cargo: cellText(normalized.cargo) || null,
      tipo,
      email: email || null,
      telefono,
      whatsapp: whatsapp.ok ? whatsapp.value : null,
      es_principal: principal.ok ? principal.value === true : false,
      source_note: cellText(normalized.source_note) || null,
    },
    errors: [],
  };
}

export function prepareInteraccionImportRow(
  rawRow: Record<string, unknown>,
  rowNumber: number
): PreparedImportRow {
  const normalized: Record<string, unknown> = {};
  const errors: ImportFieldError[] = [];
  for (const [key, value] of Object.entries(rawRow)) {
    const column = normalizeExcelKey(key);
    if (!column) continue;
    if (!INTERACTION_COLUMN_SET.has(column)) {
      errors.push({
        row: rowNumber,
        column,
        value: cellText(value).slice(0, 80),
        message: `Fila ${rowNumber}, interacción, columna ${column}: no está permitida.`,
      });
      continue;
    }
    normalized[column] = value;
  }
  const slug = slugifyProveedor(cellText(normalized.slug_proveedor));
  const resumen = cellText(normalized.resumen);
  if (!slug) {
    errors.push({
      row: rowNumber,
      column: 'slug_proveedor',
      value: '',
      message: `Fila ${rowNumber}: la interacción no tiene slug_proveedor.`,
    });
  }
  if (!resumen) {
    errors.push({
      row: rowNumber,
      column: 'resumen',
      value: '',
      message: `Fila ${rowNumber}: la interacción no tiene resumen.`,
    });
  }
  const tipo = cellText(normalized.tipo) || 'importacion';
  if (!(PROVEEDOR_INTERACCION_TIPOS as readonly string[]).includes(tipo)) {
    errors.push(enumError(rowNumber, 'tipo', tipo, PROVEEDOR_INTERACCION_TIPOS));
  }
  if (errors.length || !slug || !resumen) return { rowNumber, ok: false, payload: {}, errors };
  return {
    rowNumber,
    ok: true,
    payload: {
      slug_proveedor: slug,
      fecha: cellText(normalized.fecha) || null,
      tipo,
      resumen,
      proximo_paso: cellText(normalized.proximo_paso) || null,
      responsable: cellText(normalized.responsable) || null,
    },
    errors: [],
  };
}

export function parseContactoLibre(value: string): {
  nombre: string | null;
  cargo: string | null;
  telefono: string | null;
} {
  let raw = value.trim();
  if (!raw) return { nombre: null, cargo: null, telefono: null };
  const phoneMatch = raw.match(/(\+?\d[\d\s().-]{6,}\d)/);
  let telefono: string | null = null;
  if (phoneMatch?.[1]) {
    const normalized = normalizeWhatsapp(phoneMatch[1]);
    telefono = normalized.ok ? normalized.value : phoneMatch[1].replace(/[^\d+]/g, '');
    raw = raw
      .replace(phoneMatch[1], ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/,\s*$/, '');
  }
  const paren = raw.match(/^([^()]+?)\s*\(([^)]+)\)/);
  if (paren) {
    return { nombre: paren[1]?.trim() || null, cargo: paren[2]?.trim() || null, telefono };
  }
  const comma = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (comma.length >= 2) {
    return { nombre: comma[0] ?? null, cargo: comma.slice(1).join(', '), telefono };
  }
  return { nombre: raw.replace(/[,]+$/g, '').trim() || null, cargo: null, telefono };
}

function pickPersonName(window: string): string | null {
  const matches = [
    ...window.matchAll(/([A-ZÁÉÍÓÚÑ][\p{L}'’.-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'’.-]+){0,3})/gu),
  ];
  const names = matches
    .map(match => match[1]?.trim() ?? '')
    .filter(name => name && !NAME_SKIP.test(name.split(/\s+/)[0] ?? ''));
  return (
    names
      .at(-1)
      ?.replace(/^(correo de|otro contacto:?)\s*/i, '')
      .trim() || null
  );
}

/**
 * Extrae posibles contactos de texto libre solo para vista previa.
 * No deben guardarse sin confirmación del usuario.
 */
export function suggestContactsFromNote(note: string): ContactSuggestion[] {
  const text = note.trim();
  if (!text) return [];
  const suggestions: ContactSuggestion[] = [];
  const seen = new Set<string>();
  const push = (suggestion: ContactSuggestion) => {
    const key = [suggestion.email, suggestion.whatsapp, suggestion.telefono, suggestion.nombre]
      .filter(Boolean)
      .join('|')
      .toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    suggestions.push(suggestion);
  };

  for (const match of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const email = match[0].toLowerCase();
    const before = text.slice(Math.max(0, (match.index ?? 0) - 64), match.index ?? 0);
    push({
      nombre: pickPersonName(before),
      cargo: null,
      email,
      telefono: null,
      whatsapp: null,
      tipo: 'comercial',
      es_principal: false,
      source_note: text,
    });
  }

  for (const match of text.matchAll(/https?:\/\/wa\.me\/(\d+)/gi)) {
    const whatsapp = normalizeWhatsapp(`+${match[1]}`);
    const before = text.slice(Math.max(0, (match.index ?? 0) - 80), match.index ?? 0);
    push({
      nombre: pickPersonName(before),
      cargo: null,
      email: null,
      telefono: null,
      whatsapp: whatsapp.ok ? whatsapp.value : null,
      tipo: 'comercial',
      es_principal: false,
      source_note: text,
    });
  }

  return suggestions;
}

export function suggestInvimaTitular(note: string): string | null {
  const match = note.match(/titular\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][\p{L}\d .'-]{2,40})/iu);
  if (!match?.[1]) return null;
  const cleaned = match[1]
    .replace(/\b(sin|sin embargo|los|las|de|del)\b.*$/i, '')
    .replace(/[.,;:]+$/g, '')
    .trim();
  return cleaned || null;
}

export function suggestDistribuidorLocal(fabricante: string, note: string): string | null {
  const fromFabricante = fabricante.match(
    /distribuidor(?:\s+de)?\s+([A-ZÁÉÍÓÚÑ][\p{L}\d.'-]{1,40})/iu
  );
  if (fromFabricante?.[1]) return fromFabricante[1].replace(/[.,]$/, '').trim();
  const matches = [
    ...note.matchAll(
      /([A-ZÁÉÍÓÚÑ][\p{L}.'-]{1,30}(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}.'-]{1,30}){0,2})\s+(?:les\s+|los\s+)?distribuye(?:n)?\b/gu
    ),
  ];
  const fromNote = matches.at(-1)?.[1]?.trim();
  return fromNote || null;
}

export function mapCanvaCsvRow(rawRow: Record<string, unknown>): CanvaMappedRow {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const header = normalizeExcelKey(key);
    if (CANVA_FIELD_SET.has(header)) fields[header] = cellText(value);
    else if (CANVA_HEADER_TO_FIELD[header]) fields[CANVA_HEADER_TO_FIELD[header]] = cellText(value);
  }
  const nombre = fields.nombre ?? '';
  const notas = fields.notas ?? '';
  const fabricante = fields.razon_social ?? '';
  const tipo = /distribuidor/i.test(fabricante) ? 'distribuidor' : 'fabricante';
  const hasReach = Boolean(
    fields.contacto_nombre || fields.contacto_whatsapp || fields.contacto_email
  );
  const proveedor: Record<string, unknown> = {
    slug: slugifyProveedor(nombre),
    nombre,
    razon_social: fabricante || null,
    tipo_entidad: tipo,
    sitio_web: fields.sitio_web || null,
    pais: normalizePais(fields.pais),
    contacto_email: fields.contacto_email || null,
    contacto_whatsapp: fields.contacto_whatsapp || null,
    canal: fields.contacto_whatsapp ? 'whatsapp' : fields.contacto_email ? 'email' : 'manual',
    lifecycle_status: hasReach ? 'contactado' : 'prospect',
    lineas_equipos: fields.lineas_equipos || null,
    estado_invima: fields.estado_invima || null,
    notas: notas || null,
    activo: false,
  };
  const parsed = parseContactoLibre(fields.contacto_nombre ?? '');
  const whatsapp = fields.contacto_whatsapp ? normalizeWhatsapp(fields.contacto_whatsapp) : null;
  const email = (fields.contacto_email ?? '').toLowerCase();
  const contactoPrincipal: ContactSuggestion | null =
    parsed.nombre || email || (whatsapp?.ok && whatsapp.value) || parsed.telefono
      ? {
          nombre: parsed.nombre,
          cargo: parsed.cargo,
          email: email && isValidEmail(email) ? email : null,
          telefono: parsed.telefono,
          whatsapp: whatsapp?.ok ? whatsapp.value : null,
          tipo: 'comercial',
          es_principal: true,
          source_note: 'Columna Contacto del CSV interno',
        }
      : null;
  const followUp = /reuni[oó]n|pendiente|retomar|negoci/i.test(notas);
  return {
    proveedor,
    contactoPrincipal,
    interaccion: notas ? { tipo: followUp ? 'seguimiento' : 'importacion', resumen: notas } : null,
    contactosSugeridos: suggestContactsFromNote(notas),
    invimaTitularSugerido: suggestInvimaTitular(notas),
    distribuidorLocalSugerido: suggestDistribuidorLocal(fabricante, notas),
  };
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') inQuotes = false;
      else cell += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char !== '\r') cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter(item => item.some(value => value.trim() !== ''));
  if (!header) return [];
  return body.map(values => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key.trim()] = values[index]?.trim() ?? '';
    });
    return record;
  });
}

export function defaultCsvMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const key = normalizeExcelKey(header);
    if ((PROVEEDOR_IMPORT_COLUMNS as readonly string[]).includes(key)) mapping[header] = key;
    else if (CANVA_HEADER_TO_FIELD[key]) mapping[header] = CANVA_HEADER_TO_FIELD[key];
    else mapping[header] = '';
  }
  return mapping;
}

export const CSV_MAPPABLE_FIELDS = [
  'nombre',
  'razon_social',
  'pais',
  'sitio_web',
  'contacto_nombre',
  'contacto_whatsapp',
  'contacto_email',
  'lineas_equipos',
  'estado_invima',
  'notas',
  'slug',
  'tipo_entidad',
  'ciudad',
  'direccion_comercial',
  'canal',
  'lifecycle_status',
  'invima_titular',
  'distribuidor_local',
  'activo',
] as const;

export function applyCsvMapping(
  row: Record<string, string>,
  mapping: Record<string, string>
): CanvaMappedRow & { proveedor: Record<string, unknown> } {
  const mapped: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    mapped[field] = row[header] ?? '';
  }
  const result = mapCanvaCsvRow(mapped);
  const proveedor = { ...result.proveedor };
  for (const field of [
    'tipo_entidad',
    'ciudad',
    'direccion_comercial',
    'canal',
    'lifecycle_status',
    'invima_titular',
    'distribuidor_local',
  ] as const) {
    if (mapped[field]) proveedor[field] = mapped[field];
  }
  if (mapped.slug) proveedor.slug = slugifyProveedor(mapped.slug);
  if (mapped.activo) {
    const activo = parseActivo(mapped.activo);
    if (activo.ok && activo.value !== null) proveedor.activo = activo.value;
  }
  if (mapped.invima_titular) result.invimaTitularSugerido = mapped.invima_titular;
  if (mapped.distribuidor_local) result.distribuidorLocalSugerido = mapped.distribuidor_local;
  return { ...result, proveedor };
}

function namesRelated(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  if (short.length < 5) return false;
  return long.startsWith(`${short}-`);
}

export function findDuplicateGroups(rows: DuplicateMember[]): DuplicateGroup[] {
  const parent = rows.map((_, index) => index);
  const find = (index: number): number => {
    const next = parent[index] ?? index;
    if (next === index) return index;
    const root = find(next);
    parent[index] = root;
    return root;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const left = rows[i];
      const right = rows[j];
      if (!left || !right) continue;
      if (namesRelated(normalizeNombre(left.nombre), normalizeNombre(right.nombre))) {
        unite(i, j);
        continue;
      }
      const leftDomain = websiteDomain(left.sitio_web);
      const rightDomain = websiteDomain(right.sitio_web);
      if (leftDomain && leftDomain === rightDomain) {
        unite(i, j);
        continue;
      }
      const leftEmail = left.contacto_email.trim().toLowerCase();
      const rightEmail = right.contacto_email.trim().toLowerCase();
      if (leftEmail && leftEmail === rightEmail) unite(i, j);
    }
  }

  const groups = new Map<number, DuplicateMember[]>();
  rows.forEach((row, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(row);
    groups.set(root, list);
  });
  return [...groups.values()]
    .filter(members => members.length > 1)
    .map(members => ({
      reason: 'Posible duplicado por nombre, dominio o email',
      members,
    }));
}

export function matchExistingProveedor<T extends DuplicateMember>(
  candidate: { nombre: string; sitio_web: string; contacto_email: string; slug: string },
  existing: T[]
): T | null {
  const slug = slugifyProveedor(candidate.slug);
  const bySlug = existing.find(row => row.slug === slug);
  if (bySlug) return bySlug;
  const domain = websiteDomain(candidate.sitio_web);
  if (domain) {
    const byDomain = existing.filter(row => websiteDomain(row.sitio_web) === domain);
    if (byDomain.length === 1) return byDomain[0] ?? null;
  }
  const name = normalizeNombre(candidate.nombre);
  const byName = existing.filter(row => namesRelated(normalizeNombre(row.nombre), name));
  if (byName.length === 1) return byName[0] ?? null;
  const email = candidate.contacto_email.trim().toLowerCase();
  if (email) {
    const byEmail = existing.filter(row => row.contacto_email.trim().toLowerCase() === email);
    if (byEmail.length === 1) return byEmail[0] ?? null;
  }
  return null;
}
