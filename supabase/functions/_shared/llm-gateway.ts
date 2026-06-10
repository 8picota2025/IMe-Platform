/**
 * Interface mínima LLM Gateway — swappable entre Claude/OpenAI.
 * Implementación real en F3/Fase Asesor.
 *
 * BLOQUEANTE_BACKEND: No implementar hasta Fase Asesor.
 * TODO_CLIENTE: LLM_PROVIDER, ANTHROPIC_API_KEY o OPENAI_API_KEY en env Supabase.
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

/**
 * Interfaz LLM swappable.
 * Implementar en Fase Asesor: AnthropicGateway y OpenAIGateway.
 */
export interface LlmGateway {
  readonly provider: LlmProvider
  chat(request: LlmRequest): Promise<LlmResponse>
  embed(text: string | string[]): Promise<number[][]>
}
