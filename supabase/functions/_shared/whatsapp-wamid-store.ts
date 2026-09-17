/**
 * Idempotencia de wamid contra `whatsapp_inbound_events`.
 * Unique(wamid): el segundo insert es duplicate y no se reenvía reply.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  classifyWamidClaimError,
  MemoryWamidStore,
  type WamidClaimResult,
  type WamidClaimStore,
} from '../../../src/lib/whatsapp-cloud.ts';

export class SupabaseWamidStore implements WamidClaimStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async claim(wamid: string): Promise<WamidClaimResult> {
    const id = wamid.trim();
    if (!id) return 'duplicate';

    const { error } = await this.supabase.from('whatsapp_inbound_events').insert({
      wamid: id,
      status: 'claimed',
      kind: 'message',
    });

    if (!error) return 'claimed';
    const kind = classifyWamidClaimError(error);
    if (kind === 'duplicate') return 'duplicate';
    // Fail closed: without durable unique(wamid), Meta retries duplicate outbound
    // (ack + agent wake). Apply migration before processing production traffic.
    if (kind === 'missing_table') {
      throw new Error('whatsapp_wamid_table_missing:aplicar migracion whatsapp_inbound_events');
    }
    throw new Error(`whatsapp_wamid_claim_failed:${error.message}`);
  }
}

export async function markWamidStatus(
  supabase: SupabaseClient,
  wamid: string,
  status: 'replied' | 'ignored' | 'rate_limited' | 'send_failed' | 'pending_agent',
  extra: { fromWa?: string; phoneNumberId?: string; kind?: string; body?: string } = {}
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    from_wa: extra.fromWa ?? null,
    phone_number_id: extra.phoneNumberId ?? null,
    kind: extra.kind ?? 'message',
    updated_at: new Date().toISOString(),
  };
  if (extra.body !== undefined) {
    patch.body = extra.body;
  }
  const { error } = await supabase.from('whatsapp_inbound_events').update(patch).eq('wamid', wamid);
  if (error) {
    console.warn('[whatsapp-wamid] update status failed:', error.message);
  }
}

export function memoryWamidStoreFallback(): MemoryWamidStore {
  return new MemoryWamidStore();
}
