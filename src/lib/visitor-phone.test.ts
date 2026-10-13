import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  formatPhoneForEmail,
  likelyPhoneAfterBlindPrefix,
  normalizeVisitorPhone,
  resolveSubmittedPhone,
  twentyPhoneFields,
} from './visitor-phone';

describe('normalizeVisitorPhone', () => {
  it('no antepone +57 al número búlgaro 359887922360', () => {
    const result = normalizeVisitorPhone('359887922360', { countryCode: '57' });
    expect(result.phone).toBe('359887922360');
    expect(result.e164).toBeNull();
    expect(result.phone).not.toBe('+57359887922360');
    expect(result.raw).toBe('359887922360');
  });

  it('conserva el indicativo si el número empieza por +', () => {
    const result = normalizeVisitorPhone('+359 88 792 2360', { countryCode: '57' });
    expect(result.phone).toBe('+359887922360');
    expect(result.e164).toBe('+359887922360');
  });

  it('convierte el prefijo internacional 00 en +', () => {
    const result = normalizeVisitorPhone('00359887922360');
    expect(result.phone).toBe('+359887922360');
    expect(result.e164).toBe('+359887922360');
  });

  it('asume +57 solo en un móvil colombiano de 10 dígitos que empieza por 3', () => {
    expect(normalizeVisitorPhone('300 123 4567').e164).toBe('+573001234567');
    expect(normalizeVisitorPhone('3137247353', { countryCode: '57' }).phone).toBe('+573137247353');
  });

  it('reconoce un móvil colombiano que ya incluye 57 sin signo +', () => {
    expect(normalizeVisitorPhone('573137247353').e164).toBe('+573137247353');
  });

  it('no asume +57 en otros números de 10 dígitos', () => {
    const landline = normalizeVisitorPhone('6012345678', { countryCode: '57' });
    expect(landline.phone).toBe('6012345678');
    expect(landline.e164).toBeNull();
  });

  it('aplica el indicativo elegido cuando no es Colombia', () => {
    expect(normalizeVisitorPhone('887922360', { countryCode: '359' }).e164).toBe('+359887922360');
    expect(normalizeVisitorPhone('612345678', { countryCode: '34' }).e164).toBe('+34612345678');
    expect(normalizeVisitorPhone('4155550132', { countryCode: '1' }).e164).toBe('+14155550132');
  });

  it('no duplica el indicativo si el visitante ya lo escribió', () => {
    expect(normalizeVisitorPhone('359887922360', { countryCode: '359' }).e164).toBe(
      '+359887922360'
    );
    expect(normalizeVisitorPhone('14155550132', { countryCode: '1' }).e164).toBe('+14155550132');
  });

  it('guarda el texto crudo junto al número ambiguo', () => {
    const result = normalizeVisitorPhone(' 359 887 922 360 ', { countryCode: '57' });
    expect(result.phone).toBe('359887922360');
    expect(result.raw).toBe('359 887 922 360');
  });

  it('rechaza vacío', () => {
    expect(normalizeVisitorPhone('').ok).toBe(false);
    expect(normalizeVisitorPhone('   ').phone).toBe('');
  });
});

describe('resolveSubmittedPhone', () => {
  it('normaliza desde el texto crudo y el país, no desde un teléfono ya prefijado', () => {
    const result = resolveSubmittedPhone({
      telefono: '+57359887922360',
      telefono_raw: '359887922360',
      telefono_pais: '57',
    });
    expect(result.phone).toBe('359887922360');
    expect(result.raw).toBe('359887922360');
  });

  it('usa telefono cuando no hay texto crudo', () => {
    expect(resolveSubmittedPhone({ telefono: '+359887922360' }).e164).toBe('+359887922360');
  });
});

describe('formatPhoneForEmail', () => {
  it('muestra el crudo solo cuando los dígitos difieren', () => {
    const typed = normalizeVisitorPhone('887922360', { countryCode: '359' });
    expect(formatPhoneForEmail(typed, 'es')).toBe('+359887922360 (como lo escribió: 887922360)');
    expect(formatPhoneForEmail(typed, 'en')).toBe('+359887922360 (as typed: 887922360)');
    const same = normalizeVisitorPhone('359887922360', { countryCode: '57' });
    expect(formatPhoneForEmail(same, 'es')).toBe('359887922360');
  });
});

describe('twentyPhoneFields', () => {
  it('no fuerza +57 en un número que no es móvil colombiano', () => {
    expect(twentyPhoneFields('359887922360')).toEqual({ phoneNumber: '359887922360' });
    expect(twentyPhoneFields('+359887922360')).toEqual({
      phoneCallingCode: '+359',
      phoneNumber: '887922360',
    });
    expect(twentyPhoneFields('3001234567')).toEqual({
      phoneCallingCode: '+57',
      phoneNumber: '3001234567',
    });
  });
});

describe('likelyPhoneAfterBlindPrefix', () => {
  it('recupera el búlgaro al que se le antepuso +57 y deja en paz un móvil colombiano', () => {
    expect(likelyPhoneAfterBlindPrefix('+57359887922360')).toBe('+359887922360');
    expect(likelyPhoneAfterBlindPrefix('+573137247353')).toBeNull();
    expect(likelyPhoneAfterBlindPrefix('+576012345678')).toBeNull();
  });

  it('si el resto no es un país conocido, conserva los dígitos sin prefijo', () => {
    expect(likelyPhoneAfterBlindPrefix('+571234567890')).toBe('1234567890');
    expect(likelyPhoneAfterBlindPrefix('+57573137247353')).toBe('+573137247353');
  });
});

describe('crm_normalize_phone', () => {
  it('la migración no antepone +57 a ciegas ni reescribe filas existentes', () => {
    const sql = readFileSync(
      'supabase/migrations/20261013193000_visitor_phone_no_blind_prefix.sql',
      'utf8'
    );
    expect(sql).not.toMatch(/ELSE '\+57'/);
    expect(sql).toContain("char_length(digits) = 10 AND left(digits, 1) = '3'");
    expect(sql).not.toMatch(/\bUPDATE\b/i);
  });
});
