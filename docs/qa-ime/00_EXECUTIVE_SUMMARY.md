# QA IME — Resumen ejecutivo

Fecha: 2026-08-29. Alcance: discovery local, build, tests, análisis estático y
verificación pública limitada. Sin escritura en producción, Supabase ni clientes.

Nota: el audit de npm quedó sin resultado porque el entorno no resolvió el
registry; no se interpreta como ausencia de vulnerabilidades.

## Estado

| Área             | Estado               | Evidencia                                                                        |
| ---------------- | -------------------- | -------------------------------------------------------------------------------- |
| Web pública      | 🟡 Mejorable         | Home pública observada 200 tras `/` → `/es/`; crawl completo pendiente           |
| Catálogo         | 🟢 Correcto en build | 708 equipos/19 categorías observados públicamente; 715 HTML producto ES en build |
| CMS/comercial    | 🟡 Mejorable         | Auth y pagos probados; CRUD, CRM y cobertura comercial completa pendientes       |
| Infraestructura  | 🟡 Mejorable         | Hostinger estático + Supabase; preprod no demostrado                             |
| Seguridad        | 🟡 Riesgo operativo  | Auth y pagos probados; RLS/RBAC, webhooks y CORS completos pendientes            |
| Performance      | 🟠 Riesgo            | evidencia documental: 3.1 MB, Lighthouse 0.66–0.79; medición nueva pendiente     |
| SEO              | 🟢 Base sólida       | sitemap, robots, llms.txt, canonical/hreflang y auditoría SEO pasan              |
| Datos            | 🟠 Riesgo            | 90/476 productos sin embedding en snapshot documentado                           |
| Automatizaciones | 🟡 Mejorable         | 41 Edge Functions y workflows; pruebas externas pendientes                       |
| Observabilidad   | 🟡 Mejorable         | Sentry/telemetry declarados; smoke productivo pendiente                          |
| Backups/DR       | 🟠 Riesgo            | restauración real no demostrada                                                  |
| Testing          | 🟢 Local             | 32 archivos Vitest, 245 tests; E2E/producción incompletos                        |

## Hallazgos prioritarios

1. F5 operativa/legal no cerrada: RAG, emails completos, preprod y revisión legal siguen pendientes.
2. Build puede usar mock cuando Supabase no entrega filas; riesgo de publicar catálogo desactualizado.
3. FTP incremental tiene historial de desincronización y deploy parcial.
4. 90 productos sin embedding degradan recuperación del asesor.
5. Performance documentada bajo objetivo y con JavaScript no usado.

## Recomendación

Primero cerrar quality gate de build con datos reales y smoke preprod; luego validar
leads/cotizaciones, emails y webhooks; después performance/SEO y finalmente canary.
No desplegar desde cambios locales no atribuidos ni cerrar pagos sin registrar alcance,
ambiente y evidencia de las pruebas ya realizadas.
