/**
 * Rate-limit por identificador ('ip:<ip>' o 'session:<id>') contra la tabla
 * asesor_rate_limit: ventana corta (anti-burst) + tope diario.
 *
 * Tabla compartida entre acciones ('asesor' | 'crear-pago' | 'cotizacion' |
 * 'comercial-share' | 'whatsapp'): cada accion tiene
 * sus propios umbrales (env vars) pero el `identificador` (con su prefijo,
 * ej. 'pago:ip:<ip>' vs 'asesor:...') ya evita que se mezclen los contadores.
 * No se crea una tabla `rate_limits` separada — el esquema actual admite una
 * clave por accion sin migracion.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type RateLimitAccion =
  | 'asesor'
  | 'crear-pago'
  | 'cotizacion'
  | 'comercial-share'
  | 'formalizar-preview'
  | 'whatsapp';

export interface RateLimitResult {
  limited: boolean;
  reason?: 'ventana' | 'dia';
  retryAfterSeconds?: number;
}

interface RateLimitThresholds {
  windowSeconds: number;
  maxPerWindow: number;
  maxPerDay: number;
}

const THRESHOLDS: Record<RateLimitAccion, RateLimitThresholds> = {
  asesor: {
    windowSeconds: Number(Deno.env.get('ASESOR_RATE_LIMIT_VENTANA_SEGUNDOS') ?? 60),
    maxPerWindow: Number(Deno.env.get('ASESOR_RATE_LIMIT_MAX_VENTANA') ?? 8),
    maxPerDay: Number(Deno.env.get('ASESOR_RATE_LIMIT_MAX_DIA') ?? 60),
  },
  'crear-pago': {
    // v1.1: 10 intentos de pago por hora por IP.
    windowSeconds: Number(Deno.env.get('CREAR_PAGO_RATE_LIMIT_VENTANA_SEGUNDOS') ?? 3600),
    maxPerWindow: Number(Deno.env.get('CREAR_PAGO_RATE_LIMIT_MAX_VENTANA') ?? 10),
    maxPerDay: Number(Deno.env.get('CREAR_PAGO_RATE_LIMIT_MAX_DIA') ?? 30),
  },
  // Preview del enlace de formalización: más permisivo (reloads / reintentos UI).
  'formalizar-preview': {
    windowSeconds: Number(Deno.env.get('FORMALIZAR_PREVIEW_RATE_LIMIT_VENTANA_SEGUNDOS') ?? 3600),
    maxPerWindow: Number(Deno.env.get('FORMALIZAR_PREVIEW_RATE_LIMIT_MAX_VENTANA') ?? 60),
    maxPerDay: Number(Deno.env.get('FORMALIZAR_PREVIEW_RATE_LIMIT_MAX_DIA') ?? 200),
  },
  cotizacion: {
    // Antes: 5/h y 15/día — demasiado agresivo detrás de NAT hospitalario/oficina
    // y quemaba cuota con intentos inválidos. Umbral anti-spam más realista.
    windowSeconds: Number(Deno.env.get('COTIZACION_RATE_LIMIT_VENTANA_SEGUNDOS') ?? 3600),
    maxPerWindow: Number(Deno.env.get('COTIZACION_RATE_LIMIT_MAX_VENTANA') ?? 40),
    maxPerDay: Number(Deno.env.get('COTIZACION_RATE_LIMIT_MAX_DIA') ?? 120),
  },
  // CMS comercial: por usuario autenticado (identificador
  // `comercial-share:user:<uuid>`), no por IP — evita que un solo
  // comercial sature Resend/Twenty.
  'comercial-share': {
    windowSeconds: Number(Deno.env.get('COMERCIAL_SHARE_RATE_LIMIT_VENTANA_SEGUNDOS') ?? 3600),
    maxPerWindow: Number(Deno.env.get('COMERCIAL_SHARE_RATE_LIMIT_MAX_VENTANA') ?? 30),
    maxPerDay: Number(Deno.env.get('COMERCIAL_SHARE_RATE_LIMIT_MAX_DIA') ?? 100),
  },
  whatsapp: {
    windowSeconds: Number(Deno.env.get('WHATSAPP_RATE_LIMIT_VENTANA_SEGUNDOS') ?? 60),
    maxPerWindow: Number(Deno.env.get('WHATSAPP_RATE_LIMIT_MAX_VENTANA') ?? 8),
    maxPerDay: Number(Deno.env.get('WHATSAPP_RATE_LIMIT_MAX_DIA') ?? 80),
  },
};

interface RateLimitRow {
  ventana_inicio: string;
  contador_ventana: number;
  dia: string;
  contador_dia: number;
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  identificador: string,
  accion: RateLimitAccion = 'asesor'
): Promise<RateLimitResult> {
  const {
    windowSeconds: WINDOW_SECONDS,
    maxPerWindow: MAX_PER_WINDOW,
    maxPerDay: MAX_PER_DAY,
  } = THRESHOLDS[accion];
  const now = new Date();
  const hoy = now.toISOString().slice(0, 10);

  const { data: existente } = await supabase
    .from('asesor_rate_limit')
    .select('ventana_inicio, contador_ventana, dia, contador_dia')
    .eq('identificador', identificador)
    .maybeSingle();

  if (!existente) {
    await supabase.from('asesor_rate_limit').insert({
      identificador,
      ventana_inicio: now.toISOString(),
      contador_ventana: 1,
      dia: hoy,
      contador_dia: 1,
      updated_at: now.toISOString(),
    });
    return { limited: false };
  }

  const fila = existente as RateLimitRow;
  let { ventana_inicio: ventanaInicio, contador_ventana: contadorVentana } = fila;
  let { dia, contador_dia: contadorDia } = fila;

  if (dia !== hoy) {
    dia = hoy;
    contadorDia = 0;
  }
  contadorDia += 1;

  const ventanaInicioMs = new Date(ventanaInicio).getTime();
  const dentroDeVentana = now.getTime() - ventanaInicioMs < WINDOW_SECONDS * 1000;
  if (dentroDeVentana) {
    contadorVentana += 1;
  } else {
    ventanaInicio = now.toISOString();
    contadorVentana = 1;
  }

  await supabase
    .from('asesor_rate_limit')
    .update({
      ventana_inicio: ventanaInicio,
      contador_ventana: contadorVentana,
      dia,
      contador_dia: contadorDia,
      updated_at: now.toISOString(),
    })
    .eq('identificador', identificador);

  if (contadorDia > MAX_PER_DAY) {
    return { limited: true, reason: 'dia' };
  }
  if (contadorVentana > MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((ventanaInicioMs + WINDOW_SECONDS * 1000 - now.getTime()) / 1000)
    );
    return { limited: true, reason: 'ventana', retryAfterSeconds };
  }
  return { limited: false };
}
