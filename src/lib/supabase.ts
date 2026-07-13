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
const DEFAULT_SUPABASE_TIMEOUT_MS = import.meta.env.SSR ? 8000 : 15000;

function resolveSupabaseTimeoutMs(): number {
  const raw = import.meta.env['PUBLIC_SUPABASE_TIMEOUT_MS'] as string | undefined;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1000) return parsed;
  return DEFAULT_SUPABASE_TIMEOUT_MS;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = resolveSupabaseTimeoutMs();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Supabase request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Returns a Supabase client if env vars are set, otherwise null.
 * Callers must check isSupabaseConfigured() or handle null.
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: fetchWithTimeout,
    },
  });
}
