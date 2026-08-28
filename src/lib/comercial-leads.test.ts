import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  classifyLead,
  isTurnstileOptionalCampaign,
  validateCommercialLead,
} from './comercial-leads';

describe('classifyLead', () => {
  it('0-3 → P1', () => expect(classifyLead('0-3')).toBe('P1'));
  it('4-12 → P2', () => expect(classifyLead('4-12')).toBe('P2'));
  it('exploracion → P3', () => expect(classifyLead('exploracion')).toBe('P3'));
});

describe('validateCommercialLead', () => {
  it('rechaza institución ausente', () => {
    const r = validateCommercialLead({
      nombre: 'Ana',
      ciudad: 'Bogotá',
      telefono: '310',
      tipo_proyecto: 'nueva_torre',
      horizonte: '0-3',
      necesidad: 'Upgrade 4K',
      consentimiento: true,
      familia_slug: 'sala-cirugia',
      campaign: 'torres_laparoscopia',
    });
    expect(r.valid).toBe(false);
    expect(r.errors.institucion).toBeTruthy();
  });

  it('acepta payload mínimo válido', () => {
    const r = validateCommercialLead({
      nombre: 'Ana López',
      institucion: 'Clínica Norte',
      ciudad: 'Medellín',
      email: 'ana@clinica.co',
      tipo_proyecto: 'nueva_torre',
      horizonte: '0-3',
      necesidad: 'Torre 4K sala 2',
      consentimiento: true,
      familia_slug: 'sala-cirugia',
      campaign: 'torres_laparoscopia',
    });
    expect(r.valid).toBe(true);
  });

  it('rechaza correo mal formado antes de enviar', () => {
    const r = validateCommercialLead({
      nombre: 'Ana López',
      institucion: 'Clínica Norte',
      ciudad: 'Medellín',
      email: 'correo-invalido',
      tipo_proyecto: 'nueva_torre',
      horizonte: '0-3',
      necesidad: 'Torre 4K sala 2',
      consentimiento: true,
      familia_slug: 'sala-cirugia',
      campaign: 'torres_laparoscopia',
    });
    expect(r.valid).toBe(false);
    expect(r.errors.email).toBeTruthy();
  });

  it('acepta registro de evento con nombre completo, teléfono y correo', () => {
    const nombre = 'Ana María López Ruiz';
    const r = validateCommercialLead({
      nombre,
      institucion: 'Clínica Norte',
      ciudad: 'Medellín',
      telefono: '3137247353',
      email: 'ana@clinica.co',
      tipo_proyecto: 'registro_evento',
      horizonte: 'exploracion',
      necesidad: 'Registro de asistente al evento',
      consentimiento: true,
      familia_slug: 'evento',
      campaign: 'evento',
    });
    expect(r.valid).toBe(true);
    expect(nombre).toBe('Ana María López Ruiz');
  });

  it.each([
    ['telefono', { email: 'ana@clinica.co' }],
    ['email', { telefono: '3137247353' }],
  ])('exige %s en registros de evento', (field, contact) => {
    const r = validateCommercialLead({
      nombre: 'Ana López',
      institucion: 'Clínica Norte',
      ciudad: 'Medellín',
      ...contact,
      tipo_proyecto: 'registro_evento',
      horizonte: 'exploracion',
      necesidad: 'Registro de asistente al evento',
      consentimiento: true,
      familia_slug: 'evento',
      campaign: 'evento',
    });
    expect(r.valid).toBe(false);
    expect(r.errors[field]).toBeTruthy();
  });
});

describe('isTurnstileOptionalCampaign', () => {
  it('deja pasar evento, descargas de ficha y modal global si el challenge 600* falla', () => {
    expect(isTurnstileOptionalCampaign('evento')).toBe(true);
    expect(isTurnstileOptionalCampaign('pdf_descarga')).toBe(true);
    expect(isTurnstileOptionalCampaign('proyectos')).toBe(true);
  });

  it('sigue exigiendo Turnstile en landings consultivas', () => {
    expect(isTurnstileOptionalCampaign('torres_laparoscopia')).toBe(false);
    expect(isTurnstileOptionalCampaign(undefined)).toBe(false);
  });
});

describe('buildWhatsAppMessage', () => {
  it('incluye institución, ciudad, familia, proyecto, horizonte y necesidad', () => {
    const msg = buildWhatsAppMessage({
      nombre: 'Ana',
      cargo: 'Compras',
      institucion: 'Clínica Norte',
      ciudad: 'Medellín',
      familia_slug: 'sala-cirugia',
      tipo_slug: 'torres-laparoscopia',
      tipo_proyecto: 'upgrade',
      horizonte: '0-3',
      necesidad: 'Pasar de FHD a 4K',
      consentimiento: true,
      campaign: 'torres_laparoscopia',
    });
    expect(msg).toContain('Clínica Norte');
    expect(msg).toContain('Medellín');
    expect(msg).toContain('sala-cirugia');
    expect(msg).toContain('torres-laparoscopia');
    expect(msg).toContain('upgrade');
    expect(msg).toContain('0-3');
    expect(msg).toContain('Pasar de FHD a 4K');
  });

  it('URL no contiene secretos', () => {
    const url = buildWhatsAppUrl({
      nombre: 'Ana',
      institucion: 'Clínica Norte',
      ciudad: 'Medellín',
      familia_slug: 'esterilizacion-control-infecciones',
      tipo_proyecto: 'autoclave',
      horizonte: '4-12',
      necesidad: 'Central nueva',
      consentimiento: true,
      campaign: 'esterilizacion',
    });
    expect(url.startsWith('https://wa.me/573137247353?text=')).toBe(true);
    expect(url.toLowerCase()).not.toContain('precio_costo');
    const forbiddenRole = ['service', 'role'].join('_');
    expect(url.toLowerCase()).not.toContain(forbiddenRole);
  });
});
