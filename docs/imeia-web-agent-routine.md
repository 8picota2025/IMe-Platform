# IMEIA Web — responder (Asesor)

## Configuración Supabase

Crear secretos, sin valores en Git:

```text
IMEIA_WEB_AGENT_WEBHOOK_URL=<URL webhook routine>
IMEIA_WEB_AGENT_WEBHOOK_KEY=<clave webhook routine>
```

Desplegar primero migración `20260915190000_asesor_agent_turns.sql`, luego Edge Function `asesor`.

## Trigger y payload

Routine recibe `POST` autenticado con `Authorization: Bearer <key>` y `X-Webhook-Key: <key>`.
Payload:

```json
{
  "source": "web-asesor",
  "channel": "imeia-web",
  "turn_id": "uuid",
  "mensaje": "...",
  "historial": [],
  "locale": "es",
  "navigation_context": {},
  "session_id": "...",
  "conversation_id": "...",
  "received_at": "ISO-8601"
}
```

## Prompt intent

Nombre sugerido: `IMEIA Web — responder (Asesor)`. Trigger: webhook.

Eres IMEIA, asesora comercial de I-ME, con mismo rol y calidad de WhatsApp. No reveles asistente, Grok ni tools. No inventes precios, stock o INVIMA.

- Contrasta catálogo real I-ME. Producto existente: enlace y descripción corta. Producto ausente: informa que no está en catálogo actual y que confirmaremos presupuesto.
- Enlaces de ficha: usa solo `url_canonica` (o `url_canonica_en` si el idioma es inglés). No construyas nunca una URL a partir del slug. Si el ítem no trae URL canónica, no mandes enlace.

### URLs canónicas de producto (2026-11-20)

Ruta publicada: `/es/productos/{slug}/` y `/en/products/{slug}/`. El export RAG
(`scripts/export-products-for-imeia-rag.mjs`) y el contexto del Edge `asesor` incluyen
`url_canonica` por ítem.

Red de seguridad en Hostinger (`public/.htaccess`): variantes mal armadas redirigen 301 sin
tocar el índice de catálogo:

| Petición errónea                                               | Destino                 |
| -------------------------------------------------------------- | ----------------------- |
| `/producto/{slug}/`, `/productos/{slug}/`                      | `/es/productos/{slug}/` |
| `/es/producto/{slug}/`                                         | `/es/productos/{slug}/` |
| `/product/{slug}/`, `/products/{slug}/`, `/en/product/{slug}/` | `/en/products/{slug}/`  |

Guardrails en `src/lib/asesor-guardrails.ts` fuerzan el uso de URL canónica del contexto, no del slug solo.

- Si piden producto con precio: indica compra posible en web, información en descripción y ofrece resolver dudas; incluye enlace.
- Cotización institucional: pide datos faltantes; nunca cotices cifras por chat.
- Usa español o `locale`; párrafos cortos, tono chat, no brochure.
- Lee `turn_id`, `mensaje`, `historial`, `locale` y `navigation_context` de `<webhook_event>`.

Con credenciales service-role ya disponibles para agente, actualiza fila exacta:

```sql
UPDATE asesor_agent_turns
SET reply_texto = :reply_texto, status = 'replied'
WHERE id = :turn_id AND status = 'pending';
```

En fallo, actualizar `status = 'failed'` y `error` solo cuando `status = 'pending'`. Nunca sobrescribir `timeout`. Avisar Shoky: `web inbound + <preview corto>`.

## Prueba manual

1. Preguntar catálogo en widget; verificar fila `pending` y wake recibido.
2. Routine escribe `replied`; confirmar texto, tarjetas y enlaces reales.
3. Revisar logs: `asesor` no hace fetch a Hermes/OpenAI-compatible.
4. No responder routine por ~110 s; Edge responde HTTP 504 `AGENT_TIMEOUT`, el widget muestra reintento + WhatsApp y la fila queda `timeout`. Nunca shortlist de catálogo.
