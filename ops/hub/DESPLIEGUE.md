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
2. Copiar la carpeta y `ime_log.py`. El hub importa ese módulo y en el servidor no estaba desplegado. `cp -a ops/hub/.` no lo incluye: hay que copiarlo al lado del script.

```bash
mkdir -p ~/bin/ime-ops-hub
cp -a ops/hub/. ~/bin/ime-ops-hub/
cp -a ops/srv1715444/ime_log.py ~/bin/ime-ops-hub/ime_log.py
```

Si se sigue usando el panel largo (`ops/srv1715444/ime-ops-hub.py`), copiar también `panel_salud.py` y `ime_log.py` al mismo directorio. Sin `ime_log.py` el proceso sale al arrancar.

3. Crear `~/.config/ime-ops-hub.env` desde `ime-ops-hub.env.example` con las rutas reales y secretos nuevos. `chmod 600` ese archivo. Lo carga `ime-ops-hub.service` (`EnvironmentFile=%h/.config/ime-ops-hub.env`, sin guion: si falta, systemd no arranca). Son obligatorias `IME_OPS_TOKEN`, `IME_OPS_SECRET`, `IME_OPS_2FA_EMAIL`, `IME_OPS_SMTP_HOST`, `IME_OPS_SMTP_PORT`, `IME_OPS_SMTP_USER`, `IME_OPS_SMTP_PASS` e `IME_OPS_SMTP_FROM`. El código ya no tiene valores de reserva y ya no lee `IME_OPS_TOTP_SECRET`.

El segundo factor es un código de 6 dígitos por correo: caduca a los 10 minutos, un solo uso, máximo 5 intentos, y el envío está limitado a 1 por minuto y 5 por hora. El destinatario es solo `IME_OPS_2FA_EMAIL` (no hay campo para cambiarlo en la web). El SMTP exige TLS (puerto 465 con SSL, o STARTTLS en el resto). El log anota el envío y la verificación sin el código ni las claves.

`IME_OPS_TOKEN` e `IME_OPS_SECRET` estuvieron en el código que corría en srv1715444. Hay que rotarlos. La semilla TOTP vieja se descarta: ya no entra al panel. En el servidor, sin pegar los valores en el historial de la shell si se puede evitar:

```bash
umask 077
install -m 600 /dev/null ~/.config/ime-ops-hub.env
# Editar el archivo. Generar ahí:
#   IME_OPS_TOKEN=$(openssl rand -hex 32)
#   IME_OPS_SECRET=$(openssl rand -hex 32)
#   IME_OPS_2FA_EMAIL=correo fijo que recibe el código
#   IME_OPS_SMTP_HOST / PORT (587 o 465) / USER / PASS / FROM
chmod 600 ~/.config/ime-ops-hub.env
```

Al cambiar `IME_OPS_SECRET` mueren las sesiones. Quien usara el token anterior tiene que recibir el nuevo por un canal que no sea git. Reiniciar solo después de instalar el código nuevo: `systemctl --user restart ime-ops-hub.service`. No está hecho en esta PR.

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
11. Logs visibles: `ops/srv1715444/ime_log.py` escribe en `~/logs/<script>.log` (5×2 MB) y no guarda secretos. El diff de crontab está en `ops/srv1715444/crontab.diff` y no está aplicado. `rotate-user-logs.sh` lista los logs nuevos; tampoco está instalado.
12. `hostinger_direct.py` queda en lectura IMAP. `imeia/plugins/bot-forge/notify.py` y `enviar_cola.py` no usan SMTP: dejan la solicitud en la cola de Emilio. Estos archivos no estaban en el checkout; si en el servidor el script de Hostinger tiene más comandos de lectura, se conservan y se quita solo la parte que enviaba. Lo mismo con `notify.py`: se sustituye el SMTP por `solicitud_emilio.solicitar`.
13. Los demás scripts del inventario que no están en el repo (documenso, tablón, tg_read, modo, boteator, docling, vigila_corte_sondeo) siguen en el servidor. El mismo cambio es `except: pass` → `log.exception(...)` con `ime_log`. No se tocó WhatsApp ni las Edge de IMEIA.


