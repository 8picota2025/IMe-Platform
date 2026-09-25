import { describe, expect, it } from 'vitest';

import { parseWhatsAppWebhook } from './whatsapp-cloud';
import {
  avisoTomaHumana,
  clasificarTomaHumana,
  estadoInboundWhatsApp,
  tomaHumanaCompatibleConWake,
} from './whatsapp-human-takeover';

describe('palabras de toma humana', () => {
  it('reconoce #pausa y #activa con mayúsculas, espacios y texto detrás', () => {
    expect(clasificarTomaHumana('  #pausa  ')).toBe('pause');
    expect(clasificarTomaHumana('#PAUSA')).toBe('pause');
    expect(clasificarTomaHumana('#pausa ya lo atiendo yo')).toBe('pause');
    expect(clasificarTomaHumana('#Pausa.')).toBe('pause');
    expect(clasificarTomaHumana('#activa')).toBe('resume');
    expect(clasificarTomaHumana('#Activa retomamos')).toBe('resume');
  });

  it('no pausa por una palabra parecida ni si la orden no va primero', () => {
    expect(clasificarTomaHumana('#pausar')).toBeNull();
    expect(clasificarTomaHumana('#activado')).toBeNull();
    expect(clasificarTomaHumana('ok #pausa')).toBeNull();
    expect(clasificarTomaHumana('gracias')).toBeNull();
    expect(clasificarTomaHumana('')).toBeNull();
  });

  it('no manda el aviso al wake: no trae from, text ni wamid', () => {
    const aviso = avisoTomaHumana('pause', '573001112233');
    expect(aviso).toEqual({
      type: 'human_takeover',
      action: 'pause',
      wa_id: '573001112233',
    });
    expect(tomaHumanaCompatibleConWake(aviso)).toBe(false);
    expect(tomaHumanaCompatibleConWake(avisoTomaHumana('resume', '573001112233'))).toBe(false);
  });

  it('un cliente en pausa no queda pending_agent', () => {
    expect(estadoInboundWhatsApp(true)).toBe('human_paused');
    expect(estadoInboundWhatsApp(false)).toBe('pending_agent');
  });
});

describe('ecos del WhatsApp Business app', () => {
  it('lee smb_message_echoes: to es el cliente', () => {
    const parsed = parseWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'smb_message_echoes',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: 'PHONE' },
                message_echoes: [
                  {
                    from: '573137247353',
                    to: '573001112233',
                    id: 'wamid.echo.1',
                    timestamp: '1710000002',
                    type: 'text',
                    text: { body: '#pausa ya lo veo' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(parsed.texts).toEqual([]);
    expect(parsed.echoes).toEqual([
      expect.objectContaining({
        wamid: 'wamid.echo.1',
        waId: '573001112233',
        fromWa: '573137247353',
        text: '#pausa ya lo veo',
        field: 'smb_message_echoes',
      }),
    ]);
  });

  it('trata un mensaje con from del negocio y to del cliente como eco, no como inbound', () => {
    const parsed = parseWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'PHONE' },
                messages: [
                  {
                    from: '573137247353',
                    to: '573009998877',
                    id: 'wamid.echo.2',
                    timestamp: '1710000003',
                    type: 'text',
                    text: { body: 'Te escribo yo, sin IMEIA' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(parsed.texts).toEqual([]);
    expect(parsed.echoes.map(eco => eco.waId)).toEqual(['573009998877']);
    expect(clasificarTomaHumana(parsed.echoes[0]?.text ?? '')).toBeNull();
  });
});
