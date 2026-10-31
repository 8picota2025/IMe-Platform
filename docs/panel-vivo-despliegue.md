# Despliegue del panel vivo — pendiente de OK

Nada de esta lista está aplicado. Hace falta un sí explícito de Shoky para cada paso.

1. Crear una rama de Supabase (preview), no el proyecto `nnfbucwiasuggyfoyydo`.
2. Aplicar antes, si aun no está, `supabase/migrations/20261031120000_aprobacion_envio_cotizacion.sql` (guardas de la PR 251: el RPC `aprobar_cotizacion_envio` sigue solo para `service_role`). Luego `supabase/migrations/20261031183000_panel_vivo.sql`. Esta rama no modifica esos archivos de guarda.
3. Desplegar la Edge Function `panel-accion` en la misma rama.
4. Guardar como secretos de la función, no en el repo:
   - `PANEL_TABLON_WEBHOOK_URL`
   - `PANEL_TABLON_WEBHOOK_SECRET` (opcional)
5. Correr el E2E contra esa rama, nunca contra producción:

```bash
PANEL_E2E=1 \
PANEL_E2E_SUPABASE_URL=https://<ref-preview>.supabase.co \
PANEL_E2E_ANON_KEY=... \
PANEL_E2E_JWT=... \
PANEL_E2E_COTIZACION_ID=... \
npx vitest run src/lib/panel-vivo.test.ts
```

El test aborta si la URL contiene `nnfbucwiasuggyfoyydo`.

6. Importar en n8n, y dejarlos inactivos, `ops/n8n/panel-ingesta.json` y `ops/n8n/panel-tablon.json`. La credencial de Twenty sigue en el bot CRM y el flujo solo hace GET.
7. Cuando la preview cuadre, repetir migración y función en producción. El rollback es `supabase/rollbacks/20261031183000_panel_vivo.down.sql`.
8. Publicar el sitio estático para que exista `/admin/panel/`. El navegador solo recibe la anon key.

Aprobar una tarjeta no envía correo, WhatsApp ni Telegram. La marca la consume después Correo o IMEia, con la veda 19:30–08:00 COT y las guardas ya existentes.

El crontab del espejo Obsidian está en la otra rama (`ops/panel-sync-fix-20261031`) y tampoco está instalado.
