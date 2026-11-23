# Sincronizador del espejo Obsidian

`sync_vault_state.py` regenera `Estado-Vivo-CMS-y-RFQs.md` (y las capas `.abstract.md` / `.overview.md`) desde `solicitudes_cotizacion`, consultando por `numero` y omitiendo filas con `archived_at`.

La sección 1 lista solo cotizaciones abiertas, ordenadas por total, con aprobación (`PENDIENTE` si faltan `aprobado_por` / `aprobado_at`) y alertas `NO ENVIAR` (en `notas_internas`) y `send_error`.

## Entorno

| Variable | Uso |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Token de la Management API. No va al repo ni al log. |
| `IME_SUPABASE_PROJECT_REF` | Proyecto. Si falta, usa `nnfbucwiasuggyfoyydo`. |
| `IME_SUPABASE_MGMT_URL` | URL completa de la consulta. Pisotear el default en pruebas. |
| `IME_VAULT` | Directorio del espejo. |
| `IME_SENT_LOG` | Bitácora de envíos. Solo se anota conteo y fecha de modificación. |
| `IME_CMS_CACHE` | Caché CMS. Solo se anota tamaño o conteo y fecha de modificación. |
| `IME_HERMES_PROFILES` | Directorios de perfiles, separados por `:`. |
| `IME_INSTALL_RSYNC` | `1` intenta instalar rsync si falta. La copia no lo usa. |

## Salidas

| Código | Significado |
| --- | --- |
| 0 | Panel escrito. |
| 1 | Excepción o falta `IME_VAULT`. |
| 2 | No hay datos frescos. El panel previo queda intacto. |
| 3 | El espejo local se escribió y falló la réplica a Hermes. |

Cada línea de error lleva hora `America/Bogota` y sale por stderr.

## Réplica

`hermes-perfiles-aplicar.sh` copia con Python. rsync no es necesario. Con `IME_INSTALL_RSYNC=1` intenta `apt-get install rsync` y, si no puede, copia igual.

## Reloj

No está instalado. Tras el OK de Shoky, el usuario `shoky` en srv1715444 (sin root) puede pegar `crontab.snippet`, o importar `n8n/panel-sync-15min.json` dejándolo inactivo hasta ese OK. El log va a `~/.local/state/panel/log`.

La ejecución real, hecha por operación, debe dejar `updated:` reciente y `source: supabase_management_api`.
