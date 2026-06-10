/**
 * Edge Function: asesor
 * Estado: STUB — implementar en Fase Asesor
 *
 * PENDIENTE (Fase Asesor):
 * - Integrar RAG con embeddings Voyage voyage-3
 * - Conectar con LlmGateway (Claude/OpenAI swappable)
 * - Historial de conversación por sesión
 * - Guardar asesor_uso para auditoría de presupuesto LLM
 *
 * REGLAS:
 * - Asesor comercial puro — prohibido diagnóstico, consejo clínico, precio comprometido
 * - Presupuesto LLM: $50 USD/mes máximo (configurable en BUDGET_MENSUAL_USD)
 */

import { handleCors } from '../_shared/cors.ts'
import { badRequest } from '../_shared/errors.ts'

Deno.serve(async (req) => {
  const corsRes = handleCors(req)
  if (corsRes) return corsRes

  // STUB — respuesta mock hasta Fase Asesor
  return badRequest(
    'BLOQUEANTE_BACKEND: Asesor real implementado en Fase Asesor. Usa src/lib/asesor.ts (mock) en F1.',
    req.headers.get('origin')
  )
})
