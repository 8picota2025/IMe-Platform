/**
 * Logging estructurado para Edge Functions.
 * Todos los logs se enviarsn a stdout/stderr con contexto estructurado.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  function?: string;
  fulfillmentId?: string;
  providerId?: string;
  orderId?: string;
  channel?: string;
  attempt?: number;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Crea un logger con contexto persistente.
 * El contexto se incluye en todos los logs posteriores.
 */
export function createLogger(defaultContext: LogContext = {}) {
  const getEntry = (
    level: LogLevel,
    message: string,
    context: LogContext,
    err?: Error
  ): LogEntry => ({
    timestamp: new Date().toISOString(),
    level,
    message,
    context: { ...defaultContext, ...context },
    ...(err && {
      error: {
        name: err.name,
        message: err.message,
        stack: Deno.env.get('SUPABASE_ENV') === 'prod' ? undefined : err.stack,
      },
    }),
  });

  const log = (entry: LogEntry) => {
    const output = JSON.stringify(entry);
    if (entry.level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  };

  return {
    debug: (message: string, context: LogContext = {}) => {
      if (Deno.env.get('LOG_LEVEL') === 'debug') {
        log(getEntry('debug', message, context));
      }
    },
    info: (message: string, context: LogContext = {}) => {
      log(getEntry('info', message, context));
    },
    warn: (message: string, context: LogContext = {}) => {
      log(getEntry('warn', message, context));
    },
    error: (message: string, err?: Error, context: LogContext = {}) => {
      log(getEntry('error', message, context, err));
    },
  };
}

/**
 * Genera un requestId único para rastrear una solicitud a través de logs.
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
