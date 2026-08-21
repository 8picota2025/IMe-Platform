import {
  ensureAuthSession,
  callEdgeFunction,
  escapeHtml,
  supabase,
  trackCommercialUsage,
} from '../comercial/shared';
import { initAuthFlow, renderLoginPanel, signOut, startIdleWatch } from '../comercial/auth';
import { getCongresoEvent } from './events';

interface Product {
  id: string;
  slug: string;
  nombre_es: string;
  nombre_en: string | null;
  descripcion_corta_es: string | null;
  imagen_principal: string | null;
  ficha_pdf: string | null;
  atributos: Record<string, unknown> | null;
  familias: { nombre_es: string; slug: string } | null;
}

interface ContactDraft {
  nombres: string;
  apellidos: string;
  cargo: string;
  institucion: string;
  email: string;
  telefono: string;
  ciudad: string;
  pais: string;
}

const app = document.getElementById('congreso-app');
if (!app) throw new Error('congreso-app root missing');

let products: Product[] = [];
const selected = new Set<string>();
let query = '';
let draft: ContactDraft = {
  nombres: '',
  apellidos: '',
  cargo: '',
  institucion: '',
  email: '',
  telefono: '',
  ciudad: '',
  pais: 'Colombia',
};

const eventSlug = new URLSearchParams(location.search).get('evento');
const event = getCongresoEvent(eventSlug);

function status(message: string, error = false): string {
  return `<p class="congreso-status${error ? ' is-error' : ''}" role="status">${escapeHtml(message)}</p>`;
}

function productEligible(row: Product): boolean {
  const attrs = row.atributos ?? {};
  const enriched = Boolean(
    (typeof attrs['valor_es'] === 'string' && attrs['valor_es'].trim()) ||
    (Array.isArray(attrs['beneficios_es']) && attrs['beneficios_es'].length > 0) ||
    row.descripcion_corta_es?.trim()
  );
  return enriched && Boolean(row.ficha_pdf?.trim());
}

function visibleProducts(): Product[] {
  const needle = query.trim().toLocaleLowerCase();
  return products.filter(product => {
    if (!needle) return true;
    return [product.nombre_es, product.familias?.nombre_es, product.descripcion_corta_es]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle);
  });
}

function renderProducts(): string {
  const visible = visibleProducts();
  if (!visible.length)
    return '<p class="congreso-help">No hay productos elegibles para esta búsqueda.</p>';
  return visible
    .map(product => {
      const isSelected = selected.has(product.id);
      const image = product.imagen_principal
        ? `<img src="${escapeHtml(product.imagen_principal)}" alt="" loading="lazy" />`
        : '';
      return `<article class="congreso-product${isSelected ? ' is-selected' : ''}" data-product-id="${escapeHtml(product.id)}" tabindex="0">
      <input class="congreso-product__check" type="checkbox" ${isSelected ? 'checked' : ''} aria-label="Seleccionar ${escapeHtml(product.nombre_es)}" />
      ${image}<strong>${escapeHtml(product.nombre_es)}</strong>
      <span class="congreso-product__meta">${escapeHtml(product.familias?.nombre_es ?? 'Producto')}</span>
      <span class="congreso-help">${escapeHtml(product.descripcion_corta_es ?? '')}</span>
    </article>`;
    })
    .join('');
}

