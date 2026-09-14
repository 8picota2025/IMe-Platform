/**
 * Lógica de cliente del catálogo: filtros, búsqueda, facetas, paginación,
 * sincronización con la URL y comparador. Opera sobre el DOM ya renderizado
 * por CatalogoExplorer.astro (progressive enhancement, sin SPA).
 */
import { t, type Locale } from '../i18n/utils';
import { normalizarTexto, type CatalogoIndexItem } from './catalogo';
import { getAccionComercial } from './comercial';
import { normalizarMoneda, tienePrecioPublico } from './format';
import { resetTransientUiState } from './motion';
import {
  getComparador,
  toggleComparador,
  clearComparador,
  MAX_COMPARADOR,
  COMPARADOR_EVENT,
} from './comparador';

const PAGE_SIZE = 48;
const SEARCH_SYNONYMS: Record<string, string[]> = {
  defibrillator: ['desfibrilador', 'dea', 'aed'],
  desfibrilador: ['defibrillator', 'dea', 'aed'],
  monitor: ['monitoreo', 'multiparametrico', 'multiparameter'],
  ultrasound: ['ultrasonido', 'ecografo', 'ecografia'],
  ultrasonido: ['ultrasound', 'ecografo', 'ecografia'],
  incubator: ['incubadora', 'neonatal'],
  incubadora: ['incubator', 'neonatal'],
  ventilator: ['ventilador', 'respirador'],
  ventilador: ['ventilator', 'respirador'],
};

interface CatalogoState {
  familia: string;
  /** Subcategoría (slug de tipo) dentro de la familia seleccionada. */
  tipo: string;
  q: string;
  comercial: Set<string>;
  destacado: boolean;
  nuevo: boolean;
  disponible: string;
  modalidades: Set<string>;
  facetas: Map<string, Set<string>>;
  pagina: number;
  todos: boolean;
  orden: string;
}

/** @internal exported for unit tests */
export function parseStateFromUrl(
  search = typeof window !== 'undefined' ? window.location.search : ''
): CatalogoState {
  const params = new URLSearchParams(search);
  const facetas = new Map<string, Set<string>>();
  const filtrosParam = params.get('filtros');
  if (filtrosParam) {
    for (const parte of filtrosParam.split(';')) {
      const [claveRaw, valoresRaw] = parte.split(':');
      if (!claveRaw || !valoresRaw) continue;
      const clave = decodeURIComponent(claveRaw);
      const valores = new Set(valoresRaw.split(',').filter(Boolean).map(decodeURIComponent));
      if (valores.size > 0) facetas.set(clave, valores);
    }
  }
  const paginaRaw = Number.parseInt(params.get('pagina') ?? '1', 10);
  return {
    familia: params.get('familia') ?? params.get('cat') ?? '',
    tipo: params.get('tipo') ?? '',
    q: params.get('q') ?? '',
    comercial: new Set((params.get('comercial') ?? '').split(',').filter(Boolean)),
    destacado: params.get('destacado') === '1',
    nuevo: params.get('nuevo') === '1',
    disponible: params.get('disponible') ?? '',
    modalidades: new Set((params.get('modalidad') ?? '').split(',').filter(Boolean)),
    facetas,
    pagina: Number.isFinite(paginaRaw) && paginaRaw > 0 ? paginaRaw : 1,
    todos: params.get('todos') === '1',
    orden: params.get('orden') ?? 'relevancia',
  };
}

/** @internal exported for unit tests */
export function serializeState(state: CatalogoState): string {
  const params = new URLSearchParams();
  if (state.familia) params.set('familia', state.familia);
  if (state.tipo) params.set('tipo', state.tipo);
  if (state.q) params.set('q', state.q);
  if (state.comercial.size > 0) params.set('comercial', [...state.comercial].join(','));
  if (state.destacado) params.set('destacado', '1');
  if (state.nuevo) params.set('nuevo', '1');
  if (state.disponible) params.set('disponible', state.disponible);
  if (state.modalidades.size > 0) params.set('modalidad', [...state.modalidades].join(','));
  if (state.facetas.size > 0) {
    const partes = [...state.facetas.entries()].map(
      ([clave, valores]) =>
        `${encodeURIComponent(clave)}:${[...valores].map(encodeURIComponent).join(',')}`
    );
    params.set('filtros', partes.join(';'));
  }
  if (state.orden && state.orden !== 'relevancia') params.set('orden', state.orden);
  if (state.pagina > 1) params.set('pagina', String(state.pagina));
  const sinOtrosFiltros =
    !state.familia &&
    !state.tipo &&
    !state.q &&
    state.comercial.size === 0 &&
    !state.destacado &&
    !state.nuevo &&
    state.facetas.size === 0;
  if (state.todos && sinOtrosFiltros) params.set('todos', '1');
  return params.toString();
}

function shouldShowGrid(state: CatalogoState): boolean {
  return (
    state.todos ||
    state.familia !== '' ||
    state.tipo !== '' ||
    state.q !== '' ||
    state.comercial.size > 0 ||
    state.destacado ||
    state.nuevo ||
    state.disponible !== '' ||
    state.modalidades.size > 0 ||
    state.facetas.size > 0
  );
}

function getInitialFeaturedCards(cards: HTMLElement[]): HTMLElement[] {
  const destacados = cards.filter(card => card.dataset['destacado'] === '1');
  return destacados.length > 0 ? destacados : cards.slice(0, PAGE_SIZE);
}

function parseSpecs(card: HTMLElement): Record<string, string> {
  try {
    const parsed = JSON.parse(card.dataset['specs'] ?? '{}') as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    return {};
  } catch {
    return {};
  }
}

function getSearchTerms(raw: string): string[] {
  const base = normalizarTexto(raw);
  if (!base) return [];
  const terms = new Set([base]);
  for (const part of base.split(/\s+/).filter(Boolean)) {
    terms.add(part);
    for (const synonym of SEARCH_SYNONYMS[part] ?? []) terms.add(normalizarTexto(synonym));
  }
  return [...terms].filter(Boolean);
}

