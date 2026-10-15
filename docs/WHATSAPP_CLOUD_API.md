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
       └─ texto 1:1 nuevo               → fila pending_agent (sin burbuja inmediata)
            └─ seguimiento (~30 s de silencio; la escritura lo alarga hasta ~2 min; pasada al minuto solo con WHATSAPP_HOLDING_ENABLED)
                 ├─ claim_whatsapp_agent_batch  → 1 wake del agente por remitente
                 └─ si WHATSAPP_HOLDING_ENABLED y el pendiente sigue >60 s sin salida → 1 mensaje de espera
  pg_cron cada minuto → whatsapp-imeia-dispatch (mismo despacho, por si el isolate murió)
  smb_message_echoes → #pausa / /pausa / #pause / #continua / #activa, o bitácora kind=other
  typing_indicators → alarga el silencio del lote (tope ~2 min)
  plantillas Meta → whatsapp_outbound_messages.kind = template
```

La respuesta al cliente la escribe el agente externo (no esta función, no Hermes). El webhook solo verifica firma, filtra grupos y guarda el texto. No se inventan precios ni RS INVIMA.

Idempotencia: tabla `whatsapp_inbound_events` (PK `wamid`). Salidas: `whatsapp_outbound_messages`. Rate-limit: `asesor_rate_limit` con identificador `whatsapp:wa:<from>`.

`verify_jwt = false` (Meta no envía JWT). La autenticación es el token de verificación (GET) y la firma HMAC (POST).

## Secretos (nombres; nunca commitear valores)

| Variable                   | Uso                                                                           |
| -------------------------- | ----------------------------------------------------------------------------- |
| `WHATSAPP_VERIFY_TOKEN`    | Token que pegas en la consola Meta (GET challenge)                            |
| `WHATSAPP_APP_SECRET`      | App Secret → `X-Hub-Signature-256`. Si falta, se omite la firma (solo local)  |
| `WHATSAPP_TOKEN`           | Token permanente de la app (Graph)                                            |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número, no el E.164                                                    |
| `WHATSAPP_API_VERSION`     | Default `v21.0`                                                               |
| `WHATSAPP_RATE_LIMIT_*`    | Ventana / tope diario por remitente                                           |
| `WHATSAPP_HOLDING_ENABLED` | `true` o `1` activa la espera. Ausente, vacío o cualquier otro valor: apagada |

En Supabase:

```bash
supabase secrets set \
  WHATSAPP_VERIFY_TOKEN=... \
  WHATSAPP_APP_SECRET=... \
  WHATSAPP_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  WHATSAPP_API_VERSION=v21.0
```

Migraciones: `supabase/migrations/20260906020000_whatsapp_inbound_events.sql`, `20260909050000_whatsapp_inbound_body.sql`, `20260925143000_whatsapp_outbound_dispatch.sql`, `20260925150000_whatsapp_dispatch_cron.sql`, `20260925160000_whatsapp_human_takeover.sql`, `20261002120500_whatsapp_identity_resilience.sql`, `20261014170000_whatsapp_pausa_debounce_prioridad.sql`, `20261014171000_leads_consentimiento_pendiente.sql`.

## Setup en Meta Business Suite

1. [Meta Business Suite](https://business.facebook.com/) → **Accounts** → WhatsApp accounts. Confirma el número **+57 313 724 7353**.
2. [developers.facebook.com](https://developers.facebook.com/) → tu app → **WhatsApp** → **API Setup**.
3. Añade el número (o el test number en desarrollo) y copia **Phone number ID** + **Temporary/permanent access token**.
4. App → **WhatsApp** → **Configuration** → **Webhook**:
   - Callback URL: `https://<supabase-project>.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: el mismo valor que `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to fields **`messages`**, **`smb_message_echoes`** y, si la app lo ofrece, **`typing_indicators`**
