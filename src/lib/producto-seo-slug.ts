/**
 * Slugs de PDP orientados a SEO: descripción + modelo/referencia + fabricante.
 * Conserva la descripción actual cuando ya es legible; solo completa lo que falte.
 */

const JUNK_BRANDS = new Set([
  'c',
  'l',
  'm',
  'arn',
  'bm',
  'c3',
  'sunny',
  'kit-cpap',
  'nuprep-skin',
  'prematuro-wigglepads',
  'sistema-resusa',
]);

const BAD_BRAND_PREFIX =
  /^(monitor de|circuito|blender|kit de|mesa de|sistema de|torre de|prong|cascada|cable|autoclave|equipo|canula|cánula|gorro|mascara|máscara|silla|cama|lampara|lámpara|incubadora|ventilador|bomba|manta|humidificador|carrito|carro|camilla)/i;

const KNOWN_BRANDS: Array<{ label: string; slug: string; match: RegExp }> = [
  { label: 'Fisher & Paykel', slug: 'fisher-paykel', match: /fisher\s*(&|and)?\s*paykel/i },
  { label: 'Saikang', slug: 'saikang', match: /\bsaikang\b/i },
  { label: 'Biolight', slug: 'biolight', match: /\bbiolight\b/i },
  { label: 'Mindray', slug: 'mindray', match: /\bmindray\b/i },
  { label: 'SLE', slug: 'sle', match: /\bsle\b/i },
  { label: 'Air Liquide', slug: 'air-liquide', match: /air\s*liquide/i },
  { label: 'Penlon', slug: 'penlon', match: /\bpenlon\b/i },
  { label: 'Dr. Mach', slug: 'dr-mach', match: /dr\.?\s*mach/i },
  { label: 'BenQ', slug: 'benq', match: /\bbenq\b/i },
  { label: 'Natus', slug: 'natus', match: /\bnatus\b/i },
  { label: 'Ilumitec', slug: 'ilumitec', match: /\bilumitec\b/i },
  { label: 'Belmont', slug: 'belmont', match: /\bbelmont\b/i },
  { label: 'BIOBASE', slug: 'biobase', match: /\bbiobase\b/i },
  { label: 'Medentech', slug: 'medentech', match: /\bmedentech\b/i },
  { label: 'PadBot', slug: 'padbot', match: /\bpadbot\b/i },
  { label: 'Konfort Plus', slug: 'konfort-plus', match: /\bkonfort\s*plus\b/i },
  { label: 'Angell', slug: 'angell', match: /\bangell\b/i },
  { label: 'Advanced', slug: 'advanced', match: /\badvanced\b/i },
  { label: 'Northern', slug: 'northern', match: /\bnorthern\b/i },
  { label: 'Bistos', slug: 'bistos', match: /\bbistos\b/i },
  { label: 'Medin', slug: 'medin', match: /\bmedin\b/i },
  { label: 'Bio-Med', slug: 'bio-med', match: /\bbio-?med\b/i },
  { label: 'Rayto', slug: 'rayto', match: /\brayto\b/i },
  { label: 'Mercury', slug: 'mercury', match: /\bmercury\b/i },
  { label: 'Saniswiss', slug: 'saniswiss', match: /\bsaniswiss\b/i },
];

const BRAND_SLUG_ALIASES: Record<string, string> = {
  'saikang medical': 'saikang',
  saikang: 'saikang',
  'fisher & paykel': 'fisher-paykel',
  'fisher and paykel': 'fisher-paykel',
  'angell technology': 'angell',
  angell: 'angell',
  'natus medical': 'natus',
  natus: 'natus',
  'air liquide': 'air-liquide',
  'konfort plus': 'konfort-plus',
  'dr. mach': 'dr-mach',
  'dr mach': 'dr-mach',
  'bio-med': 'bio-med',
  biomed: 'bio-med',
  'rayto life and analytical sciences co ltd': 'rayto',
  'rayto life and analytical sciences co.,ltd.': 'rayto',
  'rayto life and analytical sciences co.,ltd': 'rayto',
};

export type ProductoSeoSlugInput = {
  slug: string;
  nombre_es?: string | null;
  sku?: string | null;
  marca?: string | null;
  atributos?: {
    marca?: unknown;
    fabricante?: unknown;
    brand?: unknown;
    legacy_slugs?: unknown;
  } | null;
};