function render(): void {
  const chosen = products.filter(product => selected.has(product.id));
  app!.innerHTML = `<div class="congreso-shell">
    <header class="congreso-topbar">
      <div><div class="congreso-brand">I·ME CONGRESO</div><small>${escapeHtml(event.name)} · ${escapeHtml(event.location)}</small></div>
      <button class="congreso-button congreso-button--ghost" type="button" data-signout>Cerrar sesión</button>
    </header>
    <div class="congreso-grid">
      <section class="congreso-panel">
        <h1>Nuevo visitante</h1>
        <p class="congreso-help">Selecciona soluciones de interés y registra interacción comercial.</p>
        <div class="congreso-toolbar">
          <input class="congreso-input" type="search" placeholder="Buscar producto o familia" value="${escapeHtml(query)}" data-search />
          <select class="congreso-select" data-event aria-label="Evento"><option value="${escapeHtml(event.slug)}">${escapeHtml(event.name)}</option></select>
        </div>
        <div class="congreso-products" data-products>${renderProducts()}</div>
      </section>
      <aside class="congreso-panel congreso-selected">
        <h2>Visitante</h2>
        <p><span class="congreso-selected__count">${chosen.length} productos seleccionados</span></p>
        ${chosen.length ? `<ul class="congreso-list">${chosen.map(p => `<li>${escapeHtml(p.nombre_es)}</li>`).join('')}</ul>` : '<p class="congreso-help">Selecciona al menos un producto.</p>'}
        <form class="congreso-form" data-contact-form novalidate>
          <div class="congreso-camera"><strong>Escanear tarjeta</strong><br /><span class="congreso-help">OCR editable antes de registrar.</span><input type="file" accept="image/*" capture="environment" data-ocr /></div>
          <div class="congreso-form__row"><label>Nombre<input class="congreso-input" name="nombres" required value="${escapeHtml(draft.nombres)}" /></label><label>Apellidos<input class="congreso-input" name="apellidos" required value="${escapeHtml(draft.apellidos)}" /></label></div>
          <div class="congreso-form__row"><label>Institución<input class="congreso-input" name="institucion" required value="${escapeHtml(draft.institucion)}" /></label><label>Cargo<input class="congreso-input" name="cargo" value="${escapeHtml(draft.cargo)}" /></label></div>
          <div class="congreso-form__row"><label>Email<input class="congreso-input" name="email" type="email" value="${escapeHtml(draft.email)}" /></label><label>Teléfono / WhatsApp<input class="congreso-input" name="telefono" value="${escapeHtml(draft.telefono)}" /></label></div>
          <div class="congreso-form__row"><label>Ciudad<input class="congreso-input" name="ciudad" required value="${escapeHtml(draft.ciudad)}" /></label><label>País<input class="congreso-input" name="pais" value="${escapeHtml(draft.pais)}" /></label></div>
          <label>Notas del comercial<textarea class="congreso-textarea" name="notas" placeholder="Necesidad, plazo o contexto"></textarea></label>
          <label class="congreso-consent"><input type="checkbox" name="consentimiento" required /> <span>Confirmo consentimiento para tratamiento de datos, contacto comercial y envío de información solicitada.</span></label>
          <div class="congreso-actions"><button class="congreso-button congreso-button--primary" type="submit" ${chosen.length ? '' : 'disabled'}>Registrar y enviar</button><button class="congreso-button congreso-button--ghost" type="button" data-clear>Limpiar</button></div>
          <div data-status></div>
        </form>
      </aside>
    </div>
  </div>`;
  bind();
}

function readDraft(form: HTMLFormElement): Record<string, string | boolean> {
  const data = new FormData(form);
  draft = {
    nombres: String(data.get('nombres') ?? '').trim(),
    apellidos: String(data.get('apellidos') ?? '').trim(),
    cargo: String(data.get('cargo') ?? '').trim(),
    institucion: String(data.get('institucion') ?? '').trim(),
    email: String(data.get('email') ?? '')
      .trim()
      .toLowerCase(),
    telefono: String(data.get('telefono') ?? '').trim(),
    ciudad: String(data.get('ciudad') ?? '').trim(),
    pais: String(data.get('pais') ?? 'Colombia').trim(),
  };
  return {
    ...draft,
    notas: String(data.get('notas') ?? '').trim(),
    consentimiento: data.get('consentimiento') === 'on',
  };
}

function bind(): void {
  app!.querySelector<HTMLInputElement>('[data-search]')?.addEventListener('input', eventInput => {
    query = (eventInput.target as HTMLInputElement).value;
    const slot = app!.querySelector('[data-products]');
    if (slot) slot.innerHTML = renderProducts();
    bindProductEvents();
  });
  bindProductEvents();
  app!.querySelector('[data-signout]')?.addEventListener('click', () => void signOut());
  app!.querySelector('[data-clear]')?.addEventListener('click', () => {
    selected.clear();
    draft = {
      nombres: '',
      apellidos: '',
      cargo: '',
      institucion: '',
      email: '',
      telefono: '',
      ciudad: '',
      pais: 'Colombia',
    };
    render();
  });
  app!.querySelector<HTMLInputElement>('[data-ocr]')?.addEventListener('change', eventInput => {
    const file = (eventInput.target as HTMLInputElement).files?.[0];
    if (file) void runOcr(file);
  });
  app!
    .querySelector<HTMLFormElement>('[data-contact-form]')
    ?.addEventListener('submit', eventInput => {
      eventInput.preventDefault();
      void submit(eventInput.currentTarget as HTMLFormElement);
    });
}

function bindProductEvents(): void {
  app!.querySelectorAll<HTMLElement>('[data-product-id]').forEach(card => {
    const toggle = () => {
      const id = card.dataset.productId!;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      render();
      trackCommercialUsage('product_selected', { item_count: selected.size }, 'catalogo');
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', eventKey => {
      if (eventKey.key === 'Enter' || eventKey.key === ' ') {
        eventKey.preventDefault();
        toggle();
      }
    });
  });
}

async function runOcr(file: File): Promise<void> {
  const slot = app!.querySelector('[data-status]');
  if (slot) slot.innerHTML = status('Analizando tarjeta…');
  const encoded = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer imagen'));
    reader.readAsDataURL(file);
  });
  const result = await callEdgeFunction<{ extract?: Partial<ContactDraft> }>('congreso-ocr', {
    body: { image_base64: encoded.split(',')[1] ?? '', mime: file.type },
  });
  if (result.error || !result.data?.extract) {
    if (slot) slot.innerHTML = status(result.error ?? 'OCR no disponible.', true);
    return;
  }
  draft = {
    ...draft,
    ...Object.fromEntries(
      Object.entries(result.data.extract).filter(([, value]) => typeof value === 'string')
    ),
  } as ContactDraft;
  render();
  const after = app!.querySelector('[data-status]');
  if (after) after.innerHTML = status('Datos OCR cargados. Revísalos antes de registrar.');
}