5. App → **Settings** → **Basic** → copia **App secret** a `WHATSAPP_APP_SECRET`.
6. En producción usa un token permanente de sistema (no el temporal de 24 h).
7. Envía un mensaje de texto al +57 313 724 7353 desde un número permitido (en modo desarrollo, solo testers de la app).

Proyecto I-ME actual: `https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/whatsapp-webhook`.

## Deploy

```bash
# 1. Migraciones ANTES que las funciones.
#    Workflow: Deploy Supabase Migrations (workflow_dispatch) sobre la rama
#    que ya contiene 20261014170000 y 20261014171000. Tiene que decir
#    "Session Pooler conectado." y aplicarlas con supabase db push.
#    El fallback de Management API solo cubre 20260809090000 y no sirve aquí.
supabase db push

# 2. Funciones, después de las migraciones. verify_jwt = false en el webhook y el dispatch.
supabase functions deploy whatsapp-webhook whatsapp-imeia-dispatch whatsapp-imeia-reply registrar-lead-comercial --project-ref <ref>
```

No hace falta ningún secreto nuevo en git ni en Vault. Siguen `WHATSAPP_*` y `IMEIA_AGENT_WEBHOOK_URL` / `IMEIA_AGENT_WEBHOOK_KEY`. `SUPABASE_SERVICE_ROLE_KEY` ya lo inyecta la plataforma en la función. `WHATSAPP_HOLDING_ENABLED` es opcional y, si falta, la espera queda apagada. Para volver a activarla: `supabase secrets set WHATSAPP_HOLDING_ENABLED=true --project-ref <ref>` y redesplegar `whatsapp-webhook` y `whatsapp-imeia-dispatch`.

### Cron (necesario como red de seguridad)

El webhook agenda el seguimiento con `EdgeRuntime.waitUntil` (~30 s de silencio; si llega un indicador de escritura, espera a que pare, con tope de ~2 min desde el último mensaje). Con `WHATSAPP_HOLDING_ENABLED` hay una segunda pasada al minuto para la espera. Si ese isolate muere, **nada despierta al agente** hasta que corre el cron. El reclamo SQL usa el mismo silencio (`p_quiet_seconds` 30) y el mismo tope de escritura.

`20260925150000_whatsapp_dispatch_cron.sql` hace el alta al aplicar la migración:

- Crea `whatsapp_dispatch_auth` (una fila, `id = 1`) y, si está vacía, guarda un token de 64 hex generado con `gen_random_uuid`. Reaplicar no lo rota.
- RLS sin políticas. `anon` y `authenticated` no tienen GRANT. `service_role` puede leer. El dueño (`postgres`, que es quien corre pg_cron) bypassa RLS.
- Programa `whatsapp-imeia-dispatch` con `* * * * *`. El comando lee el token en el momento de ejecutar; el valor no queda escrito en `cron.job`.
- `net.http_post` usa timeout de 5 s. La función responde **202** y sigue el despacho en `waitUntil`, para que ese corte no aborte un wake de 40–80 s.

La función acepta el bearer si coincide con ese token o con `SUPABASE_SERVICE_ROLE_KEY`. No acepta un JWT sin verificar aunque el payload diga `role=service_role`.

