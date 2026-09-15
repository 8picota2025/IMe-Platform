# IMEIA Ayuda — ruta, fallos y verificación local

Widget **IMEIA Ayuda** (`src/components/Asesor.astro`) → cliente `src/lib/asesor.ts` → Edge Function `asesor` → **Grok (xAI)** `https://api.x.ai/v1/chat/completions` con el **mismo rol comercial que WhatsApp Business**.

Hermes / skills locales en `/home/shoky/IMEIA` **no están en este repo**. **No se usa el SOUL del agente `imeia`**: responde mal. El redactor es Grok; el catálogo publicado solo aporta grounding. Sin `XAI_API_KEY` (ni `IMEIA_API_URL` apuntando a `api.x.ai`) la Edge Function degrada a `composeGroundedAsesorReply`.

## Número WhatsApp Business

Oficial en uso (WhatsApp Web I-ME): **+57 313 724 7353** → `https://wa.me/573137247353`.

Constante: `src/lib/contacto-oficial.ts`. El `+57 310 333 2607` es histórico y no debe usarse en handoff.

## Ruta de una pregunta

```
Usuario (Asesor.astro)
  → Turnstile (si PUBLIC_TURNSTILE_SITE_KEY)
  → preguntarAsesor()
       ├─ localhost + PUBLIC_OLLAMA_URL     → Ollama + Supabase (dev)
       ├─ host no-prod + PUBLIC_IMEIA_API_URL → gateway directo (JSON)
       └─ producción i-me.com.co            → supabase.functions.invoke('asesor')
            1. CORS + validación
            2. Turnstile (falla cerrado)
            3. Rate-limit IP + sesión
            4. Contacto/legal estático (sin LLM) + handoff WhatsApp si es contacto
            5. Contexto canónico + catálogo / shortlist sticky
            6. Si hay XAI_API_KEY (o IMEIA_API_URL = api.x.ai) → Grok grok-4
               + system prompt = rol WhatsApp IMEIA
               Si no → composeGroundedAsesorReply (sin SOUL)
            7. Tarjetas desde slugs de catálogo + URLs en el texto
            8. accion_handoff: texto o intención del usuario
            9. 503 solo si falla el compose/LLM ya intentado; el cliente tiene fallback
```

`accion_handoff` en el widget:

- `whatsapp` → `wa.me/573137247353?text=` + resumen (y linkifica la palabra WhatsApp).
- `cotizacion` → `/es/contacto/` o `/en/contact/` con hash `asesor_resumen`.

## Modos de fallo observados (no se asume un único root cause)

| Síntoma                  | Causa en esta fachada                                  | Qué ve el usuario                                           |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------------- |
| Sigue el listado de SKUs | falta `XAI_API_KEY` → compose de catálogo              | mismas plantillas de antes + CTA WhatsApp                   |
| Timeout ~110s            | xAI / túnel lento                                      | 503 → fallback catálogo o CTA WhatsApp                      |
| `IMEIA sin contenido`    | `choices[0].message.content` vacío                     | igual                                                       |
| `IMEIA HTTP 4xx/5xx`     | URL/key, 401 xAI, modelo inválido                      | igual                                                       |
| RAG vacío                | sin `product_slug` y keyword score &lt; 90             | Grok responde sin grounding; prompt prohíbe inventar SKU/RS |
| Respuesta floja / soul   | Se llamaba `model: imeia` (SOUL.md de Hermes)          | ya no se llama; Grok o compose                              |
| CTA ausente              | handoff solo si el texto decía "WhatsApp"/"cotización" | ahora también dispara por precio, RS-SKU, financiación      |
| Contacto sin botón       | intercepto estático con `accion_handoff: null`         | contacto adjunta handoff WhatsApp                           |
| 403 / verificación       | Turnstile inválido o bloqueado                         | reintentar / desbloquear                                    |
| 429                      | 8/min o 60/día por IP o sesión                         | mensaje de límite                                           |
| 503 `NOT_CONFIGURED`     | falta `TURNSTILE_SECRET_KEY`                           | no gasta LLM                                                |

Turnstile y rate-limit **no se relajan** en este cambio.

