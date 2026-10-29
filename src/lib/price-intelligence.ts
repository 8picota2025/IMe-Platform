/**
 * Inteligencia de precios de proveedor y mercado.
 *
 * Los costos son confidenciales: este módulo no publica precios al sitio.
 * No hay TRM, flete, arancel ni margen por defecto. Si faltan, el aterrizaje
 * queda incompleto en lugar de inventar una tasa.
 */

export const SOURCE_TYPES = [
  'factory_fob',
  'factory_exw',
  'factory_cif',
  'local_distributor',
  'web_scrape',
  'historical_quote',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const INCOTERMS = ['FOB', 'EXW', 'CIF', 'DDP_COLOMBIA', 'WEB_REF', 'LOCAL'] as const;

export type Incoterm = (typeof INCOTERMS)[number];

export const IVA_MODES = ['incluido', 'mas_iva', 'no_aplica'] as const;

export type IvaMode = (typeof IVA_MODES)[number];

export const STALE_PRICE_DAYS = 90;

export const SOURCE_LABEL: Record<SourceType, string> = {
  factory_fob: 'Fábrica FOB',
  factory_exw: 'Fábrica EXW',
  factory_cif: 'Fábrica CIF',
  local_distributor: 'Distribuidor local',
  web_scrape: 'Web scraping',
  historical_quote: 'Cotización histórica',
};

export type SourceGroup = 'factory' | 'local' | 'web' | 'historical';

export interface PriceEntry {
  id: string;
  product_id: string | null;
  category: string | null;
  equipment_name: string;
  brand: string | null;
  model: string | null;
  specs_summary: string | null;
  invima_registration: string | null;
  invima_status: string | null;
  source_type: SourceType;
  supplier_or_source_name: string | null;
  supplier_country: string | null;
  contact_email: string | null;
  source_url_or_ref: string | null;
  currency: string;
  unit_cost_original: number;
  price_min_original: number | null;
  price_avg_original: number | null;
  price_max_original: number | null;
  incoterm: Incoterm;
  tier_min_qty: number;
  lead_time: string | null;
  iva_mode: IvaMode | null;
  trm_applied: number | null;
  freight_pct: number | null;
  duty_pct: number | null;
  ime_margin_pct: number | null;
  estimated_landed_cost_cop: number | null;
  suggested_sale_price_cop: number | null;
  max_reference_price_cop: number | null;
  public_stamp_surcharge_pct: number | null;
  valid_until: string | null;
  captured_at: string;
  notes: string | null;
  raw_metadata: Record<string, unknown>;
  external_key: string | null;
}

export interface NormalizedPriceRow {
  equipment_name: string;
  source_type: SourceType;
  currency: string;
  unit_cost_original: number;
  incoterm: Incoterm;
  tier_min_qty: number;
  product_id: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  specs_summary: string | null;
  invima_registration: string | null;
  invima_status: string | null;
  supplier_or_source_name: string | null;
  supplier_country: string | null;
  contact_email: string | null;
  source_url_or_ref: string | null;
  price_min_original: number | null;
  price_avg_original: number | null;
  price_max_original: number | null;
  lead_time: string | null;
  iva_mode: IvaMode | null;
  trm_applied: number | null;
  freight_pct: number | null;
  duty_pct: number | null;
  ime_margin_pct: number | null;
  estimated_landed_cost_cop: number | null;
  suggested_sale_price_cop: number | null;
  max_reference_price_cop: number | null;
  public_stamp_surcharge_pct: number | null;
  valid_until: string | null;
  captured_at: string;
  notes: string | null;
  raw_metadata: Record<string, unknown>;
  external_key: string;
}

export interface LandingAssumptions {
  trm: number | null;
  freightPct: number | null;
  dutyPct: number | null;
  marginPct: number | null;
  stampPct: number | null;
  applyStamp: boolean;
}

export interface LandingQuote {
  landedCop: number | null;
  suggestedCop: number | null;
  stampBaseCop: number | null;
  stampPriceCop: number | null;
  partial: boolean;
  missing: string[];
}

export interface PriceComparison {
  key: string;
  label: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  invimaStatus: string | null;
  factory: PriceEntry | null;
  local: PriceEntry | null;
  web: PriceEntry | null;
  historical: PriceEntry | null;
  tiers: PriceEntry[];
  factoryLandedCop: number | null;
  localCop: number | null;
  webMinCop: number | null;
  webAvgCop: number | null;
  webMaxCop: number | null;
  deltaLocalVsFactoryPct: number | null;
  deltaWebVsFactoryPct: number | null;
  stale: boolean;
}

export interface BestPriceResult {
  supplier: PriceEntry | null;
  web: PriceEntry | null;
  quoteBase: PriceEntry | null;
  landing: LandingQuote | null;
}

const SOURCE_RANK: Record<SourceType, number> = {
  factory_cif: 1,
  factory_fob: 2,
  factory_exw: 3,
  local_distributor: 4,
  historical_quote: 5,
  web_scrape: 6,
};

const HEADER_ALIASES: Record<string, keyof NormalizedPriceRow | 'id'> = {
  equipo: 'equipment_name',
  equipment_name: 'equipment_name',
  equipment: 'equipment_name',
  nombre: 'equipment_name',
  categoria: 'category',
  category: 'category',
  marca: 'brand',
  brand: 'brand',
  modelo: 'model',
  model: 'model',
  specs: 'specs_summary',
  specs_summary: 'specs_summary',
  especificaciones: 'specs_summary',
  invima: 'invima_registration',
  invima_registration: 'invima_registration',
  registro_invima: 'invima_registration',
  invima_status: 'invima_status',
  estado_invima: 'invima_status',
  source_type: 'source_type',
  origen: 'source_type',
  tipo_origen: 'source_type',
  proveedor: 'supplier_or_source_name',
  supplier: 'supplier_or_source_name',
  supplier_or_source_name: 'supplier_or_source_name',
  fuente: 'supplier_or_source_name',
  pais: 'supplier_country',
  supplier_country: 'supplier_country',
  email: 'contact_email',
  contact_email: 'contact_email',
  url: 'source_url_or_ref',
  source_url_or_ref: 'source_url_or_ref',
  referencia: 'source_url_or_ref',
  moneda: 'currency',
  currency: 'currency',
  precio: 'unit_cost_original',
  unit_cost_original: 'unit_cost_original',
  costo: 'unit_cost_original',
  precio_min: 'price_min_original',
  price_min_original: 'price_min_original',
  precio_medio: 'price_avg_original',
  price_avg_original: 'price_avg_original',
  precio_max: 'price_max_original',
  price_max_original: 'price_max_original',
  incoterm: 'incoterm',
  tier_min_qty: 'tier_min_qty',
  cantidad_minima: 'tier_min_qty',
  escala: 'tier_min_qty',
  lead_time: 'lead_time',
  tiempo_entrega: 'lead_time',
  iva: 'iva_mode',
  iva_mode: 'iva_mode',
  trm: 'trm_applied',
  trm_applied: 'trm_applied',
  flete_pct: 'freight_pct',
  freight_pct: 'freight_pct',
  arancel_pct: 'duty_pct',
  duty_pct: 'duty_pct',
  margen_pct: 'ime_margin_pct',
  ime_margin_pct: 'ime_margin_pct',
  landed_cop: 'estimated_landed_cost_cop',
  estimated_landed_cost_cop: 'estimated_landed_cost_cop',
  suggested_sale_price_cop: 'suggested_sale_price_cop',
  precio_venta_cop: 'suggested_sale_price_cop',
  max_reference_price_cop: 'max_reference_price_cop',
  precio_max_referencia_cop: 'max_reference_price_cop',
  estampillas_pct: 'public_stamp_surcharge_pct',
  public_stamp_surcharge_pct: 'public_stamp_surcharge_pct',
  valid_until: 'valid_until',
  vigencia: 'valid_until',
  captured_at: 'captured_at',
  fecha: 'captured_at',
  notes: 'notes',
  notas: 'notes',
  product_id: 'product_id',
  external_key: 'external_key',
};

export function sourceGroup(source: SourceType): SourceGroup {
  if (source === 'local_distributor') return 'local';
  if (source === 'web_scrape') return 'web';
  if (source === 'historical_quote') return 'historical';
  return 'factory';
}

export function emptyAssumptions(): LandingAssumptions {
  return {
    trm: null,
    freightPct: null,
    dutyPct: null,
    marginPct: null,
    stampPct: null,
    applyStamp: false,
  };
}

export function roundMoney(value: number, currency: string): number {
  if (!Number.isFinite(value)) return value;
  if (currency.toUpperCase() === 'COP') return Math.round(value);
  return Math.round(value * 100) / 100;
}

export function formatIntelMoney(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'COP' ? 0 : 2,
    }).format(value);
  } catch {
    return `${roundMoney(value, code).toLocaleString('es-CO')} ${code}`;
  }
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return null;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let normalized = cleaned;
  if (lastDot >= 0 && lastComma >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = cleaned.split(',');
    const tail = parts[parts.length - 1] ?? '';
    normalized =
      parts.length > 2 || tail.length === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  } else if (lastDot >= 0) {
    const parts = cleaned.split('.');
    const groups = parts.slice(1);
    if (groups.length > 0 && groups.every(part => part.length === 3)) {
      normalized = cleaned.replace(/\./g, '');
    }
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function sanitizeIlike(value: string): string {
  return value
    .replace(/[%_,()*"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPriceStale(
  entry: Pick<PriceEntry, 'captured_at' | 'valid_until'>,
  now = Date.now()
): boolean {
  if (entry.valid_until) {
    const until = Date.parse(entry.valid_until);
    if (Number.isFinite(until) && until < now) return true;
  }
  const captured = Date.parse(entry.captured_at);
  if (!Number.isFinite(captured)) return false;
  return now - captured > STALE_PRICE_DAYS * 24 * 60 * 60 * 1000;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function intelligenceGroupKey(
  entry: Pick<PriceEntry, 'brand' | 'model' | 'equipment_name'>
): string {
  const model = normalizeKey(entry.model ?? '');
  const brand = normalizeKey(entry.brand ?? '');
  if (model) return `${brand}|${model}`;
  return normalizeKey(entry.equipment_name);
}

export function buildExternalKey(input: {
  source_type: string;
  supplier_or_source_name?: string | null;
  model?: string | null;
  equipment_name: string;
  currency: string;
  tier_min_qty: number;
  source_url_or_ref?: string | null;
  captured_at: string;
}): string {
  const day = input.captured_at.slice(0, 10);
  const parts = [
    normalizeKey(input.source_type),
    normalizeKey(input.supplier_or_source_name ?? ''),
    normalizeKey(input.model || input.equipment_name),
    input.currency.toLowerCase(),
    String(input.tier_min_qty),
    normalizeKey(input.source_url_or_ref ?? ''),
    day,
  ].filter(Boolean);
  return parts.join(':').slice(0, 180);
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return parseMoney(value);
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseSourceType(value: unknown, incoterm: Incoterm | null): SourceType | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if ((SOURCE_TYPES as readonly string[]).includes(raw)) return raw as SourceType;
  if (['fob', 'fabrica_fob', 'factory fob', 'proveedor fabrica fob'].includes(raw))
    return 'factory_fob';
  if (['exw', 'fabrica_exw', 'factory exw'].includes(raw)) return 'factory_exw';
  if (['cif', 'fabrica_cif', 'factory cif'].includes(raw)) return 'factory_cif';
  if (['local', 'distribuidor', 'distribuidor local', 'distribuidor_local'].includes(raw))
    return 'local_distributor';
  if (['web', 'scraping', 'web scraping', 'mercado', 'referencia web'].includes(raw))
    return 'web_scrape';
  if (['historico', 'historica', 'cotizacion historica'].includes(raw)) return 'historical_quote';
  if (!raw || raw === 'proveedor fabrica' || raw === 'fabrica') {
    if (incoterm === 'CIF') return 'factory_cif';
    if (incoterm === 'EXW') return 'factory_exw';
    if (incoterm === 'FOB') return 'factory_fob';
    if (incoterm === 'WEB_REF') return 'web_scrape';
    if (incoterm === 'LOCAL' || incoterm === 'DDP_COLOMBIA') return 'local_distributor';
  }
  return null;
}

export function parseIncoterm(value: unknown): Incoterm | null {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if ((INCOTERMS as readonly string[]).includes(raw)) return raw as Incoterm;
  if (raw === 'DDP' || raw === 'DDP_CO') return 'DDP_COLOMBIA';
  if (raw === 'WEB' || raw === 'WEBREF') return 'WEB_REF';
  return null;
}

function parseIvaMode(value: unknown): IvaMode | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if ((IVA_MODES as readonly string[]).includes(raw)) return raw as IvaMode;
  if (['mas iva', '+iva', '+ iva', 'sin iva', 'antes de iva'].includes(raw)) return 'mas_iva';
  if (['iva incluido', 'con iva'].includes(raw)) return 'incluido';
  return null;
}

function aliasRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const alias = HEADER_ALIASES[normalizeKey(key).replace(/-/g, '_')];
    const target = alias ?? (normalizeKey(key).replace(/-/g, '_') as keyof NormalizedPriceRow);
    if (target === 'id') continue;
    out[target] = value;
  }
  return out;
}

export function normalizePriceInput(
  raw: Record<string, unknown>,
  nowIso = new Date().toISOString()
): { ok: true; row: NormalizedPriceRow } | { ok: false; error: string } {
  const input = aliasRow(raw);
  const equipment = textOrNull(input['equipment_name']);
  if (!equipment) return { ok: false, error: 'Falta el nombre del equipo.' };
  const incoterm = parseIncoterm(input['incoterm']);
  if (!incoterm) return { ok: false, error: `Incoterm no válido para ${equipment}.` };
  const source = parseSourceType(input['source_type'], incoterm);
  if (!source) return { ok: false, error: `Origen no válido para ${equipment}.` };
  const currency = (textOrNull(input['currency']) ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    return { ok: false, error: `Moneda no válida para ${equipment}.` };
  const unit = numberOrNull(input['unit_cost_original']);
  if (unit == null || unit < 0) return { ok: false, error: `Precio no válido para ${equipment}.` };
  const tierRaw = numberOrNull(input['tier_min_qty']);
  const tier = tierRaw == null ? 1 : Math.floor(tierRaw);
  if (tier < 1) return { ok: false, error: `La escala de ${equipment} debe ser al menos 1.` };
  const captured = textOrNull(input['captured_at']) ?? nowIso;
  if (!Number.isFinite(Date.parse(captured))) {
    return { ok: false, error: `Fecha de captura no válida para ${equipment}.` };
  }
  const email = textOrNull(input['contact_email']);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: `Email no válido para ${equipment}.` };
  }
  const metadata = asRecord(input['raw_metadata']) ?? {};
  const supplier = textOrNull(input['supplier_or_source_name']);
  const model = textOrNull(input['model']);
  const sourceRef = textOrNull(input['source_url_or_ref']);
  const external =
    textOrNull(input['external_key']) ??
    buildExternalKey({
      source_type: source,
      supplier_or_source_name: supplier,
      model,
      equipment_name: equipment,
      currency,
      tier_min_qty: tier,
      source_url_or_ref: sourceRef,
      captured_at: captured,
    });
  return {
    ok: true,
    row: {
      equipment_name: equipment,
      source_type: source,
      currency,
      unit_cost_original: unit,
      incoterm,
      tier_min_qty: tier,
      product_id: textOrNull(input['product_id']),
      category: textOrNull(input['category']),
      brand: textOrNull(input['brand']),
      model,
      specs_summary: textOrNull(input['specs_summary']),
      invima_registration: textOrNull(input['invima_registration']),
      invima_status: textOrNull(input['invima_status']),
      supplier_or_source_name: supplier,
      supplier_country: textOrNull(input['supplier_country']),
      contact_email: email,
      source_url_or_ref: sourceRef,
      price_min_original: numberOrNull(input['price_min_original']),
      price_avg_original: numberOrNull(input['price_avg_original']),
      price_max_original: numberOrNull(input['price_max_original']),
      lead_time: textOrNull(input['lead_time']),
      iva_mode: parseIvaMode(input['iva_mode']),
      trm_applied: numberOrNull(input['trm_applied']),
      freight_pct: numberOrNull(input['freight_pct']),
      duty_pct: numberOrNull(input['duty_pct']),
      ime_margin_pct: numberOrNull(input['ime_margin_pct']),
      estimated_landed_cost_cop: numberOrNull(input['estimated_landed_cost_cop']),
      suggested_sale_price_cop: numberOrNull(input['suggested_sale_price_cop']),
      max_reference_price_cop: numberOrNull(input['max_reference_price_cop']),
      public_stamp_surcharge_pct: numberOrNull(input['public_stamp_surcharge_pct']),
      valid_until: textOrNull(input['valid_until']),
      captured_at: new Date(captured).toISOString(),
      notes: textOrNull(input['notes']),
      raw_metadata: metadata,
      external_key: external,
    },
  };
}

