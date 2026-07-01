/**
 * Gateway LLM para ingesta PDF y Asesor RAG.
 * Claves solo en Edge Functions.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createEmbedder, type EmbedResult } from './embeddings.ts';

export type LlmProvider = 'anthropic' | 'openai' | 'ollama';

/** Base URL del servidor Ollama local. Ver docs/decisions/0005-ollama-asesor-local.md. */
export const OLLAMA_BASE_URL = Deno.env.get('OLLAMA_BASE_URL') ?? 'http://localhost:11434';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LlmGateway {
  readonly provider: LlmProvider;
  /** Modelo que se usaria en chat() si no se pasa `request.model` explicito. */
  readonly defaultChatModel: string;
  chat(request: LlmRequest): Promise<LlmResponse>;
  embed(texts: string[]): Promise<EmbedResult>;
}

/** Embeddings: proveedor configurado vía EMBEDDING_PROVIDER (independiente de LLM_PROVIDER). */
async function embedTexts(texts: string[]): Promise<EmbedResult> {
  return createEmbedder().embed(texts);
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

export function createLlmGateway(): LlmGateway {
  const provider = (Deno.env.get('LLM_PROVIDER') ?? 'anthropic') as LlmProvider;
  if (provider === 'openai') return new OpenAiGateway();
  if (provider === 'ollama') return new OllamaGateway();
  return new AnthropicGateway();
}

class AnthropicGateway implements LlmGateway {
  readonly provider = 'anthropic' as const;
  readonly defaultChatModel = Deno.env.get('LLM_INGEST_MODEL') ?? 'claude-3-5-sonnet-latest';

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY requerido');

    const model = request.model ?? Deno.env.get('LLM_INGEST_MODEL') ?? 'claude-3-5-sonnet-latest';
    const system = request.messages.find(message => message.role === 'system')?.content ?? '';
    const messages = request.messages
      .filter(message => message.role !== 'system')
      .map(message => ({ role: message.role, content: message.content }));

    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system,
        messages,
        max_tokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);

    const json = (await res.json()) as AnthropicResponse;
    const content =
      json.content
        ?.map(block => (block.type === 'text' ? (block.text ?? '') : ''))
        .join('')
        .trim() ?? '';

    return {
      content,
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
      model: json.model ?? model,
    };
  }

  embed(texts: string[]): Promise<EmbedResult> {
    return embedTexts(texts);
  }
}

class OpenAiGateway implements LlmGateway {
  readonly provider = 'openai' as const;
  readonly defaultChatModel = Deno.env.get('LLM_INGEST_MODEL') ?? 'gpt-4.1-mini';

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY requerido');

    const model = request.model ?? Deno.env.get('LLM_INGEST_MODEL') ?? 'gpt-4.1-mini';
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        max_tokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);

    const json = (await res.json()) as OpenAiResponse;
    return {
      content: json.choices?.[0]?.message?.content?.trim() ?? '',
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      model: json.model ?? model,
    };
  }

  embed(texts: string[]): Promise<EmbedResult> {
    return embedTexts(texts);
  }
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  model?: string;
}

/** Proveedor local autoalojado (sin API key). Ver docs/decisions/0005-ollama-asesor-local.md. */
class OllamaGateway implements LlmGateway {
  readonly provider = 'ollama' as const;
  readonly defaultChatModel = Deno.env.get('LLM_INGEST_MODEL') ?? 'qwen3:8b';

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model ?? Deno.env.get('LLM_INGEST_MODEL') ?? 'qwen3:8b';

