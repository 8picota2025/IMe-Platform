/**
 * Búsqueda catálogo + ingesta PDF → línea de cotización (admin + comercial).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCatalogUnitPrice, type CotizacionLineaOferta } from './cotizacion-oferta';
import { searchCatalogProducts, type CatalogProductHit } from './catalog-search';
import {
  catalogHitToQuoteLine,
  draftToQuoteLine,
  type QuoteIngestDraft,
} from './quote-product-ingest';
import { uniqueProductSlug } from './quote-product-ingest';
import {
  callAdminImportProduct,
  fetchIngestDraftFromPdf,
  importProductFromDraft,
} from './quote-product-ingest-flow';

export interface QuoteLineToolsOptions {
  root: HTMLElement;
  supabase: SupabaseClient;
  escapeHtml: (value: string) => string;
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  getMoneda: () => 'COP' | 'USD';
  onAddLine: (line: CotizacionLineaOferta) => void;
  onDirty?: () => void;
}

function ingestModalHtml(
  draft: QuoteIngestDraft,
  moneda: 'COP' | 'USD',
  escapeHtml: (value: string) => string
): string {
  const step = moneda === 'USD' ? '0.01' : '1';
  return `
    <div class="quote-ingest-overlay" data-quote-ingest-overlay role="presentation">
      <div class="quote-ingest-modal" role="dialog" aria-modal="true" aria-labelledby="quote-ingest-title">
        <header class="quote-ingest-modal__head">
          <h2 id="quote-ingest-title">Importar ficha PDF → producto</h2>
          <button type="button" class="quote-ingest-modal__close" data-quote-ingest-close aria-label="Cerrar">✕</button>
        </header>
        <form class="quote-ingest-modal__body" data-quote-ingest-form>
          <p class="quote-ingest-help">Se creará un producto <strong>borrador</strong> (no publicado en catálogo) y se añadirá a la oferta.</p>
          <label class="quote-ingest-field"><span>Nombre</span>
            <input name="nombre" type="text" required value="${escapeHtml(draft.nombre_es)}" />
          </label>
          <label class="quote-ingest-field"><span>Slug / referencia</span>
            <input name="slug" type="text" required value="${escapeHtml(draft.slug || uniqueProductSlug(draft.nombre_es))}" />
          </label>
          <div class="quote-ingest-cols">
            <label class="quote-ingest-field"><span>Precio unitario (${escapeHtml(moneda)})</span>
              <input name="precio" type="number" min="0" step="${step}" placeholder="0 = pendiente validar" />
            </label>
            <label class="quote-ingest-field"><span>Cantidad</span>
              <input name="cantidad" type="number" min="1" step="1" value="1" required />
            </label>
          </div>
          ${
            draft.descripcion_corta_es
              ? `<p class="quote-ingest-help">${escapeHtml(draft.descripcion_corta_es.slice(0, 220))}</p>`
              : ''
          }
          <footer class="quote-ingest-modal__foot">
            <button type="button" class="quote-ingest-btn quote-ingest-btn--ghost" data-quote-ingest-close>Cancelar</button>
            <button type="submit" class="quote-ingest-btn quote-ingest-btn--primary">Crear producto y añadir</button>
          </footer>
        </form>
      </div>
    </div>`;
}

function closeIngestModal(slot: HTMLElement | null): void {
  slot?.replaceChildren();
}

export function bindQuoteCatalogSearch(
  options: QuoteLineToolsOptions & {
    searchInput: HTMLInputElement | null;
    suggestList: HTMLElement | null;
  }
): void {
  const { searchInput, suggestList, supabase, escapeHtml, getMoneda, onAddLine, onDirty } = options;
  if (!searchInput || !suggestList) return;
  let hits: CatalogProductHit[] = [];
  let activeIndex = -1;
  let searchTimer = 0;

  const addHit = (hit: CatalogProductHit) => {
    onAddLine(catalogHitToQuoteLine(hit, getMoneda(), 1));
    onDirty?.();
    suggestList.hidden = true;
    suggestList.innerHTML = '';
    searchInput.value = '';
    hits = [];
    activeIndex = -1;
  };

  async function runSearch(q: string): Promise<void> {
    if (!suggestList) return;
    if (q.trim().length < 2) {
      hits = [];
      suggestList.hidden = true;
      suggestList.innerHTML = '';
      return;
    }
    hits = await searchCatalogProducts(supabase, q.trim());
    suggestList.hidden = hits.length === 0;
    suggestList.innerHTML = hits
      .map((p, i) => {
        const unit = resolveCatalogUnitPrice(p);
        const precio =
          unit > 0
            ? ` <span class="quote-ingest-help">${escapeHtml(String(unit))} ${escapeHtml(p.moneda === 'USD' ? 'USD' : 'COP')}</span>`
            : '';
        return `<li role="option" data-catalog-hit="${i}" class="quote-ingest-suggest__item">${escapeHtml(p.nombre_es)}${p.sku ? ` <span class="quote-ingest-help">${escapeHtml(p.sku)}</span>` : ''}${precio}</li>`;
      })
      .join('');
    activeIndex = -1;
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void runSearch(searchInput.value), 220);
  });

  searchInput.addEventListener('keydown', event => {
    if (suggestList.hidden) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(hits.length - 1, activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0 && hits[activeIndex]) {
      event.preventDefault();
      addHit(hits[activeIndex]!);
      return;
    } else if (event.key === 'Escape') {
      suggestList.hidden = true;
      return;
    } else {
      return;
    }
    suggestList.querySelectorAll('[data-catalog-hit]').forEach((el, i) => {
      el.classList.toggle('is-active', i === activeIndex);
    });
  });

  suggestList.addEventListener('click', event => {
    const li = (event.target as Element).closest<HTMLElement>('[data-catalog-hit]');
    if (!li) return;
    const hit = hits[Number(li.getAttribute('data-catalog-hit'))];
    if (hit) addHit(hit);
  });
}

export function bindQuoteProductIngest(
  options: QuoteLineToolsOptions & {
    trigger: HTMLElement | null;
    fileInput: HTMLInputElement | null;
    modalSlot: HTMLElement | null;
  }
): void {
  const {
    trigger,
    fileInput,
    modalSlot,
    supabase,
    escapeHtml,
    toast,
    getMoneda,
    onAddLine,
    onDirty,
  } = options;
  if (!trigger || !fileInput || !modalSlot) return;

  const openPicker = () => {
    fileInput.value = '';
    fileInput.click();
  };

  trigger.addEventListener('click', () => openPicker());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      toast('Selecciona un archivo PDF.', 'error');
      return;
    }
    modalSlot.innerHTML = ingestModalHtml(
      {
        nombre_es: '…',
        nombre_en: '',
        slug: '',
        descripcion_corta_es: '',
        descripcion_larga_es: '',
        especificaciones: [],
        aplicaciones_es: [],
        beneficios_es: [],
        valor_es: '',
        marca: '',
        ficha_pdf: '',
      },
      getMoneda(),
      escapeHtml
    );
    const overlay = modalSlot.querySelector<HTMLElement>('[data-quote-ingest-overlay]');
    const body = modalSlot.querySelector('[data-quote-ingest-form]');
    if (body) {
      body.innerHTML = '<p class="quote-ingest-help">Leyendo PDF y extrayendo datos…</p>';
    }
    const closeHandlers = () => closeIngestModal(modalSlot);
    overlay?.addEventListener('click', event => {
      if (event.target === overlay) closeHandlers();
    });
    modalSlot.querySelectorAll('[data-quote-ingest-close]').forEach(btn => {
      btn.addEventListener('click', closeHandlers);
    });

    try {
      const { draft } = await fetchIngestDraftFromPdf(file, {
        supabase,
        invokeIngestaPdf: async body => {
          const { data, error } = await supabase.functions.invoke('ingesta-pdf', { body });
          if (error) throw error;
          return data;
        },
      });
      modalSlot.innerHTML = ingestModalHtml(draft, getMoneda(), escapeHtml);
      const form = modalSlot.querySelector<HTMLFormElement>('[data-quote-ingest-form]');
      const newOverlay = modalSlot.querySelector<HTMLElement>('[data-quote-ingest-overlay]');
      newOverlay?.addEventListener('click', event => {
        if (event.target === newOverlay) closeIngestModal(modalSlot);
      });
      modalSlot.querySelectorAll('[data-quote-ingest-close]').forEach(btn => {
        btn.addEventListener('click', () => closeIngestModal(modalSlot));
      });
      form?.addEventListener('submit', async event => {
        event.preventDefault();
        const data = new FormData(form);
        const nombre = String(data.get('nombre') ?? '').trim();
        const slug = String(data.get('slug') ?? '').trim() || uniqueProductSlug(nombre);
        const cantidad = Math.max(1, Math.floor(Number(data.get('cantidad')) || 1));
        const precioRaw = Number(data.get('precio'));
        const precio = Number.isFinite(precioRaw) && precioRaw > 0 ? precioRaw : 0;
        const moneda = getMoneda();
        const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Importando…';
        }
        try {
          const draftFinal: QuoteIngestDraft = { ...draft, nombre_es: nombre, slug };
          await importProductFromDraft(row => callAdminImportProduct(supabase, row), draftFinal, {
            slug,
            precio: precio > 0 ? precio : null,
            activo: false,
          });
          onAddLine(draftToQuoteLine(draftFinal, slug, moneda, cantidad, precio));
          onDirty?.();
          toast('Producto importado y añadido a la oferta.', 'success');
          closeIngestModal(modalSlot);
        } catch (err) {
          toast(err instanceof Error ? err.message : 'No se pudo importar el producto.', 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear producto y añadir';
          }
        }
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al leer el PDF.', 'error');
      closeIngestModal(modalSlot);
    }
  });
}
