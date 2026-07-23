/**
 * Vista de catálogo comercial: filtros jerárquicos (Especialidad → Familia →
 * Tipo), sección (`tipo_comercial`), búsqueda por nombre/SKU, tarjetas de
 * producto, selección múltiple y barra flotante de envío.
 *
 * Los datos se cargan una vez desde Supabase (`productos`, `familias`,
 * `tipos`) y se filtran en memoria — el catálogo activo es pequeño
 * (~150 productos), así que no hace falta re-consultar por cada filtro.
 */
import { SPECIALTY_GROUPS, type SpecialtyGroup } from '../lib/comercial-cms';
import {
  supabase,
  escapeHtml,
  debounce,
  replaceHashQuery,
  hashParams,
  skeletonCards,
} from './shared';

export interface FamiliaRow {
  id: string;
  slug: string;
  nombre_es: string;
  orden: number;
}

export interface TipoRow {
  id: string;
  familia_id: string;
  slug: string;
  nombre_es: string;
  orden: number;
}

export interface ProductoComercial {
  id: string;
  slug: string;
  sku: string | null;
  nombre_es: string;
  descripcion_corta_es: string | null;
  imagen_principal: string | null;
  familia_id: string | null;
  tipo_id: string | null;
  tipo_comercial: 'equipo' | 'consumible';
  disponible: boolean;
}

interface CatalogoFilters {
  especialidad: string;
  familia: string;
  tipo: string;
  seccion: string;
  q: string;
}

interface CatalogoCache {
  familias: FamiliaRow[];
  tipos: TipoRow[];
  productos: ProductoComercial[];
  /** Especialidades (grupos UI) que tienen al menos una familia con productos activos. */
  taxonomia: SpecialtyGroup[];
  /** slug de familia → slug del grupo de especialidad al que pertenece. */
  familiaAGrupo: Map<string, { slug: string; nombre: string }>;
  familiaPorId: Map<string, FamiliaRow>;
  familiaPorSlug: Map<string, FamiliaRow>;
  tipoPorId: Map<string, TipoRow>;
}

let cache: CatalogoCache | null = null;
let loadError: string | null = null;
let loadingPromise: Promise<void> | null = null;
const selection = new Set<string>();

function parseFiltersFromHash(): CatalogoFilters {
  const params = hashParams();
  return {
    especialidad: params.get('especialidad') ?? '',
    familia: params.get('familia') ?? '',
    tipo: params.get('tipo') ?? '',
    seccion: params.get('seccion') ?? '',
    q: params.get('q') ?? '',
  };
}

function filtersToParams(filters: CatalogoFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.especialidad) params.set('especialidad', filters.especialidad);
  if (filters.familia) params.set('familia', filters.familia);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.seccion) params.set('seccion', filters.seccion);
  if (filters.q) params.set('q', filters.q);
  return params;
}

