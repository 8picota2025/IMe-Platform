# WhatsApp: identidad, coexistencia y resiliencia

Cambios preparados para revisión. No se ha aplicado ninguna migración ni desplegado funciones en producción.

## Identificadores y respuesta

Se revisó el 2 de octubre de 2026 la [documentación oficial de Meta sobre BSUID](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids). El webhook recibe `messages[].from_user_id`, `contacts[].user_id` y `contacts[].profile.username`; el teléfono puede faltar. Graph acepta el BSUID **íntegro** en `recipient`. `to` sigue destinado al teléfono y tiene prioridad si se proporcionan ambos. El código envía exactamente uno de esos campos. La versión por defecto pasa a v26.0; un secreto `WHATSAPP_API_VERSION` existente tiene prioridad y debe revisarse al desplegar.

El parser conserva también los formatos alternativos `from`, `wa_id`, `user_id` y `username`. No convierte identificadores opacos en números. Un username solo se conserva como identidad provisional: no se inventa una dirección Graph ni se asocia a otra persona por un nombre mutable. Si falta teléfono y BSUID, se persiste el mensaje y se registra `no_sendable_recipient`; requiere revisión humana. Un BSUID o teléfono confirmado en un payload permite conservar la ruta existente y reutilizar el último BSUID conocido en siguientes respuestas.

Los mensajes de todos los tipos conservan `kind`, una representación legible, el perfil y el payload completo en `raw`. No se descarga ni transcribe el audio; se conserva `[audio]` y sus metadatos. Los ejemplos de `tests/fixtures/whatsapp` reproducen la estructura documentada con datos de prueba; no son capturas privadas de @soenvalencia.

El wake mantiene `from`, `text` y `wamid` y añade `claim_token`, `sender_id`, `recipient`, `messages` y `reply_endpoint`. `messages` contiene el lote completo. El agente externo debe usar este contrato y llamar a **`whatsapp-imeia-reply`** con `{ "claim_token": "<UUID del wake>", "body": "<respuesta>" }`, autenticado con el secreto existente `IMEIA_AGENT_WEBHOOK_KEY` (o la service role del servidor). La función elige la ruta desde la base de datos, comprueba exclusiones/pausa, reserva la respuesta, envía por Graph, registra `kind=reply` y cierra únicamente ese lote. La reserva usa el último wamid del turno, de modo que un reclamo nuevo no duplica una respuesta ya enviada. Un error de red con resultado desconocido conserva la reserva pendiente para revisión manual; un rechazo explícito de Graph permite reintento. Mensajes nuevos quedan pendientes. El agente externo no está versionado en este repositorio: su adaptación es un requisito del despliegue, no una modificación realizada en producción.

## Migraciones

`20261002120000_whatsapp_identity_resilience.sql`:

- Añade `sender_id`, `sender_type`, `username`, `profile_name`, `raw`, `drop_reason`, `retry_count` y `last_error` a los eventos; mantiene `from_wa` como clave de ruta compatible. El backfill conserva los contactos telefónicos existentes.
- Permite todos los `kind` y añade `stale` al estado. Un trigger actualiza `updated_at` en cualquier UPDATE, incluido `replied`.
- Crea `whatsapp_contact_routes` para identidad y ruta confirmada; amplía las pausas para identificadores opacos y añade `reason`.
- Crea `whatsapp_contact_exclusions` con los once identificadores solicitados, `whatsapp_drop_log`, `whatsapp_alerts` y `whatsapp_pipeline_config`.
- La ingesta es una transacción con idempotencia por wamid. Si falla la persistencia o la auditoría, el webhook devuelve 503 para que Meta reintente.
- Ecos manuales de cualquier tipo pausan con `reason=human_takeover`. `#activa` reanuda; `#pausa`, `/pausa`, `#parar` pausan. Ecos de mensajes ya registrados como salientes de API no pausan.
- El dispatcher comprueba las exclusiones y las pausas antes de wake/espera y el reclamo SQL repite el guard. Las exclusiones telefónicas siguen aplicándose cuando llega un BSUID asociado. Los grupos se descartan; los bots identificados explícitamente como tales se registran como `bot`. No se infiere que una persona es un bot por su nombre; para bots sin marca explícita se usa la lista de exclusiones.
- Fallos HTTP/red/configuración del wake y fallos de respuesta incrementan el contador. Si un wake aceptado no cierra su lote antes de expirar el reclamo (180 s), se registra otro fallo. Un timeout conserva temporalmente el reclamo para evitar wakes simultáneos.
- El umbral por defecto es 3 y se configura con `UPDATE public.whatsapp_pipeline_config SET max_failures = 3 WHERE id = 1`.
- Al alcanzar el umbral se crea una alerta única por turno. Después de la primera espera, la segunda se reserva atómicamente y se intenta una sola vez. Una reserva incompleta o un envío fallido requiere revisión; no se reenvía automáticamente esa segunda espera.
- La rutina marca pendientes de más de 24 h como `stale` y audita el motivo.
- Tablas nuevas y RPC quedan inaccesibles a anon/authenticated; acceso solo de servicio.

