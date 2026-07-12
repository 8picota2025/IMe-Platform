/**
 * Telemetría para Edge Functions.
 *
 * Extiende `logging.ts` (NO lo reemplaza): sigue usando `createLogger` para
 * stdout/stderr estructurado (Supabase Edge Logs), y además:
 *   - `withTelemetry(fnName, handler)`: envuelve el handler de Deno.serve,
 *     mide la duración con `performance.now()` y registra un evento por
 *     petición en `eventos_sistema` (tabla creada en
 *     supabase/migrations/20260712000000_eventos_sistema.sql).
 *   - `trackEvent(fn, evento, detalle?)`: eventos de negocio puntuales
 *     (ej. 'cotizacion_registrada', 'pago_confirmado', 'factura_emitida',
 *     'webhook_rechazado').
 *
 * REGLA CRÍTICA: un fallo de telemetría (insert a eventos_sistema, o
 * inicialización/captura de Sentry) JAMÁS debe romper la petición ni
 * bloquear el camino crítico. Los inserts son "fire-and-forget": se
 * invocan sin `await` en los puntos calientes (webhooks de pago).
 *
 * Sentry (opcional, gateado por env var): si `SENTRY_DSN` no está
 * configurado, todo funciona igual sin Sentry — no se intenta importar
 * ni inicializar nada.
 */

import { createLogger, generateRequestId, type LogContext } from './logging.ts';
import { getServerSupabase } from './supabase-server.ts';
import { getCorsHeaders } from './cors.ts';

type Handler = (req: Request) => Response | Promise<Response>;

type NivelEvento = 'debug' | 'info' | 'warn' | 'error';

/** Interfaz mínima usada de @sentry/deno — evitamos depender de sus tipos reales. */
interface MinimalSentryClient {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: Record<string, unknown>) => void;
  flush?: (timeout?: number) => Promise<boolean>;
}

let sentryClientPromise: Promise<MinimalSentryClient | null> | null = null;

/**
 * Inicializa @sentry/deno una única vez por instancia de función, solo si
 * `SENTRY_DSN` está presente. Guía: https://supabase.com/docs/guides/functions/examples/sentry-monitoring
 */
function getSentryClient(): Promise<MinimalSentryClient | null> {
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return Promise.resolve(null);

  if (!sentryClientPromise) {
    sentryClientPromise = (async () => {
      try {
        const mod = (await import('npm:@sentry/deno')) as unknown as MinimalSentryClient;
        mod.init({
          dsn,
          defaultIntegrations: false,
          environment: Deno.env.get('SUPABASE_ENV') ?? 'development',
          tracesSampleRate: 0,
        });
        return mod;
      } catch (err) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: 'telemetry: no se pudo inicializar @sentry/deno',
            error: err instanceof Error ? err.message : String(err),
          })
        );
        return null;
      }
    })();
  }

  return sentryClientPromise;
}

/**
 * Envía la excepción a Sentry si está configurado. Nunca lanza: cualquier
 * fallo de Sentry queda solo en logs, nunca afecta la respuesta al cliente.
 */
async function reportToSentry(
  fnName: string,
  error: Error,
  context: Record<string, unknown>
): Promise<void> {
  try {
    const sentry = await getSentryClient();
    sentry?.captureException(error, { tags: { fn: fnName }, extra: context });
    await sentry?.flush?.(1500);
  } catch {
    // Sentry nunca debe romper la petición.
  }
}

/**
 * Insert fire-and-forget en `eventos_sistema`. Nunca lanza: un fallo aquí
 * solo se refleja en logs (stdout), jamás en la respuesta HTTP.
 *
 * No hacer `await trackEvent(...)` en el camino crítico de un webhook de
 * pago — invocar sin await cuando la latencia de la respuesta importa.
 */
export async function trackEvent(
  fn: string,
  evento: string,
  detalle?: Record<string, unknown>,
  opts?: { nivel?: NivelEvento; requestId?: string; duracionMs?: number }
): Promise<void> {
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from('eventos_sistema').insert({
      fn,
      nivel: opts?.nivel ?? 'info',
      evento,
      request_id: opts?.requestId ?? null,
      duracion_ms: opts?.duracionMs ?? null,
      detalle: detalle ?? null,
    });
    if (error) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'telemetry: fallo insertando en eventos_sistema',
          fn,
          evento,
          error: error.message,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'telemetry: excepción insertando en eventos_sistema',
        fn,
        evento,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

/**
 * Envuelve el handler de `Deno.serve` de una Edge Function con:
 *   - logging estructurado (via `createLogger` de logging.ts)
 *   - medición de duración (`performance.now()`)
 *   - un evento `request_completada` por petición en `eventos_sistema`
 *   - captura de excepciones no controladas (log + Sentry si está
 *     configurado) devolviendo un 500 JSON en vez de dejar caer la función
 *
 * Uso: `Deno.serve(withTelemetry('nombre-funcion', async (req) => { ... }));`
 */
export function withTelemetry(fnName: string, handler: Handler): Handler {
  return async (req: Request): Promise<Response> => {
    const requestId = generateRequestId();
    const context: LogContext = { function: fnName, requestId };
    const logger = createLogger(context);
    const start = performance.now();

    let response: Response;
    let caughtError: Error | undefined;

    try {
      response = await handler(req);
    } catch (err) {
      caughtError = err instanceof Error ? err : new Error(String(err));
      logger.error(`${fnName}: error no controlado`, caughtError, context);

      void reportToSentry(fnName, caughtError, { requestId });

      response = new Response(
        JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(req.headers.get('origin')),
          },
        }
      );
    }

    const duracionMs = Math.round(performance.now() - start);
    const nivel: NivelEvento = caughtError
      ? 'error'
      : response.status >= 500
        ? 'error'
        : response.status >= 400
          ? 'warn'
          : 'info';

    const logCtx = { ...context, duracionMs, status: response.status };
    if (nivel === 'error') {
      logger.error(`${fnName}: completado con error`, caughtError, logCtx);
    } else if (nivel === 'warn') {
      logger.warn(`${fnName}: completado`, logCtx);
    } else {
      logger.info(`${fnName}: completado`, logCtx);
    }

    // Fire-and-forget: nunca bloquear la respuesta por la telemetría.
    void trackEvent(
      fnName,
      'request_completada',
      { status: response.status },
      { nivel, requestId, duracionMs }
    );

    return response;
  };
}
