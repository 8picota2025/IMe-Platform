# Propuesta: Panel Vivo IME (Kanban interactivo) — 31-10-2026

## Recomendación

**Módulo admin del CMS (8picota2025/IMe-Platform, ruta /admin/panel)**, con Obsidian solo como espejo de lectura (el `Estado-Vivo` que ya regenera el cron cada 15 min).

| Criterio         | CMS admin                                                       | Obsidian                                                                      |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Autenticación    | Supabase Auth + rol admin (ya existe)                           | Ninguna; cualquiera con el archivo                                            |
| Aprobar → acción | Edge Function con service_role llama `aprobar_cotizacion_envio` | Requiere parsear checkboxes de .md y un watcher; frágil, conflictos Syncthing |
| Auditoría        | Tabla append-only + `aprobado_por/aprobado_at`                  | git/archivo, falsificable                                                     |
| Tiempo real      | Supabase Realtime                                               | Refresco por sync, minutos                                                    |
| Móvil            | Navegador                                                       | App Obsidian + sync                                                           |

## Arquitectura

1. **Fuente única: Supabase** (proyecto nnfbucwiasuggyfoyydo).
   - Vista `v_panel_tarjetas` (unión): cotizaciones abiertas (`solicitudes_cotizacion` no archivadas: estado, aprobación, NO ENVIAR, send_error, validez), RFQs a proveedores, y tareas de bots.
   - Tabla nueva `panel_tareas` (id, tipo, titulo, ref, bot_dueno, columna, estado, payload jsonb, creado_por, created_at) = pendientes y colas de bots.
   - Tabla nueva `panel_eventos` (append-only: tarjeta, accion, actor, actor_canal, ts, resultado, hash). Sin UPDATE/DELETE por RLS.
   - Tabla `panel_snapshot_twenty` (oportunidades/estado de sync): la llena **CRM** (único que lee/escribe Twenty) vía su MCP o un flujo n8n de solo lectura; el panel nunca escribe en Twenty.
2. **Ingesta / refresco: n8n (n8n.i-me.com.co)**, flujo cada 5–15 min:
   - lee sent_log/RFQs, Twenty (lectura, credencial de CRM), colas Hermes (tablón) → upsert en `panel_tareas` / snapshot.
   - Cron actual en srv1715444 sigue regenerando el espejo Obsidian.
3. **UI**: página admin en el CMS, columnas _Por aprobar · Aprobado/en cola · En ejecución · Hecho · Bloqueado_, Realtime sobre `panel_tareas` / `solicitudes_cotizacion`.
4. **Ejecución**: Edge Function `panel-accion` (service_role, verifica JWT admin):
   - Cotización: llama RPC `aprobar_cotizacion_envio(id, tipo='ok_shoky'|'validacion_costeo_margen', actor, ref)`; el envío lo hace después **Correo** (único que envía email) o IMEia (WhatsApp), respetando veda 19:30–08:00 COT.
   - Otra tarea: inserta en la cola del bot dueño (tablón Hermes vía webhook n8n, que ya existe) con `aprobado_por/at`.
   - Todo escribe `panel_eventos` antes y después (resultado/errores).

## Flujo de aprobación

Shoky abre /admin/panel (login Supabase + 2FA, rol `admin` u `owner`) → pulsa _Aprobar_ en tarjeta → modal muestra total, margen validado, alertas (duplicado/NO ENVIAR) y pide confirmar → `panel-accion` valida JWT y estado actual (idempotencia por marca ya puesta) → RPC/encolado → evento auditado (quién, cuándo, IP, versión de tarjeta) → bot dueño ejecuta y marca _Hecho_ o _Bloqueado_ con motivo. Opcional: aprobar desde Telegram (iMErvis) con botón que llama la misma función firmando con el user id de Shoky.

Aprobar solo marca o encola. No envía a clientes ni proveedores.

## Esfuerzo estimado

| Fase          | Contenido                                                                                      | Esfuerzo       |
| ------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| 0 (hecho hoy) | Fix `numero`, sección 1 desde datos, errores con exit distinto de 0, cron 15 min en srv1715444 | —              |
| 1             | Migraciones `panel_tareas`, `panel_eventos`, vista, RLS; Edge `panel-accion` con RPC           | 1–1,5 días     |
| 2             | UI Kanban admin + Realtime + modal de aprobación                                               | 1,5–2 días     |
| 3             | Flujo n8n de ingesta (RFQs, tablón Hermes, snapshot Twenty vía CRM)                            | 1 día          |
| 4             | Encolado a bots (webhook tablón) + estados de retorno + botón Telegram                         | 1 día          |
| 5             | Pruebas E2E (aprobar → Correo envía en ventana), rollback, docs                                | 0,5–1 día      |
| **Total**     |                                                                                                | **5–6,5 días** |

Requiere OK de Shoky para: migraciones en Supabase, PR/merge en IMe-Platform, nuevo flujo n8n, y credencial de lectura Twenty (gestionada por CRM).

La UI de este repo es Astro y TypeScript del admin, sin React: el tablero vive en `/admin/panel` con el mismo cliente Supabase (anon key + JWT) que `/admin`.
