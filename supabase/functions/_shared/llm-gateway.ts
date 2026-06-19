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

/** Registra el uso/coste de una llamada LLM o embedding en llm_uso. Devuelve el coste estimado. */
export async function registrarUsoLlm(
  supabase: SupabaseClient,
  uso: {
    proveedor: string;
    modelo: string;
    tipo: TipoUsoLlm;
    inputTokens: number;
    outputTokens?: number;
    sessionId?: string | null;
  }
): Promise<number> {
  const coste = estimateCost({
    model: uso.modelo,
    provider: uso.proveedor,
    inputTokens: uso.inputTokens,
    outputTokens: uso.outputTokens ?? 0,
  });

  const { error } = await supabase.from('llm_uso').insert({
    periodo_yyyy_mm: periodoActual(),
    proveedor: uso.proveedor,
    modelo: uso.modelo,
    tipo: uso.tipo,
    input_tokens: uso.inputTokens,
    output_tokens: uso.outputTokens ?? 0,
    coste_estimado: coste,
    session_id: uso.sessionId ?? null,
  });
  if (error) throw new Error(`registrarUsoLlm: ${error.message}`);

  return coste;
}

export interface EstadoPresupuesto {
  disponible: boolean;
  gastado: number;
  limite: number;
  periodo: string;
}

/** Comprueba el gasto del periodo actual contra BUDGET_MENSUAL_USD. */
export async function enforceBudget(supabase: SupabaseClient): Promise<EstadoPresupuesto> {
  const limite = Number(Deno.env.get('BUDGET_MENSUAL_USD') ?? '50');
  const periodo = periodoActual();

  const { data, error } = await supabase
    .from('llm_uso')
    .select('coste_estimado')
    .eq('periodo_yyyy_mm', periodo);
  if (error) throw new Error(`enforceBudget: ${error.message}`);

  const gastado = (data ?? []).reduce(
    (acc: number, row: { coste_estimado: number | string | null }) =>
      acc + Number(row.coste_estimado ?? 0),
    0
  );

  return { disponible: gastado < limite, gastado, limite, periodo };
}