async function submit(form: HTMLFormElement): Promise<void> {
  const values = readDraft(form);
  const slot = app!.querySelector('[data-status]');
  if (
    !values.consentimiento ||
    !draft.nombres ||
    !draft.apellidos ||
    !draft.institucion ||
    !draft.ciudad ||
    (!draft.email && !draft.telefono)
  ) {
    if (slot) slot.innerHTML = status('Completa datos mínimos, contacto y consentimiento.', true);
    return;
  }
  const session = await ensureAuthSession();
  if (!session) return;
  const key = crypto.randomUUID();
  const chosen = products.filter(product => selected.has(product.id));
  if (slot) slot.innerHTML = status('Registrando contacto…');
  const lead = await callEdgeFunction<{ leadId: string }>('congreso-lead', {
    body: {
      idempotencyKey: key,
      eventSlug: event.slug,
      eventName: event.name,
      productIds: chosen.map(product => product.id),
      contact: values,
      commercialUserId: session.user.id,
    },
  });
  if (lead.error) {
    if (slot) slot.innerHTML = status(lead.error, true);
    return;
  }
  const message = `Gracias por su tiempo. Le comparto información sobre:\n${chosen.map(product => `- ${product.nombre_es}: ${location.origin}/es/productos/${product.slug}/\n  Brochure: ${new URL(product.ficha_pdf!, location.origin).href}`).join('\n')}\n\nEquipo I-ME`;
  const channels: Array<'email' | 'whatsapp'> = [];
  if (draft.email) channels.push('email');
  if (draft.telefono) channels.push('whatsapp');
  const sends = await Promise.all(
    channels.map(channel =>
      callEdgeFunction('comercial-share', {
        body: {
          channel,
          recipientName: `${draft.nombres} ${draft.apellidos}`,
          medicalCenterName: draft.institucion,
          recipientEmail: channel === 'email' ? draft.email : undefined,
          recipientPhone: channel === 'whatsapp' ? draft.telefono : undefined,
          productIds: chosen.map(product => product.id),
          message,
          consentContact: true,
          idempotencyKey: `${key}-${channel}`,
        },
      })
    )
  );
  const whatsapp = sends.find((_, index) => channels[index] === 'whatsapp')?.data as {
    whatsappUrl?: string;
  } | null;
  const failed = sends.filter(result => result.error);
  app!.innerHTML = `<div class="congreso-shell"><section class="congreso-panel congreso-success"><h1>Contacto registrado</h1><p>✓ Lead asociado al evento y al comercial.</p><p>✓ ${channels.length - failed.length} canal(es) procesado(s).</p>${whatsapp?.whatsappUrl ? `<p><a class="congreso-button congreso-button--primary" href="${escapeHtml(whatsapp.whatsappUrl)}" target="_blank" rel="noreferrer">Abrir WhatsApp</a></p>` : ''}<button class="congreso-button congreso-button--ghost" type="button" data-next>Atender siguiente visitante</button></section></div>`;
  app!.querySelector('[data-next]')?.addEventListener('click', () => {
    selected.clear();
    draft = {
      nombres: '',
      apellidos: '',
      cargo: '',
      institucion: '',
      email: '',
      telefono: '',
      ciudad: '',
      pais: 'Colombia',
    };
    render();
  });
}

async function load(): Promise<void> {
  if (!supabase) {
    renderLoginPanel(app!, '', () => void load());
    return;
  }
  const { data, error } = await supabase
    .from('productos')
    .select(
      'id,slug,nombre_es,nombre_en,descripcion_corta_es,imagen_principal,ficha_pdf,atributos,familias(nombre_es,slug)'
    )
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('nombre_es', { ascending: true });
  if (error) {
    app!.innerHTML = status(`No se pudo cargar catálogo: ${error.message}`, true);
    return;
  }
  products = (data ?? [])
    .map(row => {
      const raw = row as unknown as Omit<Product, 'familias'> & {
        familias?: Product['familias'] | Product['familias'][] | null;
      };
      const family = Array.isArray(raw.familias)
        ? (raw.familias[0] ?? null)
        : (raw.familias ?? null);
      return { ...raw, familias: family } as Product;
    })
    .filter(productEligible);
  render();
}

initAuthFlow({
  onSessionReady: session => {
    if (!session) renderLoginPanel(app!, '', () => void load());
    else {
      startIdleWatch(() => void signOut());
      void load();
    }
  },
  onRecovery: () => renderLoginPanel(app!),
});
