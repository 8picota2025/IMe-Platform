import { describe, expect, it } from 'vitest';

import { IME_WHATSAPP_DISPLAY } from './contacto-oficial';
import {
  IME_COTIZACION_URL,
  MemoryWamidStore,
  RADIOLOGY_QUOTE_SCOPE_ES,
  WHATSAPP_DEFAULT_API_VERSION,
  buildWhatsAppMessagesUrl,
  composeWhatsAppImeiaReply,
  computeWhatsAppSignatureHex,
  decideWhatsAppInbound,
  isStatusOnlyWebhook,
  parseWhatsAppWebhook,
  sampleInboundTextPayload,
  sampleStatusOnlyPayload,
  sendWhatsAppText,
  verifyWhatsAppChallenge,
  verifyWhatsAppSignature,
} from './whatsapp-cloud';

const APP_SECRET = 'test-app-secret';

describe('WhatsApp Cloud API — GET challenge', () => {
  it('devuelve el challenge solo con mode=subscribe y token exacto', () => {
    expect(
      verifyWhatsAppChallenge({
        mode: 'subscribe',
        token: 'verify-me',
        challenge: '12345',
        expectedToken: 'verify-me',
      })
    ).toEqual({ ok: true, challenge: '12345' });

    expect(
      verifyWhatsAppChallenge({
        mode: 'subscribe',
        token: 'wrong',
        challenge: '12345',
        expectedToken: 'verify-me',
      })
    ).toEqual({ ok: false });

    expect(
      verifyWhatsAppChallenge({
        mode: 'unsubscribe',
        token: 'verify-me',
        challenge: '12345',
        expectedToken: 'verify-me',
      })
    ).toEqual({ ok: false });
  });
});

describe('WhatsApp Cloud API — X-Hub-Signature-256', () => {
  it('acepta HMAC-SHA256 del body crudo', async () => {
    const rawBody = JSON.stringify({ object: 'whatsapp_business_account' });
    const hex = await computeWhatsAppSignatureHex(rawBody, APP_SECRET);
    await expect(verifyWhatsAppSignature(rawBody, `sha256=${hex}`, APP_SECRET)).resolves.toBe(true);
    await expect(verifyWhatsAppSignature(rawBody, hex, APP_SECRET)).resolves.toBe(true);
  });

  it('rechaza firma alterada, header vacío o secreto vacío', async () => {
    const rawBody = '{"ok":true}';
    const hex = await computeWhatsAppSignatureHex(rawBody, APP_SECRET);
    await expect(verifyWhatsAppSignature(rawBody, `sha256=${hex}00`, APP_SECRET)).resolves.toBe(
      false
    );
    await expect(verifyWhatsAppSignature(rawBody, null, APP_SECRET)).resolves.toBe(false);
    await expect(verifyWhatsAppSignature(rawBody, `sha256=${hex}`, '')).resolves.toBe(false);
    await expect(
      verifyWhatsAppSignature('{"ok":false}', `sha256=${hex}`, APP_SECRET)
    ).resolves.toBe(false);
  });
});

describe('WhatsApp Cloud API — payload parse', () => {
  it('extrae un mensaje de texto inbound', () => {
    const parsed = parseWhatsAppWebhook(
      sampleInboundTextPayload({
        wamid: 'wamid.HBgNNjc',
        from: '573001112233',
        text: '¿Cuánto cuesta un monitor M12?',
      })
    );
    expect(parsed.object).toBe('whatsapp_business_account');
    expect(parsed.texts).toEqual([
      expect.objectContaining({
        wamid: 'wamid.HBgNNjc',
        from: '573001112233',
        text: '¿Cuánto cuesta un monitor M12?',
        isGroup: false,
        type: 'text',
      }),
    ]);
    expect(parsed.statuses).toEqual([]);
    expect(isStatusOnlyWebhook(parsed)).toBe(false);
  });

  it('trata statuses como evento sin reply', () => {
    const parsed = parseWhatsAppWebhook(sampleStatusOnlyPayload('wamid.status.9'));
    expect(parsed.texts).toEqual([]);
    expect(parsed.statuses).toEqual([
      {
        wamid: 'wamid.status.9',
        status: 'delivered',
        recipientId: '573001112233',
      },
    ]);
    expect(isStatusOnlyWebhook(parsed)).toBe(true);
  });

  it('ignora grupos y tipos no texto', () => {
    const group = sampleInboundTextPayload({
      wamid: 'wamid.group',
      from: '573001112233',
      text: 'hola grupo',
    }) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<Record<string, unknown>> } }> }>;
    };
    group.entry[0]!.changes[0]!.value.messages[0]!.group_id = '1203630grupo';

    const image = sampleInboundTextPayload({
      wamid: 'wamid.image',
      from: '573001112233',
      text: 'foto',
    }) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<Record<string, unknown>> } }> }>;
    };
    image.entry[0]!.changes[0]!.value.messages[0]!.type = 'image';
    delete image.entry[0]!.changes[0]!.value.messages[0]!.text;

    const groupParsed = parseWhatsAppWebhook(group);
    expect(groupParsed.texts).toEqual([]);
    expect(groupParsed.ignored.some(item => item.reason === 'group')).toBe(true);

    const imageParsed = parseWhatsAppWebhook(image);
    expect(imageParsed.texts).toEqual([]);
    expect(imageParsed.ignored.some(item => item.reason === 'unsupported_type:image')).toBe(true);
  });
});