export type ProductoSeoSlugPlan = {
  oldSlug: string;
  newSlug: string;
  changed: boolean;
  brand: string | null;
  brandSlug: string | null;
  model: string | null;
};

export type ProductoSeoSlugOptions = {
  /** Fuerza `-ref-{modelo}` aunque el modelo ya esté inline en la descripción. */
  strictRef?: boolean;
};

export function slugifyProductoSeo(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function isUsefulBrand(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  if (JUNK_BRANDS.has(trimmed.toLowerCase())) return false;
  if (BAD_BRAND_PREFIX.test(trimmed)) return false;
  return true;
}

export function brandSlugFromLabel(brand: string): string {
  const key = brand.toLowerCase().trim().replace(/\.+$/, '');
  if (BRAND_SLUG_ALIASES[key]) return BRAND_SLUG_ALIASES[key]!;
  for (const known of KNOWN_BRANDS) {
    if (known.match.test(brand)) return known.slug;
  }
  const slug = slugifyProductoSeo(brand);
  if (slug.length > 24) {
    const first = slug.split('-').find(part => part.length > 2);
    if (first) return first;
  }
  return slug;
}

export function resolveUsefulBrand(input: ProductoSeoSlugInput): string | null {
  const attrs = input.atributos ?? {};
  const candidates = [
    firstText(attrs.fabricante),
    firstText(attrs.marca),
    firstText(input.marca),
    firstText(attrs.brand),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (isUsefulBrand(candidate)) return candidate;
  }

  const haystack = `${input.nombre_es ?? ''} ${input.slug}`;
  for (const known of KNOWN_BRANDS) {
    if (known.match.test(haystack)) return known.label;
  }
  return null;
}

export function isOpaqueProductSlug(slug: string): boolean {
  if (!slug || slug === 'test') return false;
  if (/^(g|sk|skc|skd|skm|skh|skb|skw|skr|sku|ske|skl|sks)-/i.test(slug)) return true;
  if (
    /^[a-z]{1,4}-?\d/i.test(slug) &&
    slug.split('-').length <= 3 &&
    !/(incubadora|bomba|cama|monitor|sistema|lampara|maquina|ventilador|silla|sillon|carrito|carro)/.test(
      slug
    )
  ) {
    return true;
  }
  return slug.split('-').length < 3;
}

export function extractModelSlug(input: ProductoSeoSlugInput): string | null {
  const sku = String(input.sku ?? '').trim();
  const name = String(input.nombre_es ?? '');

  if (sku && !/^EQ-/i.test(sku) && sku.length >= 2 && sku.length <= 36) {
    if (/^SK[A-Z]?-/i.test(sku)) {
      const nameRef = name.match(/\b(?:Ref\.?\s*)?([A-Z]{2,}[-.]?\d[\w().-]{1,24}|\d{3,}[A-Z]?)\b/);
      if (nameRef?.[1]) {
        const fromName = slugifyProductoSeo(nameRef[1].replace(/[()]/g, ''));
        if (fromName.length >= 3) return fromName;
      }
    }
    return slugifyProductoSeo(sku);
  }

  const ref = name.match(/\bRef\.?\s*([A-Za-z0-9][\w./()-]{1,30})/i);
  if (ref?.[1]) return slugifyProductoSeo(ref[1].replace(/[()]/g, ''));

  const withoutBrand = name
    .replace(
      /\b(Fisher\s*&\s*Paykel|Saikang(?:\s+Medical)?|Advanced|Angell(?:\s+Technology)?|Northern|Ilumitec|Belmont|Natus(?:\s+Medical)?|Konfort\s*Plus|Rayto|Biolight|Mindray|Penlon|BenQ|BIOBASE|Medentech|PadBot|Bistos|Medin|Bio-?Med|Air\s*Liquide|Dr\.?\s*Mach|SLE|Mercury|Saniswiss)\b/gi,
      ''
    )
    .trim();
  const tokens = withoutBrand.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i]!.replace(/[(),]/g, '');
    if (/^[A-Za-z]{0,6}\d[\w-]{0,20}$/.test(token) || /^[A-Z]{2,}[-/][A-Za-z0-9]+$/i.test(token)) {
      const model = slugifyProductoSeo(token);
      if (model.length >= 3) return model;
    }
  }
  return null;
}