`20261002121000_recordatorio_cron_auth.sql` elimina el cron antiguo por nombre o endpoint, programa uno solo y lo deja **inactivo** hasta desplegar el handler. Lee en cada ejecución el token protegido existente de `whatsapp_dispatch_auth`; no guarda un JWT/token literal en `cron.job`. El handler acepta ese token o `SUPABASE_SERVICE_ROLE_KEY`, en tiempo constante, y `verify_jwt=false` permite que autentique el bearer opaco dentro de la función. Esto evita depender del antiguo `app.settings.service_key` o de un JWT obsoleto. La documentación de [autenticación de Supabase](https://supabase.com/docs/guides/functions/auth) explica la separación entre verificación JWT del gateway y autenticación del handler. No se ha inspeccionado ni ejecutado el job de producción: el 401 real debe verificarse después del despliegue aprobado.

## Pruebas locales

```bash
npm ci
npx vitest run src/lib/whatsapp*.test.ts scripts/whatsapp-pipeline.test.ts scripts/recordatorio-auth.test.ts
bash scripts/test-whatsapp-sql.sh
```

El script SQL crea un contenedor PostgreSQL 17 con pg_cron/pg_net, sin red, y lo elimina al terminar. Prueba ingesta, aliases teléfono/BSUID, duplicados, takeover/reanudación, exclusiones, bots, reclamos, expiración, alertas, `stale`, trigger, permisos y cron inactivo sin credencial literal.

Para simular Meta, servir las funciones **solo en Supabase local**, con secretos de prueba y un wake simulado. No poner `WHATSAPP_TOKEN` real en ese entorno; las pruebas HTTP automatizadas usan fetch simulado y no envían mensajes reales. `WHATSAPP_APP_SECRET` debe coincidir con el usado para la firma:

```bash
supabase functions serve --env-file /tmp/whatsapp-local.env
```

En otra terminal, usando un secreto de prueba, firmado sobre los mismos bytes que curl:

```bash
export WHATSAPP_APP_SECRET='local-fixture-only'
fixture=tests/fixtures/whatsapp/bsuid.json
signature=$(node --input-type=module -e '
  import { createHmac } from "node:crypto";
  import { readFileSync } from "node:fs";
  process.stdout.write(createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
    .update(readFileSync(process.argv[1])).digest("hex"));
' "$fixture")
curl --fail-with-body http://127.0.0.1:54321/functions/v1/whatsapp-webhook \
  -H 'Content-Type: application/json' \
  -H "X-Hub-Signature-256: sha256=$signature" \
  --data-binary "@$fixture"
```

Repetir para `text`, `username`, `audio`, `echo` y `status`. Firmar de nuevo cada archivo. BSUID/audio/text deben persistirse; el mismo wamid no crea otro evento; username queda registrado sin dirección inventada; echo pausa; status se audita con `status_update`. Cambiar IDs de fixture para probar varias conversaciones sin activar la idempotencia del caso anterior.

Consultar, solo en la base local:

```sql
SELECT wamid, sender_id, sender_type, from_wa, kind, body, status, drop_reason, retry_count
FROM public.whatsapp_inbound_events ORDER BY created_at DESC;
SELECT wamid, drop_reason FROM public.whatsapp_drop_log ORDER BY created_at DESC;
SELECT sender_id, turn_key, retry_count, second_holding_status FROM public.whatsapp_alerts;
```

Validación realizada: 69 pruebas de WhatsApp/pipeline/auth pasan; SQL de identidad y cron probado en contenedores aislados; lint, Astro check (0 errores/advertencias) y build pasan; Deno check de las cuatro funciones pasa. La suite general presenta tres fallos de `src/lib/datos.test.ts`, reproducidos también en un checkout limpio del mismo `main` (`82d278d`): el producto requerido por esos tests está inactivo y devuelve null. No se alteró el catálogo para ocultarlos.

## Despliegue, solo después de aprobación de Shoky

1. Revisar el PR y probar en staging. El merge a `main` dispara automáticamente `.github/workflows/deploy-supabase-functions.yml`; antes del merge aprobado, suspender temporalmente ese workflow para respetar el orden migración → funciones → cron. Rehabilitarlo al cerrar el rollout. Preparar el agente externo para consumir `messages`/`recipient` y responder a través del endpoint con `claim_token`. No ejecutar el rollout sin ese cambio.
2. Registrar únicamente IDs/nombres/estado de los cron existentes, sin seleccionar comandos que puedan contener claves antiguas. Desactivar temporalmente `whatsapp-imeia-dispatch` y `recordatorio-carritos`; guardar el estado para recuperación.
3. Aplicar las dos migraciones versionadas. El cron de carritos queda inactivo. Revisar columnas, permisos, rutas, seed de exclusiones y existencia de `whatsapp_dispatch_auth`; no consultar/imprimir el token.
4. Desplegar `whatsapp-webhook`, `whatsapp-imeia-dispatch`, `whatsapp-imeia-reply` y `recordatorio-carritos`, respetando `supabase/config.toml`. Mantener los secretos existentes; verificar `WHATSAPP_API_VERSION=v26.0` sin mostrar valores de otros secretos.
5. Activar la versión compatible del agente. Probar con un contacto de prueba autorizado: teléfono, BSUID sin teléfono, audio y takeover/resume. Verificar respuestas por BSUID y que nuevos mensajes no se cierren con el lote anterior.
6. Reactivar los cron: `SELECT cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname IN ('whatsapp-imeia-dispatch','recordatorio-carritos');`. No ejecutar manualmente carritos contra clientes como prueba: observar su siguiente ejecución autorizada y revisar que no hay 401.
7. Monitorizar estados, alertas y motivos de descarte durante al menos dos ciclos de despacho y la siguiente ejecución horaria de carritos. Confirmar que excluidos y pausados no reciben esperas ni wakes.

Recuperación: desactivar cron y el agente si aparecen respuestas duplicadas o rutas incorrectas. Mantener las tablas aditivas y datos de auditoría; no revertir borrando payloads. La nueva ingesta permite `kind` distintos de `message`, por lo que una vuelta a funciones antiguas requiere comprobar primero sus supuestos. Revisar manualmente reservas de salida/segunda espera con resultado ambiguo antes de repetir un envío.
