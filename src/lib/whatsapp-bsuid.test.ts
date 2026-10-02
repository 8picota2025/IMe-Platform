import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  parseWhatsAppWebhook,
  sendWhatsAppText,
  readableWhatsAppBody,
  whatsAppRecipient,
} from './whatsapp-cloud';
import { clasificarTomaHumana } from './whatsapp-human-takeover';
import { planWhatsAppDispatch } from './whatsapp-imeia-dispatch';

function fixture(name: string) {
  return JSON.parse(
    readFileSync(new URL(`../../tests/fixtures/whatsapp/${name}.json`, import.meta.url), 'utf8')
  );
}

describe('Meta BSUID and coexistence fixtures (sanitized)', () => {
  it('retains the full BSUID and matches contacts by identity, not array order', () => {
    const payload = fixture('bsuid');
    payload.entry[0].changes[0].value.contacts.unshift({
      user_id: 'CO.Other123',
      profile: { name: 'Other' },
    });
    const [message] = parseWhatsAppWebhook(payload).texts;
    expect(message).toMatchObject({
      from: 'CO.TestBsuid42',
      senderType: 'bsuid',
      username: 'test.university',
      contactName: 'Institución de prueba',
    });
    expect(message?.raw).toMatchObject({ message: { from_user_id: 'CO.TestBsuid42' } });
  });
  it('retains username-only messages without inventing a phone recipient', () => {
    expect(parseWhatsAppWebhook(fixture('username')).texts[0]).toMatchObject({
      from: 'test.university',
      senderType: 'username',
    });
    expect(whatsAppRecipient('test.university')).toBeNull();
  });
  it('accepts contact BSUID without from, and opaque wa_id without stripping digits', () => {
    const payload = fixture('bsuid');
    delete payload.entry[0].changes[0].value.messages[0].from_user_id;
    expect(parseWhatsAppWebhook(payload).texts[0]?.from).toBe('CO.TestBsuid42');
    delete payload.entry[0].changes[0].value.contacts[0].user_id;
    payload.entry[0].changes[0].value.contacts[0].wa_id = 'CO.Opaque987';
    expect(parseWhatsAppWebhook(payload).texts[0]?.from).toBe('CO.Opaque987');
  });
  it('ingests audio and nontext manual echoes', () => {
    expect(parseWhatsAppWebhook(fixture('audio')).texts[0]).toMatchObject({
      type: 'audio',
      text: '[audio]',
      from: 'CO.TestBsuid42',
    });
    expect(parseWhatsAppWebhook(fixture('echo')).echoes[0]).toMatchObject({
      waId: 'CO.TestBsuid42',
      text: '[image]',
    });
    expect(parseWhatsAppWebhook(fixture('status')).texts).toEqual([]);
    expect(parseWhatsAppWebhook(fixture('text')).texts[0]?.senderType).toBe('phone');
  });
  it.each([
    'text',
    'image',
    'audio',
    'video',
    'document',
    'sticker',
    'location',
    'contacts',
    'interactive',
    'button',
    'reaction',
  ])('preserves %s with a readable body', type => {
    expect(readableWhatsAppBody({ type }, type)).toBe(`[${type}]`);
  });
  it('uses captions and reply titles', () => {
    expect(readableWhatsAppBody({ image: { caption: 'Equipo' } }, 'image')).toBe('Equipo');
    expect(
      readableWhatsAppBody({ interactive: { button_reply: { title: 'Cotizar' } } }, 'interactive')
    ).toBe('Cotizar');
  });
  it.each(['#pausa', '/pausa', '#parar'])('keeps %s as a pause command', command => {
    expect(clasificarTomaHumana(command)).toBe('pause');
    expect(clasificarTomaHumana('#activa')).toBe('resume');
  });
  it('sends BSUID unchanged in recipient, omitting to', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ messages: [{ id: 'wamid.out.test' }] })
    );
    await sendWhatsAppText({
      to: 'CO.TestBsuid42',
      body: 'Hola',
      phoneNumberId: 'test',
      token: 'fixture-token',
      fetchImpl,
    });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(init?.body))).toMatchObject({ recipient: 'CO.TestBsuid42' });
    expect(JSON.parse(String(init?.body))).not.toHaveProperty('to');
  });
  it('never sends a username as a phone number', async () => {
    const fetchImpl = vi.fn();
    expect(
      await sendWhatsAppText({
        to: 'name123',
        body: 'Hola',
        phoneNumberId: 'test',
        token: 'fixture-token',
        fetchImpl,
      })
    ).toMatchObject({ ok: false, error: 'no_sendable_recipient' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('dispatches BSUID messages while retaining explicit pause suppression', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const event = {
      fromWa: 'CO.TestBsuid42',
      wamid: 'test',
      body: '[audio]',
      createdAt: '2026-10-02T11:58:00Z',
      phoneNumberId: 'test',
      status: 'pending_agent',
      agentClaimedAt: null,
    };
    expect(planWhatsAppDispatch({ now, events: [event], outbound: [] }).wakes).toHaveLength(1);
    expect(
      planWhatsAppDispatch({ now, events: [event], outbound: [], pausedWaIds: [event.fromWa] })
    ).toEqual({ wakes: [], holdings: [] });
  });
});