describe('WhatsApp Cloud API — no-double-reply', () => {
  it('no vuelve a responder el mismo wamid', async () => {
    const store = new MemoryWamidStore();
    const payload = sampleInboundTextPayload({
      wamid: 'wamid.dup.1',
      from: '573001112233',
      text: 'hola',
    });
    const first = await decideWhatsAppInbound(parseWhatsAppWebhook(payload), store);
    const second = await decideWhatsAppInbound(parseWhatsAppWebhook(payload), store);

    expect(first).toEqual([
      expect.objectContaining({
        action: 'reply',
        message: expect.objectContaining({ wamid: 'wamid.dup.1' }),
      }),
    ]);
    expect(second).toEqual([
      expect.objectContaining({
        action: 'ignore',
        reason: 'duplicate_wamid',
        wamid: 'wamid.dup.1',
      }),
    ]);
    expect(store.has('wamid.dup.1')).toBe(true);
  });

  it('ignora status-only sin reclamar reply', async () => {
    const store = new MemoryWamidStore();
    const decisions = await decideWhatsAppInbound(
      parseWhatsAppWebhook(sampleStatusOnlyPayload()),
      store
    );
    expect(decisions).toEqual([{ action: 'ignore', reason: 'status_only' }]);
    expect(store.has('wamid.status.1')).toBe(false);
  });
});

describe('WhatsApp Cloud API — IMEIA composition', () => {
  it('no inventa precio ni RS INVIMA y apunta a cotización web', () => {
    const reply = composeWhatsAppImeiaReply({
      mensaje: '¿Cuánto cuesta el monitor M12 y cuál es su registro sanitario INVIMA?',
      locale: 'es',
      products: [
        {
          slug: 'monitor-de-paciente-m12-biolight',
          nombre: 'Monitor de Paciente M12 Biolight',
          descripcion_corta: 'Monitor de paciente compacto.',
          url_canonica: 'https://i-me.com.co/es/productos/monitor-de-paciente-m12-biolight',
        },
      ],
    });
    expect(reply.texto).toContain('Monitor de Paciente M12 Biolight');
    expect(reply.texto).toContain(IME_WHATSAPP_DISPLAY);
    expect(reply.texto).toContain(IME_COTIZACION_URL);
    expect(reply.texto).not.toMatch(/\bRS[-\s]?\d{4,}/i);
    expect(reply.texto).not.toMatch(/\$\s?\d|\bCOP\s?\d/);
  });

  it('acota cotización de radiología a equipo + instalación del equipo', () => {
    const reply = composeWhatsAppImeiaReply({
      mensaje: 'Necesito cotización de un rayos X para la sala de radiología',
      locale: 'es',
      products: [],
    });
    expect(reply.texto).toContain(RADIOLOGY_QUOTE_SCOPE_ES);
    expect(reply.texto).toContain(IME_COTIZACION_URL);
    expect(reply.texto).not.toMatch(/\$\s?\d|\bCOP\s?\d/);
  });
});

describe('WhatsApp Cloud API — Graph send scaffold', () => {
  it('arma URL Graph y envía texto con token + phone-number-id', async () => {
    expect(buildWhatsAppMessagesUrl('123456', WHATSAPP_DEFAULT_API_VERSION)).toBe(
      'https://graph.facebook.com/v21.0/123456/messages'
    );

    const calls: Array<{ url: string; init: RequestInit }> = [];
    const result = await sendWhatsAppText({
      to: '+57 300 111 2233',
      body: 'Hola I-ME',
      token: 'EAAB-test',
      phoneNumberId: '109900',
      apiVersion: 'v21.0',
      fetchImpl: (async (input, init) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.out.1' }] }), { status: 200 });
      }) as typeof fetch,
    });

    expect(result).toEqual({ ok: true, status: 200, messageId: 'wamid.out.1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v21.0/109900/messages');
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: 'Bearer EAAB-test',
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      messaging_product: 'whatsapp',
      to: '573001112233',
      type: 'text',
      text: { body: 'Hola I-ME', preview_url: false },
    });
  });
});