## Variables tocadas (nombres; no commitear valores)

| Variable                               | Dónde                | Uso                                               |
| -------------------------------------- | -------------------- | ------------------------------------------------- |
| `XAI_API_KEY`                          | secret Edge Function | Bearer de xAI (preferido para IMEIA web)          |
| `XAI_API_URL`                          | secret Edge Function | Default `https://api.x.ai`                        |
| `IMEIA_API_URL`                        | secret Edge Function | Si es `https://api.x.ai`, se trata como Grok      |
| `IMEIA_API_KEY`                        | secret Edge Function | Bearer del gateway (xAI o OpenAI-compat)          |
| `IMEIA_CHAT_MODEL`                     | secret Edge Function | En xAI default `grok-4`. **Prohibido `imeia`**    |
| `PUBLIC_IMEIA_CHAT_MODEL`              | build Astro          | Solo si hay gateway directo en staging            |
| `PUBLIC_IMEIA_API_URL`                 | build Astro          | Solo local/staging; prod usa la Edge Function     |
| `PUBLIC_FORCE_DIRECT_IMEIA_IN_BROWSER` | build                | `1` fuerza gateway directo también en i-me.com.co |
| `TURNSTILE_SECRET_KEY`                 | Edge                 | Verificación server-side                          |
| `PUBLIC_TURNSTILE_SITE_KEY`            | widget               | Challenge                                         |
| `ASESOR_RATE_LIMIT_VENTANA_SEGUNDOS`   | Edge                 | default 60                                        |
| `ASESOR_RATE_LIMIT_MAX_VENTANA`        | Edge                 | default 8                                         |
| `ASESOR_RATE_LIMIT_MAX_DIA`            | Edge                 | default 60                                        |
| `PUBLIC_OLLAMA_URL`                    | cliente              | Dev local, no producción                          |

## Cómo probar en local

### 1. Evals / unitarios (sin secretos)

```bash
npx vitest run src/lib/asesor-evals.test.ts src/lib/asesor.test.ts src/lib/asesor-knowledge.test.ts
```

### 2. Edge Function + Grok

```bash
# supabase/.env.local — no commitear
XAI_API_KEY=xai-...
XAI_API_URL=https://api.x.ai
IMEIA_CHAT_MODEL=grok-4
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY para rate-limit y catálogo
```

```bash
supabase functions serve asesor --no-verify-jwt --env-file supabase/.env.local
```

```bash
# Contacto: estático + accion_handoff.whatsapp (no llama a Grok)
curl -sS http://127.0.0.1:54321/functions/v1/asesor \
  -H 'Content-Type: application/json' \
  -d '{"mensaje":"¿Cuál es su WhatsApp?","locale":"es","sessionId":"dev-local","turnstileToken":"XXXX.DUMMY.TOKEN"}'

# Precio: Grok con rol WhatsApp; accion_handoff cotizacion; sin precio inventado
curl -sS http://127.0.0.1:54321/functions/v1/asesor \
  -H 'Content-Type: application/json' \
  -d '{"mensaje":"¿Cuánto cuesta una bomba de infusión volumétrica?","locale":"es","sessionId":"dev-local","turnstileToken":"XXXX.DUMMY.TOKEN"}'

# RS por SKU: handoff whatsapp; el texto no debe inventar un RS
curl -sS http://127.0.0.1:54321/functions/v1/asesor \
  -H 'Content-Type: application/json' \
  -d '{"mensaje":"¿Cuál es el registro sanitario INVIMA del monitor M12?","locale":"es","sessionId":"dev-local","turnstileToken":"XXXX.DUMMY.TOKEN"}'
```

Comprobar JSON: `accion_handoff.tipo`, que `texto` no contenga un RS inventado, y que cualquier `wa.me` sea `573137247353`.

### 3. Widget

En `http://localhost:44334/es/` abrir **IMEIA Ayuda**. Debe sonar a conversación (no a listado de 4 SKUs). El CTA abre WhatsApp al 313 724 7353. Sin `XAI_API_KEY`, el fallback de catálogo / WhatsApp sigue activo.