Para quitarlo:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'whatsapp-imeia-dispatch';
```

CI (`deploy-supabase-functions.yml`) despliega todas las funciones al hacer push a `main`. Las migraciones, cron incluido, solo corren con `deploy-supabase-migrations.yml` (`workflow_dispatch`). Hay que aplicarlas antes de mergear: si el webhook nuevo llega a producción sin la migración, los clientes se quedan sin respuesta.

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

Esperado: `{ "ok": true, "queued": 1, "replied": 0, ... }`. Este POST no envía burbuja ni despierta al agente en la misma petición: deja la fila `pending_agent` y agenda el despacho. Reenviar el mismo `wamid` → `queued: 0` (idempotencia). El texto de la respuesta real lo escribe el agente; no debe incluir un RS inventado ni un precio en COP.

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

## Reglas del mensaje de espera

Por defecto no se envía ninguna espera. Hace falta `WHATSAPP_HOLDING_ENABLED=true` (o `1`) en la Edge Function. Con el flag apagado, ni el cron ni el seguimiento del webhook llaman a `enviarEspera` ni a la segunda espera. Con el flag encendido, no se envía al recibir el mensaje. Se envía solo si, en el despacho:

1. El pendiente más reciente de ese cliente tiene **más de 60 s** y el agente aún no lo cerró.
2. **No hay ninguna salida** (`whatsapp_outbound_messages.send_status = sent`) hacia ese número desde que llegó ese pendiente. Una respuesta del agente cuenta, si quedó registrada.
3. **Como mucho una vez por turno** (el turno es el `wamid` pendiente más reciente) y **nunca más de una cada 3 minutos** por cliente.
4. **Nunca** si todos los pendientes del turno son acuse trivial: `ok`, `gracias`, `listo`, variantes cortas (`vale`, `thanks`, `muchas gracias`) o solo emoji. Una pregunta junto a un «ok» sí puede llevar espera.
5. **Nunca** a grupos ni a un contacto cuyo evento más reciente en 24 h está `ignored`.

El texto rota, en «tú», y no repite el último que ese cliente ya recibió. Ejemplos:

- Dame un momento, estoy revisando la información para responderte bien.
- Ya casi, estoy confirmando los detalles.
- Sigo con tu consulta, en breve te escribo.

Si el pendiente está en inglés, rota el equivalente en inglés. La frase fija anterior («Un momento, reviso su consulta…») ya no se usa.

## Bitácora de salida (el agente también escribe aquí)

Tabla `whatsapp_outbound_messages`: `to_wa`, `body`, `kind` (`holding` | `reply` | `other`), `wamid` (id de Graph del mensaje **saliente**), `created_at`. RLS sin políticas: solo `service_role` (el rol bypassa RLS).

La plataforma inserta `kind = holding` cuando manda la espera. El agente, con la misma service role, debe insertar su respuesta **al enviarla por Graph y antes de marcar las filas `replied`**, para que el despacho no mande una espera encima:

```sql
insert into public.whatsapp_outbound_messages (to_wa, body, kind, wamid)
values ('573001112233', 'texto que IMEIA acaba de enviar', 'reply', 'wamid.HBg...');
```

`send_status` queda en `sent` por defecto. `to_wa` son dígitos, sin `+`.

## Wake

Sigue el contrato de siempre, una vez por lote, con el pendiente más reciente:

```json
{
  "source": "whatsapp-cloud",
  "channel": "imeia",
  "from": "573001112233",
  "text": "texto del último pendiente",
  "claim_token": "uuid-del-lote",
  "wamid": "wamid.HBg...",
  "phone_number_id": "PHONE_NUMBER_ID",
  "locale": "es",
  "received_at": "2026-09-25T15:00:00.000Z",
  "recent_outbound": [
    {
      "time": "2026-09-25T14:55:00.000Z",
      "text": "texto enviado hace unos minutos"
    }
  ],
  "trivial_ack": false
}
```

`recent_outbound` son como mucho las 3 últimas salidas `sent` a ese contacto en los 10 minutos previos, de la más antigua a la más nueva. `trivial_ack` es `true` solo cuando todos los mensajes del lote son acuse trivial (`esAcuseTrivial`). El lote no se cierra por eso: sigue `pending_agent` hasta que el agente responda.

Si, al responder, `whatsapp-imeia-reply` ve filas `pending_agent` del mismo contacto más nuevas que el lote reclamado, no envía. Suelta el `claim_token` (las filas vuelven a poder reclamarse juntas) y responde `409` con `{ "ok": false, "error": "new_messages" }`. El cuerpo del reply sigue siendo `{ "claim_token", "body" }`.

El agente lee los `pending_agent` de ese `from` en las últimas 24 h y los marca `replied` o `ignored`. Un segundo despacho que reclama 0 filas no vuelve a despertarlo mientras el reclamo tenga menos de 3 minutos. Si el wake HTTP falla, el reclamo se suelta y el cron reintenta. Si el wake no responde a tiempo, el reclamo se conserva para no disparar otra corrida en paralelo.

## Toma humana (`#pausa`, `/pausa`, `#pause`, `#continua`, `#activa`)

