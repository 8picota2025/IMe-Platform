import {
  ensureAuthSession,
  callEdgeFunction,
  escapeHtml,
  esUsuarioComercial,
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
let selectedProductIds: string[] = [];
let query = '';
let familySlug = '';
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

window.addEventListener('beforeinstallprompt', promptEvent => {
  promptEvent.preventDefault();
  deferredInstallPrompt = promptEvent as BeforeInstallPromptEvent;
  refreshInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  refreshInstallButton();
});

function status(message: string, error = false): string {
  return `<p class="congreso-status${error ? ' is-error' : ''}" role="status">${escapeHtml(message)}</p>`;
}

function productEligible(row: Product): boolean {
  const attrs = row.atributos ?? {};
  if (attrs['congreso_habilitado'] === false) return false;
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
    if (familySlug && product.familias?.slug !== familySlug) return false;
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
      const isSelected = selectedProductIds.includes(product.id);
      const image = product.imagen_principal
        ? `<img src="${escapeHtml(product.imagen_principal)}" alt="" loading="lazy" />`
        : '';
      return `<article class="congreso-product${isSelected ? ' is-selected' : ''}" data-product-id="${escapeHtml(product.id)}" tabindex="0">
      <input class="congreso-product__check" type="checkbox" name="producto_interes" ${isSelected ? 'checked' : ''} aria-label="Seleccionar ${escapeHtml(product.nombre_es)}" />
      ${image}<strong>${escapeHtml(product.nombre_es)}</strong>
      <span class="congreso-product__meta">${escapeHtml(product.familias?.nombre_es ?? 'Producto')}</span>
      <span class="congreso-help">${escapeHtml(product.descripcion_corta_es ?? '')}</span>
    </article>`;
    })
    .join('');
}

function familyOptions(): string {
  const families = [
    ...new Map(products.map(product => [product.familias?.slug, product.familias])).values(),
  ]
    .filter((family): family is { nombre_es: string; slug: string } => Boolean(family))
    .sort((a, b) => a.nombre_es.localeCompare(b.nombre_es));
  return `<option value="">Todas las familias</option>${families.map(family => `<option value="${escapeHtml(family.slug)}" ${family.slug === familySlug ? 'selected' : ''}>${escapeHtml(family.nombre_es)}</option>`).join('')}`;
}

function render(): void {
  const chosen = products.filter(product => selectedProductIds.includes(product.id));
  app!.innerHTML = `<div class="congreso-shell">
    <header class="congreso-topbar">
      <div><div class="congreso-brand">I·ME CONGRESO</div><small>Sesión comercial · ${escapeHtml(event.location)}</small></div>
      <div class="congreso-actions"><button class="congreso-button congreso-button--ghost" type="button" data-pwa-install hidden>Instalar PWA</button><button class="congreso-button congreso-button--ghost" type="button" data-signout>Cerrar sesión</button></div>
    </header>
    <section class="congreso-panel congreso-registration">
      <h1>Registrar visitante</h1>
      <p class="congreso-help">Completa o escanea los datos. Revisa siempre el resultado OCR antes de continuar.</p>
      <form class="congreso-form" data-contact-form novalidate>
          <div class="congreso-camera"><strong>Escanear tarjeta</strong><br /><span class="congreso-help">OCR editable antes de registrar.</span><input type="file" accept="image/*" capture="environment" data-ocr /></div>
          <div class="congreso-form__row"><label>Nombre<input class="congreso-input" name="nombres" required value="${escapeHtml(draft.nombres)}" /></label><label>Apellidos<input class="congreso-input" name="apellidos" required value="${escapeHtml(draft.apellidos)}" /></label></div>
          <div class="congreso-form__row"><label>Institución<input class="congreso-input" name="institucion" required value="${escapeHtml(draft.institucion)}" /></label><label>Cargo<input class="congreso-input" name="cargo" value="${escapeHtml(draft.cargo)}" /></label></div>
          <div class="congreso-form__row"><label>Email<input class="congreso-input" name="email" type="email" value="${escapeHtml(draft.email)}" /></label><label>Teléfono / WhatsApp<input class="congreso-input" name="telefono" value="${escapeHtml(draft.telefono)}" /></label></div>
          <div class="congreso-form__row"><label>Ciudad<input class="congreso-input" name="ciudad" required value="${escapeHtml(draft.ciudad)}" /></label><label>País<input class="congreso-input" name="pais" value="${escapeHtml(draft.pais)}" /></label></div>
          <label>Notas del comercial<textarea class="congreso-textarea" name="notas" placeholder="Necesidad, plazo o contexto"></textarea></label>
          <fieldset class="congreso-channel"><legend>Enviar información por</legend><label class="congreso-consent"><input type="checkbox" name="canal_email" checked /> <span>Email</span></label><label class="congreso-consent"><input type="checkbox" name="canal_whatsapp" /> <span>WhatsApp</span></label></fieldset>
          <label class="congreso-consent"><input type="checkbox" name="consentimiento" required /> <span>Confirmo consentimiento para tratamiento de datos, contacto comercial y envío de información solicitada.</span></label>
          <div class="congreso-actions"><button class="congreso-button congreso-button--primary" type="submit" ${chosen.length ? '' : 'disabled'}>Registrar y enviar</button><button class="congreso-button congreso-button--ghost" type="button" data-clear>Limpiar</button></div>
          <div data-status></div>
      </form>
    </section>
    <section class="congreso-panel congreso-products-panel">
          <h2>Productos de interés</h2>
      <p class="congreso-help">Puedes seleccionar varios productos. La selección se conserva aunque cambies búsqueda o familia.</p>
      <div class="congreso-toolbar"><input class="congreso-input" type="search" placeholder="Buscar producto" value="${escapeHtml(query)}" data-search /><select class="congreso-select" data-family aria-label="Familia de producto">${familyOptions()}</select></div>
      <div class="congreso-products" data-products>${renderProducts()}</div>
      <p class="congreso-selected__count">${chosen.length ? `${chosen.length} producto(s) seleccionado(s)` : 'Ningún producto seleccionado'}</p>
    </section>
    <footer class="congreso-panel congreso-campaign"><label>Campaña / evento<select class="congreso-select" data-event aria-label="Campaña"><option value="${escapeHtml(event.slug)}">${escapeHtml(event.name)}</option></select></label></footer>
  </div>`;
  bind();
  refreshInstallButton();
}

