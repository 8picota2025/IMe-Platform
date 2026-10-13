/**
 * Control ligero de teléfono (selector de país + número) para formularios
 * públicos. Equivale a intl-tel-input sin la librería: el indicativo viaja
 * en `telefono_pais` y el texto tal cual en `telefono_raw`.
 */
import { normalizeVisitorPhone } from './visitor-phone-core';

const PLACEHOLDER: Record<string, { es: string; en: string }> = {
  '57': { es: '3XX XXX XXXX', en: '3XX XXX XXXX' },
  '': { es: '+ o 00…', en: '+ or 00…' },
};

function placeholderFor(dial: string, locale: 'es' | 'en'): string {
  const known = PLACEHOLDER[dial];
  if (known) return known[locale];
  return locale === 'en' ? 'Local number' : 'Número local';
}

export function bindVisitorPhoneFields(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-visitor-phone]').forEach(field => {
    if (field.dataset.visitorPhoneBound === '1') return;
    field.dataset.visitorPhoneBound = '1';
    const select = field.querySelector<HTMLSelectElement>('[data-visitor-phone-country]');
    const input = field.querySelector<HTMLInputElement>('[data-visitor-phone-input]');
    if (!select || !input) return;
    const locale = field.dataset.locale === 'en' ? 'en' : 'es';
    const apply = () => {
      input.placeholder = placeholderFor(select.value, locale);
    };
    select.addEventListener('change', apply);
    field.closest('form')?.addEventListener('reset', () => {
      queueMicrotask(apply);
    });
    apply();
  });
}

export function collectVisitorPhone(scope: ParentNode): {
  telefono: string;
  telefono_raw: string;
  telefono_pais: string;
} {
  const field = scope.querySelector<HTMLElement>('[data-visitor-phone]');
  const input =
    field?.querySelector<HTMLInputElement>('[data-visitor-phone-input]') ??
    scope.querySelector<HTMLInputElement>('input[name="telefono"]');
  const select = field?.querySelector<HTMLSelectElement>('[data-visitor-phone-country]');
  const raw = input?.value.trim() ?? '';
  const pais = select?.value ?? '';
  const normalized = normalizeVisitorPhone(raw, { countryCode: pais });
  return {
    telefono: normalized.phone,
    telefono_raw: raw,
    telefono_pais: pais,
  };
}
