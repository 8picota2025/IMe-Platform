# ops/hub/original — copia de referencia (31-10-2026)

Origen: srv1715444 (Hermes, 100.80.80.8), copiado sin modificar el servidor.

| Archivo | Ruta en srv | mtime (COT) |
|---|---|---|
| ime-ops-hub.py | /home/shoky/bin/ime-ops-hub.py | 2026-10-25 18:46 |
| sync_obsidian_kanbans.py | /home/shoky/bin/sync_obsidian_kanbans.py | 2026-10-24 22:31 |
| ime-cluster-ha.py | /home/shoky/bin/ime-cluster-ha.py.bak-20261031-1311 (versión ORIGINAL, antes de desactivar la llamada a sync_obsidian_kanbans.py) | 2026-10-24 20:28 |

Redacción: en ime-ops-hub.py se sustituyeron por `<REDACTED:NOMBRE>` los valores por defecto de IME_OPS_TOKEN, IME_OPS_SECRET, IME_OPS_TOTP_SECRET y las contraseñas literales del login (OPS_ADMIN_PASSWORD_1, OPS_ADMIN_PASSWORD_2, OPS_GERENCIA_PASSWORD). Los otros dos archivos no contenían secretos literales (leen claves de ficheros de configuración en runtime). Las credenciales expuestas en el original deben rotarse y moverse a variables de entorno.

Los correos de contacto de B. Braun y Fresenius Kabi no van en este árbol. En la versión nueva se leen de `IME_CONTACTO_BBRAUN` y `IME_CONTACTO_FRESENIUS`. En esta copia de `sync_obsidian_kanbans.py` quedaron como `$IME_CONTACTO_BBRAUN` y `$IME_CONTACTO_FRESENIUS`.
