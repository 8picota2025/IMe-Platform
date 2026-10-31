# Infraestructura y despliegue

- Frontend: Astro estático en Hostinger vía FTP.
- Backend: Supabase alojado, Edge Functions, Postgres, Auth y Storage.
- CI/CD: workflows para CI, preprod, preview, producción, funciones, migraciones,
  smoke y canary.
- No Docker/systemd/nginx en repo.
- No se confirmó entorno preprod accesible ni despliegue remoto en esta pasada.

Riesgo confirmado documental: FTP incremental tuvo incidentes de desincronización;
workflow usa estado versionado y `cancel-in-progress: false`, pero requiere smoke
postdeploy y rollback probado.

## Vistas previas de PR

Runbook detallado: [`docs/deploy-preview.md`](../deploy-preview.md).

Resumen:

- `.github/workflows/deploy-preview.yml` — build con `PUBLIC_NOINDEX`, FTP a
  `HOSTINGER_PREVIEW_PATH/<PR>/`, comentario con URL, borrado `lftp` al cerrar el PR.
- Cuota compartida con prod: limpieza adicional en `deploy-prod.yml` (carpetas solo numéricas
  bajo `HOSTINGER_PROD_PATH`, timeout 18m, no falla el deploy si expira).
- Poda histórica one-shot: `prune-closed-previews.yml` (`workflow_dispatch`, dry-run primero).
