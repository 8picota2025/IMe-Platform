/**
 * Estrategia de reintentos con exponential backoff configurable.
 * Soporta diferentes configuraciones por canal.
 */

import type { LogContext } from './logging.ts';
import { createLogger } from './logging.ts';

export interface RetryConfig {
  maxRetries: number; // máximo número de intentos
  initialDelayMs: number; // retraso inicial en ms
  maxDelayMs: number; // retraso máximo en ms
  backoffMultiplier: number; // multiplicador para exponential backoff
  jitterMs?: number; // jitter aleatorio en ms para evitar thundering herd
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 0,
  maxDelayMs: 5000,
  backoffMultiplier: 1.5,
  jitterMs: 100,
};

const CHANNEL_CONFIGS: Record<string, RetryConfig> = {
  webhook: { ...DEFAULT_RETRY_CONFIG, maxRetries: 5, maxDelayMs: 10000 },
  api: { ...DEFAULT_RETRY_CONFIG, maxRetries: 3, maxDelayMs: 5000 },
  email: { ...DEFAULT_RETRY_CONFIG, maxRetries: 2, maxDelayMs: 3000 },
  whatsapp: { ...DEFAULT_RETRY_CONFIG, maxRetries: 1, maxDelayMs: 1000 },
  manual: { ...DEFAULT_RETRY_CONFIG, maxRetries: 0 }, // no reintentos para manual
};

interface RetryResult<T> {
  ok: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  lastError?: string;
  totalDelayMs: number;
}

/**
 * Ejecuta una función con reintentos y exponential backoff.
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  channel: string,
  logContext?: LogContext
): Promise<RetryResult<T>> {
  const config = CHANNEL_CONFIGS[channel] || DEFAULT_RETRY_CONFIG;
  const logger = createLogger();
  let totalDelayMs = 0;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Delay exponencial (excepto en primer intento)
    if (attempt > 0) {
      const delayMs = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );
      const jitterMs = config.jitterMs ? Math.random() * config.jitterMs : 0;
      const totalDelayThisAttempt = delayMs + jitterMs;

      logger.debug(`Esperando antes de reintento`, {
        ...logContext,
        attempt,
        delayMs: Math.round(totalDelayThisAttempt),
        channel,
      });

      await new Promise(resolve => setTimeout(resolve, totalDelayThisAttempt));
      totalDelayMs += totalDelayThisAttempt;
    }

    try {
      logger.debug(`Intento ${attempt + 1}/${config.maxRetries + 1}`, {
        ...logContext,
        attempt,
        channel,
      });

      const result = await fn();
      logger.info(`Éxito en intento ${attempt + 1}`, {
        ...logContext,
        attempt,
        channel,
      });

      return {
        ok: true,
        result,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      logger.warn(`Intento ${attempt + 1} falló`, {
        ...logContext,
        attempt,
        channel,
        error: lastError.message,
      });

      // Si es el último intento, no continuar
      if (attempt === config.maxRetries) {
        logger.error(`Todos los ${config.maxRetries + 1} intentos fallaron`, lastError, {
          ...logContext,
          channel,
          totalDelayMs,
        });

        return {
          ok: false,
          error: lastError,
          attempts: attempt + 1,
          lastError: lastError.message,
          totalDelayMs,
        };
      }
    }
  }

  return {
    ok: false,
    error: lastError,
    attempts: config.maxRetries + 1,
    lastError: lastError?.message,
    totalDelayMs,
  };
}

/**
 * Helper para ejecutar un POST HTTP con reintentos.
 */
export async function postWithRetry(
  url: string,
  payload: unknown,
  headers: Record<string, string>,
  channel: string,
  logContext?: LogContext
): Promise<RetryResult<Response>> {
  return await executeWithRetry(
    async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    channel,
    { ...logContext, url }
  );
}
