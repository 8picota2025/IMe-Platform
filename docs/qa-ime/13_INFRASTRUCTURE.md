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
