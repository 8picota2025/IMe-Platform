# IME — Remediation backlog

## TASK-F01 — Fail-closed de datos en build

- Prioridad: P0. Impact Score: 25. Esfuerzo: 1/5. Riesgo: 1/5.
- Evidencia: build registró `getProductosBySlugs` con 0 filas y fallback mock.
- Afecta: build, catálogo, productos, SEO.
- Solución: distinguir Supabase vacío esperado de error; exigir snapshot explícito,
  conteo mínimo y artifact; abortar build cuando entorno productivo no entrega datos.
- Aceptación: build CI falla ante 0 filas no justificado; output declara fuente y conteos.
- Pruebas: unit fallback, integración Supabase fixture, build sin credenciales.

## TASK-F02 — Deploy atómico y rollback

- Prioridad: P0. Impact Score: 25. Esfuerzo: 3/5. Riesgo: 2/5.
- Evidencia: workflow FTP incremental e incidentes documentados.
- Solución: release versionada, smoke postdeploy, manifest checksum y rollback probado.
- Aceptación: release incompleta no queda activa; rollback restaura 10 URLs críticas.
- Dependencias: acceso Hostinger/preprod. Estado: NO_EJECUTADO_ENTORNO.

## TASK-F03 — Cerrar validación comercial residual

- Prioridad: P0. Impact Score: 25. Esfuerzo: 3/5. Riesgo: 2/5.
- Afecta: lead, cotización, email, CRM y webhooks. Pagos/Auth: pruebas realizadas;
  falta adjuntar alcance, ambiente y evidencia.
- Aceptación: lead persiste, tiene ID/correlation ID, notifica; email fallido reintenta;
  pago/webhook no duplica; cliente nunca decide aprobación.
- Dependencias: buzón de prueba, proyecto Supabase no productivo y evidencia de pagos/Auth.

## TASK-F04 — Recuperar embeddings faltantes

- Prioridad: P1. Impact Score: 20. Esfuerzo: 3/5. Riesgo: 2/5.
- Evidencia: snapshot documenta 90 de 476 productos sin vector.
- Aceptación: 100% de productos elegibles tienen vector o motivo explícito y métrica diaria.

## TASK-F05 — Performance budgets

- Prioridad: P1. Impact Score: 20. Esfuerzo: 2/5. Riesgo: 1/5.
- Evidencia: Lighthouse histórico 0.66–0.79, 3.1 MB y 248 KiB JS no usado.
- Aceptación: budgets CI y tres corridas móvil/desktop con LCP/INP/CLS documentados.

## TASK-F06 — Seguridad remota y DR

- Prioridad: P1. Impact Score: 25. Esfuerzo: 4/5. Riesgo: 2/5.
- Estado: REQUIERE VERIFICACIÓN; incluye RBAC/IDOR/RLS, webhook replay, CORS,
  uploads, dependencias, backups y restore aislado.
- Aceptación: matriz rol/recurso, reporte OWASP sin Critical/High abiertos y restore
  reproducible con RPO/RTO medidos.

## TASK-F07 — QA E2E/SEO/accessibility

- Prioridad: P1. Impact Score: 20. Esfuerzo: 3/5. Riesgo: 1/5.
- Aceptación: Playwright recorre URLs críticas, filtros/paginación/formularios;
  axe sin violaciones serias; crawl sin enlaces críticos rotos.
