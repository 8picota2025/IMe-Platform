/**
 * Supabase client — public (anon key) for client and static build.
 * BLOQUEANTE_BACKEND: Requires PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env
 *
 * Privileged server keys ONLY live in supabase/functions/_shared/supabase-server.ts
 * and is never imported here or exposed in dist/.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env['PUBLIC_SUPABASE_URL'] as string | undefined;
const supabaseAnonKey = import.meta.env['PUBLIC_SUPABASE_ANON_KEY'] as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Returns a Supabase client if env vars are set, otherwise null.
 * Callers must check isSupabaseConfigured() or handle null.
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}
