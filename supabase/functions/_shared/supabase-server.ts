/**
 * Cliente Supabase server-side para Edge Functions.
 * Usa service_role — SOLO en Edge Functions, NUNCA en cliente o dist/.
 *
 * REGLA CRÍTICA: Este archivo NUNCA se importa desde src/ (frontend).
 * precio_costo y secretos solo son accesibles aquí.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getServerSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en Edge Functions')
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
