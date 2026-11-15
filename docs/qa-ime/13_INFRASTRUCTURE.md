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

## Runbooks de CI (repo)

| Workflow | Documentación |
| -------- | ------------- |
| `.github/workflows/deploy-supabase-functions.yml` | [supabase-edge-deploy-ci.md](../supabase-edge-deploy-ci.md) — filtro de secrets vacíos, `secrets set --yes`, deploy con reintentos |
| `.github/workflows/deploy-preview.yml` | [deploy-preview.md](../deploy-preview.md) — noindex, exclusión de assets importados, cleanup FTP al cerrar PR |
| Producción FTP / smoke | `DEPLOYMENT_GUIDE.md`, workflows `deploy-prod.yml` / `ci.yml` |

## Catálogo y Asesor (cambios recientes en main)

| Tema | Documentación |
| ---- | ------------- |
| Etiquetas de disponibilidad en PDP/tarjetas | [catalogo-disponibilidad-producto.md](../catalogo-disponibilidad-producto.md) |
| Zuowei sin venta + copy robots servicio | [catalogo-zuowei-y-robotica.md](../catalogo-zuowei-y-robotica.md) |
| RAG híbrido + chunks bge-m3 | [rag-busqueda-hibrida.md](../rag-busqueda-hibrida.md) |
| Cotizaciones IVA USD, recaudo, guarda envío | [commercial-quote-dev.md](../commercial-quote-dev.md) |
