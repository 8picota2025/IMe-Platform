/**
 * Modal de envío de catálogo (email o WhatsApp) para uno o varios productos
 * seleccionados. Envía la solicitud a la Edge Function `comercial-share`
 * (`${PUBLIC_SUPABASE_URL}/functions/v1/comercial-share`) adjuntando el
 * bearer token de la sesión activa — nunca claves privilegiadas en el
 * navegador.
 *
 * Contrato del payload (`ShareBody`) y de la respuesta espejan
 * `supabase/functions/comercial-share/index.ts` — ver ese archivo si se
 * agregan campos nuevos.
 */
import {
  buildIdempotencyKey,
  renderMessageTemplate,
  type ComercialTemplateVars,
} from '../lib/comercial-cms';
import { supabase, state, escapeHtml, toast, callEdgeFunction } from './shared';
import type { ProductoComercial } from './catalog-view';

type Canal = 'email' | 'whatsapp';

/** Códigos de país SIN '+' — `comercial-share` los concatena vía `normalizeE164`. */
const PAISES: Array<{ code: string; label: string }> = [
  { code: '57', label: 'Colombia (+57)' },
  { code: '52', label: 'México (+52)' },
  { code: '51', label: 'Perú (+51)' },
  { code: '593', label: 'Ecuador (+593)' },
  { code: '507', label: 'Panamá (+507)' },
  { code: '1', label: 'Estados Unidos (+1)' },
  { code: '34', label: 'España (+34)' },
];

/** Respuesta de `POST /comercial-share` (ver `handleCreate` en el backend). */
interface ShareCreateResponse {
  shareId: string;
  status: 'draft' | 'prepared' | 'sent' | 'failed' | string;
  whatsappUrl?: string;
  crmSyncStatus: 'pending' | 'synced' | 'failed' | 'skipped';
  idempotent?: boolean;
}

interface PlantillaRow {
  name: string;
  channel: Canal;
  body: string;
  is_default: boolean;
}

let currentOverlay: HTMLDivElement | null = null;
let previouslyFocused: HTMLElement | null = null;
const templateCache = new Map<Canal, PlantillaRow | null>();

function productListText(productos: ProductoComercial[]): string {
  if (productos.length === 0) return '(sin productos seleccionados)';
  return productos.map(p => `• ${p.nombre_es}${p.sku ? ` (ref. ${p.sku})` : ''}`).join('\n');
}

function buildFallbackMessage(productos: ProductoComercial[]): string {
  return `Hola,\n\nTe comparto información de los siguientes equipos biomédicos de I-ME:\n\n${productListText(
    productos
  )}\n\nQuedo atento(a) a tus comentarios.\n\nSaludos,\nEquipo Comercial I-ME`;
}

/** Lee la plantilla activa (preferentemente `is_default`) de `commercial_message_templates` por canal. */
async function fetchTemplate(canal: Canal): Promise<PlantillaRow | null> {
  if (templateCache.has(canal)) return templateCache.get(canal) ?? null;
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('commercial_message_templates')
      .select('name,channel,body,is_default')
      .eq('channel', canal)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      templateCache.set(canal, null);
      return null;
    }
    const plantilla = data as PlantillaRow;
    templateCache.set(canal, plantilla);
    return plantilla;
  } catch {
    return null;
  }
}

/** Renderiza la plantilla con las variables conocidas; si falla (variable desconocida), usa el mensaje de respaldo. */
function renderDraftMessage(
  plantilla: PlantillaRow | null,
  productos: ProductoComercial[],
  destinatario: { nombre: string; centroMedico: string }
): string {
  if (!plantilla) return buildFallbackMessage(productos);
  const vars: Partial<ComercialTemplateVars> = {
    nombre_destinatario: destinatario.nombre || '(nombre del destinatario)',
    nombre_comercial: state.nombre || state.email,
    centro_medico: destinatario.centroMedico || '(centro médico)',
    mensaje: '',
    lista_productos_texto: productListText(productos),
    correo_comercial: state.email,
    telefono_comercial: state.telefono,
  };
  const rendered = renderMessageTemplate(plantilla.body, vars);
  return rendered.ok && rendered.text ? rendered.text : buildFallbackMessage(productos);
}

function closeModal(): void {
  if (!currentOverlay) return;
  currentOverlay.remove();
  currentOverlay = null;
  document.removeEventListener('keydown', handleKeydown, true);
  previouslyFocused?.focus?.();
  previouslyFocused = null;
}

