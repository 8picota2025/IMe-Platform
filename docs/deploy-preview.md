# PR preview deploy (Hostinger FTP)

Workflow: `.github/workflows/deploy-preview.yml`.

## Cuándo corre

- Eventos de PR hacia `develop`, `preprod` o `main`: `opened`, `synchronize`, `reopened`, `ready_for_review`, `closed`.
- No despliega PRs en **draft**.
- Concurrency por número de PR (`cancel-in-progress: true`).

## Build y URL

1. `npm ci` + `npm run build` con `PUBLIC_NOINDEX=1`.
2. Se sobrescribe `dist/robots.txt` con `Disallow: /`.
3. La cabecera `X-Robots-Tag` la aplica `public/.htaccess` (SetEnvIf sobre `/<PR>/`); viaja en el deploy.
4. FTP sube `dist/` a:

   `HOSTINGER_PREVIEW_PATH/<PR>/` (secreto GitHub; si está vacío → `/<PR>/` en la raíz FTP del sitio).

5. Comentario en el PR con la URL:

   - Si `HOSTINGER_PREVIEW_DOMAIN` está definido: `https://preview-<PR>.<dominio>/es/`
   - Si no: `https://i-me.com.co/<PR>/es/`

Los enlaces internos de la copia apuntan a la raíz de producción (assets compartidos).

## Exclusiones FTP

No se suben de nuevo los PDF/imágenes de fabricantes (~950 ficheros por preview):

```text
**/assets/productos/importados/**
assets/productos/importados/**
```

`dangerous-clean-slate: false` — no borra el resto del hosting.

## Limpieza al cerrar el PR

Job `cleanup` cuando `action == closed`:

- Borra solo la carpeta `/<PR>/` (o `${PREVIEW_PATH}/<PR>`).
- Guardas: el número de PR debe ser solo dígitos; rechaza rutas con comillas, `..`, espacios o destino `/`.
- Si `HOSTINGER_PREVIEW_PATH` está vacío, el target es `/<PR>` (mismo criterio que el deploy).
- Verifica con `lftp cls` del **padre** que el nombre del PR desapareció (un `cls` del propio directorio listaba contenido y podía marcar el job en rojo aunque la carpeta ya no existiera).

Motivo: la cuenta FTP comparte cuota con producción; previews huérfanas provocaron `Disk quota exceeded` y rompían deploys.

## Limpieza legacy (batch)

`.github/workflows/prune-closed-previews.yml` — `workflow_dispatch` con `dry_run` (default `true`).

- Lista fija de PRs fusionados hasta 2026-10-12; **no** añadir PRs abiertos.
- Exige `HOSTINGER_PREVIEW_PATH` absoluto no vacío (a diferencia del cleanup por PR, que tolera secreto vacío).

## Producción

`deploy-prod.yml` incluye un paso aparte que elimina carpetas numéricas legacy en la raíz FTP (timeout 18 min). No sustituye el cleanup por PR; es barrido histórico.

## Secretos

| Secreto | Uso |
| --- | --- |
| `HOSTINGER_FTP_HOST` / `USER` / `PASSWORD` | Deploy y cleanup |
| `HOSTINGER_PREVIEW_PATH` | Prefijo FTP (vacío = raíz del jail) |
| `HOSTINGER_PREVIEW_DOMAIN` | Subdominio opcional `preview-<PR>.*` |
| Resto del build | Igual que CI (Supabase publishable, Turnstile, Sentry, etc.) |

## Comprobar manualmente

1. Abrir la URL del comentario del PR → debe cargar `/es/` y llevar `noindex`.
2. Cerrar el PR → job `Limpiar vista previa del PR cerrado` en verde.
3. Tras cleanup, la carpeta no debe listarse bajo el padre FTP.
