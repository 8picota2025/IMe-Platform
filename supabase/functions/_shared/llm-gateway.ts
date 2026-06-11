/**
 * Gateway LLM minimo para ingesta PDF.
 * Claves solo en Edge Functions.
 */

export type LlmProvider = 'anthropic' | 'openai'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  messages: LlmMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface LlmResponse {
  content: string
  inputTokens: number
  outputTokens: number
  model: string
}

export interface LlmGateway {
  readonly provider: LlmProvider
  chat(request: LlmRequest): Promise<LlmResponse>
  embed(text: string | string[]): Promise<number[][]>
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
  model?: string
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  model?: string
}

export function createLlmGateway(): LlmGateway {
  const provider = (Deno.env.get('LLM_PROVIDER') ?? 'anthropic') as LlmProvider
  if (provider === 'openai') return new OpenAiGateway()
  return new AnthropicGateway()
}

class AnthropicGateway implements LlmGateway {
  readonly provider = 'anthropic' as const

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY requerido')

    const model = request.model ?? Deno.env.get('LLM_INGEST_MODEL') ?? 'claude-3-5-sonnet-latest'
    const system = request.messages.find((message) => message.role === 'system')?.content ?? ''
    const messages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role, content: message.content }))

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
    })
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`)

    const json = (await res.json()) as AnthropicResponse
    const content =
      json.content
        ?.map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
        .join('')
        .trim() ?? ''

    return {
      content,
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
      model: json.model ?? model,
    }
  }

  embed(_text: string | string[]): Promise<number[][]> {
    throw new Error('Embeddings se implementan en Fase Asesor')
  }
}

class OpenAiGateway implements LlmGateway {
  readonly provider = 'openai' as const

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY requerido')

    const model = request.model ?? Deno.env.get('LLM_INGEST_MODEL') ?? 'gpt-4.1-mini'
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
    })
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`)

    const json = (await res.json()) as OpenAiResponse
    return {
      content: json.choices?.[0]?.message?.content?.trim() ?? '',
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
      model: json.model ?? model,
    }
  }

  embed(_text: string | string[]): Promise<number[][]> {
    throw new Error('Embeddings se implementan en Fase Asesor')
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = Number(Deno.env.get('LLM_TIMEOUT_MS') ?? 45000)
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
