import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import {
  despacharWhatsAppImeia,
  whatsappHoldingEnabled,
} from '../supabase/functions/_shared/whatsapp-dispatch';
import { replyToWhatsAppBatch } from '../supabase/functions/_shared/whatsapp-reply';

async function withHoldingFlag<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const scope = globalThis as { Deno?: { env: { get(name: string): string | undefined } } };
  const previous = scope.Deno;
  scope.Deno = {
    env: {
      get(name: string) {
        return name === 'WHATSAPP_HOLDING_ENABLED' ? value : undefined;
      },
    },
  };
  try {
    return await run();
  } finally {
    if (previous === undefined) delete scope.Deno;
    else scope.Deno = previous;
  }
}

type Row = Record<string, unknown>;
function database(reason: string | null = null) {
  const rows: Record<string, Row[]> = {
    whatsapp_inbound_events: [
      {
        from_wa: 'CO.TestBsuid42',
        wamid: 'test.turn',
        body: '[audio]',
        created_at: new Date(Date.now() - 120000).toISOString(),
        phone_number_id: 'test.phone',
        status: 'pending_agent',
        agent_claimed_at: null,
        agent_claim_token: 'test.token',
      },
    ],
    whatsapp_outbound_messages: [],
    whatsapp_contact_pauses: [],
    whatsapp_drop_log: [],
    whatsapp_alerts: [],
    whatsapp_contact_routes: [
      { sender_id: 'CO.TestBsuid42', bsuid: 'CO.TestBsuid42', phone: null },
    ],
  };
  let failures = 0;
  const rpc = vi.fn(async (name: string, params?: Row) => {
    if (name === 'whatsapp_dispatch_drop_reason') return { data: reason, error: null };
    if (name === 'claim_whatsapp_agent_batch') {
      const claimed = rows.whatsapp_inbound_events!.filter(
        row => row.status === 'pending_agent' && row.agent_claim_token
      );
      return {
        data: claimed.map(row => ({
          out_wamid: row.wamid,
          out_body: row.body,
          out_created_at: row.created_at,
          out_phone_number_id: row.phone_number_id,
          out_claim_token: row.agent_claim_token,
        })),
        error: null,
      };
    }
    if (name === 'fail_whatsapp_batch') {
      failures += 1;
      if (failures >= 3 && !rows.whatsapp_alerts!.length)
        rows.whatsapp_alerts!.push({
          id: 'alert',
          sender_id: 'CO.TestBsuid42',
          turn_key: 'test.turn',
          second_holding_status: 'new',
        });
      expect(params?.p_error).toBeTruthy();
    }
    return { data: null, error: null };
  });
  const from = (table: string) => {
    rows[table] ??= [];
    const predicates: Array<(row: Row) => boolean> = [];
    let mutation: 'insert' | 'update' | 'delete' | null = null;
    let values: Row | Row[] = {};
    let single = false;
    let descending: string | null = null;
    let max = Infinity;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        predicates.push(row => row[key] === value);
        return query;
      },
      in: (key: string, list: unknown[]) => {
        predicates.push(row => list.includes(row[key]));
        return query;
      },
      gt: (key: string, value: string) => {
        predicates.push(row => String(row[key]) > value);
        return query;
      },
      gte: (key: string, value: string) => {
        predicates.push(row => String(row[key]) >= value);
        return query;
      },
      order: (key: string, options?: { ascending: boolean }) => {
        if (options?.ascending === false) descending = key;
        return query;
      },
      limit: (limit: number) => {
        max = limit;
        return query;
      },
      maybeSingle: () => {
        single = true;
        return query;
      },
      single: () => {
        single = true;
        return query;
      },
      insert: (value: Row | Row[]) => {
        mutation = 'insert';
        values = value;
        return query;
      },
      update: (value: Row) => {
        mutation = 'update';
        values = value;
        return query;
      },
      delete: () => {
        mutation = 'delete';
        return query;
      },
      then: (
        resolve: (value: { data: Row | Row[] | null; error: { code: string } | null }) => unknown
      ) => {
        let selected = rows[table]!.filter(row => predicates.every(predicate => predicate(row)));
        if (mutation === 'insert') {
          const inserted = (Array.isArray(values) ? values : [values]).map(value => ({
            id: 'inserted',
            created_at: new Date().toISOString(),
            ...value,
          }));
          if (
            inserted.some(
              value =>
                value.kind === 'reply' &&
                rows[table]!.some(row => row.kind === 'reply' && row.turn_key === value.turn_key)
            )
          )
            return Promise.resolve(resolve({ data: null, error: { code: '23505' } }));
          rows[table]!.push(...inserted);
          selected = inserted;
        }
        if (mutation === 'update') selected.forEach(row => Object.assign(row, values));
        if (mutation === 'delete')
          rows[table] = rows[table]!.filter(row => !selected.includes(row));
        if (descending) {
          const key = descending;
          selected.sort((a, b) => String(b[key]).localeCompare(String(a[key])));
        }
        selected = selected.slice(0, max);
        return Promise.resolve(
          resolve({ data: single ? (selected[0] ?? null) : selected, error: null })
        );
      },
    };
    return query;
  };
  return {
    client: { from, rpc } as unknown as Parameters<typeof replyToWhatsAppBatch>[0],
    rows,
    rpc,
  };
}
const graph = { token: 'test-token', phoneNumberId: 'test.phone', apiVersion: 'v26.0' };