function descriptionBase(
  input: ProductoSeoSlugInput,
  brand: string | null,
  model: string | null
): string {
  let name = String(input.nombre_es ?? '')
    .split('|')[0]!
    .trim()
    .replace(/\+/g, ' Plus ');
  name = name.replace(/\bRef\.?\s*[A-Za-z0-9][\w./()-]*/gi, ' ');
  if (brand) {
    name = name.replace(new RegExp(escapeRegExp(brand), 'gi'), ' ');
  }
  name = name.replace(
    /\b(Saikang(?:\s+Medical)?|Fisher\s*&\s*Paykel|Angell(?:\s+Technology)?|Advanced|Northern|Ilumitec|Belmont|Natus(?:\s+Medical)?|Konfort\s*Plus|Rayto(?:\s+Life[\w\s.,]*)?|Biolight|Mindray|Penlon|BenQ|BIOBASE|Medentech|PadBot|Bistos|Medin|Bio-?Med|Air\s*Liquide|Dr\.?\s*Mach|SLE|Mercury|Saniswiss)\b/gi,
    ' '
  );
  if (model) {
    const modelLoose = model.replace(/-/g, '[-\\s]?');
    name = name.replace(new RegExp(modelLoose, 'ig'), ' ');
  }
  return slugifyProductoSeo(name.replace(/\s+/g, ' ').trim());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugContainsBrand(slug: string, brandSlug: string): boolean {
  if (slug === brandSlug || slug.endsWith(`-${brandSlug}`) || slug.startsWith(`${brandSlug}-`)) {
    return true;
  }
  if (slug.includes(`-${brandSlug}-`)) return true;
  const parts = brandSlug.split('-').filter(part => part.length > 2);
  if (parts.length > 1) return parts.every(part => slug.includes(part));
  return parts.some(part => slug.includes(part));
}

function slugContainsModel(slug: string, model: string): boolean {
  if (slug.includes(model)) return true;
  const parts = model.split('-').filter(part => part.length >= 2);
  if (parts.length === 0) return true;
  if (parts.length === 1) {
    const token = parts[0]!;
    if (slug.includes(token)) return true;
    // SKU compuesto tipo sle6000 ya cubierto por ...-ref-6000-sle
    const splitAlphaNum = token.match(/^([a-z]+)(\d+[a-z0-9]*)$/i);
    if (splitAlphaNum) {
      const [, alpha, num] = splitAlphaNum;
      if (alpha && num && slug.includes(alpha.toLowerCase()) && slug.includes(num.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
  const hits = parts.filter(part => slug.includes(part)).length;
  return hits >= Math.ceil(parts.length * 0.6);
}

/** Convierte `{desc}-{modelo}-{marca}` en `{desc}-ref-{modelo}-{marca}`. */
export function normalizeExplicitRefSlug(
  slug: string,
  model: string,
  brandSlug: string | null
): string {
  let base = slug;
  if (brandSlug && base.endsWith(`-${brandSlug}`)) {
    base = base.slice(0, -(brandSlug.length + 1));
  }
  if (base === model) {
    base = '';
  } else if (base.endsWith(`-${model}`)) {
    base = base.slice(0, -(model.length + 1));
  } else {
    for (const part of model.split('-').filter(Boolean).reverse()) {
      if (part.length >= 2 && base.endsWith(`-${part}`)) {
        base = base.slice(0, -(part.length + 1));
      }
    }
  }
  base = slugifyProductoSeo(base);
  // Si la descripción quedó como prefijo del modelo (slug era solo modelo+marca),
  // preferir `ref-{modelo}-{marca}` limpio.
  if (!base || model === base || model.startsWith(`${base}-`)) {
    const parts = ['ref', model];
    if (brandSlug) parts.push(brandSlug);
    return slugifyProductoSeo(parts.join('-'));
  }
  const parts = [base, 'ref', model];
  if (brandSlug) parts.push(brandSlug);
  return slugifyProductoSeo(parts.join('-'));
}

export function needsExplicitRefSegment(slug: string, model: string): boolean {
  if (!model) return false;
  // Ya tiene -ref- y el modelo está en el slug (p.ej. ref-ainno-light20).
  if (/-ref-/.test(slug) && slugContainsModel(slug, model)) return false;
  return slugContainsModel(slug, model);
}

function clampSlug(slug: string, brandSlug: string | null, model: string | null): string {
  const MAX = 96;
  if (slug.length <= MAX) return slug;
  const tailParts = [model ? `ref-${model}` : null, brandSlug].filter(Boolean) as string[];
  const tail = tailParts.join('-');
  const budget = Math.max(24, MAX - (tail ? tail.length + 1 : 0));
  let head = slug;
  if (tail && head.endsWith(`-${tail}`)) head = head.slice(0, -(tail.length + 1));
  else if (brandSlug && head.endsWith(`-${brandSlug}`)) {
    head = head.slice(0, -(brandSlug.length + 1));
  }
  head = head.slice(0, budget).replace(/-+$/g, '');
  return [head, tail].filter(Boolean).join('-');
}

/**
 * Plan de URL canónica: `{descripcion}[-ref-{modelo}][-{fabricante}]`.
 * No renombra el producto de prueba `test`.
 */
export function planProductoSeoSlug(
  input: ProductoSeoSlugInput,
  options: ProductoSeoSlugOptions = {}
): ProductoSeoSlugPlan {
  const oldSlug = input.slug;
  if (oldSlug === 'test') {
    return {
      oldSlug,
      newSlug: oldSlug,
      changed: false,
      brand: null,
      brandSlug: null,
      model: null,
    };
  }

  const brand = resolveUsefulBrand(input);
  const brandSlug = brand ? brandSlugFromLabel(brand) : null;
  const model = extractModelSlug(input);
  let slug = oldSlug;

  if (isOpaqueProductSlug(slug)) {
    const desc = descriptionBase(input, brand, model);
    const parts: string[] = [];
    if (desc) parts.push(desc);
    if (model && !desc.includes(model)) {
      parts.push('ref', model);
    }
    if (brandSlug) parts.push(brandSlug);
    slug = parts.join('-');
  } else {
    if (model && !slugContainsModel(slug, model)) {
      if (brandSlug && slug.endsWith(`-${brandSlug}`)) {
        slug = `${slug.slice(0, -(brandSlug.length + 1))}-ref-${model}-${brandSlug}`;
      } else {
        slug = `${slug}-ref-${model}`;
      }
    }
    if (brandSlug && !slugContainsBrand(slug, brandSlug)) {
      slug = `${slug}-${brandSlug}`;
    }
  }

  slug = slugifyProductoSeo(slug);
  if (brandSlug) {
    slug = slug.replace(new RegExp(`(-${escapeRegExp(brandSlug)}){2,}$`), `-${brandSlug}`);
  }
  slug = slug.replace(/(-ref){2,}-/g, '-ref-');
  if (options.strictRef && model && needsExplicitRefSegment(slug, model)) {
    slug = normalizeExplicitRefSlug(slug, model, brandSlug);
  }
  slug = clampSlug(slug, brandSlug, model);

  return {
    oldSlug,
    newSlug: slug,
    changed: slug !== oldSlug,
    brand,
    brandSlug,
    model,
  };
}

export function ensureUniqueProductoSeoSlug(
  planned: string,
  occupied: Set<string>,
  disambiguator?: string | null
): string {
  if (!occupied.has(planned)) return planned;
  const extra = slugifyProductoSeo(disambiguator ?? '') || 'x';
  let candidate = `${planned}-${extra}`.replace(/-+/g, '-');
  let n = 2;
  while (occupied.has(candidate)) {
    candidate = `${planned}-${extra}-${n}`;
    n += 1;
  }
  return candidate;
}

export function mergeLegacySlugs(existing: unknown, oldSlug: string, newSlug: string): string[] {
  const fromExisting = Array.isArray(existing)
    ? existing.filter((value): value is string => typeof value === 'string' && Boolean(value))
    : [];
  return [...new Set([...fromExisting, oldSlug])].filter(slug => slug && slug !== newSlug);
}
