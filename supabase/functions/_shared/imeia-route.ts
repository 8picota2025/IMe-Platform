import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type RutaImeia = 'grokbot' | 'hermes';

/**
 * Failover sin tokens (imeia_routing, fila única). Ante cualquier error se
 * queda en 'grokbot' para no cambiar el comportamiento existente.
 */
export async function rutaImeia(supabase: SupabaseClient): Promise<RutaImeia> {
  try {
    const { data, error } = await supabase
      .from('imeia_routing')
      .select('target')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return 'grokbot';
    return data.target === 'hermes' ? 'hermes' : 'grokbot';
  } catch {
    return 'grokbot';
  }
}

/** Encola un lote para el worker Hermes (pull desde srv; Supabase no alcanza la tailnet). */
export async function encolarHermes(
  supabase: SupabaseClient,
  canal: 'whatsapp' | 'web',
  ref: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from('imeia_hermes_queue')
    .upsert({ canal, ref, payload, status: 'pending' }, { onConflict: 'canal,ref' });
  if (error) console.error('[imeia-route] encolar', canal, error.message);
  return !error;
}

/** Verifica el token del worker Hermes contra su hash en BD (nunca en claro). */
export async function esTokenWorkerHermes(supabase: SupabaseClient, bearer: string): Promise<boolean> {
  if (!bearer || bearer.length < 32) return false;
  const { data, error } = await supabase.rpc('imeia_worker_token_ok', { p_token: bearer });
  return !error && data === true;
}