describe('WhatsApp pipeline with mocked DB and HTTP (no real sends)', () => {
  it.each(['excluded', 'paused', 'group'])(
    'suppresses wake and holdings for %s, and audits the drop',
    async reason => {
      const db = database(reason);
      const fetchImpl = vi.fn<typeof fetch>();
      const result = await despacharWhatsAppImeia({
        supabase: db.client,
        graph,
        wakeUrl: 'https://test.invalid/wake',
        wakeKey: 'test-key',
        wakes: true,
        holdings: true,
        fetchImpl,
      });
      expect(result).toEqual({ wakes: 0, holdings: 0 });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(db.rows.whatsapp_drop_log).toEqual([expect.objectContaining({ drop_reason: reason })]);
    }
  );
  it('counts wake failures and sends the second holding once after the threshold', async () => {
    await withHoldingFlag('true', async () => {
      const db = database();
      const fetchImpl = vi.fn<typeof fetch>(async url =>
        String(url).includes('/wake')
          ? new Response(null, { status: 500 })
          : Response.json({ messages: [{ id: 'test.holding' }] })
      );
      const opts = {
        supabase: db.client,
        graph,
        wakeUrl: 'https://test.invalid/wake',
        wakeKey: 'test-key',
        wakes: true,
        holdings: true,
        fetchImpl,
      };
      for (let i = 0; i < 4; i++) await despacharWhatsAppImeia(opts);
      const graphCalls = fetchImpl.mock.calls.filter(([url]) =>
        String(url).includes('graph.facebook.com')
      );
      expect(graphCalls).toHaveLength(2);
      expect(JSON.parse(String(graphCalls[0]?.[1]?.body))).toMatchObject({
        recipient: 'CO.TestBsuid42',
      });
      expect(db.rows.whatsapp_alerts![0]?.second_holding_status).toBe('sent');
      expect(db.rpc.mock.calls.filter(([name]) => name === 'fail_whatsapp_batch')).toHaveLength(4);
    });
  });
  it('never sends a holding when WHATSAPP_HOLDING_ENABLED is off', async () => {
    expect(whatsappHoldingEnabled()).toBe(false);
    await withHoldingFlag('false', async () => expect(whatsappHoldingEnabled()).toBe(false));
    await withHoldingFlag('0', async () => expect(whatsappHoldingEnabled()).toBe(false));
    await withHoldingFlag(undefined, async () => expect(whatsappHoldingEnabled()).toBe(false));
    await withHoldingFlag('true', async () => expect(whatsappHoldingEnabled()).toBe(true));
    await withHoldingFlag('1', async () => expect(whatsappHoldingEnabled()).toBe(true));
    const db = database();
    const fetchImpl = vi.fn<typeof fetch>(async url =>
      String(url).includes('/wake')
        ? new Response(null, { status: 500 })
        : Response.json({ messages: [{ id: 'test.holding' }] })
    );
    const opts = {
      supabase: db.client,
      graph,
      wakeUrl: 'https://test.invalid/wake',
      wakeKey: 'test-key',
      wakes: true,
      holdings: true,
      fetchImpl,
    };
    for (let i = 0; i < 4; i++) await despacharWhatsAppImeia(opts);
    const graphCalls = fetchImpl.mock.calls.filter(([url]) =>
      String(url).includes('graph.facebook.com')
    );
    expect(graphCalls).toHaveLength(0);
    expect(db.rows.whatsapp_outbound_messages).toEqual([]);
    expect(db.rows.whatsapp_alerts![0]?.second_holding_status).toBe('new');
  });
  it('preserves the claim after a wake timeout while recording the failure', async () => {
    const db = database();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new DOMException('test timeout', 'AbortError');
    });
    await despacharWhatsAppImeia({
      supabase: db.client,
      graph,
      wakeUrl: 'https://test.invalid/wake',
      wakeKey: 'test-key',
      wakes: true,
      holdings: false,
      fetchImpl,
    });
    expect(db.rpc).toHaveBeenCalledWith(
      'fail_whatsapp_batch',
      expect.objectContaining({ p_error: 'wake_timeout', p_release: false })
    );
  });
  it('includes the recipient and claim token in the agent contract', async () => {
    const db = database();
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    await despacharWhatsAppImeia({
      supabase: db.client,
      graph,
      wakeUrl: 'https://test.invalid/wake',
      wakeKey: 'test-key',
      wakes: true,
      holdings: false,
      fetchImpl,
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      claim_token: 'test.token',
      recipient: { recipient: 'CO.TestBsuid42' },
      messages: [{ wamid: 'test.turn', body: '[audio]' }],
      recent_outbound: [],
      trivial_ack: false,
    });
  });
  it('adds the last three sent outbound messages from the past 10 minutes', async () => {
    const db = database();
    const now = Date.now();
    const sent = (minutesAgo: number, body: string) => ({
      to_wa: 'CO.TestBsuid42',
      body,
      kind: 'reply',
      created_at: new Date(now - minutesAgo * 60_000).toISOString(),
      send_status: 'sent',
      turn_key: `out-${minutesAgo}`,
    });
    db.rows.whatsapp_outbound_messages!.push(
      sent(11, 'fuera de ventana'),
      sent(9, 'hace nueve'),
      sent(6, 'hace seis'),
      sent(3, 'hace tres'),
      sent(1, 'hace uno'),
      {
        to_wa: 'CO.TestBsuid42',
        body: 'falló',
        kind: 'reply',
        created_at: new Date(now - 30_000).toISOString(),
        send_status: 'failed',
        turn_key: 'out-failed',
      },
      {
        to_wa: '573009998877',
        body: 'otro contacto',
        kind: 'reply',
        created_at: new Date(now - 20_000).toISOString(),
        send_status: 'sent',
        turn_key: 'out-other',
      }
    );
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    await despacharWhatsAppImeia({
      supabase: db.client,
      graph,
      wakeUrl: 'https://test.invalid/wake',
      wakeKey: 'test-key',
      wakes: true,
      holdings: false,
      fetchImpl,
    });
    const wake = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(wake.recent_outbound).toEqual([
      { time: sent(6, 'hace seis').created_at, text: 'hace seis' },
      { time: sent(3, 'hace tres').created_at, text: 'hace tres' },
      { time: sent(1, 'hace uno').created_at, text: 'hace uno' },
    ]);
  });
  it('flags a trivial-ack batch and leaves it pending', async () => {
    const db = database();
    db.rows.whatsapp_inbound_events![0]!.body = 'gracias';
    db.rows.whatsapp_inbound_events!.push({
      ...db.rows.whatsapp_inbound_events![0],
      wamid: 'test.ack',
      body: 'ok',
      created_at: new Date(Date.now() - 90_000).toISOString(),
    });
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    await despacharWhatsAppImeia({
      supabase: db.client,
      graph,
      wakeUrl: 'https://test.invalid/wake',
      wakeKey: 'test-key',
      wakes: true,
      holdings: true,
      fetchImpl,
    });
    const wake = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(wake.trivial_ack).toBe(true);
    expect(wake.messages).toEqual([
      expect.objectContaining({ body: 'gracias' }),
      expect.objectContaining({ body: 'ok' }),
    ]);
    expect(db.rows.whatsapp_inbound_events!.every(row => row.status === 'pending_agent')).toBe(
      true
    );
    expect(fetchImpl.mock.calls.every(([url]) => !String(url).includes('graph.facebook.com'))).toBe(
      true
    );
  });
  it('does not flag a batch that mixes an ack with a real question', async () => {
    const db = database();
    db.rows.whatsapp_inbound_events![0]!.body = 'ok';
    db.rows.whatsapp_inbound_events!.push({
      ...db.rows.whatsapp_inbound_events![0],
      wamid: 'test.question',
      body: '¿Tienen monitores de paciente?',
      created_at: new Date(Date.now() - 90_000).toISOString(),
    });
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    await despacharWhatsAppImeia({
      supabase: db.client,
      graph,
      wakeUrl: 'https://test.invalid/wake',
      wakeKey: 'test-key',
      wakes: true,
      holdings: false,
      fetchImpl,
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).trivial_ack).toBe(false);
    expect(db.rows.whatsapp_inbound_events!.every(row => row.status === 'pending_agent')).toBe(
      true
    );
  });
  it('replies using the latest BSUID and closes only the claimed batch', async () => {
    const db = database();
    db.rows.whatsapp_inbound_events!.push({
      ...db.rows.whatsapp_inbound_events![0],
      wamid: 'new.turn',
      agent_claim_token: null,
    });
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ messages: [{ id: 'test.reply' }] })
    );
    expect(
      await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)
    ).toEqual({ ok: true, status: 200 });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      recipient: 'CO.TestBsuid42',
    });
    expect(db.rows.whatsapp_inbound_events![0]?.status).toBe('replied');
    expect(db.rows.whatsapp_inbound_events![1]?.status).toBe('pending_agent');
    await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('does not resend an uncertain reply after the batch is reclaimed', async () => {
    const db = database();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('fixture network failure');
    });
    expect(
      (await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)).status
    ).toBe(502);
    expect(db.rows.whatsapp_outbound_messages![0]?.send_status).toBe('pending');
    db.rows.whatsapp_inbound_events![0]!.agent_claim_token = 'new.token';
    expect(
      (await replyToWhatsAppBatch(db.client, graph, 'new.token', 'Respuesta', fetchImpl)).status
    ).toBe(409);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('recovers a sent reply whose batch was not closed without another Graph send', async () => {
    const db = database();
    db.rows.whatsapp_outbound_messages!.push({
      id: 'prior',
      to_wa: 'CO.TestBsuid42',
      kind: 'reply',
      turn_key: 'test.turn',
      send_status: 'sent',
    });
    const fetchImpl = vi.fn<typeof fetch>();
    expect(
      await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)
    ).toEqual({ ok: true, status: 200 });
    expect(db.rows.whatsapp_inbound_events![0]?.status).toBe('replied');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('releases the claim instead of sending when a newer pending inbound exists', async () => {
    const db = database();
    const claimedAt = String(db.rows.whatsapp_inbound_events![0]!.created_at);
    db.rows.whatsapp_inbound_events!.push(
      {
        ...db.rows.whatsapp_inbound_events![0],
        wamid: 'newer.turn',
        body: 'sigo con la consulta',
        created_at: new Date(Date.parse(claimedAt) + 5_000).toISOString(),
        agent_claim_token: null,
        agent_claimed_at: null,
        status: 'pending_agent',
      },
      {
        ...db.rows.whatsapp_inbound_events![0],
        wamid: 'other.contact',
        from_wa: '573009998877',
        created_at: new Date(Date.parse(claimedAt) + 9_000).toISOString(),
        agent_claim_token: null,
        status: 'pending_agent',
      }
    );
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ messages: [{ id: 'test.reply' }] })
    );
    expect(
      await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)
    ).toEqual({ ok: false, status: 409, error: 'new_messages' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.rows.whatsapp_outbound_messages).toEqual([]);
    expect(db.rows.whatsapp_inbound_events![0]).toMatchObject({
      status: 'pending_agent',
      agent_claim_token: null,
      agent_claimed_at: null,
    });
    expect(db.rows.whatsapp_inbound_events![1]).toMatchObject({
      wamid: 'newer.turn',
      status: 'pending_agent',
      agent_claim_token: null,
    });
  });
  it('still sends when the only newer pending row belongs to another contact', async () => {
    const db = database();
    const claimedAt = String(db.rows.whatsapp_inbound_events![0]!.created_at);
    db.rows.whatsapp_inbound_events!.push({
      ...db.rows.whatsapp_inbound_events![0],
      wamid: 'other.contact',
      from_wa: '573009998877',
      created_at: new Date(Date.parse(claimedAt) + 5_000).toISOString(),
      agent_claim_token: null,
      status: 'pending_agent',
    });
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ messages: [{ id: 'test.reply' }] })
    );
    expect(
      await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)
    ).toEqual({ ok: true, status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(db.rows.whatsapp_inbound_events![0]?.status).toBe('replied');
    expect(db.rows.whatsapp_inbound_events![1]?.status).toBe('pending_agent');
  });
  it('rejects replies after human takeover', async () => {
    const db = database('paused');
    const fetchImpl = vi.fn<typeof fetch>();
    expect(
      await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)
    ).toEqual({ ok: false, status: 409 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('reads WHATSAPP_HOLDING_ENABLED instead of forcing holdings on', () => {
    const dispatch = readFileSync(
      new URL('../supabase/functions/whatsapp-imeia-dispatch/index.ts', import.meta.url),
      'utf8'
    );
    const followUp = readFileSync(
      new URL('../supabase/functions/_shared/whatsapp-dispatch.ts', import.meta.url),
      'utf8'
    );
    expect(dispatch).toContain('holdings: whatsappHoldingEnabled()');
    expect(dispatch).not.toContain('holdings: true');
    expect(followUp).toContain('if (!whatsappHoldingEnabled()) return;');
    expect(followUp).toContain('if (!whatsappHoldingEnabled()) return false;');
    expect(followUp).toContain('if (!whatsappHoldingEnabled()) return 0;');
  });
});
