# IMEIA Ayuda — ruta y operación

Widget (`Asesor.astro`) → `src/lib/asesor.ts` → Edge Function `asesor` → fila `asesor_agent_turns` → webhook routine IMEIA/Grok → fila `replied` → widget.

Hermes, `IMEIA_API_*`, `IMEIA_CHAT_MODEL` y el navegador directo no forman parte del flujo web.

El cliente **no** mantiene una sola petición HTTP de 2 minutos (móviles y middleboxes la cortan):

1. `POST asesor` con mensaje (sin token Turnstile por defecto) → edge crea turno, despierta routine y responde `{ status: "pending", turn_id }` en ~1 s.
2. Cliente hace poll cada 2 s: `POST asesor` con `{ turnId, sessionId }` (sin Turnstile ni rate-limit de mensaje).
3. Cuando routine escribe `replied`, el poll devuelve texto + tarjetas.

Tope de espera del widget: ~150 s en peticiones cortas (~30 s timeout c/u).

## Secuencia

1. Edge valida mensaje, historial y rate-limit IP/sesión. Turnstile del chat está **apagado por defecto**.
2. Preguntas de sitio, legales o contacto usan fallback estático sin llamar agente.
3. Pregunta comercial crea turno `pending` con contexto de navegación e historial validados.
4. Edge envía wake autenticado a routine y **devuelve `turn_id` de inmediato**.
5. Routine escribe `reply_texto` y transición `pending → replied` con service role.
6. Poll del cliente recibe texto, genera tarjetas solo desde enlaces I-ME existentes y cierra el turno en UI.
7. Wake fallido → HTTP 503 `AGENT_UNAVAILABLE`. Poll que ve `timeout`/`failed` → 504/503. El widget muestra reintento + WhatsApp; nunca shortlist de catálogo ni copy consultiva.

## Secretos y despliegue

Edge necesita:

- `IMEIA_WEB_AGENT_WEBHOOK_URL`
- `IMEIA_WEB_AGENT_WEBHOOK_KEY`
- `TURNSTILE_SECRET_KEY` — solo si se reactiva Turnstile (`ASESOR_TURNSTILE_REQUIRED=true`)

Workflow despliega secretos de GitHub con mismos nombres. Configurar routine y permisos service-role según [imeia-web-agent-routine.md](./imeia-web-agent-routine.md). Migración `20260915190000_asesor_agent_turns.sql` debe aplicar antes de función.

## Prueba manual

1. En widget enviar consulta de catálogo; revisar nuevo turno `pending` y wake con `source=web-asesor`.
2. Routine escribe respuesta con enlace I-ME. Confirmar `replied`, texto, tarjetas, enlace y `accion_handoff`.
3. Ver logs de `asesor`: no debe existir fetch a Hermes ni `/v1/chat/completions`.
4. Omitir respuesta de routine: tras ~110 s comprobar fila `timeout` y que el widget muestre error honesto (reintento + WhatsApp), no shortlist de catálogo.

Rate-limit IP/sesión sigue activo. No incluir valores secretos en archivos ni logs.

## Turnstile (web chat) — desactivado por defecto

Decisión de producto (2026-09-17, Shoky): el checkbox de Cloudflare bloqueaba visitas reales en i-me.com.co (widget ausente, recuadro gris, 403 `siteverify` / `missing_token`) mientras el agente a veces sí contestaba en `asesor_agent_turns`. El chat IMEIA **ya no exige Turnstile**.

**Default (producción):**

- Cliente: no pinta widget, no espera token, envía el mensaje al Edge.
- Edge: no llama a `siteverify`; acepta el POST sin `turnstileToken`.
- Sigue el rate-limit (`asesor_rate_limit`): 8 mensajes / 60 s y 60 / día por IP y por sesión (ajustable con `ASESOR_RATE_LIMIT_*`).
- Formularios de evento, leads y propuesta de artículo **no** cambian: siguen usando Turnstile.

**Reactivar más adelante** (ambos lados; si falta uno, el chat vuelve a fallar):

1. Build estático: `PUBLIC_ASESOR_TURNSTILE=true` (GitHub Actions / `.env`). Eso pinta de nuevo el checkbox y espera token. Sigue haciendo falta `PUBLIC_TURNSTILE_SITE_KEY`.
2. Edge: secreto `ASESOR_TURNSTILE_REQUIRED=true`. Eso vuelve a exigir `siteverify`.
3. Emergency skip aunque REQUIRED esté on: `ASESOR_TURNSTILE_BYPASS=true`.

Si se reactiva, el widget usa `appearance: always`, `size` `normal` (≥300px) o `compact`, script `render=explicit`. Edge verifica con timeout de 8 s; fallo → 403 `FORBIDDEN` con `details.reason` / `errorCodes` (`missing_token`, `siteverify_timeout`, …) **sin** despertar el agente.

**Errores en UI:** el widget ya no muestra solo «No pudimos procesar tu mensaje» / «security check». `copyForAsesorError` elige una clave i18n que nombra la clase: `AGENT_TIMEOUT`, `AGENT_UNAVAILABLE`, `POLL_TIMEOUT`, `INVOKE_ABORT`, `INVOKE_TIMEOUT`, `MISSING_TOKEN`, `SITEVERIFY_TIMEOUT`, `FORBIDDEN`, `NOT_CONFIGURED`, `TURNSTILE_CLIENT`, `SESSION_FORBIDDEN`, `SUPABASE_MISSING`, `INVALID_PAYLOAD`.

Tras merge + deploy (sitio estático **y** Edge `asesor`):

1. Abrir https://i-me.com.co en móvil y desktop (Android Chrome incluido). **No** debe aparecer casilla ni recuadro gris de Cloudflare entre los mensajes y el campo de envío.
2. Enviar «Holters please» / «Tienes mamógrafos?». Debe crearse fila `asesor_agent_turns` y una respuesta IMEIA, o el error honesto de agente (`AGENT_UNAVAILABLE` / `AGENT_TIMEOUT` / `INVOKE_ABORT`) — nunca shortlist de catálogo ni `keyword_degradado`.
3. Si algo falla, el globo debe incluir el nombre de la clase (p. ej. `INVOKE_ABORT`), no solo `asesor.error` / `asesor.verificacion`.

Evidencia previa (2026-09-17, Android Chrome, https://i-me.com.co/es/): recuadro gris + fallo de envío — `docs/qa/imeia-turnstile-mobile-android-2026-09-17.jpg`. Ese síntoma es el motivo de apagar Turnstile en el chat.
