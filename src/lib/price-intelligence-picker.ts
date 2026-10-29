/**
 * Buscador de inteligencia de precios para el editor de cotizaciones.
 * El costo se muestra en el modal. A la línea del cliente solo pasa el precio
 * de venta confirmado.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CotizacionLineaOferta } from './cotizacion-oferta';
import {
  SOURCE_LABEL,
  assumptionsFromFields,
  entryFromRow,
  formatIntelMoney,
  isPriceStale,
  priceForQuoteCurrency,
  quoteLanding,
  roundMoney,
  sanitizeIlike,
  toCop,
  type LandingAssumptions,
  type PriceEntry,
} from './price-intelligence';

export interface QuotePriceFill {
  nombre: string;
  slug: string;
  precio_unitario: number;
  moneda: 'COP' | 'USD';
  notas: string | null;
  tratamiento_iva: '19' | null;
}

interface PickerOptions {
  root: HTMLElement;
  supabase: SupabaseClient;
  escapeHtml: (value: string) => string;
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  getMoneda: () => 'COP' | 'USD';
  modalSlot: HTMLElement | null;
  onAddLine: (line: CotizacionLineaOferta) => void;
  onApplied?: () => void;
}

export function applyQuotePriceFill(row: HTMLElement, fill: QuotePriceFill): void {
  const nombre = row.querySelector<HTMLInputElement>('[data-linea-nombre]');
  if (nombre) nombre.value = fill.nombre;
  const slug = row.querySelector<HTMLInputElement>('[data-linea-slug]');
  if (slug) slug.value = fill.slug;
  const modo = row.querySelector<HTMLSelectElement>('[data-linea-precio-modo]');
  if (modo) {
    modo.value = 'numero';
    modo.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const precio = row.querySelector<HTMLInputElement>('[data-linea-precio]');
  if (precio) {
    precio.disabled = false;
    precio.value = String(fill.precio_unitario);
    precio.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const iva = row.querySelector<HTMLSelectElement>('[data-linea-iva]');
  if (iva && fill.tratamiento_iva) {
    iva.value = fill.tratamiento_iva;
    iva.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const notas = row.querySelector<HTMLTextAreaElement>('[data-linea-notas]');
  if (notas && fill.notas && !notas.value.trim()) notas.value = fill.notas;
}

export function bindQuotePriceIntelligence(options: PickerOptions): void {
  if (options.root.dataset['priceIntelBound'] === '1') return;
  options.root.dataset['priceIntelBound'] = '1';
  options.root.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const open = target.closest<HTMLElement>('[data-price-intel-open], [data-price-intel-line]');
    if (!open) return;
    event.preventDefault();
    const row = open.closest<HTMLElement>('[data-cotizacion-linea], [data-quote-line]');
    const seed =
      row?.querySelector<HTMLInputElement>('[data-linea-nombre]')?.value.trim() ||
      options.root
        .querySelector<HTMLInputElement>(
          '[data-cotizacion-catalog-search], [data-quote-search-product]'
        )
        ?.value.trim() ||
      '';
    openPicker(options, row, seed);
  });
}

function openPicker(options: PickerOptions, row: HTMLElement | null, seed: string): void {
  const slot = options.modalSlot;
  if (!slot) {
    options.toast('No hay contenedor para el buscador de precios.', 'error');
    return;
  }
  const hits = new Map<string, PriceEntry>();
  let selected: PriceEntry | null = null;
  slot.innerHTML = modalHtml(options.escapeHtml, seed, options.getMoneda());
  const overlay = slot.querySelector<HTMLElement>('[data-price-intel-overlay]');
  const close = () => {
    slot.replaceChildren();
  };
  overlay?.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  slot.querySelectorAll('[data-price-intel-close]').forEach(button => {
    button.addEventListener('click', close);
  });
  slot.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });

  const searchInput = slot.querySelector<HTMLInputElement>('[data-price-intel-q]');
  const results = slot.querySelector<HTMLElement>('[data-price-intel-results]');
  const preview = slot.querySelector<HTMLElement>('[data-price-intel-preview]');
  let timer = 0;

  const runSearch = async () => {
    if (!results) return;
    results.innerHTML = '<p class="quote-ingest-help">Buscando precios…</p>';
    const found = await fetchPrices(options.supabase, searchInput?.value ?? '');
    hits.clear();
    if (!found.ok) {
      results.innerHTML = `<p class="quote-ingest-help">${options.escapeHtml(found.error)}</p>`;
      return;
    }
    for (const hit of found.rows) hits.set(hit.id, hit);
    results.innerHTML = resultsHtml(found.rows, options.escapeHtml);
  };

  const refreshPreview = () => {
    if (!preview) return;
    preview.innerHTML = selected
      ? previewHtml(selected, readModalAssumptions(slot), options.getMoneda(), options.escapeHtml)
      : '<p class="quote-ingest-help">Elige un precio de proveedor o de la web.</p>';
  };

  searchInput?.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void runSearch(), 250);
  });
  slot
    .querySelector('[data-price-intel-search]')
    ?.addEventListener('click', () => void runSearch());
  slot.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pick = target.closest<HTMLElement>('[data-price-intel-pick]');
    if (!pick) return;
    selected = hits.get(pick.dataset['priceIntelPick'] ?? '') ?? null;
    refreshPreview();
  });
  slot.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-price-intel-assumptions]')) return;
    refreshPreview();
  });
  slot.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-price-intel-assumptions]')) return;
    refreshPreview();
  });
  slot.querySelector('[data-price-intel-apply]')?.addEventListener('click', () => {
    if (!selected) {
      options.toast('Elige un precio primero.', 'error');
      return;
    }
    const fill = fillFromModal(slot, selected, options.getMoneda());
    if (!fill.ok) {
      options.toast(fill.error, 'error');
      return;
    }
    if (row) applyQuotePriceFill(row, fill.fill);
    else options.onAddLine(lineFromFill(fill.fill));
    options.onApplied?.();
    options.toast('Precio de venta cargado en la cotización.', 'success');
    close();
  });

  void runSearch();
  searchInput?.focus();
}

async function fetchPrices(
  supabase: SupabaseClient,
  queryText: string
): Promise<{ ok: true; rows: PriceEntry[] } | { ok: false; error: string }> {
  const safe = sanitizeIlike(queryText);
  let query = supabase
    .from('market_price_entries')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(40);
  if (safe.length >= 2) {
    query = query.or(
      `equipment_name.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%,supplier_or_source_name.ilike.%${safe}%`
    );
  }
  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      error: error.message.includes('market_price_entries')
        ? 'Falta aplicar la migración de inteligencia de precios.'
        : error.message,
    };
  }
  const rows = (data ?? [])
    .map(item => entryFromRow(item as Record<string, unknown>))
    .filter((item): item is PriceEntry => item != null);
  return { ok: true, rows };
}

function modalHtml(
  escapeHtml: (value: string) => string,
  seed: string,
  moneda: 'COP' | 'USD'
): string {
  return `
    <div class="quote-ingest-overlay" data-price-intel-overlay role="presentation">
      <div class="quote-ingest-modal quote-ingest-modal--wide" role="dialog" aria-modal="true" aria-labelledby="price-intel-title">
        <header class="quote-ingest-modal__head">
          <h2 id="price-intel-title">Buscar en Inteligencia de Precios</h2>
          <button class="quote-ingest-modal__close" type="button" data-price-intel-close aria-label="Cerrar">×</button>
        </header>
        <div class="quote-ingest-modal__body">
          <p class="quote-ingest-help">El costo queda en este panel. A la oferta solo pasa el precio de venta que confirmes, en ${escapeHtml(moneda)}.</p>
          <div class="quote-ingest-cols">
            <label class="quote-ingest-field">Equipo, marca o modelo
              <input data-price-intel-q type="search" value="${escapeHtml(seed)}" />
            </label>
            <button class="admin-button comercial-button" type="button" data-price-intel-search>Buscar</button>
          </div>
          <div data-price-intel-results></div>
          <form data-price-intel-assumptions class="admin-grid" style="margin-top:12px">
            <label class="quote-ingest-field">TRM
              <input name="trm" type="number" min="0" step="0.01" placeholder="Sin tasa por defecto" />
            </label>
            <label class="quote-ingest-field">Flete %
              <input name="freight_pct" type="number" min="0" step="0.01" />
            </label>
            <label class="quote-ingest-field">Arancel %
              <input name="duty_pct" type="number" min="0" step="0.01" />
            </label>
            <label class="quote-ingest-field">Margen I-ME %
              <input name="margin_pct" type="number" min="0" step="0.01" />
            </label>
            <label class="quote-ingest-field">Estampillas %
              <input name="stamp_pct" type="number" min="0" step="0.01" value="30" />
            </label>
            <label class="quote-ingest-field">Aplicar estampillas sobre el máximo
              <input name="apply_stamp" type="checkbox" />
            </label>
          </form>
          <div data-price-intel-preview><p class="quote-ingest-help">Elige un precio de proveedor o de la web.</p></div>
          <div class="quote-ingest-modal__foot">
            <button class="admin-button admin-button--ghost comercial-button comercial-button--ghost" type="button" data-price-intel-close>Cancelar</button>
            <button class="admin-button comercial-button comercial-button--primary" type="button" data-price-intel-apply>Cargar en la cotización</button>
          </div>
        </div>
      </div>
    </div>`;
}

function resultsHtml(rows: PriceEntry[], escapeHtml: (value: string) => string): string {
  if (!rows.length) return '<p class="quote-ingest-help">Sin precios para esa búsqueda.</p>';
  return `<ul class="quote-ingest-suggest" style="position:static;max-height:220px">${rows
    .map(row => {
      const stale = isPriceStale(row) ? ' · +90 días' : '';
      const label = `${row.brand ? `${row.brand} ` : ''}${row.model || row.equipment_name}`;
      return `<li><button type="button" data-price-intel-pick="${escapeHtml(row.id)}">${escapeHtml(label)} · ${escapeHtml(SOURCE_LABEL[row.source_type])} · ${escapeHtml(formatIntelMoney(row.unit_cost_original, row.currency))}${escapeHtml(stale)}</button></li>`;
    })
    .join('')}</ul>`;
}

function readModalAssumptions(slot: HTMLElement): LandingAssumptions {
  const form = slot.querySelector<HTMLFormElement>('[data-price-intel-assumptions]');
  const value = (name: string) =>
    form?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? '';
  return assumptionsFromFields({
    trm: value('trm'),
    freightPct: value('freight_pct'),
    dutyPct: value('duty_pct'),
    marginPct: value('margin_pct'),
    stampPct: value('stamp_pct'),
    applyStamp: Boolean(form?.querySelector<HTMLInputElement>('[name="apply_stamp"]')?.checked),
  });
}

function previewHtml(
  entry: PriceEntry,
  assumptions: LandingAssumptions,
  moneda: 'COP' | 'USD',
  escapeHtml: (value: string) => string
): string {
  const landing = quoteLanding(entry, assumptions);
  const saleCop = assumptions.applyStamp ? landing.stampPriceCop : landing.suggestedCop;
  const sale = priceForQuoteCurrency(moneda, saleCop, assumptions.trm ?? entry.trm_applied);
  const prefill = sale ?? '';
  const missing = landing.missing.length ? ` Falta: ${landing.missing.join(', ')}.` : '';
  return `
    <div class="admin-alert">
      <strong>${escapeHtml(entry.equipment_name)}</strong>
      · costo ${escapeHtml(formatIntelMoney(entry.unit_cost_original, entry.currency))}
      ${entry.iva_mode === 'mas_iva' ? ' + IVA' : ''}
      · aterrizado ${escapeHtml(formatIntelMoney(landing.landedCop, 'COP'))}
      · venta sugerida ${escapeHtml(formatIntelMoney(landing.suggestedCop, 'COP'))}
      ${assumptions.applyStamp ? ` · con estampillas ${escapeHtml(formatIntelMoney(landing.stampPriceCop, 'COP'))}` : ''}
      ${landing.partial ? ' · aterrizaje parcial' : ''}
      ${escapeHtml(missing)}
    </div>
    <label class="quote-ingest-field">Precio de venta a cargar (${escapeHtml(moneda)})
      <input name="sale_price" data-price-intel-sale type="number" min="0" step="${moneda === 'USD' ? '0.01' : '1'}" value="${prefill}" />
    </label>
    <label class="quote-ingest-field"><input name="confirm_sale" data-price-intel-confirm type="checkbox" /> Si el importe coincide con el costo, confirmo que igual quiero usarlo como precio de venta.</label>`;
}

function fillFromModal(
  slot: HTMLElement,
  entry: PriceEntry,
  moneda: 'COP' | 'USD'
): { ok: true; fill: QuotePriceFill } | { ok: false; error: string } {
  const assumptions = readModalAssumptions(slot);
  const saleInput = slot.querySelector<HTMLInputElement>('[data-price-intel-sale]');
  const typed = Number(saleInput?.value ?? '');
  if (!Number.isFinite(typed) || typed <= 0) {
    return {
      ok: false,
      error:
        'Indica el precio de venta. Sin TRM y margen no se calcula solo para no cotizar el costo.',
    };
  }
  const cost = costInQuote(entry, moneda, assumptions.trm ?? entry.trm_applied);
  const confirm = slot.querySelector<HTMLInputElement>('[data-price-intel-confirm]');
  if (cost != null && nearlyEqual(typed, cost) && !confirm?.checked) {
    return {
      ok: false,
      error:
        'Ese importe coincide con el costo. Márcalo como precio de venta o calcula el margen antes de enviarlo al cliente.',
    };
  }
  return {
    ok: true,
    fill: {
      nombre: entry.equipment_name,
      slug: entry.model ?? '',
      precio_unitario: roundMoney(typed, moneda),
      moneda,
      notas: entry.specs_summary,
      tratamiento_iva: entry.iva_mode === 'mas_iva' ? '19' : null,
    },
  };
}

function lineFromFill(fill: QuotePriceFill): CotizacionLineaOferta {
  const line: CotizacionLineaOferta = {
    slug: fill.slug,
    nombre: fill.nombre,
    cantidad: 1,
    precio_unitario: fill.precio_unitario,
    subtotal: fill.precio_unitario,
    moneda: fill.moneda,
  };
  if (fill.notas) line.notas = fill.notas;
  if (fill.tratamiento_iva) line.tratamiento_iva = fill.tratamiento_iva;
  return line;
}

function costInQuote(entry: PriceEntry, moneda: 'COP' | 'USD', trm: number | null): number | null {
  if (entry.currency === moneda) return roundMoney(entry.unit_cost_original, moneda);
  if (moneda === 'COP') return toCop(entry.unit_cost_original, entry.currency, trm);
  if (entry.currency === 'COP' && trm && trm > 0)
    return roundMoney(entry.unit_cost_original / trm, 'USD');
  return null;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1, Math.abs(right) * 0.001);
}
