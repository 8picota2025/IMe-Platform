// Entorno de ejecución de las Edge Functions.
// Supabase reserva el prefijo SUPABASE_ para secretos de proyecto, así que
// SUPABASE_ENV no se puede definir en producción. Se usa IME_ENV y, sin valor,
// se asume 'prod' (fail-safe: sin detalles de error ni stacks). En local:
// IME_ENV=dev en supabase/functions/.env.
export function entornoEdge(): string {
  return Deno.env.get('IME_ENV') ?? Deno.env.get('SUPABASE_ENV') ?? 'prod';
}

export function esProduccion(): boolean {
  return entornoEdge() === 'prod';
}
