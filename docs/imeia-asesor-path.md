# IMEIA Ayuda — ruta y operación

Widget (`Asesor.astro`) → `src/lib/asesor.ts` → Edge Function `asesor` → fila `asesor_agent_turns` → webhook routine IMEIA/Grok → fila `replied` → widget.

Hermes, `IMEIA_API_*`, `IMEIA_CHAT_MODEL` y el navegador directo no forman parte del flujo web. El cliente espera hasta 120 s solo para `functions/v1/asesor`; resto de llamadas Supabase conserva timeout normal.

## Secuencia

1. Edge valida mensaje, historial, Turnstile y rate-limit IP/sesión.
2. Preguntas de sitio, legales o contacto usan fallback estático sin llamar agente.
3. Pregunta comercial crea turno `pending` con contexto de navegación e historial validados.
4. Edge envía wake autenticado a routine y consulta fila cada segundo durante máximo 110 s.
5. Routine escribe `reply_texto` y transición `pending → replied` con service role.
6. Edge genera tarjetas solo desde enlaces I-ME existentes en respuesta y devuelve contrato actual.
7. Wake fallido marca `failed` y responde HTTP 503 `AGENT_UNAVAILABLE`. Vencimiento marca `timeout` y responde HTTP 504 `AGENT_TIMEOUT`. El widget muestra reintento + WhatsApp; nunca shortlist de catálogo ni copy consultiva.

## Secretos y despliegue

Edge necesita:

- `IMEIA_WEB_AGENT_WEBHOOK_URL`
- `IMEIA_WEB_AGENT_WEBHOOK_KEY`
- `TURNSTILE_SECRET_KEY`

Workflow despliega secretos de GitHub con mismos nombres. Configurar routine y permisos service-role según [imeia-web-agent-routine.md](./imeia-web-agent-routine.md). Migración `20260915190000_asesor_agent_turns.sql` debe aplicar antes de función.

## Prueba manual

1. En widget enviar consulta de catálogo; revisar nuevo turno `pending` y wake con `source=web-asesor`.
2. Routine escribe respuesta con enlace I-ME. Confirmar `replied`, texto, tarjetas, enlace y `accion_handoff`.
3. Ver logs de `asesor`: no debe existir fetch a Hermes ni `/v1/chat/completions`.
4. Omitir respuesta de routine: tras ~110 s comprobar fila `timeout` y que el widget muestre error honesto (reintento + WhatsApp), no shortlist de catálogo.

Turnstile y rate-limit siguen fail-closed. No incluir valores secretos en archivos ni logs.
