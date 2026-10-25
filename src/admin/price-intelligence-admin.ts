/**
 * CMS → Inteligencia de precios y comparativas.
 * Costos de proveedor y referencias web. No se publican en el sitio.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INCOTERMS,
  SOURCE_LABEL,
  SOURCE_TYPES,
  assumptionsFromFields,
  buildComparisons,
  entryFromRow,
  formatIntelMoney,
  isPriceStale,
  normalizePriceInput,
  parsePriceBatch,
  quoteLanding,
  sanitizeIlike,
  type LandingAssumptions,
  type PriceComparison,
  type PriceEntry,
} from '../lib/price-intelligence';

export interface PriceIntelAdminCtx {
  supabase: SupabaseClient;
  escapeHtml: (value: string) => string;
  toast: (message: string) => void;
  rerender: () => Promise<void>;
  canDelete: boolean;
}

const CSV_TEMPLATE =
  'equipment_name,brand,model,category,source_type,supplier_or_source_name,supplier_country,contact_email,source_url_or_ref,currency,unit_cost_original,price_min_original,price_avg_original,price_max_original,incoterm,tier_min_qty,lead_time,iva_mode,trm_applied,freight_pct,duty_pct,ime_margin_pct,estimated_landed_cost_cop,suggested_sale_price_cop,max_reference_price_cop,public_stamp_surcharge_pct,valid_until,captured_at,invima_registration,invima_status,notes';

let loaded: PriceEntry[] = [];

function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

function assumptionsOf(root: ParentNode): LandingAssumptions {
  const form = root.querySelector<HTMLFormElement>('[data-price-assumptions]');
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

export async function priceIntelligenceView(ctx: PriceIntelAdminCtx): Promise<string> {
  const params = hashParams();
  const filters = {
    q: params.get('q') ?? '',
    origen: params.get('origen') ?? '',
    moneda: params.get('moneda') ?? '',
    invima: params.get('invima') ?? '',
  };
  const result = await loadEntries(ctx.supabase, filters);
  loaded = result.rows;
  const assumptions = assumptionsFromFields({
    trm: '',
    freightPct: '',
    dutyPct: '',
    marginPct: '',
    stampPct: '30',
    applyStamp: false,
  });
  const missing = result.error
    ? `<div class="admin-alert">${ctx.escapeHtml(result.error)}</div>`
    : '';
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>Inteligencia de precios y comparativas</h2>
        <span class="admin-meta">${loaded.length} registros</span>
      </div>
      <div class="admin-alert">Costo confidencial. No sale al sitio ni al PDF del cliente. La cotización recibe solo el precio de venta confirmado. Sin TRM, flete, arancel o margen escritos aquí, el aterrizaje no inventa tasas.</div>
      ${missing}
      <form class="admin-grid" data-price-filters style="padding:16px">
        <label class="admin-field">Equipo, marca o modelo
          <input name="q" type="search" value="${ctx.escapeHtml(filters.q)}" />
        </label>
        <label class="admin-field">Origen
          <select name="origen">
            <option value="" ${filters.origen === '' ? 'selected' : ''}>Todos</option>
            <option value="factory" ${filters.origen === 'factory' ? 'selected' : ''}>Proveedor fábrica</option>
            <option value="local" ${filters.origen === 'local' ? 'selected' : ''}>Distribuidor local</option>
            <option value="web" ${filters.origen === 'web' ? 'selected' : ''}>Web scraping</option>
            <option value="historical" ${filters.origen === 'historical' ? 'selected' : ''}>Histórico</option>
          </select>
        </label>
        <label class="admin-field">Moneda
          <select name="moneda">
            ${['', 'USD', 'COP', 'EUR', 'QAR'].map(code => `<option value="${code}" ${filters.moneda === code ? 'selected' : ''}>${code || 'Todas'}</option>`).join('')}
          </select>
        </label>
        <label class="admin-field">Estado INVIMA
          <input name="invima" value="${ctx.escapeHtml(filters.invima)}" placeholder="vigente, vencido…" />
        </label>
        <button class="admin-button" type="submit">Filtrar</button>
      </form>
      <form class="admin-grid" data-price-assumptions style="padding:0 16px 16px">
        <label class="admin-field">TRM para aterrizar
          <input name="trm" type="number" min="0" step="0.01" placeholder="Sin tasa por defecto" />
        </label>
        <label class="admin-field">Flete % (FOB/EXW)
          <input name="freight_pct" type="number" min="0" step="0.01" />
        </label>
        <label class="admin-field">Arancel % (FOB/EXW/CIF)
          <input name="duty_pct" type="number" min="0" step="0.01" />
        </label>
        <label class="admin-field">Margen I-ME %
          <input name="margin_pct" type="number" min="0" step="0.01" />
        </label>
        <label class="admin-field">Estampillas %
          <input name="stamp_pct" type="number" min="0" step="0.01" value="30" />
        </label>
        <label class="admin-field">Aplicar estampillas al máximo
          <input name="apply_stamp" type="checkbox" />
        </label>
      </form>
      <div data-price-compare aria-live="polite">${comparisonHtml(buildComparisons(loaded, assumptions), assumptions, ctx.escapeHtml)}</div>
      <div class="admin-table-wrap">${tableHtml(loaded, ctx.escapeHtml, ctx.canDelete)}</div>
      <div style="padding:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="admin-button" type="button" data-price-new>Registrar precio</button>
        <button class="admin-button admin-button--ghost" type="button" data-price-import-open>Importar JSON/CSV</button>
        <a class="admin-button admin-button--ghost" href="${csvHref()}" download="plantilla-inteligencia-precios.csv">Plantilla CSV</a>
      </div>
      <div data-price-form-slot hidden>${formHtml(ctx.escapeHtml, null)}</div>
      <div data-price-import-slot></div>
    </section>`;
}

async function loadEntries(
  supabase: SupabaseClient,
  filters: { q: string; origen: string; moneda: string; invima: string }
): Promise<{ rows: PriceEntry[]; error: string }> {
  let query = supabase
    .from('market_price_entries')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(500);
  const q = sanitizeIlike(filters.q);
  if (q) {
    query = query.or(
      `equipment_name.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%,supplier_or_source_name.ilike.%${q}%,category.ilike.%${q}%`
    );
  }
  if (filters.origen === 'factory')
    query = query.in('source_type', ['factory_fob', 'factory_exw', 'factory_cif']);
  if (filters.origen === 'local') query = query.eq('source_type', 'local_distributor');
  if (filters.origen === 'web') query = query.eq('source_type', 'web_scrape');
  if (filters.origen === 'historical') query = query.eq('source_type', 'historical_quote');
  if (filters.moneda) query = query.eq('currency', filters.moneda.toUpperCase());
  const invima = sanitizeIlike(filters.invima);
  if (invima) query = query.ilike('invima_status', `%${invima}%`);
  const { data, error } = await query;
  if (error) {
    const message = /market_price_entries|schema cache/i.test(error.message)
      ? 'La tabla todavía no está en la base. Aplica la migración 20261025120000_market_price_intelligence.sql.'
      : error.message;
    return { rows: [], error: message };
  }
  return {
    rows: (data ?? [])
      .map(row => entryFromRow(row as Record<string, unknown>))
      .filter((row): row is PriceEntry => row != null),
    error: '',
  };
}

function comparisonHtml(
  groups: PriceComparison[],
  assumptions: LandingAssumptions,
  escapeHtml: (value: string) => string
): string {
  if (!groups.length) {
    return '<p class="admin-help" style="padding:0 16px 16px">No hay grupos para comparar con estos filtros.</p>';
  }
  const cards = groups
    .map(group => {
      const landing = group.factory ? quoteLanding(group.factory, assumptions) : null;
      const stale = group.stale
        ? '<p class="price-intel-stale">Hay precios con más de 90 días o vigencia vencida.</p>'
        : '';
      return `
        <article class="price-intel-card">
          <h3>${escapeHtml(group.label)}</h3>
          <p class="admin-meta">${escapeHtml(group.category || 'Sin categoría')} · INVIMA ${escapeHtml(group.invimaStatus || 'sin dato')}</p>
          ${stale}
          <div class="price-intel-cols">
            <div><strong>Fábrica</strong><br>${columnPrice(group.factory, landing?.landedCop ?? null, escapeHtml)}</div>
            <div><strong>Distribuidor local</strong><br>${columnPrice(group.local, group.localCop, escapeHtml)}</div>
            <div><strong>Web</strong><br>${webColumn(group, escapeHtml)}</div>
          </div>
          <p class="admin-meta">Diferencial local vs fábrica: ${pct(group.deltaLocalVsFactoryPct)} · web vs fábrica: ${pct(group.deltaWebVsFactoryPct)}</p>
          <p class="admin-meta">Escalas: ${escapeHtml(tierSummary(group))}</p>
          ${
            group.historical
              ? `<p class="admin-meta">Histórico: ${escapeHtml(formatIntelMoney(group.historical.unit_cost_original, group.historical.currency))} · ${escapeHtml(group.historical.supplier_or_source_name || 'sin fuente')}</p>`
              : ''
          }
          ${
            assumptions.applyStamp && landing?.stampPriceCop
              ? `<p class="admin-meta">Venta con estampillas: ${escapeHtml(formatIntelMoney(landing.stampPriceCop, 'COP'))}</p>`
              : ''
          }
        </article>`;
    })
    .join('');
  return `<div class="price-intel-compare">${cards}</div>`;
}

function columnPrice(
  entry: PriceEntry | null,
  landed: number | null,
  escapeHtml: (value: string) => string
): string {
  if (!entry) return '<span class="admin-meta">Sin dato</span>';
  const stale = isPriceStale(entry)
    ? ' <span class="admin-badge admin-badge--warn">+90 días</span>'
    : '';
  return `${escapeHtml(SOURCE_LABEL[entry.source_type])} ${escapeHtml(formatIntelMoney(entry.unit_cost_original, entry.currency))}${stale}<br><span class="admin-meta">${escapeHtml(entry.supplier_or_source_name || 'Sin fuente')} · ${escapeHtml(entry.incoterm)} · aterrizado ${escapeHtml(formatIntelMoney(landed, 'COP'))}</span>`;
}

function webColumn(group: PriceComparison, escapeHtml: (value: string) => string): string {
  if (!group.web) return '<span class="admin-meta">Sin dato</span>';
  return `mín ${escapeHtml(formatIntelMoney(group.webMinCop, 'COP'))}<br>medio ${escapeHtml(formatIntelMoney(group.webAvgCop, 'COP'))}<br>máx ${escapeHtml(formatIntelMoney(group.webMaxCop, 'COP'))}`;
}

function pct(value: number | null): string {
  if (value == null) return 'pendiente (falta aterrizar fábrica)';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('es-CO')} %`;
}

function tierSummary(group: PriceComparison): string {
  const tiers = group.tiers.filter(
    entry => entry.source_type === (group.factory?.source_type ?? entry.source_type)
  );
  const unique = new Map<string, PriceEntry>();
  for (const entry of tiers) unique.set(`${entry.source_type}:${entry.tier_min_qty}`, entry);
  return [...unique.values()]
    .map(
      entry =>
        `${entry.tier_min_qty}+ ${formatIntelMoney(entry.unit_cost_original, entry.currency)}`
    )
    .join(' · ');
}

function tableHtml(
  rows: PriceEntry[],
  escapeHtml: (value: string) => string,
  canDelete: boolean
): string {
  const body = rows
    .map(row => {
      const stale = isPriceStale(row)
        ? '<span class="admin-badge admin-badge--warn">+90 días</span>'
        : '';
      return `<tr>
        <td>${escapeHtml(row.equipment_name)}<br><span class="admin-meta">${escapeHtml(row.brand || '')} ${escapeHtml(row.model || '')}</span></td>
        <td>${escapeHtml(row.category || '—')}</td>
        <td>${escapeHtml(SOURCE_LABEL[row.source_type])}<br><span class="admin-meta">${escapeHtml(row.supplier_or_source_name || '')}</span></td>
        <td>${escapeHtml(formatIntelMoney(row.unit_cost_original, row.currency))}<br><span class="admin-meta">${escapeHtml(row.incoterm)} · ${row.tier_min_qty}+ ${row.iva_mode === 'mas_iva' ? '+ IVA' : ''}</span></td>
        <td>${escapeHtml(row.invima_status || '—')}<br><span class="admin-meta">${escapeHtml(row.invima_registration || '')}</span></td>
        <td>${escapeHtml(new Date(row.captured_at).toLocaleDateString('es-CO'))} ${stale}<br><span class="admin-meta">${escapeHtml(row.lead_time || '')}</span></td>
        <td>
          <button class="admin-button admin-button--ghost" type="button" data-price-edit="${escapeHtml(row.id)}">Editar</button>
          ${canDelete ? `<button class="admin-button admin-button--danger" type="button" data-price-delete="${escapeHtml(row.id)}">Eliminar</button>` : ''}
        </td>
      </tr>`;
    })
    .join('');
  return `<table class="admin-table"><thead><tr><th>Equipo</th><th>Categoría</th><th>Origen</th><th>Precio</th><th>INVIMA</th><th>Captura</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="7">Sin registros.</td></tr>'}</tbody></table>`;
}

function formHtml(escapeHtml: (value: string) => string, entry: PriceEntry | null): string {
  const value = (text: string | null | undefined) => escapeHtml(text ?? '');
  const num = (amount: number | null | undefined) => (amount == null ? '' : String(amount));
  const options = (values: readonly string[], current: string | null) =>
    values
      .map(item => `<option value="${item}" ${item === current ? 'selected' : ''}>${item}</option>`)
      .join('');
  return `
    <form class="admin-form admin-grid" data-price-entry-form style="padding:0 16px 16px">
      <input type="hidden" name="id" value="${value(entry?.id)}" />
      <input type="hidden" name="external_key" value="${value(entry?.external_key)}" />
      <label class="admin-field">Equipo
        <input name="equipment_name" required value="${value(entry?.equipment_name)}" />
      </label>
      <label class="admin-field">Marca
        <input name="brand" value="${value(entry?.brand)}" />
      </label>
      <label class="admin-field">Modelo
        <input name="model" value="${value(entry?.model)}" />
      </label>
      <label class="admin-field">Categoría
        <input name="category" value="${value(entry?.category)}" />
      </label>
      <label class="admin-field">Origen
        <select name="source_type">${SOURCE_TYPES.map(item => `<option value="${item}" ${item === (entry?.source_type ?? 'factory_cif') ? 'selected' : ''}>${SOURCE_LABEL[item]}</option>`).join('')}</select>
      </label>
      <label class="admin-field">Proveedor o fuente
        <input name="supplier_or_source_name" value="${value(entry?.supplier_or_source_name)}" />
      </label>
      <label class="admin-field">País
        <input name="supplier_country" value="${value(entry?.supplier_country)}" />
      </label>
      <label class="admin-field">Email
        <input name="contact_email" type="email" value="${value(entry?.contact_email)}" />
      </label>
      <label class="admin-field">PI, correo o URL
        <input name="source_url_or_ref" value="${value(entry?.source_url_or_ref)}" />
      </label>
      <label class="admin-field">Moneda
        <input name="currency" required maxlength="3" value="${value(entry?.currency ?? 'USD')}" />
      </label>
      <label class="admin-field">Costo unitario
        <input name="unit_cost_original" type="number" min="0" step="0.01" required value="${num(entry?.unit_cost_original)}" />
      </label>
      <label class="admin-field">Mínimo web
        <input name="price_min_original" type="number" min="0" step="0.01" value="${num(entry?.price_min_original)}" />
      </label>
      <label class="admin-field">Medio web
        <input name="price_avg_original" type="number" min="0" step="0.01" value="${num(entry?.price_avg_original)}" />
      </label>
      <label class="admin-field">Máximo web
        <input name="price_max_original" type="number" min="0" step="0.01" value="${num(entry?.price_max_original)}" />
      </label>
      <label class="admin-field">Incoterm
        <select name="incoterm">${options(INCOTERMS, entry?.incoterm ?? 'CIF')}</select>
      </label>
      <label class="admin-field">Escala (1, 3, 5, 10+)
        <input name="tier_min_qty" type="number" min="1" step="1" value="${entry?.tier_min_qty ?? 1}" />
      </label>
      <label class="admin-field">Entrega
        <input name="lead_time" value="${value(entry?.lead_time)}" />
      </label>
      <label class="admin-field">IVA
        <select name="iva_mode">
          <option value="">Sin dato</option>
          <option value="mas_iva" ${entry?.iva_mode === 'mas_iva' ? 'selected' : ''}>+ IVA</option>
          <option value="incluido" ${entry?.iva_mode === 'incluido' ? 'selected' : ''}>IVA incluido</option>
          <option value="no_aplica" ${entry?.iva_mode === 'no_aplica' ? 'selected' : ''}>No aplica</option>
        </select>
      </label>
      <label class="admin-field">Registro INVIMA
        <input name="invima_registration" value="${value(entry?.invima_registration)}" />
      </label>
      <label class="admin-field">Estado INVIMA
        <input name="invima_status" value="${value(entry?.invima_status)}" />
      </label>
      <label class="admin-field">Specs
        <input name="specs_summary" value="${value(entry?.specs_summary)}" />
      </label>
      <label class="admin-field">Vigencia
        <input name="valid_until" type="date" value="${value(entry?.valid_until?.slice(0, 10))}" />
      </label>
      <label class="admin-field">Notas
        <textarea name="notes" rows="2">${value(entry?.notes)}</textarea>
      </label>
      <button class="admin-button" type="submit">Guardar precio</button>
    </form>`;
}

function csvHref(): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;
}

export function bindPriceIntelligence(ctx: PriceIntelAdminCtx): void {
  const root = document.querySelector('[data-price-filters]')?.closest('section');
  if (!root) return;
  root.querySelector<HTMLFormElement>('[data-price-filters]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['q', 'origen', 'moneda', 'invima']) {
      const value = String(data.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    location.hash = `#/inteligencia-precios${params.toString() ? `?${params.toString()}` : ''}`;
  });
  const compare = root.querySelector<HTMLElement>('[data-price-compare]');
  const refresh = () => {
    if (!compare) return;
    const assumptions = assumptionsOf(root);
    compare.innerHTML = comparisonHtml(
      buildComparisons(loaded, assumptions),
      assumptions,
      ctx.escapeHtml
    );
  };
  root.querySelector('[data-price-assumptions]')?.addEventListener('input', refresh);
  root.querySelector('[data-price-new]')?.addEventListener('click', () => {
    const slot = root.querySelector<HTMLElement>('[data-price-form-slot]');
    if (!slot) return;
    slot.hidden = false;
    slot.innerHTML = formHtml(ctx.escapeHtml, null);
    bindEntryForm(ctx, slot);
  });
  root
    .querySelector('[data-price-import-open]')
    ?.addEventListener('click', () => openImport(ctx, root));
  root.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const edit = target.closest<HTMLElement>('[data-price-edit]');
    if (edit) {
      const entry = loaded.find(row => row.id === edit.dataset['priceEdit']);
      const slot = root.querySelector<HTMLElement>('[data-price-form-slot]');
      if (!entry || !slot) return;
      slot.hidden = false;
      slot.innerHTML = formHtml(ctx.escapeHtml, entry);
      bindEntryForm(ctx, slot);
      return;
    }
    const remove = target.closest<HTMLElement>('[data-price-delete]');
    if (remove) void removeEntry(ctx, remove.dataset['priceDelete'] ?? '');
  });
}

function bindEntryForm(ctx: PriceIntelAdminCtx, slot: HTMLElement): void {
  slot
    .querySelector<HTMLFormElement>('[data-price-entry-form]')
    ?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      void saveEntry(ctx, form);
    });
}

async function saveEntry(ctx: PriceIntelAdminCtx, form: HTMLFormElement): Promise<void> {
  const data = Object.fromEntries(new FormData(form).entries());
  const parsed = normalizePriceInput(data);
  if (!parsed.ok) {
    ctx.toast(parsed.error);
    return;
  }
  const id = String(data['id'] ?? '').trim();
  const payload = parsed.row;
  const existing = id ? loaded.find(row => row.id === id) : undefined;
  if (existing) {
    payload.captured_at = existing.captured_at;
    payload.product_id = existing.product_id;
    payload.raw_metadata = existing.raw_metadata;
    payload.trm_applied = existing.trm_applied;
    payload.freight_pct = existing.freight_pct;
    payload.duty_pct = existing.duty_pct;
    payload.ime_margin_pct = existing.ime_margin_pct;
    payload.estimated_landed_cost_cop = existing.estimated_landed_cost_cop;
    payload.suggested_sale_price_cop = existing.suggested_sale_price_cop;
    payload.max_reference_price_cop = existing.max_reference_price_cop;
    payload.public_stamp_surcharge_pct = existing.public_stamp_surcharge_pct;
  }
  const query = id
    ? ctx.supabase.from('market_price_entries').update(payload).eq('id', id)
    : ctx.supabase.from('market_price_entries').insert(payload);
  const { error } = await query;
  if (error) {
    ctx.toast(error.message);
    return;
  }
  ctx.toast('Precio guardado.');
  await ctx.rerender();
}

async function removeEntry(ctx: PriceIntelAdminCtx, id: string): Promise<void> {
  if (!id) return;
  if (!window.confirm('¿Eliminar este precio de la inteligencia?')) return;
  const { error } = await ctx.supabase.from('market_price_entries').delete().eq('id', id);
  if (error) {
    ctx.toast(error.message);
    return;
  }
  ctx.toast('Precio eliminado.');
  await ctx.rerender();
}

function openImport(ctx: PriceIntelAdminCtx, root: Element): void {
  const slot = root.querySelector<HTMLElement>('[data-price-import-slot]');
  if (!slot) return;
  slot.innerHTML = `
    <div class="quote-ingest-overlay" data-price-import-overlay role="presentation">
      <div class="quote-ingest-modal quote-ingest-modal--wide" role="dialog" aria-modal="true" aria-labelledby="price-import-title">
        <header class="quote-ingest-modal__head">
          <h2 id="price-import-title">Importar precios</h2>
          <button class="quote-ingest-modal__close" type="button" data-price-import-close aria-label="Cerrar">×</button>
        </header>
        <form class="quote-ingest-modal__body" data-price-import-form>
          <p class="quote-ingest-help">Pega un JSON (arreglo u objeto con rows) o un CSV con los encabezados de la plantilla. La clave externa evita duplicar la misma captura.</p>
          <label class="quote-ingest-field">Archivo JSON o CSV
            <input name="file" type="file" accept=".json,.csv,text/csv,application/json" />
          </label>
          <label class="quote-ingest-field">O pega el contenido
            <textarea name="payload" rows="8" placeholder='[{"equipment_name":"Nombre del equipo","brand":"Marca","model":"Modelo","source_type":"factory_cif","currency":"USD","unit_cost_original":0,"incoterm":"CIF","tier_min_qty":1}]'></textarea>
          </label>
          <p data-price-import-status class="quote-ingest-help" role="status"></p>
          <div class="quote-ingest-modal__foot">
            <button class="admin-button admin-button--ghost" type="button" data-price-import-close>Cancelar</button>
            <button class="admin-button" type="submit">Importar</button>
          </div>
        </form>
      </div>
    </div>`;
  const close = () => slot.replaceChildren();
  slot.querySelector('[data-price-import-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) close();
  });
  slot.querySelectorAll('[data-price-import-close]').forEach(button => {
    button.addEventListener('click', close);
  });
  slot
    .querySelector<HTMLFormElement>('[data-price-import-form]')
    ?.addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form instanceof HTMLFormElement) void importPayload(ctx, form, close);
    });
}

async function importPayload(
  ctx: PriceIntelAdminCtx,
  form: HTMLFormElement,
  close: () => void
): Promise<void> {
  const status = form.querySelector('[data-price-import-status]');
  const file = form.querySelector<HTMLInputElement>('input[name="file"]')?.files?.[0];
  const pasted = String(new FormData(form).get('payload') ?? '').trim();
  const text = file ? await file.text() : pasted;
  if (!text) {
    ctx.toast('Pega o selecciona un archivo.');
    return;
  }
  let payload: unknown;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      payload = JSON.parse(trimmed) as unknown;
    } catch {
      ctx.toast('El JSON no se pudo leer.');
      return;
    }
  } else {
    payload = { csv: text };
  }
  const parsed = parsePriceBatch(payload);
  if (!parsed.ok) {
    if (status) status.textContent = parsed.error;
    ctx.toast(parsed.error);
    return;
  }
  const { error } = await ctx.supabase
    .from('market_price_entries')
    .upsert(parsed.rows, { onConflict: 'external_key' });
  if (error) {
    ctx.toast(error.message);
    return;
  }
  ctx.toast(`${parsed.rows.length} precios importados.`);
  close();
  await ctx.rerender();
}