export function parsePriceBatch(
  payload: unknown
): { ok: true; rows: NormalizedPriceRow[] } | { ok: false; error: string } {
  const records = batchRecords(payload);
  if (!records)
    return {
      ok: false,
      error: 'El lote debe ser un JSON (objeto o arreglo) o un CSV con encabezados.',
    };
  if (records.length === 0) return { ok: false, error: 'El lote no trae filas.' };
  if (records.length > 500) return { ok: false, error: 'El lote supera 500 filas.' };
  const rows: NormalizedPriceRow[] = [];
  const errors: string[] = [];
  records.forEach((record, index) => {
    const parsed = normalizePriceInput(record);
    if (!parsed.ok) errors.push(`Fila ${index + 1}: ${parsed.error}`);
    else rows.push(parsed.row);
  });
  if (errors.length) return { ok: false, error: errors.slice(0, 8).join(' ') };
  return { ok: true, rows };
}

function batchRecords(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) {
    return payload.every(item => asRecord(item)) ? (payload as Record<string, unknown>[]) : null;
  }
  const record = asRecord(payload);
  if (!record) return null;
  if (Array.isArray(record['rows'])) return batchRecords(record['rows']);
  if (typeof record['csv'] === 'string') return parseCsvRecords(record['csv']);
  if (typeof record['json'] === 'string') {
    try {
      return batchRecords(JSON.parse(record['json']) as unknown);
    } catch {
      return null;
    }
  }
  return [record];
}