function normalizeSearchText(text: string): string {
  return normalizarTexto(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cada término escrito debe aparecer; un sinónimo puede satisfacer ese término.
 * Al tokenizar separadores como guiones, "DUS-5000" también coincide con "dus 5000".
 */
export function matchesSearchText(text: string, query: string): boolean {
  const searchable = new Set(normalizeSearchText(text).split(' ').filter(Boolean));
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  return tokens.every(token => {
    const alternatives = [token, ...(SEARCH_SYNONYMS[token] ?? [])]
      .flatMap(term => normalizeSearchText(term).split(' '))
      .filter(Boolean);
    return alternatives.some(term => searchable.has(term));
  });
}

function relevanceScore(
  card: HTMLElement,
  state: CatalogoState,
  order: Map<HTMLElement, number>
): number {
  const terms = getSearchTerms(state.q);
  let score = 0;
  const nombre = normalizarTexto(card.dataset['nombre'] ?? '');
  const familia = normalizarTexto(card.dataset['familiaNombre'] ?? card.dataset['familia'] ?? '');
  const texto = card.dataset['busqueda'] ?? '';
  const specs = normalizarTexto(Object.values(parseSpecs(card)).join(' '));

  for (const term of terms) {
    if (nombre === term) score += 1200;
    else if (nombre.startsWith(term)) score += 900;
    else if (nombre.includes(term)) score += 700;

    if (familia === term) score += 500;
    else if (familia.includes(term)) score += 350;

    if (specs.includes(term)) score += 180;
    if (texto.includes(term)) score += 80;
  }

  if (state.familia && (card.dataset['familias'] ?? '').split(/\s+/).includes(state.familia)) {
    score += 60;
  }
  if (state.tipo && card.dataset['tipo'] === state.tipo) score += 40;
  if (card.dataset['destacado'] === '1') score += 15;
  return score * 10000 - (order.get(card) ?? 0);
}

/** @internal exported for unit tests */
export function matchesBase(card: HTMLElement, state: CatalogoState): boolean {
  if (state.familia) {
    const familias = (card.dataset['familias'] ?? card.dataset['familia'] ?? '').split(/\s+/);
    if (!familias.includes(state.familia)) return false;
  }
  if (state.tipo) {
    const tipoSlug = card.dataset['tipo'] ?? '';
    if (state.tipo === '__general__') {
      if (tipoSlug) return false;
    } else if (tipoSlug !== state.tipo) {
      return false;
    }
  }
  if (state.comercial.size > 0 && !state.comercial.has(card.dataset['comercial'] ?? '')) {
    return false;
  }
  if (state.destacado && card.dataset['destacado'] !== '1') return false;
  if (state.nuevo && card.dataset['nuevo'] !== '1') return false;
  if (state.disponible === '1' && card.dataset['disponible'] !== '1') return false;
  if (state.disponible === '0' && card.dataset['disponible'] !== '0') return false;
  if (state.modalidades.size > 0 && !state.modalidades.has(card.dataset['fulfillment'] ?? '')) {
    return false;
  }
  if (state.q) {
    const texto = card.dataset['busqueda'] ?? '';
    if (!matchesSearchText(texto, state.q)) return false;
  }
  return true;
}

/** Tipos presentes en un conjunto de cards (para facetas de tipo). */
export function collectTiposFromCards(
  cards: HTMLElement[]
): Array<{ slug: string; nombre: string; count: number }> {
  const map = new Map<string, { nombre: string; count: number }>();
  let generalCount = 0;
  for (const card of cards) {
    const slug = card.dataset['tipo'] ?? '';
    if (!slug) {
      generalCount += 1;
      continue;
    }
    const nombre = card.dataset['tipoNombre'] ?? slug;
    const prev = map.get(slug);
    if (prev) prev.count += 1;
    else map.set(slug, { nombre, count: 1 });
  }
  const list = [...map.entries()]
    .map(([slug, meta]) => ({ slug, nombre: meta.nombre, count: meta.count }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  if (generalCount > 0) {
    list.push({ slug: '__general__', nombre: '', count: generalCount });
  }
  return list;
}

function computeFacetas(cards: HTMLElement[]): Map<string, string[]> {
  const acumulado = new Map<string, Set<string>>();
  for (const card of cards) {
    const specs = parseSpecs(card);
    for (const [clave, valor] of Object.entries(specs)) {
      if (!acumulado.has(clave)) acumulado.set(clave, new Set());
      acumulado.get(clave)?.add(valor);
    }
  }
  const resultado = new Map<string, string[]>();
  for (const [clave, valores] of acumulado) {
    if (valores.size >= 2) resultado.set(clave, [...valores].sort());
  }
  return resultado;
}

/**
 * Envuelve la primera coincidencia (acento/mayúsculas insensible) en <mark>.
 * Si query está vacío, restaura el texto original.
 */
function resaltar(el: HTMLElement, queryNormalizado: string): void {
  const original = el.textContent ?? '';
  if (!queryNormalizado) {
    if (el.children.length > 0) el.textContent = original;
    return;
  }
  const normalizado = normalizarTexto(original);
  const idx = normalizado.indexOf(queryNormalizado);
  if (idx === -1) {
    if (el.children.length > 0) el.textContent = original;
    return;
  }
  el.textContent = '';
  const mark = document.createElement('mark');
  mark.textContent = original.slice(idx, idx + queryNormalizado.length);
  el.append(original.slice(0, idx), mark, original.slice(idx + queryNormalizado.length));
}

function matchesFacetas(card: HTMLElement, facetas: Map<string, Set<string>>): boolean {
  if (facetas.size === 0) return true;
  const specs = parseSpecs(card);
  for (const [clave, valores] of facetas) {
    if (valores.size === 0) continue;
    const valor = specs[clave];
    if (!valor || !valores.has(valor)) return false;
  }
  return true;
}

export function initCatalogo(locale: Locale): () => void {
  const root = document.getElementById('catalogo-root');
  if (!root) return () => undefined;

  const grid = document.getElementById('vista-productos');
  const familiasView = document.getElementById('vista-familias');
  let cards = Array.from(grid?.querySelectorAll<HTMLElement>('[data-producto-slug]') ?? []);
  const initialCards = cards;
  let cardOrder = new Map(cards.map((card, index) => [card, index]));
  const buscarInput = document.getElementById('catalogo-buscar') as HTMLInputElement | null;
  const contador = document.getElementById('catalogo-contador');
  const anuncios = document.getElementById('catalogo-anuncios');
  const sinResultados = document.getElementById('catalogo-sin-resultados');
  const familiaLista = document.getElementById('catalogo-familia-lista');
  const tipoLista = document.getElementById('catalogo-tipo-lista');
  const tipoBloque = document.getElementById('catalogo-tipo-bloque');
  const comercialContenedor = document.getElementById('catalogo-comercial');
  const destacadoInput = document.getElementById(
    'catalogo-filtro-destacado'
  ) as HTMLInputElement | null;
  const nuevoInput = document.getElementById('catalogo-filtro-nuevo') as HTMLInputElement | null;
  const disponibilidadInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="catalogo-disponibilidad"]')
  );
  const modalidadInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-filtro-modalidad]')
  );
  const facetasContenedor = document.getElementById('catalogo-facetas');
  const ordenSelect = document.getElementById('catalogo-orden') as HTMLSelectElement | null;
  const resetBtns = Array.from(document.querySelectorAll('[data-reset-filtros]'));
  const mostrarTodosBtns = Array.from(document.querySelectorAll('[data-mostrar-todos]'));
  const paginacion = document.getElementById('catalogo-paginacion');
  const familiaActualEl = document.getElementById('catalogo-familia-actual');
  const familiaActualNombre = document.getElementById('catalogo-familia-actual-nombre');
  const familiaActualTipo = document.getElementById('catalogo-familia-actual-tipo');
  const familiaActualIcono = document.getElementById('catalogo-familia-actual-icono');
  const familiaActualQuitar = document.getElementById('catalogo-familia-actual-quitar');
  const tipoChips = document.getElementById('catalogo-tipo-chips');
  const resultadosEl = document.getElementById('catalogo-resultados');
  const filtrosToggle = document.getElementById('catalogo-filtros-toggle');
  const filtrosPanel = document.getElementById('catalogo-filtros');
  const filtrosCerrar = document.getElementById('catalogo-filtros-cerrar');
  const filtrosBackdrop = document.getElementById('catalogo-filtros-backdrop');
  const quickviewDialog = document.getElementById('quickview-dialog') as HTMLDialogElement | null;
  const quickviewImagen = document.getElementById('quickview-imagen') as HTMLImageElement | null;
  const quickviewFamilia = document.getElementById('quickview-familia');
  const quickviewNombre = document.getElementById('quickview-nombre');
  const quickviewDescripcion = document.getElementById('quickview-descripcion');
  const quickviewModalidad = document.getElementById('quickview-modalidad');
  const quickviewDisponibilidad = document.getElementById('quickview-disponibilidad');
  const quickviewStock = document.getElementById('quickview-stock');
  const quickviewPrecio = document.getElementById('quickview-precio');
  const quickviewFicha = document.getElementById('quickview-ficha') as HTMLAnchorElement | null;
  const quickviewCta = document.getElementById('quickview-cta') as HTMLButtonElement | null;
  const quickviewWhatsapp = document.getElementById(
    'quickview-whatsapp'
  ) as HTMLAnchorElement | null;
  let cleanupComparadorWindow: (() => void) | null = null;

  const state = parseStateFromUrl();
  const staticPage = root.dataset['staticPage'] === 'true';
  let fullCatalogRequested = state.todos;
  let catalogoIndex: CatalogoIndexItem[] | null = null;
  let catalogoIndexPending: Promise<CatalogoIndexItem[]> | null = null;
  if (staticPage && !shouldShowGrid(state)) state.todos = true;

  const familiasMap = new Map<string, string>();
  familiasView?.querySelectorAll<HTMLElement>('[data-familia-link]').forEach(el => {
    const slug = el.dataset['familiaLink'];
    const nombre = el.dataset['familiaNombre'];
    if (slug) familiasMap.set(slug, nombre ?? slug);
  });

  function announce(msg: string): void {
    if (!anuncios) return;
    anuncios.textContent = '';
    window.requestAnimationFrame(() => {
      anuncios.textContent = msg;
    });
  }

  function isCatalogoIndexItem(item: unknown): item is CatalogoIndexItem {
    return (
      !!item &&
      typeof item === 'object' &&
      typeof (item as { slug?: unknown }).slug === 'string' &&
      typeof (item as { nombre?: unknown }).nombre === 'string' &&
      typeof (item as { familia?: { slug?: unknown; nombre?: unknown } }).familia?.slug ===
        'string' &&
      typeof (item as { familia?: { slug?: unknown; nombre?: unknown } }).familia?.nombre ===
        'string'
    );
  }

  async function loadCatalogoIndex(): Promise<CatalogoIndexItem[]> {
    if (catalogoIndex) return catalogoIndex;
    if (!catalogoIndexPending) {
      catalogoIndexPending = fetch(`/data/catalogo-index.${locale}.json`, {
        headers: { Accept: 'application/json' },
      })
        .then(async response => {
          if (!response.ok) return [];
          const data = (await response.json()) as unknown;
          return Array.isArray(data) ? data.filter(isCatalogoIndexItem) : [];
        })
        .catch(() => []);
    }
    catalogoIndex = await catalogoIndexPending;
    return catalogoIndex;
  }

  function indexItemMatchesBase(item: CatalogoIndexItem, filterState: CatalogoState): boolean {
    const familias = item.familias_filtro ?? [item.familia.slug];
    if (filterState.familia && !familias.includes(filterState.familia)) return false;
    const tipo = item.tipo?.slug ?? '';
    if (
      filterState.tipo &&
      (filterState.tipo === '__general__' ? !!tipo : tipo !== filterState.tipo)
    ) {
      return false;
    }
    if (filterState.comercial.size > 0 && !filterState.comercial.has(item.tipo_comercial ?? '')) {
      return false;
    }
    if (filterState.destacado && !item.destacado) return false;
    if (filterState.nuevo && !item.nuevo) return false;
    if (filterState.disponible === '1' && item.disponible === false) return false;
    if (filterState.disponible === '0' && item.disponible !== false) return false;
    if (
      filterState.modalidades.size > 0 &&
      !filterState.modalidades.has(item.fulfillment_mode ?? '')
    ) {
      return false;
    }
    return !filterState.q || matchesSearchText(item.texto_busqueda ?? '', filterState.q);
  }

  function materializeIndexItem(item: CatalogoIndexItem): HTMLElement {
    const card = document.createElement('li');
    const href = `/${locale}/${locale === 'en' ? 'products' : 'productos'}/${item.slug}/`;
    const imagen = item.imagen_principal ?? '/assets/img-placeholder.svg';
    card.className = 'card producto-card';
    card.dataset['productoSlug'] = item.slug;
    card.dataset['nombre'] = item.nombre;
    card.dataset['imagen'] = imagen;
    card.dataset['familia'] = item.familia.slug;
    card.dataset['familias'] = (item.familias_filtro ?? [item.familia.slug]).join(' ');
    card.dataset['familiaNombre'] = item.familia.nombre;
    card.dataset['tipo'] = item.tipo?.slug ?? '';
    card.dataset['tipoNombre'] = item.tipo?.nombre ?? '';
    card.dataset['comercial'] = item.tipo_comercial ?? '';
    card.dataset['fulfillment'] = item.fulfillment_mode ?? '';
    card.dataset['disponible'] = item.disponible === false ? '0' : '1';
    card.dataset['destacado'] = item.destacado ? '1' : '0';
    card.dataset['nuevo'] = item.nuevo ? '1' : '0';
    card.dataset['busqueda'] = item.texto_busqueda ?? '';
    card.dataset['specs'] = JSON.stringify(item.especificaciones_reducidas ?? {});
    card.dataset['precio'] = item.precio == null ? '' : String(item.precio);
    card.dataset['moneda'] = item.moneda ?? 'COP';
    card.dataset['stock'] = item.stock == null ? '' : String(item.stock);
    card.dataset['href'] = href;

    const link = document.createElement('a');
    link.className = 'producto-card__link';
    link.href = href;
    link.setAttribute('aria-label', `${t(locale, 'catalogo.ver_detalle')}: ${item.nombre}`);
    const image = document.createElement('img');
    image.className = 'producto-card__img';
    image.src = imagen;
    image.alt = item.nombre;
    image.width = 400;
    image.height = 280;
    image.loading = 'lazy';
    image.decoding = 'async';
    const media = document.createElement('div');
    media.className = 'producto-card__img-wrapper';
    media.appendChild(image);
    const body = document.createElement('div');
    body.className = 'producto-card__body';
    const family = document.createElement('p');
    family.className = 'producto-card__familia';
    family.textContent = item.tipo?.nombre
      ? `${item.familia.nombre} · ${item.tipo.nombre}`
      : item.familia.nombre;
    const name = document.createElement('h3');
    name.className = 'producto-card__nombre';
    name.textContent = item.nombre;
    const description = document.createElement('p');
    description.className = 'producto-card__desc';
    description.textContent = item.descripcion_corta;
    const cta = document.createElement('span');
    cta.className = 'btn btn-secondary producto-card__cta';
    cta.textContent = t(locale, 'catalogo.ver_detalle');
    body.append(family, name, description, cta);
    link.append(media, body);
    const compare = document.createElement('label');
    compare.className = 'producto-card__compare';
    const compareInput = document.createElement('input');
    compareInput.type = 'checkbox';
    compareInput.className = 'producto-card__compare-input';
    compareInput.dataset['compareSlug'] = item.slug;
    compareInput.checked = getComparador().includes(item.slug);
    compare.append(compareInput, ` ${t(locale, 'catalogo.comparar_anadir')}`);
    const quick = document.createElement('button');
    quick.type = 'button';
    quick.className = 'btn btn-secondary producto-card__quick';
    quick.dataset['quickView'] = '';
    quick.textContent = t(locale, 'catalogo.vista_rapida');
    card.append(link, compare, quick);
    return card;
  }

  async function materializeMatchingRemoteCards(): Promise<void> {
    const items = await loadCatalogoIndex();
    if (!grid || items.length === 0) return;
    const existingSlugs = new Set(cards.map(card => card.dataset['productoSlug']).filter(Boolean));
    const baseState = { ...state, facetas: new Map<string, Set<string>>() };
    const remoteCards = items
      .filter(item => !existingSlugs.has(item.slug) && indexItemMatchesBase(item, baseState))
      .map(materializeIndexItem);
    if (remoteCards.length === 0) return;
    grid.append(...remoteCards);
    cards = [...cards, ...remoteCards];
    cardOrder = new Map(cards.map((card, index) => [card, index]));
  }

  function scrollToResultados(): void {
    if (!resultadosEl) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultadosEl.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
  }

  function syncFiltrosUI(): void {
    if (buscarInput) buscarInput.value = state.q;
    if (ordenSelect) ordenSelect.value = state.orden;
    familiaLista?.querySelectorAll<HTMLButtonElement>('[data-familia-filter]').forEach(btn => {
      const valor = btn.dataset['familiaFilter'] ?? '';
      const activo = valor === state.familia;
      btn.classList.toggle('catalogo-filtros__familia--activa', activo);
      if (activo) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
    tipoLista?.querySelectorAll<HTMLButtonElement>('[data-tipo-filter]').forEach(btn => {
      const valor = btn.dataset['tipoFilter'] ?? '';
      const activo = valor === state.tipo;
      btn.classList.toggle('catalogo-filtros__tipo--activa', activo);
      if (activo) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
    tipoChips?.querySelectorAll<HTMLButtonElement>('[data-tipo-filter]').forEach(btn => {
      const valor = btn.dataset['tipoFilter'] ?? '';
      const activo = valor === state.tipo;
      btn.classList.toggle('catalogo-tipo-chip--activa', activo);
      if (activo) btn.setAttribute('aria-pressed', 'true');
      else btn.setAttribute('aria-pressed', 'false');
    });
    comercialContenedor
      ?.querySelectorAll<HTMLInputElement>('[data-filtro-comercial]')
      .forEach(input => {
        input.checked = state.comercial.has(input.dataset['filtroComercial'] ?? '');
      });
    if (destacadoInput) destacadoInput.checked = state.destacado;
    if (nuevoInput) nuevoInput.checked = state.nuevo;
    disponibilidadInputs.forEach(input => {
      input.checked = input.value === (state.disponible || '');
    });
    modalidadInputs.forEach(input => {
      input.checked = state.modalidades.has(input.dataset['filtroModalidad'] ?? '');
    });
  }

  function bindTipoFilterButtons(container: HTMLElement | null): void {
    container?.querySelectorAll<HTMLButtonElement>('[data-tipo-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const valor = btn.dataset['tipoFilter'] ?? '';
        state.tipo = state.tipo === valor ? '' : valor;
        state.pagina = 1;
        syncFiltrosUI();
        applyFiltros();
      });
    });
  }

  function renderTipoFacetas(cardsAmbito: HTMLElement[]): void {
    const tipos = state.familia ? collectTiposFromCards(cardsAmbito) : [];
    const show = state.familia !== '' && tipos.length >= 1;

    // Si el tipo activo ya no aplica al ámbito, limpialo.
    if (state.tipo && !tipos.some(t => t.slug === state.tipo)) {
      state.tipo = '';
    }

    if (tipoBloque) tipoBloque.hidden = !show;
    if (tipoChips) tipoChips.hidden = !show;

    if (!show) {
      if (tipoLista) tipoLista.innerHTML = '';
      if (tipoChips) tipoChips.innerHTML = '';
      return;
    }

    const renderButtons = (target: HTMLElement, variant: 'sidebar' | 'chips') => {
      target.innerHTML = '';
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.dataset['tipoFilter'] = '';
      allBtn.className = variant === 'chips' ? 'catalogo-tipo-chip' : 'catalogo-filtros__tipo';
      allBtn.textContent = t(locale, 'catalogo.todos_tipos');
      target.appendChild(allBtn);

      for (const tipo of tipos) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset['tipoFilter'] = tipo.slug;
        btn.className = variant === 'chips' ? 'catalogo-tipo-chip' : 'catalogo-filtros__tipo';
        const label =
          tipo.slug === '__general__' ? t(locale, 'catalogo.tipo_general') : tipo.nombre;
        btn.textContent = variant === 'chips' ? `${label} (${tipo.count})` : label;
        btn.title = `${label} (${tipo.count})`;
        target.appendChild(btn);
      }
      bindTipoFilterButtons(target);
    };

    if (tipoLista) renderButtons(tipoLista, 'sidebar');
    if (tipoChips) renderButtons(tipoChips, 'chips');
  }

  function renderFacetas(facetas: Map<string, string[]>): void {
    if (!facetasContenedor) return;
    // Descarta selecciones de facetas que ya no aplican al ámbito actual
    for (const clave of [...state.facetas.keys()]) {
      const disponibles = facetas.get(clave);
      if (!disponibles) {
        state.facetas.delete(clave);
        continue;
      }
      const filtradas = new Set(
        [...state.facetas.get(clave)!].filter(v => disponibles.includes(v))
      );
      if (filtradas.size === 0) state.facetas.delete(clave);
      else state.facetas.set(clave, filtradas);
    }

    facetasContenedor.innerHTML = '';
    facetasContenedor.hidden = facetas.size === 0;
    if (facetas.size === 0) return;

    const heading = document.createElement('p');
    heading.className = 'catalogo-filtros__heading';
    heading.textContent = t(locale, 'catalogo.facetas_titulo');
    facetasContenedor.appendChild(heading);

    let contador = 0;
    for (const [clave, valores] of facetas) {
      const grupo = document.createElement('fieldset');
      grupo.className = 'catalogo-filtros__grupo';
      const legend = document.createElement('legend');
      legend.textContent = clave;
      grupo.appendChild(legend);
      for (const valor of valores) {
        contador += 1;
        const id = `catalogo-faceta-${contador}`;
        const label = document.createElement('label');
        label.className = 'catalogo-filtros__opcion';
        label.htmlFor = id;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = state.facetas.get(clave)?.has(valor) ?? false;
        input.addEventListener('change', () => {
          if (input.checked) {
            if (!state.facetas.has(clave)) state.facetas.set(clave, new Set());
            state.facetas.get(clave)?.add(valor);
          } else {
            state.facetas.get(clave)?.delete(valor);
            if (state.facetas.get(clave)?.size === 0) state.facetas.delete(clave);
          }
          state.pagina = 1;
          applyFiltros();
        });
        label.appendChild(input);
        label.append(` ${valor}`);
        grupo.appendChild(label);
      }
      facetasContenedor.appendChild(grupo);
    }
  }

  function renderPaginacion(totalPaginas: number, actual: number): void {
    if (staticPage && !hasActiveFilters()) return;
    if (!paginacion) return;
    paginacion.innerHTML = '';
    if (totalPaginas <= 1) {
      paginacion.hidden = true;
      return;
    }
    paginacion.hidden = false;

    const anterior = document.createElement('button');
    anterior.type = 'button';
    anterior.className = 'btn btn-secondary';
    anterior.textContent = t(locale, 'comun.anterior');
    anterior.disabled = actual <= 1;
    anterior.addEventListener('click', () => {
      state.pagina = Math.max(1, state.pagina - 1);
      applyFiltros();
      scrollToResultados();
    });

    const info = document.createElement('p');
    info.className = 'catalogo-paginacion__info';
    info.textContent = `${t(locale, 'comun.pagina')} ${actual} ${t(locale, 'comun.de')} ${totalPaginas}`;

    const siguiente = document.createElement('button');
    siguiente.type = 'button';
    siguiente.className = 'btn btn-secondary';
    siguiente.textContent = t(locale, 'comun.siguiente');
    siguiente.disabled = actual >= totalPaginas;
    siguiente.addEventListener('click', () => {
      state.pagina = Math.min(totalPaginas, state.pagina + 1);
      applyFiltros();
      scrollToResultados();
    });

    paginacion.append(anterior, info, siguiente);
  }

  function hasActiveFilters(): boolean {
    return (
      state.familia !== '' ||
      state.tipo !== '' ||
      state.q !== '' ||
      state.comercial.size > 0 ||
      state.destacado ||
      state.nuevo ||
      state.disponible !== '' ||
      state.modalidades.size > 0 ||
      state.facetas.size > 0 ||
      state.orden !== 'relevancia'
    );
  }

  function updateFamiliaActual(): void {
    if (!familiaActualEl || !familiaActualNombre) return;
    if (!state.familia) {
      familiaActualEl.hidden = true;
      if (familiaActualTipo) {
        familiaActualTipo.textContent = '';
        familiaActualTipo.hidden = true;
      }
      if (familiaActualIcono) {
        familiaActualIcono.replaceChildren();
        familiaActualIcono.style.display = 'none';
      }
      return;
    }
    familiaActualEl.hidden = false;
    familiaActualNombre.textContent = familiasMap.get(state.familia) ?? state.familia;
    if (familiaActualTipo) {
      if (state.tipo) {
        const tipoLabel =
          state.tipo === '__general__'
            ? t(locale, 'catalogo.tipo_general')
            : (cards.find(c => c.dataset['tipo'] === state.tipo)?.dataset['tipoNombre'] ??
              state.tipo);
        familiaActualTipo.textContent = tipoLabel;
        familiaActualTipo.hidden = false;
      } else {
        familiaActualTipo.textContent = '';
        familiaActualTipo.hidden = true;
      }
    }
    if (familiaActualIcono) {
      const iconoOrigen = familiasView?.querySelector<SVGElement>(
        `[data-familia-link="${CSS.escape(state.familia)}"] .categoria-card__icon svg`
      );
      familiaActualIcono.replaceChildren();
      if (iconoOrigen) {
        familiaActualIcono.appendChild(iconoOrigen.cloneNode(true));
        familiaActualIcono.style.display = 'inline-flex';
      } else {
        familiaActualIcono.style.display = 'none';
      }
    }
  }

  function updateFiltrosToggle(open: boolean): void {
    if (!filtrosToggle) return;
    filtrosToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    filtrosToggle.textContent = t(
      locale,
      open ? 'catalogo.cerrar_filtros' : 'catalogo.abrir_filtros'
    );
  }

  function setFiltrosPanelOpen(open: boolean): void {
    if (!filtrosPanel) return;
    filtrosPanel.classList.toggle('catalogo-filtros--abierto', open);
    if (filtrosBackdrop) filtrosBackdrop.hidden = !open;
    updateFiltrosToggle(open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  async function applyFiltros(): Promise<void> {
    if (staticPage && (fullCatalogRequested || hasActiveFilters())) {
      await materializeMatchingRemoteCards();
    }
    const mostrarGrid = shouldShowGrid(state);

    if (familiasView) familiasView.hidden = mostrarGrid;
    if (grid) grid.hidden = !mostrarGrid;
    if (mostrarGrid) setFiltrosPanelOpen(false);

    if (!mostrarGrid) {
      const visibles = getInitialFeaturedCards(initialCards);
      const totalPaginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
      if (state.pagina > totalPaginas || state.pagina < 1) state.pagina = 1;
      const inicio = (state.pagina - 1) * PAGE_SIZE;
      const visiblesPagina = new Set(visibles.slice(inicio, inicio + PAGE_SIZE));

      if (grid) grid.hidden = false;
      cards.forEach(card => {
        card.hidden = !visiblesPagina.has(card);
      });

      if (sinResultados) sinResultados.hidden = true;
      if (facetasContenedor) facetasContenedor.hidden = true;
      if (familiaActualEl) familiaActualEl.hidden = true;
      if (tipoBloque) tipoBloque.hidden = true;
      if (tipoChips) {
        tipoChips.hidden = true;
        tipoChips.innerHTML = '';
      }
      if (tipoLista) tipoLista.innerHTML = '';
      if (contador) {
        const etiqueta =
          visibles.length === 1
            ? t(locale, 'catalogo.resultados_un')
            : t(locale, 'catalogo.resultados_otros');
        contador.textContent = `${visibles.length} ${etiqueta}`;
      }
      renderPaginacion(totalPaginas, state.pagina);
      history.replaceState(null, '', buildUrl());
      return;
    }

    // Primero resuelve tipos del ámbito familia (puede limpiar state.tipo inválido),
    // luego aplica el filtro completo incluyendo tipo.
    const ambitoFamilia = state.familia
      ? cards.filter(card =>
          matchesBase(card, {
            ...state,
            tipo: '',
            facetas: new Map(),
          })
        )
      : [];
    renderTipoFacetas(ambitoFamilia);

    const baseCoincide = cards.filter(card => matchesBase(card, state));
    syncFiltrosUI();

    const facetas = computeFacetas(baseCoincide);
    renderFacetas(facetas);

    let visibles = baseCoincide.filter(card => matchesFacetas(card, state.facetas));
    if (state.orden === 'relevancia') {
      visibles = [...visibles].sort(
        (a, b) => relevanceScore(b, state, cardOrder) - relevanceScore(a, state, cardOrder)
      );
    } else if (state.orden === 'nombre_asc' || state.orden === 'nombre_desc') {
      const factor = state.orden === 'nombre_asc' ? 1 : -1;
      visibles = [...visibles].sort((a, b) => {
        const an = a.dataset['nombre'] ?? '';
        const bn = b.dataset['nombre'] ?? '';
        return (
          factor *
          an.localeCompare(bn, locale === 'en' ? 'en' : 'es', {
            sensitivity: 'base',
          })
        );
      });
    } else if (state.orden === 'precio_asc' || state.orden === 'precio_desc') {
      const factor = state.orden === 'precio_asc' ? 1 : -1;
      visibles = [...visibles].sort((a, b) => {
        const ap = Number.parseFloat(a.dataset['precio'] ?? '');
        const bp = Number.parseFloat(b.dataset['precio'] ?? '');
        const aVal = Number.isFinite(ap) ? ap : Number.POSITIVE_INFINITY;
        const bVal = Number.isFinite(bp) ? bp : Number.POSITIVE_INFINITY;
        return factor * (aVal - bVal);
      });
    }

    if (grid) {
      const resto = cards.filter(card => !visibles.includes(card));
      [...visibles, ...resto].forEach(card => grid.appendChild(card));
    }

    const totalPaginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE));
    if (state.pagina > totalPaginas) state.pagina = totalPaginas;
    if (state.pagina < 1) state.pagina = 1;
    const inicio = (state.pagina - 1) * PAGE_SIZE;
    const visiblesPagina = new Set(visibles.slice(inicio, inicio + PAGE_SIZE));

    cards.forEach(card => {
      card.hidden = !visiblesPagina.has(card);
    });

    const queryNormalizado = state.q ? normalizarTexto(state.q) : '';
    cards.forEach(card => {
      const nombreEl = card.querySelector<HTMLElement>('.producto-card__nombre');
      const descEl = card.querySelector<HTMLElement>('.producto-card__desc');
      if (nombreEl) resaltar(nombreEl, queryNormalizado);
      if (descEl) resaltar(descEl, queryNormalizado);
    });

    if (contador) {
      const etiqueta =
        visibles.length === 1
          ? t(locale, 'catalogo.resultados_un')
          : t(locale, 'catalogo.resultados_otros');
      contador.textContent = `${visibles.length} ${etiqueta}`;
    }

    if (sinResultados) sinResultados.hidden = visibles.length > 0;

    renderPaginacion(totalPaginas, state.pagina);
    updateFamiliaActual();
    history.replaceState(null, '', buildUrl());
  }

  function buildUrl(): string {
    const qs = serializeState(state);
    return qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  }

  function resetFiltros(): void {
    state.familia = '';
    state.tipo = '';
    state.q = '';
    state.comercial = new Set();
    state.destacado = false;
    state.nuevo = false;
    state.disponible = '';
    state.modalidades = new Set();
    state.facetas = new Map();
    state.pagina = 1;
    state.todos = false;
    state.orden = 'relevancia';
    syncFiltrosUI();
    applyFiltros();
    setFiltrosPanelOpen(false);
  }

  // Búsqueda con debounce
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const onBuscarInput = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const newQ = buscarInput?.value.trim() ?? '';
      if (newQ && state.familia) {
        state.familia = '';
        state.tipo = '';
        state.todos = true;
      } else if (!newQ && state.todos && !state.familia) {
        const noOtherFilters =
          !state.tipo &&
          state.comercial.size === 0 &&
          !state.destacado &&
          !state.nuevo &&
          !state.disponible &&
          state.modalidades.size === 0 &&
          state.facetas.size === 0;
        if (noOtherFilters) state.todos = false;
      }
      state.q = newQ;
      state.pagina = 1;
      syncFiltrosUI();
      applyFiltros();
    }, 300);
  };
  buscarInput?.addEventListener('input', onBuscarInput);

  const onOrdenChange = () => {
    state.orden = ordenSelect?.value || 'relevancia';
    state.pagina = 1;
    applyFiltros();
  };
  ordenSelect?.addEventListener('change', onOrdenChange);

  // Navegación por familia (overview)
  familiasView?.querySelectorAll<HTMLAnchorElement>('[data-familia-link]').forEach(enlace => {
    // Las familias con landing editorial usan navegación HTML normal.
    if (enlace.dataset['familyLanding'] === 'true') return;
    const onClick = (evento: Event) => {
      evento.preventDefault();
      state.familia = enlace.dataset['familiaLink'] ?? '';
      state.tipo = '';
      state.todos = false;
      state.pagina = 1;
      syncFiltrosUI();
      applyFiltros();
      scrollToResultados();
    };
    enlace.addEventListener('click', onClick);
  });

  // Filtro por familia (sidebar)
  familiaLista?.querySelectorAll<HTMLButtonElement>('[data-familia-filter]').forEach(btn => {
    const onClick = () => {
      const next = btn.dataset['familiaFilter'] ?? '';
      state.familia = next;
      state.tipo = '';
      state.pagina = 1;
      syncFiltrosUI();
      applyFiltros();
    };
    btn.addEventListener('click', onClick);
  });

  const onFamiliaActualQuitar = () => {
    state.familia = '';
    state.tipo = '';
    state.pagina = 1;
    syncFiltrosUI();
    applyFiltros();
  };
  familiaActualQuitar?.addEventListener('click', onFamiliaActualQuitar);

  // Filtro tipo comercial
  comercialContenedor
    ?.querySelectorAll<HTMLInputElement>('[data-filtro-comercial]')
    .forEach(input => {
      const onChange = () => {
        const valor = input.dataset['filtroComercial'] ?? '';
        if (input.checked) state.comercial.add(valor);
        else state.comercial.delete(valor);
        state.pagina = 1;
        applyFiltros();
      };
      input.addEventListener('change', onChange);
    });

  // Filtros destacado / nuevo
  const onDestacadoChange = () => {
    state.destacado = destacadoInput?.checked ?? false;
    state.pagina = 1;
    applyFiltros();
  };
  destacadoInput?.addEventListener('change', onDestacadoChange);
  const onNuevoChange = () => {
    state.nuevo = nuevoInput?.checked ?? false;
    state.pagina = 1;
    applyFiltros();
  };
  nuevoInput?.addEventListener('change', onNuevoChange);

  disponibilidadInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) {
        state.disponible = input.value;
        disponibilidadInputs.forEach(other => {
          if (other !== input) other.checked = false;
        });
      } else if (!disponibilidadInputs.some(other => other.checked)) {
        state.disponible = '';
      }
      state.pagina = 1;
      applyFiltros();
    });
  });

  modalidadInputs.forEach(input => {
    input.addEventListener('change', () => {
      const valor = input.dataset['filtroModalidad'] ?? '';
      if (input.checked) state.modalidades.add(valor);
      else state.modalidades.delete(valor);
      state.pagina = 1;
      applyFiltros();
    });
  });

  // Mostrar todos
  mostrarTodosBtns.forEach(btn => {
    const onClick = () => {
      fullCatalogRequested = true;
      state.todos = true;
      state.familia = '';
      state.tipo = '';
      state.pagina = 1;
      state.orden = 'relevancia';
      syncFiltrosUI();
      applyFiltros();
      setFiltrosPanelOpen(false);
      scrollToResultados();
    };
    btn.addEventListener('click', onClick);
  });

  // Reset de filtros
  resetBtns.forEach(btn => btn.addEventListener('click', resetFiltros));

  // Drawer de filtros (mobile)
  const onFiltrosToggle = () => {
    const abierto = !(filtrosPanel?.classList.contains('catalogo-filtros--abierto') ?? false);
    setFiltrosPanelOpen(abierto);
    if (abierto) filtrosPanel?.querySelector<HTMLElement>('input, button, a')?.focus();
  };
  filtrosToggle?.addEventListener('click', onFiltrosToggle);
  const onFiltrosCerrar = () => {
    setFiltrosPanelOpen(false);
    filtrosToggle?.focus();
  };
  filtrosCerrar?.addEventListener('click', onFiltrosCerrar);
  const onFiltrosKeydown = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape' && filtrosPanel?.classList.contains('catalogo-filtros--abierto')) {
      setFiltrosPanelOpen(false);
      filtrosToggle?.focus();
    }
  };
  filtrosPanel?.addEventListener('keydown', onFiltrosKeydown);
  filtrosBackdrop?.addEventListener('click', () => {
    setFiltrosPanelOpen(false);
    filtrosToggle?.focus();
  });

  function modalidadTexto(valor?: string): string {
    if (valor === 'dropship') return t(locale, 'catalogo.modalidad_dropship');
    if (valor === 'individualizado') return t(locale, 'catalogo.modalidad_individualizado');
    return t(locale, 'catalogo.modalidad_cotizacion');
  }

  function disponibilidadTexto(valor?: string): string {
    if (valor === '0') return t(locale, 'catalogo.disponibilidad_no');
    if (valor === '1') return t(locale, 'catalogo.disponibilidad_si');
    return t(locale, 'catalogo.disponibilidad_todas');
  }

  function precioTexto(card: HTMLElement): string {
    const raw = Number(card.dataset['precio'] ?? '');
    if (!tienePrecioPublico(raw)) return t(locale, 'producto.precio_solicitud_corto');
    const moneda = normalizarMoneda(card.dataset['moneda']);
    try {
      return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
        style: 'currency',
        currency: moneda,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(raw);
    } catch {
      return `${moneda} ${raw.toLocaleString()}`;
    }
  }

  function renderQuickView(card: HTMLElement): void {
    if (!quickviewDialog || !quickviewImagen || !quickviewNombre || !quickviewDescripcion) return;
    const nombre = card.dataset['nombre'] ?? '';
    const imagen = card.dataset['imagen'] ?? '';
    const familia = card.dataset['familiaNombre'] ?? '';
    const descripcion = card.querySelector<HTMLElement>('.producto-card__desc')?.textContent ?? '';
    const disponible = card.dataset['disponible'] ?? '1';
    const fulfillment = card.dataset['fulfillment'] ?? 'cotizacion';
    const precio = card.dataset['precio'] ?? '';
    const href = card.dataset['href'] ?? '#';
    const whatsappHref = `https://wa.me/573137247353?text=${encodeURIComponent(
      `${t(locale, 'producto.cta_consultar_disponibilidad')}: ${nombre}`
    )}`;

    quickviewImagen.src = imagen;
    quickviewImagen.alt = nombre;
    if (quickviewFamilia) quickviewFamilia.textContent = familia;
    quickviewNombre.textContent = nombre;
    quickviewDescripcion.textContent = descripcion;
    if (quickviewModalidad) quickviewModalidad.textContent = modalidadTexto(fulfillment);
    if (quickviewDisponibilidad)
      quickviewDisponibilidad.textContent = disponibilidadTexto(disponible);
    if (quickviewStock)
      quickviewStock.textContent =
        disponible === '0' || card.dataset['stock'] === '0'
          ? t(locale, 'producto.ficha_no_disponible')
          : card.dataset['stock']
            ? t(locale, 'carrito.stock_limitado').replace('{stock}', card.dataset['stock'] ?? '')
            : t(locale, 'producto.ficha_disponible');
    if (quickviewPrecio) quickviewPrecio.textContent = precioTexto(card);
    if (quickviewFicha) quickviewFicha.href = href;

    // Misma política que ProductoCard/Landing/crear-pago (F4.2) — no rutear por tipo_comercial.
    const stockRaw = card.dataset['stock'] ?? '';
    const stockNumero = stockRaw === '' ? null : Number(stockRaw);
    const precioNumero = Number(precio);
    const accion = getAccionComercial(
      {
        precio: tienePrecioPublico(precioNumero) ? precioNumero : null,
        disponible: disponible !== '0',
        stock: stockNumero !== null && Number.isFinite(stockNumero) ? stockNumero : null,
        gestionar_stock: stockNumero !== null,
      },
      locale
    );

    if (quickviewWhatsapp) {
      const mostrarWhatsapp = accion.tipo === 'consultar';
      quickviewWhatsapp.hidden = !mostrarWhatsapp;
      quickviewWhatsapp.href = whatsappHref;
    }

    if (quickviewCta) {
      quickviewCta.hidden = false;
      if (accion.tipo === 'carrito') {
        quickviewCta.textContent = accion.label;
        quickviewCta.onclick = () => {
          const slug = card.dataset['productoSlug'] ?? '';
          const nombreProducto = card.dataset['nombre'] ?? '';
          const moneda = normalizarMoneda(card.dataset['moneda']);
          if (!slug || !nombreProducto || !tienePrecioPublico(precioNumero)) return;
          void import('./carrito').then(({ agregarAlCarrito }) => {
            agregarAlCarrito({
              slug,
              nombre: nombreProducto,
              precio: precioNumero,
              moneda,
              stock: stockNumero !== null && Number.isFinite(stockNumero) ? stockNumero : null,
            });
          });
          quickviewDialog.close();
        };
      } else if (accion.tipo === 'cotizacion') {
        quickviewCta.textContent = accion.label;
        quickviewCta.onclick = () => {
          const slug = card.dataset['productoSlug'] ?? '';
          const nombreProducto = card.dataset['nombre'] ?? '';
          const imagenProducto = card.dataset['imagen'] ?? '';
          if (!slug || !nombreProducto || !imagenProducto) return;
          void import('./cotizacion-equipos').then(({ agregarACotizacion }) => {
            agregarACotizacion({ slug, nombre: nombreProducto, imagen: imagenProducto });
          });
          quickviewDialog.close();
        };
      } else {
        // consultar disponibilidad → WhatsApp; ocultar CTA primario duplicado
        quickviewCta.hidden = true;
        if (quickviewWhatsapp) quickviewWhatsapp.hidden = false;
      }
    }

    resetTransientUiState();
    quickviewDialog.showModal();
  }

  // --- Comparador ---
  function initComparador(): void {
    const getCompareInputs = () =>
      Array.from(document.querySelectorAll<HTMLInputElement>('[data-compare-slug]'));
    const bar = document.getElementById('comparador-bar');
    const contadorEl = document.getElementById('comparador-contador');
    const verBtn = document.getElementById('comparador-ver');
    const vaciarBtn = document.getElementById('comparador-vaciar');
    const dialog = document.getElementById('comparador-dialog') as HTMLDialogElement | null;
    const tabla = document.getElementById('comparador-tabla');
    const cerrarBtn = dialog?.querySelector('[data-comparador-close]');

    function syncCheckboxes(slugs: string[]): void {
      getCompareInputs().forEach(input => {
        const slug = input.dataset['compareSlug'] ?? '';
        input.checked = slugs.includes(slug);
        input.disabled = !input.checked && slugs.length >= MAX_COMPARADOR;
      });
    }

    function syncBar(slugs: string[]): void {
      if (bar) bar.hidden = slugs.length === 0;
      if (contadorEl) contadorEl.textContent = `${slugs.length}/${MAX_COMPARADOR}`;
    }

    function renderTabla(slugs: string[]): void {
      if (!tabla) return;
      tabla.innerHTML = '';
      if (slugs.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'comparador__vacio';
        vacio.textContent = t(locale, 'catalogo.comparar_vacio');
        tabla.appendChild(vacio);
        return;
      }

      const productos = slugs
        .map(slug => document.querySelector<HTMLElement>(`[data-producto-slug="${slug}"]`))
        .filter((el): el is HTMLElement => el !== null);

      const specsList = productos.map(el => parseSpecs(el));
      const claves = new Set<string>();
      specsList.forEach(specs => Object.keys(specs).forEach(clave => claves.add(clave)));

      const table = document.createElement('table');
      table.className = 'comparador__table';

      const thead = document.createElement('thead');
      const filaCabecera = document.createElement('tr');
      const thVacio = document.createElement('th');
      thVacio.scope = 'col';
      thVacio.textContent = t(locale, 'catalogo.comparar_columna_producto');
      filaCabecera.appendChild(thVacio);
      productos.forEach(el => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = el.dataset['nombre'] ?? '';
        filaCabecera.appendChild(th);
      });
      thead.appendChild(filaCabecera);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      function addRow(label: string, values: string[]): void {
        const fila = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = label;
        fila.appendChild(th);
        values.forEach(valor => {
          const td = document.createElement('td');
          td.textContent = valor;
          fila.appendChild(td);
        });
        tbody.appendChild(fila);
      }

      addRow(
        t(locale, 'catalogo.comparar_familia'),
        productos.map(el => el.dataset['familiaNombre'] ?? '')
      );

      if (productos.some(el => el.dataset['tipoNombre'])) {
        addRow(
          t(locale, 'catalogo.tipo_titulo'),
          productos.map(el => el.dataset['tipoNombre'] || '—')
        );
      }

      if (productos.some(el => el.dataset['comercial'])) {
        addRow(
          t(locale, 'catalogo.filtro_comercial'),
          productos.map(el => {
            const valor = el.dataset['comercial'];
            if (valor === 'equipo') return t(locale, 'catalogo.filtro_comercial_equipo');
            if (valor === 'consumible') return t(locale, 'catalogo.filtro_comercial_consumible');
            return valor || '—';
          })
        );
      }

      if (productos.some(el => el.dataset['destacado'] === '1')) {
        addRow(
          t(locale, 'producto.badge_destacado'),
          productos.map(el =>
            el.dataset['destacado'] === '1' ? t(locale, 'comun.si') : t(locale, 'comun.no')
          )
        );
      }

      if (productos.some(el => el.dataset['nuevo'] === '1')) {
        addRow(
          t(locale, 'producto.badge_nuevo'),
          productos.map(el =>
            el.dataset['nuevo'] === '1' ? t(locale, 'comun.si') : t(locale, 'comun.no')
          )
        );
      }

      for (const clave of [...claves].sort()) {
        addRow(
          clave,
          specsList.map(specs => specs[clave] ?? '—')
        );
      }

      table.appendChild(tbody);
      tabla.appendChild(table);
    }

    const inicial = getComparador();
    syncCheckboxes(inicial);
    syncBar(inicial);

    const onCompareChange = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input?.matches('[data-compare-slug]')) return;
      const slug = input.dataset['compareSlug'] ?? '';
      const resultado = toggleComparador(slug);
      if (!resultado.ok) {
        input.checked = false;
        announce(t(locale, 'catalogo.comparar_limite'));
      }
      syncCheckboxes(resultado.slugs);
      syncBar(resultado.slugs);
    };
    document.addEventListener('change', onCompareChange);

    const onComparadorChange = ((evento: CustomEvent<string[]>) => {
      syncCheckboxes(evento.detail);
      syncBar(evento.detail);
    }) as EventListener;
    window.addEventListener(COMPARADOR_EVENT, onComparadorChange);
    cleanupComparadorWindow = () => {
      document.removeEventListener('change', onCompareChange);
      window.removeEventListener(COMPARADOR_EVENT, onComparadorChange);
    };

    const onVaciar = () => {
      clearComparador();
      if (dialog?.open) renderTabla([]);
    };
    vaciarBtn?.addEventListener('click', onVaciar);

    const onVer = () => {
      renderTabla(getComparador());
      resetTransientUiState();
      dialog?.showModal();
    };
    verBtn?.addEventListener('click', onVer);

    const onCerrar = () => dialog?.close();
    cerrarBtn?.addEventListener('click', onCerrar);
    const onDialogClick = (evento: MouseEvent) => {
      if (dialog && evento.target === dialog) dialog.close();
    };
    dialog?.addEventListener('click', onDialogClick);
  }

  const onQuickViewClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('[data-quick-view]');
    if (!btn) return;
    const card = btn.closest<HTMLElement>('[data-producto-slug]');
    if (!card) return;
    renderQuickView(card);
  };
  document.addEventListener('click', onQuickViewClick);

  const quickviewClose = quickviewDialog?.querySelector('[data-quickview-close]');
  const closeQuickView = () => quickviewDialog?.close();
  quickviewClose?.addEventListener('click', closeQuickView);
  quickviewDialog?.addEventListener('click', event => {
    if (event.target === quickviewDialog) quickviewDialog.close();
  });
  quickviewDialog?.addEventListener('close', () => {
    if (quickviewCta) quickviewCta.onclick = null;
  });

  updateFiltrosToggle(false);
  syncFiltrosUI();
  applyFiltros();
  initComparador();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    cleanupComparadorWindow?.();
    document.removeEventListener('click', onQuickViewClick);
    setFiltrosPanelOpen(false);
  };
}