Shoky escribe en el chat del cliente desde el WhatsApp Business app. Meta manda el eco en `smb_message_echoes` (`message_echoes[]`, `from` = negocio, `to` = cliente). Si el mismo eco llega dentro de `messages` con `from` igual al número del negocio y `to` del cliente, se trata igual. Un comando escrito desde el propio número del negocio, con destinatario, hace lo mismo.

- `#pausa`, `/pausa`, `#pause` y `#parar` (primera palabra; mayúsculas y puntuación final no importan; puede llevar más texto detrás, `#pausa ya lo veo`) ponen `whatsapp_contact_pauses.paused = true`. No caduca.
- `#continua` y `#activa` lo dejan en `paused = false`. El texto del comando gana aunque el eco llegue marcado como pausa.
- Mientras está en pausa, el reclamo devuelve 0 filas y el plan no arma wake ni espera. Los mensajes nuevos de ese cliente se guardan como `human_paused`, no como `pending_agent`. Reanudar no convierte los que ya quedaron en pausa: no se responden después.
- Cualquier otro eco que no sea un envío ya registrado de IMEIA (ni una plantilla) sigue pausando el chat. El texto se anota en `whatsapp_outbound_messages` con `kind = other`. El comando se guarda como `[toma-humana]`: Graph no lo reenvía al cliente.
- Si en un chat ya pausado aparece un envío que no es IMEIA ni el eco del dueño, se inserta `whatsapp_watcher_flags` (`reason = paused_unmatched_outbound`, `acknowledged_at` nulo) para que el watcher lo lea.
- `rate_limited` se audita en `whatsapp_drop_log` y la fila queda `pending_agent`, para que el siguiente lote la responda.
- El despacho (cron, sin un solo remitente) despierta primero a clientes y proveedores y después la actividad del número del negocio. Las esperas salen después de esos wakes.
- Una plantilla de Meta (eco o `enviarPlantillaWhatsApp`, p. ej. `aviso_cotizacion_pendiente`) se anota con `kind = template` y `origin = imeia`. No pausa el chat. Enviarla exige que la plantilla ya esté aprobada en Meta.
- No se llama al webhook del agente. El aviso sería `{ "type": "human_takeover", "action": "pause" | "resume", "wa_id": "57300..." }` y ese cuerpo no trae `source`, `from`, `text` ni `wamid`. Mandarlo haría que el agente lo tomara por un turno de cliente.

En el App Dashboard → **WhatsApp** → **Configuration** → Webhook fields, hace falta **`messages`** y **`smb_message_echoes`**. Sin el segundo, Meta no entrega los ecos de la app. Si la app ofrece **`typing_indicators`**, hay que suscribirlo para alargar el silencio mientras el contacto escribe. No hay secretos nuevos.

## Canal web

La Edge Function `asesor` no manda un texto de espera: el widget mostraba al instante «IMEIA está preparando su respuesta…». Ahora ese aviso es un «…» y la frase (la misma rotación, a los 60 s, sin acuses, sin repetir en 3 minutos) solo aparece si la respuesta sigue pendiente. El input sigue bloqueado, así que no se apilan burbujas.

## Relación con comercial-share

`WHATSAPP_MODE=link` sigue generando `wa.me` desde el CMS comercial. Este webhook es el canal Cloud API de **IMEIA**. No mezclar el token Graph con el front ni con `dist/`.
