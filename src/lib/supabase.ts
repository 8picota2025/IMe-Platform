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
/**
 * Each asesor HTTP call is short (create+wake or a DB poll). 60s covers Edge
 * cold-start + webhook ACK on slow mobile without waiting the full agent reply.
 * The widget poll loop owns the 90–180s wait; this timer must not abort it.
 */
const ASESOR_FUNCTION_TIMEOUT_MS = 60_000;
/** Subir fotos (móvil/cámara sin comprimir) puede tardar mucho más que una
 * consulta de datos normal, sobre todo en redes lentas. El timeout general
 * (PUBLIC_SUPABASE_TIMEOUT_MS, fijado corto para fallar rápido en build/API)
 * no debe aplicar aquí. */
const STORAGE_UPLOAD_TIMEOUT_MS = 60_000;

function resolveSupabaseTimeoutMs(): number {
  const raw = import.meta.env['PUBLIC_SUPABASE_TIMEOUT_MS'] as string | undefined;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1000) return parsed;
  return DEFAULT_SUPABASE_TIMEOUT_MS;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isAsesorFunctionRequest(input: RequestInfo | URL): boolean {
  return requestUrl(input).includes('/functions/v1/asesor');
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const isStorageObjectRequest = requestUrl(input).includes('/storage/v1/object');
  const timeoutMs = isStorageObjectRequest
    ? STORAGE_UPLOAD_TIMEOUT_MS
    : isAsesorFunctionRequest(input)
      ? ASESOR_FUNCTION_TIMEOUT_MS
      : resolveSupabaseTimeoutMs();
  const parentSignal = init?.signal;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (parentSignal?.aborted) throw error;
      const timeoutErr = new Error(`Supabase request timed out after ${timeoutMs}ms`);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', onParentAbort);
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
