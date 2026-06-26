/**
 * Rate limiting per provider para notificaciones.
 * Previene que un proveedor reciba más notificaciones de las que puede procesar.
 *
 * Usa tabla `provider_rate_limits` en Supabase.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitConfig {
  notificaciones_por_minuto: number; // max notifications per minute
  notificaciones_por_hora: number; // max notifications per hour
  cooldown_minutos: number; // wait time after limit reached
}

const DEFAULT_CONFIG: RateLimitConfig = {
  notificaciones_por_minuto: 10,
  notificaciones_por_hora: 100,
  cooldown_minutos: 5,
};

/**
 * Verifica si un proveedor está dentro del rate limit.
 * Retorna { allowed: boolean, reason?: string, resetAt?: Date }
 */
export async function checkProviderRateLimit(
  supabase: SupabaseClient,
  providerId: string
): Promise<{ allowed: boolean; reason?: string; resetAt?: Date }> {
  const ahora = new Date();
  const hace1minuto = new Date(ahora.getTime() - 60 * 1000);
  const hace1hora = new Date(ahora.getTime() - 60 * 60 * 1000);

  // Contar notificaciones en último minuto
  const { count: countMinuto, error: errorMinuto } = await supabase
    .from('notification_log')
    .select('*', { count: 'exact', head: true })
    .eq('proveedor_id', providerId)
    .eq('tipo', 'notificacion')
    .gte('created_at', hace1minuto.toISOString());

  if (errorMinuto) {
    return {
      allowed: true, // fail open: si no podemos verificar, permitimos
      reason: `Error verificando rate limit (continuando): ${errorMinuto.message}`,
    };
  }

  const config = DEFAULT_CONFIG;

  if ((countMinuto ?? 0) >= config.notificaciones_por_minuto) {
    const resetAt = new Date(ahora.getTime() + config.cooldown_minutos * 60 * 1000);
    return {
      allowed: false,
      reason: `Rate limit: max ${config.notificaciones_por_minuto} notificaciones/minuto`,
      resetAt,
    };
  }

  // Contar notificaciones en última hora
  const { count: countHora, error: errorHora } = await supabase
    .from('notification_log')
    .select('*', { count: 'exact', head: true })
    .eq('proveedor_id', providerId)
    .eq('tipo', 'notificacion')
    .gte('created_at', hace1hora.toISOString());

  if (errorHora) {
    return {
      allowed: true,
      reason: `Error verificando rate limit (continuando): ${errorHora.message}`,
    };
  }

  if ((countHora ?? 0) >= config.notificaciones_por_hora) {
    const resetAt = new Date(ahora.getTime() + config.cooldown_minutos * 60 * 1000);
    return {
      allowed: false,
      reason: `Rate limit: max ${config.notificaciones_por_hora} notificaciones/hora`,
      resetAt,
    };
  }

  return { allowed: true };
}

/**
 * Registra una notificación en el log para rate limiting.
 */
export async function logNotificationAttempt(
  supabase: SupabaseClient,
  providerId: string,
  status: 'enviado' | 'fallido',
  metadatos?: Record<string, unknown>
): Promise<void> {
  await supabase.from('notification_log').insert({
    proveedor_id: providerId,
    tipo: 'notificacion',
    status,
    metadatos,
    created_at: new Date().toISOString(),
  });
}