export function parseCsvRecords(text: string): Record<string, unknown>[] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] ?? '';
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
  const filled = rows.filter(item => item.some(value => value.trim() !== ''));
  const header = filled[0];
  if (!header) return [];
  return filled.slice(1).map(values => {
    const record: Record<string, unknown> = {};
    header.forEach((key, index) => {
      record[key.trim()] = values[index]?.trim() ?? '';
    });
    return record;
  });
}

function positive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function pctOrNull(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function freightApplies(incoterm: Incoterm, source: SourceType): boolean {
  if (source === 'web_scrape' || source === 'local_distributor') return false;
  return incoterm === 'FOB' || incoterm === 'EXW';
}

function dutyApplies(incoterm: Incoterm, source: SourceType): boolean {
  if (source === 'web_scrape' || source === 'local_distributor') return false;
  if (incoterm === 'DDP_COLOMBIA' || incoterm === 'WEB_REF' || incoterm === 'LOCAL') return false;
  return incoterm === 'FOB' || incoterm === 'EXW' || incoterm === 'CIF';
}

/**
 * Aterriza a COP.
 * COP local / DDP / web en COP: el importe ya está en pesos.
 * Moneda extranjera: costo × TRM. FOB y EXW multiplican flete y arancel solo
 * si el usuario los indicó. CIF multiplica arancel, no flete. Un precio web
 * extranjero solo se convierte con TRM.
 */
export function quoteLanding(entry: PriceEntry, assumptions: LandingAssumptions): LandingQuote {
  const missing: string[] = [];
  const trm = positive(assumptions.trm) ?? positive(entry.trm_applied);
  const freight = pctOrNull(assumptions.freightPct) ?? pctOrNull(entry.freight_pct);
  const duty = pctOrNull(assumptions.dutyPct) ?? pctOrNull(entry.duty_pct);
  const margin = pctOrNull(assumptions.marginPct) ?? pctOrNull(entry.ime_margin_pct);
  let partial = false;
  let landed: number | null = null;

  if (entry.currency === 'COP') {
    landed = roundMoney(entry.unit_cost_original, 'COP');
  } else if (trm) {
    let multiplier = 1;
    if (freightApplies(entry.incoterm, entry.source_type)) {
      if (freight == null) {
        missing.push('flete');
        partial = true;
      } else multiplier *= 1 + freight / 100;
    }
    if (dutyApplies(entry.incoterm, entry.source_type)) {
      if (duty == null) {
        missing.push('arancel');
        partial = true;
      } else multiplier *= 1 + duty / 100;
    }
    landed = roundMoney(entry.unit_cost_original * trm * multiplier, 'COP');
  } else if (positive(entry.estimated_landed_cost_cop)) {
    landed = roundMoney(entry.estimated_landed_cost_cop ?? 0, 'COP');
    partial = true;
    missing.push('trm');
  } else {
    missing.push('trm');
  }

  let suggested: number | null = null;
  if (landed != null && margin != null) {
    suggested = roundMoney(landed * (1 + margin / 100), 'COP');
  } else if (positive(entry.suggested_sale_price_cop) && assumptions.marginPct == null) {
    suggested = roundMoney(entry.suggested_sale_price_cop ?? 0, 'COP');
  } else if (landed != null) {
    missing.push('margen');
  }

  const stampBase = stampBaseCop(entry, landed, suggested, trm);
  const stampPct = assumptions.applyStamp
    ? (pctOrNull(assumptions.stampPct) ?? pctOrNull(entry.public_stamp_surcharge_pct) ?? 30)
    : null;
  const stampPrice =
    assumptions.applyStamp && stampBase != null && stampPct != null
      ? roundMoney(stampBase * (1 + stampPct / 100), 'COP')
      : null;
  if (assumptions.applyStamp && stampBase == null) missing.push('precio máximo');

  return {
    landedCop: landed,
    suggestedCop: suggested,
    stampBaseCop: stampBase,
    stampPriceCop: stampPrice,
    partial,
    missing: [...new Set(missing)],
  };
}

export function stampBaseCop(
  entry: PriceEntry,
  landedCop: number | null,
  suggestedCop: number | null,
  trm: number | null
): number | null {
  const convertedMax = toCop(entry.price_max_original, entry.currency, trm);
  const convertedUnit =
    entry.source_type === 'web_scrape' || entry.source_type === 'local_distributor'
      ? toCop(entry.unit_cost_original, entry.currency, trm)
      : null;
  const candidates = [
    positive(entry.max_reference_price_cop),
    convertedMax,
    convertedUnit,
    positive(suggestedCop),
    entry.source_type === 'web_scrape' ? positive(landedCop) : null,
  ].filter((value): value is number => value != null);
  if (!candidates.length) return null;
  return Math.max(...candidates);
}

export function toCop(amount: number | null, currency: string, trm: number | null): number | null {
  const value = positive(amount);
  if (value == null) return null;
  if (currency.toUpperCase() === 'COP') return roundMoney(value, 'COP');
  const rate = positive(trm);
  if (!rate) return null;
  return roundMoney(value * rate, 'COP');
}

function representative(entries: PriceEntry[], now: number): PriceEntry | null {
  const unit = entries.filter(entry => entry.tier_min_qty <= 1);
  return newest(unit.length ? unit : entries, now);
}

function newest(entries: PriceEntry[], now: number): PriceEntry | null {
  if (!entries.length) return null;
  const fresh = entries.filter(entry => !isPriceStale(entry, now));
  const pool = fresh.length ? fresh : entries;
  return (
    [...pool].sort((a, b) => {
      const rank = SOURCE_RANK[a.source_type] - SOURCE_RANK[b.source_type];
      if (rank !== 0) return rank;
      if (a.tier_min_qty !== b.tier_min_qty) return b.tier_min_qty - a.tier_min_qty;
      return Date.parse(b.captured_at) - Date.parse(a.captured_at);
    })[0] ?? null
  );
}

function tierEligible(entries: PriceEntry[], qty: number): PriceEntry[] {
  const eligible = entries.filter(entry => entry.tier_min_qty <= qty);
  if (eligible.length) return eligible;
  const lowest = Math.min(...entries.map(entry => entry.tier_min_qty));
  return entries.filter(entry => entry.tier_min_qty === lowest);
}

export function selectBestPrice(
  entries: PriceEntry[],
  options: { qty?: number; now?: number; assumptions?: LandingAssumptions } = {}
): BestPriceResult {
  const qty = options.qty && options.qty > 0 ? options.qty : 1;
  const now = options.now ?? Date.now();
  const pool = tierEligible(entries, qty);
  const supplier = newest(
    pool.filter(entry => sourceGroup(entry.source_type) !== 'web'),
    now
  );
  const web = newest(
    pool.filter(entry => entry.source_type === 'web_scrape'),
    now
  );
  const quoteBase = supplier ?? web;
  const assumptions = options.assumptions ?? emptyAssumptions();
  return {
    supplier,
    web,
    quoteBase,
    landing: quoteBase ? quoteLanding(quoteBase, assumptions) : null,
  };
}

function deltaPct(other: number | null, base: number | null): number | null {
  if (other == null || base == null || base === 0) return null;
  return Math.round(((other - base) / base) * 1000) / 10;
}

export function buildComparisons(
  entries: PriceEntry[],
  assumptions: LandingAssumptions = emptyAssumptions(),
  now = Date.now()
): PriceComparison[] {
  const groups = new Map<string, PriceEntry[]>();
  for (const entry of entries) {
    const key = intelligenceGroupKey(entry);
    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  }
  const trm = positive(assumptions.trm);
  return [...groups.entries()]
    .map(([key, group]) => {
      const factory = representative(
        group.filter(entry => sourceGroup(entry.source_type) === 'factory'),
        now
      );
      const local = representative(
        group.filter(entry => sourceGroup(entry.source_type) === 'local'),
        now
      );
      const web = representative(
        group.filter(entry => sourceGroup(entry.source_type) === 'web'),
        now
      );
      const historical = representative(
        group.filter(entry => sourceGroup(entry.source_type) === 'historical'),
        now
      );
      const sample = factory ?? local ?? web ?? historical ?? group[0];
      if (!sample) return null;
      const factoryLanded = factory ? quoteLanding(factory, assumptions).landedCop : null;
      const localCop = local
        ? (quoteLanding(local, assumptions).landedCop ??
          toCop(local.unit_cost_original, local.currency, trm))
        : null;
      const webTrm = positive(assumptions.trm) ?? positive(web?.trm_applied ?? null);
      const webMin = web
        ? toCop(web.price_min_original ?? web.unit_cost_original, web.currency, webTrm)
        : null;
      const webAvg = web
        ? toCop(web.price_avg_original ?? web.unit_cost_original, web.currency, webTrm)
        : null;
      const webMax = web
        ? toCop(web.price_max_original ?? web.unit_cost_original, web.currency, webTrm)
        : null;
      const label = [sample.brand, sample.model || sample.equipment_name].filter(Boolean).join(' ');
      return {
        key,
        label: label || sample.equipment_name,
        brand: sample.brand,
        model: sample.model,
        category: sample.category,
        invimaStatus: sample.invima_status,
        factory,
        local,
        web,
        historical,
        tiers: [...group].sort((a, b) => a.tier_min_qty - b.tier_min_qty),
        factoryLandedCop: factoryLanded,
        localCop,
        webMinCop: webMin,
        webAvgCop: webAvg,
        webMaxCop: webMax,
        deltaLocalVsFactoryPct: deltaPct(localCop, factoryLanded),
        deltaWebVsFactoryPct: deltaPct(webMax ?? webAvg, factoryLanded),
        stale: group.some(entry => isPriceStale(entry, now)),
      } satisfies PriceComparison;
    })
    .filter((item): item is PriceComparison => item != null)
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function priceForQuoteCurrency(
  quoteCurrency: 'COP' | 'USD',
  amountCop: number | null,
  trm: number | null
): number | null {
  const amount = positive(amountCop);
  if (amount == null) return null;
  if (quoteCurrency === 'COP') return roundMoney(amount, 'COP');
  const rate = positive(trm);
  if (!rate) return null;
  return roundMoney(amount / rate, 'USD');
}

export function entryFromRow(row: Record<string, unknown>): PriceEntry | null {
  const source = parseSourceType(row['source_type'], parseIncoterm(row['incoterm']));
  const incoterm = parseIncoterm(row['incoterm']);
  const equipment = textOrNull(row['equipment_name']);
  const currency = (textOrNull(row['currency']) ?? '').toUpperCase();
  const unit = numberOrNull(row['unit_cost_original']);
  if (!source || !incoterm || !equipment || !/^[A-Z]{3}$/.test(currency) || unit == null)
    return null;
  return {
    id: textOrNull(row['id']) ?? '',
    product_id: textOrNull(row['product_id']),
    category: textOrNull(row['category']),
    equipment_name: equipment,
    brand: textOrNull(row['brand']),
    model: textOrNull(row['model']),
    specs_summary: textOrNull(row['specs_summary']),
    invima_registration: textOrNull(row['invima_registration']),
    invima_status: textOrNull(row['invima_status']),
    source_type: source,
    supplier_or_source_name: textOrNull(row['supplier_or_source_name']),
    supplier_country: textOrNull(row['supplier_country']),
    contact_email: textOrNull(row['contact_email']),
    source_url_or_ref: textOrNull(row['source_url_or_ref']),
    currency,
    unit_cost_original: unit,
    price_min_original: numberOrNull(row['price_min_original']),
    price_avg_original: numberOrNull(row['price_avg_original']),
    price_max_original: numberOrNull(row['price_max_original']),
    incoterm,
    tier_min_qty: Math.max(1, Math.floor(numberOrNull(row['tier_min_qty']) ?? 1)),
    lead_time: textOrNull(row['lead_time']),
    iva_mode: parseIvaMode(row['iva_mode']),
    trm_applied: numberOrNull(row['trm_applied']),
    freight_pct: numberOrNull(row['freight_pct']),
    duty_pct: numberOrNull(row['duty_pct']),
    ime_margin_pct: numberOrNull(row['ime_margin_pct']),
    estimated_landed_cost_cop: numberOrNull(row['estimated_landed_cost_cop']),
    suggested_sale_price_cop: numberOrNull(row['suggested_sale_price_cop']),
    max_reference_price_cop: numberOrNull(row['max_reference_price_cop']),
    public_stamp_surcharge_pct: numberOrNull(row['public_stamp_surcharge_pct']),
    valid_until: textOrNull(row['valid_until']),
    captured_at: textOrNull(row['captured_at']) ?? new Date(0).toISOString(),
    notes: textOrNull(row['notes']),
    raw_metadata: asRecord(row['raw_metadata']) ?? {},
    external_key: textOrNull(row['external_key']),
  };
}

export function assumptionsFromFields(fields: {
  trm: string;
  freightPct: string;
  dutyPct: string;
  marginPct: string;
  stampPct: string;
  applyStamp: boolean;
}): LandingAssumptions {
  const num = (raw: string): number | null => {
    const text = raw.trim();
    if (!text) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  };
  return {
    trm: num(fields.trm),
    freightPct: num(fields.freightPct),
    dutyPct: num(fields.dutyPct),
    marginPct: num(fields.marginPct),
    stampPct: num(fields.stampPct),
    applyStamp: fields.applyStamp,
  };
}