async function loadCatalogoData(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    if (!supabase) {
      loadError = 'Supabase no configurado.';
      return;
    }
    try {
      const [familiasRes, tiposRes, productosRes] = await Promise.all([
        supabase
          .from('familias')
          .select('id,slug,nombre_es,orden')
          .eq('activo', true)
          .order('orden', { ascending: true }),
        supabase
          .from('tipos')
          .select('id,familia_id,slug,nombre_es,orden')
          .eq('activo', true)
          .order('orden', { ascending: true }),
        supabase
          .from('productos')
          .select(
            'id,slug,sku,nombre_es,descripcion_corta_es,imagen_principal,familia_id,tipo_id,tipo_comercial,disponible'
          )
          .eq('activo', true)
          .order('nombre_es', { ascending: true }),
      ]);

      if (familiasRes.error) throw familiasRes.error;
      if (tiposRes.error) throw tiposRes.error;
      if (productosRes.error) throw productosRes.error;

      const familias = (familiasRes.data ?? []) as FamiliaRow[];
      const tipos = (tiposRes.data ?? []) as TipoRow[];
      const productos = (productosRes.data ?? []) as ProductoComercial[];

      const familiaPorId = new Map<string, FamiliaRow>();
      const familiaPorSlug = new Map<string, FamiliaRow>();
      for (const f of familias) {
        familiaPorId.set(f.id, f);
        familiaPorSlug.set(f.slug, f);
      }

      // Solo se ofrecen como filtro las especialidades (grupos UI de
      // SPECIALTY_GROUPS, espejo del backend en comercial-share/index.ts)
      // que tengan al menos una familia con productos activos.
      const familiaSlugsConProductos = new Set<string>();
      for (const p of productos) {
        const familia = p.familia_id ? familiaPorId.get(p.familia_id) : undefined;
        if (familia) familiaSlugsConProductos.add(familia.slug);
      }
      const taxonomia = SPECIALTY_GROUPS.filter(grupo =>
        grupo.familias.some(slug => familiaSlugsConProductos.has(slug))
      );

      // Se usa SPECIALTY_GROUPS completo (no solo `taxonomia`) para que toda
      // familia tenga su eyebrow de especialidad en la tarjeta, incluso si su
      // grupo quedó oculto del filtro por no tener productos aún.
      const familiaAGrupo = new Map<string, { slug: string; nombre: string }>();
      for (const grupo of SPECIALTY_GROUPS) {
        for (const familiaSlug of grupo.familias) {
          familiaAGrupo.set(familiaSlug, { slug: grupo.slug, nombre: grupo.nombre });
        }
      }

      const tipoPorId = new Map<string, TipoRow>();
      for (const t of tipos) tipoPorId.set(t.id, t);

      cache = {
        familias,
        tipos,
        productos,
        taxonomia,
        familiaAGrupo,
        familiaPorId,
        familiaPorSlug,
        tipoPorId,
      };
      loadError = null;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'No se pudo cargar el catálogo.';
      cache = null;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

function familiasDeGrupo(especialidadSlug: string): FamiliaRow[] {
  if (!cache) return [];
  if (!especialidadSlug) return cache.familias;
  const grupo = SPECIALTY_GROUPS.find(g => g.slug === especialidadSlug);
  if (!grupo) return cache.familias;
  const slugs = new Set(grupo.familias);
  return cache.familias.filter(f => slugs.has(f.slug));
}

function tiposDeFamilia(familiaSlug: string): TipoRow[] {
  if (!cache || !familiaSlug) return [];
  const familia = cache.familias.find(f => f.slug === familiaSlug);
  if (!familia) return [];
  return cache.tipos.filter(t => t.familia_id === familia.id);
}

function optionsHtml(
  items: Array<{ slug: string; nombre_es?: string; nombre?: string }>,
  selected: string
): string {
  return items
    .map(item => {
      const label = escapeHtml(item.nombre ?? item.nombre_es ?? item.slug);
      const isSelected = item.slug === selected ? ' selected' : '';
      return `<option value="${escapeHtml(item.slug)}"${isSelected}>${label}</option>`;
    })
    .join('');
}

function filtersHtml(filters: CatalogoFilters): string {
  if (loadError) {
    return `<p class="comercial-help">Los filtros estarán disponibles cuando el catálogo cargue correctamente.</p>`;
  }
  if (!cache) {
    return `<p class="comercial-help">Cargando filtros…</p>`;
  }
  const familiasDisponibles = familiasDeGrupo(filters.especialidad);
  const tiposDisponibles = tiposDeFamilia(filters.familia);
  return `
    <div class="comercial-filter">
      <label for="filtro-especialidad">Especialidad</label>
      <select id="filtro-especialidad" data-filter="especialidad">
        <option value="">Todas las especialidades</option>
        ${optionsHtml(cache.taxonomia, filters.especialidad)}
      </select>
    </div>
    <div class="comercial-filter">
      <label for="filtro-familia">Familia</label>
      <select id="filtro-familia" data-filter="familia">
        <option value="">Todas las familias</option>
        ${optionsHtml(familiasDisponibles, filters.familia)}
      </select>
    </div>
    <div class="comercial-filter">
      <label for="filtro-tipo">Subfamilia / Tipo</label>
      <select id="filtro-tipo" data-filter="tipo" ${filters.familia ? '' : 'disabled'}>
        <option value="">${filters.familia ? 'Todos los tipos' : 'Elige una familia primero'}</option>
        ${optionsHtml(tiposDisponibles, filters.tipo)}
      </select>
    </div>
    <div class="comercial-filter">
      <label for="filtro-seccion">Sección</label>
      <select id="filtro-seccion" data-filter="seccion">
        <option value="">Todas las secciones</option>
        <option value="equipo" ${filters.seccion === 'equipo' ? 'selected' : ''}>Equipos</option>
        <option value="consumible" ${filters.seccion === 'consumible' ? 'selected' : ''}>Consumibles</option>
      </select>
    </div>
    <div class="comercial-filter">
      <label for="filtro-q">Producto</label>
      <input
        id="filtro-q"
        type="search"
        data-filter="q"
        placeholder="Buscar por nombre o SKU…"
        value="${escapeHtml(filters.q)}"
        autocomplete="off"
      />
    </div>
    <button class="comercial-button comercial-button--ghost comercial-filter__clear" type="button" data-clear-filters>
      Limpiar filtros
    </button>`;
}

function normalizar(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function filterProductos(filters: CatalogoFilters): ProductoComercial[] {
  if (!cache) return [];
  const q = normalizar(filters.q.trim());
  const familiaSeleccionada = filters.familia
    ? cache.familias.find(f => f.slug === filters.familia)
    : undefined;
  const tipoSeleccionado = filters.tipo
    ? cache.tipos.find(t => t.slug === filters.tipo)
    : undefined;
  const grupoSeleccionado = filters.especialidad
    ? SPECIALTY_GROUPS.find(g => g.slug === filters.especialidad)
    : undefined;
  const familiaIdsDelGrupo = grupoSeleccionado
    ? new Set(
        grupoSeleccionado.familias
          .map(slug => cache?.familiaPorSlug.get(slug)?.id)
          .filter((id): id is string => Boolean(id))
      )
    : null;

  return cache.productos.filter(p => {
    if (familiaIdsDelGrupo && (!p.familia_id || !familiaIdsDelGrupo.has(p.familia_id)))
      return false;
    if (familiaSeleccionada && p.familia_id !== familiaSeleccionada.id) return false;
    if (tipoSeleccionado && p.tipo_id !== tipoSeleccionado.id) return false;
    if (filters.seccion && p.tipo_comercial !== filters.seccion) return false;
    if (q) {
      const haystack = normalizar(`${p.nombre_es} ${p.sku ?? ''} ${p.descripcion_corta_es ?? ''}`);
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function productoCardHtml(p: ProductoComercial): string {
  if (!cache) return '';
  const familia = p.familia_id ? cache.familiaPorId.get(p.familia_id) : undefined;
  const tipo = p.tipo_id ? cache.tipoPorId.get(p.tipo_id) : undefined;
  const especialidad = familia ? cache.familiaAGrupo.get(familia.slug) : undefined;
  const imagen = p.imagen_principal || '/assets/img-placeholder.svg';
  const seccionLabel = p.tipo_comercial === 'consumible' ? 'Consumible' : 'Equipo';
  const isSelected = selection.has(p.id);
  const publicUrl = `/es/productos/${encodeURIComponent(p.slug)}/`;

  return `
    <article class="comercial-card${isSelected ? ' comercial-card--selected' : ''}" data-card data-id="${escapeHtml(p.id)}">
      <label class="comercial-card__select">
        <input type="checkbox" data-select-product data-id="${escapeHtml(p.id)}" ${isSelected ? 'checked' : ''} aria-label="Seleccionar ${escapeHtml(p.nombre_es)}" />
        <span></span>
      </label>
      <div class="comercial-card__media">
        <img src="${escapeHtml(imagen)}" alt="${escapeHtml(p.nombre_es)}" loading="lazy" onerror="this.onerror=null;this.src='/assets/img-placeholder.svg';" />
        <span class="comercial-badge comercial-badge--${p.tipo_comercial}">${seccionLabel}</span>
        ${!p.disponible ? '<span class="comercial-badge comercial-badge--warn">No disponible</span>' : ''}
      </div>
      <div class="comercial-card__body">
        ${especialidad ? `<span class="comercial-card__eyebrow">${escapeHtml(especialidad.nombre)}</span>` : ''}
        <h3 class="comercial-card__title">${escapeHtml(p.nombre_es)}</h3>
        <p class="comercial-card__meta">
          ${familia ? escapeHtml(familia.nombre_es) : 'Sin familia'}${tipo ? ` · ${escapeHtml(tipo.nombre_es)}` : ''}
        </p>
        ${p.descripcion_corta_es ? `<p class="comercial-card__desc">${escapeHtml(p.descripcion_corta_es)}</p>` : ''}
        <p class="comercial-card__sku">SKU: ${p.sku ? escapeHtml(p.sku) : '—'}</p>
      </div>
      <div class="comercial-card__actions">
        <a class="comercial-button comercial-button--ghost" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener noreferrer" data-open-product>
          Abrir producto
        </a>
        <button class="comercial-button comercial-button--primary" type="button" data-share-one data-id="${escapeHtml(p.id)}">
          Enviar catálogo
        </button>
      </div>
    </article>`;
}

function gridHtml(filters: CatalogoFilters): string {
  if (loadError) {
    return `
      <div class="comercial-state comercial-state--error" role="alert">
        <p>${escapeHtml(loadError)}</p>
        <button class="comercial-button comercial-button--primary" type="button" data-retry-load>Reintentar</button>
      </div>`;
  }
  if (!cache) return `<div class="comercial-grid__list" data-grid-list>${skeletonCards(8)}</div>`;

  const filtered = filterProductos(filters);
  if (filtered.length === 0) {
    return `
      <div class="comercial-state comercial-state--empty">
        <p>No hay productos que coincidan con los filtros actuales.</p>
        <button class="comercial-button comercial-button--ghost" type="button" data-clear-filters>Limpiar filtros</button>
      </div>`;
  }
  return `<div class="comercial-grid__list" data-grid-list>${filtered.map(productoCardHtml).join('')}</div>`;
}

function resultCountHtml(filters: CatalogoFilters): string {
  if (!cache || loadError) return '';
  const count = filterProductos(filters).length;
  return `${count} producto${count === 1 ? '' : 's'} encontrado${count === 1 ? '' : 's'}`;
}

function floatingBarHtml(): string {
  if (selection.size === 0) return '';
  return `
    <div class="comercial-floating-bar" data-floating-bar role="region" aria-label="Selección de productos">
      <span>${selection.size} producto${selection.size === 1 ? '' : 's'} seleccionado${selection.size === 1 ? '' : 's'}</span>
      <div class="comercial-floating-bar__actions">
        <button class="comercial-button comercial-button--ghost" type="button" data-deselect-all>Deseleccionar todo</button>
        <button class="comercial-button comercial-button--primary" type="button" data-share-selected>
          Enviar ${selection.size} producto${selection.size === 1 ? '' : 's'}
        </button>
      </div>
    </div>`;
}

export async function renderCatalogoView(): Promise<string> {
  const filters = parseFiltersFromHash();
  if (!cache && !loadError) {
    await loadCatalogoData();
  }
  return `
    <section class="comercial-catalogo" data-catalogo-root>
      <aside class="comercial-filters" data-filters aria-label="Filtros de catálogo">
        <h2 class="comercial-filters__title">Filtros</h2>
        ${filtersHtml(filters)}
      </aside>
      <div class="comercial-catalogo__main">
        <div class="comercial-catalogo__toolbar">
          <span data-result-count>${resultCountHtml(filters)}</span>
        </div>
        <div data-grid>${gridHtml(filters)}</div>
      </div>
    </section>
    <div data-floating-bar-slot>${floatingBarHtml()}</div>`;
}

export interface CatalogBindings {
  onShare: (productos: ProductoComercial[]) => void;
}

function currentFiltersFromDom(root: ParentNode): CatalogoFilters {
  const get = (name: string) =>
    root.querySelector<HTMLSelectElement | HTMLInputElement>(`[data-filter="${name}"]`);
  return {
    especialidad: get('especialidad')?.value ?? '',
    familia: get('familia')?.value ?? '',
    tipo: get('tipo')?.value ?? '',
    seccion: get('seccion')?.value ?? '',
    q: get('q')?.value ?? '',
  };
}

/**
 * Enlaza los manejadores de eventos usando delegación sobre `container` (el
 * nodo que envuelve el HTML devuelto por `renderCatalogoView`, recreado por
 * el router en cada navegación). Los cambios de filtro solo reemplazan los
 * sub-slots internos (`[data-grid]`, `[data-result-count]`, `[data-filters]`)
 * — nunca `container` — así el buscador no pierde el foco ni se duplican
 * listeners entre visitas a la vista.
 */
export function bindCatalogoView(container: HTMLElement, bindings: CatalogBindings): () => void {
  const app = container;
  function refresh() {
    const root = app.querySelector('[data-catalogo-root]');
    if (!root) return;
    const filters = currentFiltersFromDom(root);
    replaceHashQuery(filtersToParams(filters));
    const gridSlot = root.querySelector('[data-grid]');
    if (gridSlot) gridSlot.innerHTML = gridHtml(filters);
    const countSlot = root.querySelector('[data-result-count]');
    if (countSlot) countSlot.textContent = resultCountHtml(filters);
  }

  function refreshFilters() {
    const root = app.querySelector('[data-catalogo-root]');
    if (!root) return;
    const filters = currentFiltersFromDom(root);
    const filtersSlot = root.querySelector('[data-filters]');
    if (filtersSlot) {
      filtersSlot.innerHTML = `<h2 class="comercial-filters__title">Filtros</h2>${filtersHtml(filters)}`;
    }
    refresh();
  }

  function refreshFloatingBar() {
    const slot = app.querySelector('[data-floating-bar-slot]');
    if (slot) slot.innerHTML = floatingBarHtml();
  }

  const debouncedRefresh = debounce(refresh, 220);

  const onChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const filterName = target.getAttribute('data-filter');
    if (!filterName) return;
    if (filterName === 'especialidad' || filterName === 'familia') {
      refreshFilters();
      return;
    }
    if (target instanceof HTMLSelectElement) {
      refresh();
    }
  };

  const onInput = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.getAttribute('data-filter') === 'q') debouncedRefresh();
  };

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-clear-filters]')) {
      const root = app.querySelector('[data-catalogo-root]');
      if (root) {
        (
          root.querySelectorAll<HTMLSelectElement | HTMLInputElement>('[data-filter]') ?? []
        ).forEach(el => {
          el.value = '';
        });
      }
      history.replaceState(null, '', location.hash.split('?')[0] || '#/catalogo');
      refreshFilters();
      return;
    }

    if (target.closest('[data-retry-load]')) {
      loadError = null;
      cache = null;
      void loadCatalogoData().then(refreshFilters);
      return;
    }

    const shareOneBtn = target.closest<HTMLElement>('[data-share-one]');
    if (shareOneBtn) {
      const id = shareOneBtn.getAttribute('data-id');
      const producto = cache?.productos.find(p => p.id === id);
      if (producto) bindings.onShare([producto]);
      return;
    }

    if (target.closest('[data-share-selected]')) {
      const productos = cache?.productos.filter(p => selection.has(p.id)) ?? [];
      if (productos.length > 0) bindings.onShare(productos);
      return;
    }

    if (target.closest('[data-deselect-all]')) {
      selection.clear();
      refreshSelectionUi();
      return;
    }
  };

  function refreshSelectionUi() {
    const root = app.querySelector('[data-catalogo-root]');
    root?.querySelectorAll<HTMLElement>('[data-card]').forEach(card => {
      const id = card.getAttribute('data-id');
      const selected = id ? selection.has(id) : false;
      card.classList.toggle('comercial-card--selected', selected);
      const checkbox = card.querySelector<HTMLInputElement>('[data-select-product]');
      if (checkbox) checkbox.checked = selected;
    });
    refreshFloatingBar();
  }

  const onCheckboxChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.hasAttribute('data-select-product')) return;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (target.checked) selection.add(id);
    else selection.delete(id);
    refreshSelectionUi();
  };

  app.addEventListener('change', onChange);
  app.addEventListener('change', onCheckboxChange);
  app.addEventListener('input', onInput);
  app.addEventListener('click', onClick);

  return () => {
    app.removeEventListener('change', onChange);
    app.removeEventListener('change', onCheckboxChange);
    app.removeEventListener('input', onInput);
    app.removeEventListener('click', onClick);
  };
}

export function clearSelection(): void {
  selection.clear();
}