function refreshInstallButton(): void {
  const button = app?.querySelector<HTMLButtonElement>('[data-pwa-install]');
  if (button) button.hidden = !deferredInstallPrompt;
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

function bindContactDraft(form: HTMLFormElement): void {
  const fields: Array<keyof ContactDraft> = [
    'nombres',
    'apellidos',
    'cargo',
    'institucion',
    'email',
    'telefono',
    'ciudad',
    'pais',
  ];
  fields.forEach(field => {
    form.querySelector<HTMLInputElement>(`[name="${field}"]`)?.addEventListener('input', event => {
      const value = (event.target as HTMLInputElement).value.trim();
      draft[field] = field === 'email' ? value.toLowerCase() : value;
    });
  });
}

function bind(): void {
  const form = app!.querySelector<HTMLFormElement>('[data-contact-form]');
  if (form) bindContactDraft(form);
  app!.querySelector<HTMLInputElement>('[data-search]')?.addEventListener('input', eventInput => {
    query = (eventInput.target as HTMLInputElement).value;
    const slot = app!.querySelector('[data-products]');
    if (slot) slot.innerHTML = renderProducts();
    bindProductEvents();
  });
  app!.querySelector<HTMLSelectElement>('[data-family]')?.addEventListener('change', eventInput => {
    familySlug = (eventInput.target as HTMLSelectElement).value;
    const slot = app!.querySelector('[data-products]');
    if (slot) slot.innerHTML = renderProducts();
    bindProductEvents();
  });
  bindProductEvents();
  app!.querySelector('[data-pwa-install]')?.addEventListener('click', () => void installPwa());
  app!.querySelector('[data-signout]')?.addEventListener('click', () => void signOut());
  app!.querySelector('[data-clear]')?.addEventListener('click', () => {
    selectedProductIds = [];
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
      selectedProductIds = selectedProductIds.includes(id)
        ? selectedProductIds.filter(productId => productId !== id)
        : [...selectedProductIds, id];
      render();
      trackCommercialUsage(
        'product_selected',
        { item_count: selectedProductIds.length },
        'catalogo'
      );
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

async function installPwa(): Promise<void> {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  refreshInstallButton();
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
  const extract = result.data.extract;
  const detected: Partial<ContactDraft> = {
    nombres: String(extract.nombres ?? '').trim(),
    apellidos: String(extract.apellidos ?? '').trim(),
    institucion: String(extract.institucion ?? '').trim(),
    email: String(extract.email ?? '')
      .trim()
      .toLowerCase(),
    telefono: String(extract.telefono ?? '').trim(),
  };
  draft = Object.entries(detected).reduce(
    (current, [field, value]) => (value ? { ...current, [field]: value } : current),
    draft
  );
  render();
  const after = app!.querySelector('[data-status]');
  if (after) after.innerHTML = status('Datos OCR cargados. Revísalos antes de registrar.');
}

async function submit(form: HTMLFormElement): Promise<void> {
  const values = readDraft(form);
  const formData = new FormData(form);
  const channels: Array<'email' | 'whatsapp'> = [];
  if (formData.get('canal_email') === 'on') channels.push('email');
  if (formData.get('canal_whatsapp') === 'on') channels.push('whatsapp');
  const slot = app!.querySelector('[data-status]');
  if (
    !values.consentimiento ||
    !draft.nombres ||
    !draft.apellidos ||
    !draft.institucion ||
    !draft.ciudad ||
    !selectedProductIds.length ||
    !channels.length ||
    (channels.includes('email') && !draft.email) ||
    (channels.includes('whatsapp') && !draft.telefono)
  ) {
    if (slot)
      slot.innerHTML = status('Completa datos, producto, canal de envío y consentimiento.', true);
    return;
  }
  const session = await ensureAuthSession();
  if (!session) return;
  const key = crypto.randomUUID();
  const chosen = products.filter(product => selectedProductIds.includes(product.id));
  if (slot) slot.innerHTML = status('Registrando contacto…');
  const lead = await callEdgeFunction<{ leadId: string }>('congreso-lead', {
    body: {
      idempotencyKey: key,
      eventSlug: event.slug,
      eventName: event.name,
      productIds: chosen.map(product => product.id),
      channels,
      contact: values,
      commercialUserId: session.user.id,
    },
  });
  if (lead.error) {
    if (slot) slot.innerHTML = status(lead.error, true);
    return;
  }
  const message = `Gracias por su tiempo. Le comparto información sobre:\n${chosen.map(product => `- ${product.nombre_es}: ${location.origin}/es/productos/${product.slug}/\n  Brochure: ${new URL(product.ficha_pdf!, location.origin).href}`).join('\n')}\n\nEquipo I-ME`;
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
    selectedProductIds = [];
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
  const session = await ensureAuthSession();
  if (!session) return;
  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('rol,activo')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!profile || !esUsuarioComercial(String(profile.rol ?? ''), profile.activo === true)) {
    app!.innerHTML = status('Esta herramienta requiere una cuenta comercial activa.', true);
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
