/**
 * Evals de calidad IMEIA (regresión de guardrails + handoff).
 * No llaman a Hermes: cubren el contrato de la fachada web.
 */
import { describe, expect, it } from 'vitest';

import {
  buildAsesorLocalSystemPrompt,
  buildImeiaRuntimeSystemPrompt,
  buildImeiaTransportSystemPrompt,
  clasificarFalloImeia,
  detectarAccionHandoff,
  esIntencionHandoffComercial,
  esIntencionInvimaSku,
  imeiaPromptEvalChecks,
  inferHandoffFromUserIntent,
} from './asesor-guardrails';
import {
  buildAsesorStaticFallback,
  esConsultaContacto,
  esConsultaSitioOLegal,
} from './asesor-knowledge';
import {
  IME_WHATSAPP_DISPLAY,
  IME_WHATSAPP_E164,
  IME_WHATSAPP_TEL,
  IME_WHATSAPP_URL,
  buildWhatsAppHref,
} from './contacto-oficial';
import { buildOrganizationJsonLd } from './seo';

describe('IMEIA evals — WhatsApp Business oficial', () => {
  it('usa +57 313 724 7353 y no el número histórico 310 333 2607', () => {
    expect(IME_WHATSAPP_E164).toBe('573137247353');
    expect(IME_WHATSAPP_DISPLAY).toBe('+57 313 724 7353');
    expect(IME_WHATSAPP_URL).toBe('https://wa.me/573137247353');
    expect(IME_WHATSAPP_TEL).toBe('+57-313-724-7353');
    expect(IME_WHATSAPP_DISPLAY).not.toMatch(/310\s*333\s*2607/);
    expect(buildWhatsAppHref('Hola I-ME')).toContain('573137247353');
    expect(buildWhatsAppHref('Hola I-ME')).toContain('text=');
  });

  it('alinea schema.org Organization con el mismo número Business', () => {
    const org = buildOrganizationJsonLd();
    const contact = (org.contactPoint as Array<{ telephone?: string }>)[0];
    expect(contact?.telephone).toBe(IME_WHATSAPP_TEL);
    expect(org.sameAs).toEqual([IME_WHATSAPP_URL]);
    expect(JSON.stringify(org)).not.toContain('310-333-2607');
  });
});

describe('IMEIA evals — guardrails del system prompt', () => {
  it.each([
    ['runtime-es', buildImeiaRuntimeSystemPrompt('es')],
    ['runtime-en', buildImeiaRuntimeSystemPrompt('en')],
    ['transport-json', buildImeiaTransportSystemPrompt()],
    ['local-ollama', buildAsesorLocalSystemPrompt()],
  ] as const)(
    '%s incluye INVIMA/RS, no-inventar, WhatsApp oficial y no-diagnóstico',
    (_id, prompt) => {
      expect(imeiaPromptEvalChecks(prompt)).toEqual([]);
      expect(prompt).toContain(IME_WHATSAPP_DISPLAY);
      expect(prompt).not.toContain('310 333 2607');
    }
  );
});

describe('IMEIA evals — accion_handoff', () => {
  it('escala precio a cotización aunque Hermes no mencione WhatsApp', () => {
    expect(inferHandoffFromUserIntent('¿Cuánto cuesta la bomba IP-200?')).toBe('cotizacion');
    expect(
      detectarAccionHandoff({
        mensaje: '¿Cuánto cuesta la bomba IP-200?',
        texto: 'Puedo orientarle con la referencia del catálogo, sin comprometer un valor.',
      })
    ).toEqual({
      tipo: 'cotizacion',
      resumen: '¿Cuánto cuesta la bomba IP-200?',
    });
  });

  it('escala financiación a cotización', () => {
    expect(esIntencionHandoffComercial('qué financiación ofrecen a 36 meses')).toBe(true);
    expect(inferHandoffFromUserIntent('qué financiación ofrecen a 36 meses')).toBe('cotizacion');
  });

  it('escala RS/INVIMA de un SKU a WhatsApp y no inventa el número', () => {
    const mensaje = '¿Cuál es el número de registro sanitario INVIMA del monitor M12?';
    expect(esIntencionInvimaSku(mensaje)).toBe(true);
    expect(
      detectarAccionHandoff({ mensaje, texto: 'Ese dato se confirma por referencia.' })
    ).toEqual({
      tipo: 'whatsapp',
      resumen: mensaje,
    });
  });

  it('no escala orientación INVIMA general (qué es / clasificación)', () => {
    expect(esIntencionInvimaSku('¿Qué es INVIMA y cómo clasifica dispositivos?')).toBe(false);
    expect(
      detectarAccionHandoff({
        mensaje: '¿Qué es INVIMA y cómo clasifica dispositivos?',
        texto:
          'INVIMA supervisa dispositivos médicos en Colombia. La clase depende del uso previsto.',
      })
    ).toBeNull();
  });

  it('respeta la mención de WhatsApp en la respuesta de Hermes', () => {
    expect(
      detectarAccionHandoff({
        mensaje: 'Necesito un monitor para triage',
        texto: `Si quiere, seguimos por WhatsApp ${IME_WHATSAPP_DISPLAY}.`,
        resumen: 'Monitor triage urgencias',
      })
    ).toEqual({
      tipo: 'whatsapp',
      resumen: 'Monitor triage urgencias',
    });
  });

  it('en consulta de contacto adjunta handoff WhatsApp con el número oficial', () => {
    expect(esConsultaSitioOLegal('¿Cuál es su WhatsApp?')).toBe(true);
    expect(esConsultaContacto('¿Cuál es su WhatsApp?')).toBe(true);
    const texto = buildAsesorStaticFallback('es', '¿Cuál es su WhatsApp?');
    expect(texto).toContain('313 724 7353');
    expect(texto).not.toContain('310 333 2607');
    expect(
      detectarAccionHandoff({
        mensaje: '¿Cuál es su WhatsApp?',
        texto: texto ?? '',
      })?.tipo
    ).toBe('whatsapp');
  });
});

describe('IMEIA evals — clasificación de fallos Hermes', () => {
  it('distingue timeout, vacío y HTTP upstream', () => {
    expect(clasificarFalloImeia(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(
      'timeout'
    );
    expect(clasificarFalloImeia(new Error('IMEIA sin contenido'))).toBe('empty');
    expect(clasificarFalloImeia(new Error('IMEIA HTTP 502'))).toBe('upstream_http');
    expect(clasificarFalloImeia(new Error('socket hang up'))).toBe('error');
  });
});
