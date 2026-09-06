/**
 * Idempotencia de wamid contra `whatsapp_inbound_events`.
 * Unique(wamid): el segundo insert es duplicate y no se reenvía reply.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
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
    if (error.code === '23505') return 'duplicate';
    throw new Error(`whatsapp_wamid_claim_failed:${error.message}`);
  }
}

export async function markWamidStatus(
  supabase: SupabaseClient,
  wamid: string,
  status: 'replied' | 'ignored' | 'rate_limited' | 'send_failed',
  extra: { fromWa?: string; phoneNumberId?: string; kind?: string } = {}
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_inbound_events')
    .update({
      status,
      from_wa: extra.fromWa ?? null,
      phone_number_id: extra.phoneNumberId ?? null,
      kind: extra.kind ?? 'message',
      updated_at: new Date().toISOString(),
    })
    .eq('wamid', wamid);
  if (error) {
    console.warn('[whatsapp-wamid] update status failed:', error.message);
  }
}

export function memoryWamidStoreFallback(): MemoryWamidStore {
  return new MemoryWamidStore();
}