function handleKeydown(event: KeyboardEvent): void {
  if (!currentOverlay) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key === 'Tab') {
    const focusables = currentOverlay.querySelectorAll<HTMLElement>(
      'input, select, textarea, button, [href]'
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function channelFieldsHtml(canal: Canal): string {
  if (canal === 'email') {
    return `
      <label class="comercial-field">
        <span>Email del destinatario</span>
        <input name="email" type="email" required autocomplete="email" />
      </label>`;
  }
  const paises = PAISES.map(
    p => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.label)}</option>`
  ).join('');
  return `
    <div class="comercial-field-row">
      <label class="comercial-field comercial-field--phone-country">
        <span>País</span>
        <select name="paisCodigo">${paises}</select>
      </label>
      <label class="comercial-field comercial-field--phone-number">
        <span>WhatsApp</span>
        <input name="telefono" type="tel" required autocomplete="tel" placeholder="3001234567" />
      </label>
    </div>`;
}

export function openShareModal(productos: ProductoComercial[]): void {
  if (productos.length === 0) {
    toast('Selecciona al menos un producto para enviar.', 'error');
    return;
  }
  closeModal();
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  overlay.className = 'comercial-modal-overlay';
  overlay.innerHTML = `
    <div class="comercial-modal" role="dialog" aria-modal="true" aria-labelledby="comercial-modal-title" data-modal>
      <header class="comercial-modal__header">
        <h2 id="comercial-modal-title">Enviar catálogo (${productos.length} producto${productos.length === 1 ? '' : 's'})</h2>
        <button class="comercial-modal__close" type="button" aria-label="Cerrar" data-modal-close>✕</button>
      </header>
      <form class="comercial-modal__body comercial-form" data-share-form novalidate>
        <ul class="comercial-modal__product-list">
          ${productos
            .map(
              p =>
                `<li>${escapeHtml(p.nombre_es)}${p.sku ? ` <span class="comercial-help">SKU ${escapeHtml(p.sku)}</span>` : ''}</li>`
            )
            .join('')}
        </ul>
        <div class="comercial-field-row">
          <label class="comercial-field">
            <span>Nombre del destinatario</span>
            <input name="nombre" type="text" required autocomplete="name" data-recipient-name />
          </label>
          <label class="comercial-field">
            <span>Centro médico / institución</span>
            <input name="centroMedico" type="text" autocomplete="organization" data-medical-center />
          </label>
        </div>
        <fieldset class="comercial-field comercial-channel-fieldset">
          <legend>Canal de envío</legend>
          <label class="comercial-radio">
            <input type="radio" name="canal" value="email" checked /> Email
          </label>
          <label class="comercial-radio">
            <input type="radio" name="canal" value="whatsapp" /> WhatsApp
          </label>
        </fieldset>
        <div data-channel-fields>${channelFieldsHtml('email')}</div>
        <label class="comercial-field">
          <span>Mensaje</span>
          <textarea name="mensaje" rows="8" data-message required></textarea>
        </label>
        <label class="comercial-field comercial-field--consent">
          <input type="checkbox" name="consentimiento" required data-consent />
          <span>Confirmo que cuento con autorización del destinatario para recibir esta comunicación comercial (tratamiento de datos personales).</span>
        </label>
        <p class="comercial-modal__error" role="alert" data-modal-error hidden></p>
        <div class="comercial-modal__footer">
          <button class="comercial-button comercial-button--ghost" type="button" data-modal-close>Cancelar</button>
          <button class="comercial-button comercial-button--primary" type="submit" data-submit>Enviar</button>
        </div>
      </form>
    </div>`;

  document.body.append(overlay);
  currentOverlay = overlay;
  document.addEventListener('keydown', handleKeydown, true);

  const form = overlay.querySelector<HTMLFormElement>('[data-share-form]');
  const messageField = overlay.querySelector<HTMLTextAreaElement>('[data-message]');
  const channelFieldsSlot = overlay.querySelector<HTMLElement>('[data-channel-fields]');
  const errorSlot = overlay.querySelector<HTMLElement>('[data-modal-error]');
  const nombreInput = overlay.querySelector<HTMLInputElement>('[data-recipient-name]');
  const centroInput = overlay.querySelector<HTMLInputElement>('[data-medical-center]');
  let messageEditedByUser = false;
  let currentCanal: Canal = 'email';

  const destinatarioActual = () => ({
    nombre: nombreInput?.value.trim() ?? '',
    centroMedico: centroInput?.value.trim() ?? '',
  });

  async function refreshDraftMessage(): Promise<void> {
    if (messageEditedByUser || !messageField) return;
    const plantilla = await fetchTemplate(currentCanal);
    if (!messageEditedByUser && messageField) {
      messageField.value = renderDraftMessage(plantilla, productos, destinatarioActual());
    }
  }

  if (messageField) {
    messageField.value = buildFallbackMessage(productos);
    messageField.addEventListener('input', () => {
      messageEditedByUser = true;
    });
  }
  void refreshDraftMessage();

  // Si el usuario completa nombre/centro médico ANTES de editar el mensaje
  // manualmente, se re-renderiza la plantilla con esos datos ya sustituidos.
  [nombreInput, centroInput].forEach(input => {
    input?.addEventListener('blur', () => void refreshDraftMessage());
  });

  overlay.querySelectorAll<HTMLInputElement>('input[name="canal"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      currentCanal = radio.value as Canal;
      if (channelFieldsSlot) channelFieldsSlot.innerHTML = channelFieldsHtml(currentCanal);
      void refreshDraftMessage();
    });
  });

  overlay.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target === overlay || target.closest('[data-modal-close]')) {
      closeModal();
    }
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const canal = String(data.get('canal') ?? 'email') as Canal;
    const consentContact = data.get('consentimiento') === 'on';
    if (!consentContact) {
      if (errorSlot) {
        errorSlot.hidden = false;
        errorSlot.textContent = 'Debes confirmar la autorización de tratamiento de datos.';
      }
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-submit]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
    }
    if (errorSlot) errorSlot.hidden = true;

    const recipientName = String(data.get('nombre') ?? '').trim();
    const medicalCenterName = String(data.get('centroMedico') ?? '').trim();
    const recipientEmail = canal === 'email' ? String(data.get('email') ?? '').trim() : undefined;
    const recipientPhone =
      canal === 'whatsapp' ? String(data.get('telefono') ?? '').trim() : undefined;
    const phoneCountryCode =
      canal === 'whatsapp' ? String(data.get('paisCodigo') ?? '57') : undefined;
    const productIds = productos.map(p => p.id);

    const payload = {
      channel: canal,
      recipientName,
      medicalCenterName: medicalCenterName || undefined,
      recipientEmail,
      recipientPhone,
      phoneCountryCode,
      productIds,
      message: String(data.get('mensaje') ?? ''),
      consentContact: true,
      // Determinista: mismo usuario + canal + destinatario + productos ⇒
      // mismo envío. Evita duplicados si el usuario reenvía el formulario
      // (doble clic, reintento de red) para exactamente la misma solicitud.
      idempotencyKey: buildIdempotencyKey({
        userId: state.userId,
        channel: canal,
        recipientEmail: recipientEmail ?? null,
        recipientPhone: recipientPhone ?? null,
        productIds,
      }),
    };

    const { data: result, error } = await callEdgeFunction<ShareCreateResponse>('comercial-share', {
      method: 'POST',
      body: payload,
    });

    if (error) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar';
      }
      if (errorSlot) {
        errorSlot.hidden = false;
        errorSlot.textContent = error;
      }
      toast(error, 'error');
      return;
    }

    // `comercial-share` responde 200 incluso cuando el envío falló — el
    // resultado real viene en `status` (nunca lanza HTTP de error para esto).
    if (result?.status === 'failed') {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar';
      }
      const message =
        canal === 'email'
          ? 'No se pudo enviar el email. Usa un correo real (no @example.com) y revisa MAILER_* en Edge Secrets.'
          : 'No se pudo preparar el envío. Verifica los datos e intenta de nuevo.';
      if (errorSlot) {
        errorSlot.hidden = false;
        errorSlot.textContent = message;
      }
      toast(message, 'error');
      return;
    }

    if (canal === 'whatsapp' && result?.whatsappUrl) {
      window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer');
      const crmNote =
        result.crmSyncStatus === 'synced'
          ? ' Contacto sincronizado en CRM.'
          : result.crmSyncStatus === 'failed'
            ? ' Aviso: CRM no sincronizó (el link de WhatsApp sí está listo).'
            : '';
      toast(`WhatsApp preparado — revisa la nueva pestaña.${crmNote}`, 'success');
    } else {
      const crmNote =
        result?.crmSyncStatus === 'synced'
          ? ' Contacto sincronizado en CRM.'
          : result?.crmSyncStatus === 'failed'
            ? ' Aviso: CRM no sincronizó.'
            : '';
      toast(`Catálogo enviado por email.${crmNote}`, 'success');
    }
    closeModal();
  });

  window.setTimeout(() => {
    nombreInput?.focus();
  }, 30);
}
