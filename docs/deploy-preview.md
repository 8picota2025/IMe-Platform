# Despliegue de vista previa por PR

Workflow: `.github/workflows/deploy-preview.yml`.

## Trigger

PRs (no borrador) contra `develop`, `preprod` o `main`: `opened`, `synchronize`, `reopened`, `ready_for_review`. También tras `pull_request_review` submitted.

## Build

- `npm ci` + `npm run build` con `PUBLIC_NOINDEX=1`.
- `dist/robots.txt` → `Disallow: /` (coherencia; la cabecera principal es `X-Robots-Tag` vía `.htaccess` en `dist/`).

## FTP

- Acción: `SamKirkland/FTP-Deploy-Action@v4.3.5`.
- Destino: `${HOSTINGER_PREVIEW_PATH}/${PR_NUMBER}/` (si el secreto está vacío, ruta `/${PR}/` en la raíz del FTP → URL `https://i-me.com.co/<PR>/es/`).
- **Excluye** `assets/productos/importados/**` (~950 archivos por PR; en prod ya existen).
- `dangerous-clean-slate: false` (incremental).

Comentario en el PR con la URL. Si `HOSTINGER_PREVIEW_DOMAIN` está definido: `https://preview-<PR>.<dominio>/es/`.

## Limpieza al cerrar el PR

Job `cleanup` cuando `action == closed`:

- Borra solo la carpeta numerada del PR (validación estricta de ruta; nunca la raíz).
- `lftp rm -r`; verifica que el nombre del PR no aparece en el listado del padre.
- Objetivo: evitar «Disk quota exceeded» en la cuenta FTP compartida con producción.

## Secretos GitHub

| Secret | Uso |
| ------ | --- |
| `HOSTINGER_FTP_HOST` / `USER` / `PASSWORD` | Subida y limpieza |
| `HOSTINGER_PREVIEW_PATH` | Prefijo en el servidor (vacío = raíz FTP) |
| `HOSTINGER_PREVIEW_DOMAIN` | Subdominio opcional en el comentario |
| Resto de `PUBLIC_*` / Turnstile / Sentry | Igual que build de prod |

## Tests

`scripts/preview-noindex.test.mjs` — aserciones sobre el workflow y noindex.