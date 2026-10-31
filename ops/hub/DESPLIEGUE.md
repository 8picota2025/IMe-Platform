# Despliegue del hub de ops — lo hace Integrador

ops.i-me.com.co no es la web principal. Sigue en srv1715444, detrás de nginx, en `127.0.0.1:18880`. `/admin/panel` de la PR del CMS no lo sustituye.

Los tres scripts que corrían en `/home/shoky/bin` están, ya redactados, en `ops/hub/original/`. La versión nueva no trae token, secreto HMAC, semilla TOTP ni contraseñas: se leen de `~/.config/ime-ops-hub.env`. El login no muestra ninguna contraseña. Los correos de B. Braun y Fresenius salen de `IME_CONTACTO_BBRAUN` y `IME_CONTACTO_FRESENIUS`.

## Qué cambia

- `sync_obsidian_kanbans.py` arma los tableros desde Supabase y `kanban.db` de Hermes. Una tarjeta que ya salió de `Por aprobar`, o que tiene decisión en `ops-hub.db`, no vuelve a la bandeja.
- `POST /post/approve` y `POST /post/reject` guardan usuario, hora y decisión. Una cotización aprobada llama a `aprobar_cotizacion_envio`. El resto se encola en el webhook del tablón. No hay envío de correo ni WhatsApp.
- El destino es el carril del archivo cuyo nombre empieza por `Ejecutados` o `Rechazados`. `Ejecutadas` y `Cerradas` no se usan.
- Los fallos quedan en el log. No hay `except: pass`.
- `ime-cluster-ha.py` ya no lanza el sync cada 2 minutos.

## Pasos en el servidor

No están ejecutados.

1. Confirmar que el lanzador de cada 2 minutos ya está parado. Si el proceso viejo de `ime-cluster-ha.py` sigue vivo, pararlo antes de copiar.
2. Copiar la carpeta, sin borrar el original todavía:

```bash
mkdir -p ~/bin/ime-ops-hub
cp -a ops/hub/. ~/bin/ime-ops-hub/
```

3. Crear `~/.config/ime-ops-hub.env` desde `ime-ops-hub.env.example` con las rutas reales y los secretos. El ejemplo trae rutas de marcador.
4. Ajustar `IME_OPS_KANBAN_DIR` al vault donde están `Kanban-Aprobaciones.md`, `Kanban-1.md`, `Kanban-2.md`, `Kanban-3.md`, `Kanban-Comercial.md` y `Kanban-Proveedores.md`.
5. Instalar el servicio de usuario y no tocar la unidad del sistema:

```bash
mkdir -p ~/.config/systemd/user
cp ~/bin/ime-ops-hub/systemd/ime-ops-hub.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now ime-ops-hub.service
systemctl --user status ime-ops-hub.service
```

Si el servicio debe sobrevivir al cierre de sesión: `loginctl enable-linger shoky`.

6. nginx ya proxya ops.i-me.com.co a `127.0.0.1:18880`. No hace falta cambiar el sitio público. `GET /salud` responde `{"ok": true}`.
7. El sync no queda en cron. Cuando las rutas estén comprobadas:

```bash
IME_OPS_KANBAN_DIR=... python3 ~/bin/ime-ops-hub/sync_obsidian_kanbans.py
```

Si Supabase o Hermes no responden, sale 2 y no pisa los markdown.

8. Probar en el propio servidor, no desde esta PR: aprobar una tarjeta de prueba y ver la fila en `ops-hub.db` (`usuario`, `decidido_at`, `decision`) y el POST al tablón o al RPC. Una cotización aprobada también queda encolada para Emilio (`ejecutor: emilio`) y esta función no envía el correo.
9. Aplicar `supabase/migrations/20261031193000_cola_emilio.sql` solo con OK, primero en una rama preview. El rollback es `supabase/rollbacks/20261031193000_cola_emilio.down.sql`. Luego desplegar las Edge Functions. Emilio es quien drena `cola_emilio` y envía. El resto del repo solo inserta, con `solicitante`.
10. No ejecutar `ops/hub/original/`. Es la copia de referencia y conserva los `except` vacíos del servidor. El log de la versión nueva es JSON por línea (`ts`, `nivel`, `accion`, `mensaje`).