    const res = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0,
          num_predict: request.maxTokens ?? 4000,
        },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);

    const json = (await res.json()) as OllamaChatResponse;
    return {
      content: json.message?.content?.trim() ?? '',
      inputTokens: json.prompt_eval_count ?? 0,
      outputTokens: json.eval_count ?? 0,
      model: json.model ?? model,
    };
  }

  embed(texts: string[]): Promise<EmbedResult> {
    return embedTexts(texts);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = Number(Deno.env.get('LLM_TIMEOUT_MS') ?? 45000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────
// Coste y presupuesto (llm_uso / BUDGET_MENSUAL_USD)
// ────────────────────────────────────────────────────────────

export type TipoUsoLlm = 'chat' | 'ingesta' | 'embedding';

/**
 * USD por 1M tokens (input/output). Valores de referencia — verificar
 * periodicamente contra la consola de cada proveedor (cambian con el tiempo).
 * 'default' se usa para modelos no listados (estimacion conservadora).
 */
const PRICING_USD_POR_1M: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-3-5-sonnet-latest': { input: 3, output: 15 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'voyage-3': { input: 0.06, output: 0 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  default: { input: 3, output: 15 },
};

/** Periodo actual en formato YYYY-MM (UTC), usado como clave en llm_uso/asesor_uso. */
export function periodoActual(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Estima el coste en USD de una llamada LLM/embedding según tokens y modelo.
 * `provider: 'ollama'` siempre cuesta 0 (autoalojado, sin facturación por token).
 */
export function estimateCost(params: {
  model: string;
  provider?: string;
  inputTokens: number;
  outputTokens?: number;
}): number {
  if (params.provider === 'ollama') return 0;

  const pricing = PRICING_USD_POR_1M[params.model] ?? PRICING_USD_POR_1M['default']!;
  const inputCost = (params.inputTokens / 1_000_000) * pricing.input;
  const outputCost = ((params.outputTokens ?? 0) / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

export interface ReservaPresupuesto {
  /** true si la reserva se registro y hay presupuesto disponible para el coste estimado. */
  disponible: boolean;
  /** id de la fila reservada en llm_uso; usar con confirmarUsoLlm() tras la llamada real. */
  reservaId: string | null;
  /** coste pesimista reservado (tokens de entrada aproximados + tope de salida). */
  estimado: number;
  gastado: number;
  limite: number;
  periodo: string;
}

/**
 * Reserva presupuesto de forma atomica antes de llamar a un proveedor LLM/embedding.
 *
 * Reemplaza el patron previo (enforceBudget + registrarUsoLlm por separado), que
 * tenia una condicion de carrera: dos solicitudes concurrentes cerca del limite
 * podian leer el mismo gasto acumulado antes de que cualquiera insertara su fila,
 * dejando pasar a ambas juntas por encima de BUDGET_MENSUAL_USD (hallazgo de la
 * auditoria del Asesor). El RPC `reservar_presupuesto_llm` serializa la
 * comprobacion+insercion con un advisory lock por periodo.
 *
 * El coste real de la llamada aun no se conoce (depende de tokens de salida),
 * asi que se reserva un estimado pesimista (approxInputChars/4 + maxOutputTokens
 * al precio del modelo). Tras la llamada real, usar confirmarUsoLlm() para
 * ajustar la fila reservada con el coste real (normalmente menor al estimado).
 */
export async function reservarPresupuesto(
  supabase: SupabaseClient,
  reserva: {
    proveedor: string;
    modelo: string;
    tipo: TipoUsoLlm;
    approxInputChars: number;
    maxOutputTokens?: number;
    sessionId?: string | null;
  }
): Promise<ReservaPresupuesto> {
  const limite = Number(Deno.env.get('BUDGET_MENSUAL_USD') ?? '50');
  const periodo = periodoActual();
  const inputTokensEstimados = Math.ceil(reserva.approxInputChars / 4);
  const estimado = estimateCost({
    model: reserva.modelo,
    provider: reserva.proveedor,
    inputTokens: inputTokensEstimados,
    outputTokens: reserva.maxOutputTokens ?? 0,
  });

  const { data, error } = await supabase.rpc('reservar_presupuesto_llm', {
    p_periodo: periodo,
    p_limite: limite,
    p_estimado: estimado,
    p_proveedor: reserva.proveedor,
    p_modelo: reserva.modelo,
    p_tipo: reserva.tipo,
    p_session_id: reserva.sessionId ?? null,
  });
  if (error) throw new Error(`reservarPresupuesto: ${error.message}`);

  const fila = ((data ?? [])[0] ?? null) as {
    id: string | null;
    disponible: boolean;
    gastado: number | string | null;
  } | null;

  return {
    disponible: fila?.disponible ?? false,
    reservaId: fila?.id ?? null,
    estimado,
    gastado: Number(fila?.gastado ?? 0),
    limite,
    periodo,
  };
}

/**
 * Ajusta una reserva previa (ver reservarPresupuesto) con el coste real tras la
 * respuesta del proveedor. Devuelve el coste real registrado.
 */
export async function confirmarUsoLlm(
  supabase: SupabaseClient,
  ajuste: {
    reservaId: string;
    proveedor: string;
    modelo: string;
    inputTokens: number;
    outputTokens?: number;
  }
): Promise<number> {
  const coste = estimateCost({
    model: ajuste.modelo,
    provider: ajuste.proveedor,
    inputTokens: ajuste.inputTokens,
    outputTokens: ajuste.outputTokens ?? 0,
  });

  const { error } = await supabase
    .from('llm_uso')
    .update({
      modelo: ajuste.modelo,
      input_tokens: ajuste.inputTokens,
      output_tokens: ajuste.outputTokens ?? 0,
      coste_estimado: coste,
    })
    .eq('id', ajuste.reservaId);
  if (error) throw new Error(`confirmarUsoLlm: ${error.message}`);

  return coste;
}
