# WhatsApp Cloud API — IMEIA inbound / outbound

Canal **WhatsApp Business Cloud API (Meta)** para que IMEIA responda sin automatizar WhatsApp Web.

Número Business en uso: **+57 313 724 7353** (`src/lib/contacto-oficial.ts`).
Cotización institucional: [https://i-me.com.co/es/contacto/](https://i-me.com.co/es/contacto/).

El widget web (`src/components/Asesor.astro` → `asesor`) no cambia: Turnstile y rate-limit web siguen igual. Este canal es una Edge Function aparte.

## Arquitectura

```
Meta Cloud API
  GET  /functions/v1/whatsapp-webhook   → hub.verify_token + hub.challenge
  POST /functions/v1/whatsapp-webhook   → X-Hub-Signature-256 + payload
       ├─ statuses / grupos / no-texto  → 200, sin reply
       ├─ wamid ya visto                → 200, no reenvía
       └─ texto nuevo                   → catálogo + guardrails IMEIA → Graph send
```

Respuestas: `composeGroundedAsesorReply` / knowledge estático (PR #82). **No** se llama el agente soul `imeia` de Hermes. No se inventan precios ni RS INVIMA. En radiología, la cotización cubre **equipo + instalación del equipo**, no adecuación de sala, transformadores ni ventilación.

Idempotencia: tabla `whatsapp_inbound_events` (PK `wamid`). Rate-limit: `asesor_rate_limit` con identificador `whatsapp:wa:<from>`.

`verify_jwt = false` (Meta no envía JWT). La autenticación es el token de verificación (GET) y la firma HMAC (POST).

## Secretos (nombres; nunca commitear valores)

| Variable                   | Uso                                                                          |
| -------------------------- | ---------------------------------------------------------------------------- |
| `WHATSAPP_VERIFY_TOKEN`    | Token que pegas en la consola Meta (GET challenge)                           |
| `WHATSAPP_APP_SECRET`      | App Secret → `X-Hub-Signature-256`. Si falta, se omite la firma (solo local) |
| `WHATSAPP_TOKEN`           | Token permanente de la app (Graph)                                           |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número, no el E.164                                                   |
| `WHATSAPP_API_VERSION`     | Default `v21.0`                                                              |
| `WHATSAPP_RATE_LIMIT_*`    | Ventana / tope diario por remitente                                          |

En Supabase:

```bash
supabase secrets set \
  WHATSAPP_VERIFY_TOKEN=... \
  WHATSAPP_APP_SECRET=... \
  WHATSAPP_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_API_VERSION=v21.0
```

Migración de idempotencia: `supabase/migrations/20260906020000_whatsapp_inbound_events.sql`.

## Setup en Meta Business Suite

1. [Meta Business Suite](https://business.facebook.com/) → **Accounts** → WhatsApp accounts. Confirma el número **+57 313 724 7353**.
2. [developers.facebook.com](https://developers.facebook.com/) → tu app → **WhatsApp** → **API Setup**.
3. Añade el número (o el test number en desarrollo) y copia **Phone number ID** + **Temporary/permanent access token**.
4. App → **WhatsApp** → **Configuration** → **Webhook**:
   - Callback URL: `https://<supabase-project>.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: el mismo valor que `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to field **`messages`**
5. App → **Settings** → **Basic** → copia **App secret** a `WHATSAPP_APP_SECRET`.
6. En producción usa un token permanente de sistema (no el temporal de 24 h).
7. Envía un mensaje de texto al +57 313 724 7353 desde un número permitido (en modo desarrollo, solo testers de la app).

Proyecto I-ME actual: `https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/whatsapp-webhook`.

## Deploy

```bash
# Migración (idempotencia wamid)
supabase db push   # o aplicar 20260906020000_whatsapp_inbound_events.sql

# Función (JWT off: config.toml + functions/whatsapp-webhook/config.toml)
supabase functions deploy whatsapp-webhook --project-ref <ref>
```

CI (`deploy-supabase-functions.yml`) despliega todas las funciones y puede empujar estos secretos si existen como GitHub Secrets (no pisa valores vacíos).

## Probar

### 1. Unitarios (sin secretos)

```bash
npx vitest run src/lib/whatsapp-cloud.test.ts
```

Cubre firma HMAC, parseo de payload, status-only, grupos, no-double-reply y composición IMEIA (sin precio/RS inventados).

### 2. Challenge GET (como Meta)

```bash
# supabase/.env.local — no commitear
WHATSAPP_VERIFY_TOKEN=dev-verify
# WHATSAPP_APP_SECRET=   # opcional en local

supabase functions serve whatsapp-webhook --no-verify-jwt --env-file supabase/.env.local
```

```bash
curl -sS -D - \
  'http://127.0.0.1:54321/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=dev-verify&hub.challenge=12345'
# Esperado: 200 + cuerpo `12345` (text/plain)

curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://127.0.0.1:54321/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'
# Esperado: 401
```

### 3. Inbound POST de muestra

Sin `WHATSAPP_APP_SECRET` (local) la firma se omite. Con secreto, calcula HMAC-SHA256 del body crudo y envía `X-Hub-Signature-256: sha256=<hex>`.

```bash
curl -sS http://127.0.0.1:54321/functions/v1/whatsapp-webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WABA_ID",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "573137247353",
            "phone_number_id": "PHONE_NUMBER_ID"
          },
          "contacts": [{ "profile": { "name": "IPS Demo" }, "wa_id": "573001112233" }],
          "messages": [{
            "from": "573001112233",
            "id": "wamid.HBgNNjc.test.1",
            "timestamp": "1710000000",
            "type": "text",
            "text": { "body": "¿Cuánto cuesta un monitor de paciente?" }
          }]
        }
      }]
    }]
  }'
```

Esperado: `{ "ok": true, "replied": 1, ... }` si hay `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`; si faltan, `ok: true` y log `no se envía` (scaffold de verify + parse). El texto **no** debe incluir un RS inventado ni un precio en COP.

Reenviar el mismo `wamid` → `replied: 0` (idempotencia).

Status-only (sin reply):

```bash
curl -sS http://127.0.0.1:54321/functions/v1/whatsapp-webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WABA_ID",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": { "phone_number_id": "PHONE_NUMBER_ID" },
          "statuses": [{
            "id": "wamid.status.1",
            "status": "delivered",
            "timestamp": "1710000001",
            "recipient_id": "573001112233"
          }]
        }
      }]
    }]
  }'
```

### 4. Firma HMAC (cuando `WHATSAPP_APP_SECRET` está)

```bash
BODY='{"object":"whatsapp_business_account","entry":[]}'
HEX=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | awk '{print $2}')
curl -sS http://127.0.0.1:54321/functions/v1/whatsapp-webhook \
  -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: sha256=${HEX}" \
  -d "$BODY"
```

Firma incorrecta → 401.

## Relación con comercial-share

`WHATSAPP_MODE=link` sigue generando `wa.me` desde el CMS comercial. Este webhook es el canal Cloud API de **IMEIA**. No mezclar el token Graph con el front ni con `dist/`.
