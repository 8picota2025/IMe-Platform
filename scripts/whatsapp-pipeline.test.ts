import { describe, expect, it, vi } from 'vitest';
import { despacharWhatsAppImeia } from '../supabase/functions/_shared/whatsapp-dispatch';
import { replyToWhatsAppBatch } from '../supabase/functions/_shared/whatsapp-reply';

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
    if (name === 'claim_whatsapp_agent_batch')
      return {
        data: [
          {
            out_wamid: 'test.turn',
            out_body: '[audio]',
            out_created_at: rows.whatsapp_inbound_events![0]!.created_at,
            out_phone_number_id: 'test.phone',
            out_claim_token: 'test.token',
          },
        ],
        error: null,
      };
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
    });
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
  it('rejects replies after human takeover', async () => {
    const db = database('paused');
    const fetchImpl = vi.fn<typeof fetch>();
    expect(
      await replyToWhatsAppBatch(db.client, graph, 'test.token', 'Respuesta', fetchImpl)
    ).toEqual({ ok: false, status: 409 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
