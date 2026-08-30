# Hallazgos priorizados

Fórmula: `Impact Score = (business + user + security + reliability + SEO) ×
probability`; `Priority Score = Impact Score / (effort + change risk)`.
Cada escala es 1–5. Hipótesis llevan estado explícito.

| ID   | Estado                | Área        | Evidencia                                       | Severidad | Prioridad |
| ---- | --------------------- | ----------- | ----------------------------------------------- | --------- | --------- |
| F-01 | CONFIRMADO            | Datos/build | fallback mock tras 0 filas Supabase en build    | HIGH      | P0        |
| F-02 | CONFIRMADO            | Deploy      | FTP incremental con incidentes documentados     | HIGH      | P0        |
| F-03 | CONFIRMADO            | RAG         | 90/476 sin embedding en snapshot                | MEDIUM    | P1        |
| F-04 | CONFIRMADO            | Performance | 3.1 MB, Lighthouse 0.66–0.79 documentado        | MEDIUM    | P1        |
| F-05 | CONFIRMADO            | F5          | RAG, email completo, preprod y legal pendientes | HIGH      | P0        |
| F-06 | REQUIERE VERIFICACIÓN | Seguridad   | RBAC/IDOR, webhooks/CORS remotos                | HIGH      | P0        |
| F-07 | REQUIERE VERIFICACIÓN | DR          | restore no demostrado                           | HIGH      | P1        |
| F-08 | REQUIERE VERIFICACIÓN | UX/SEO      | crawl HTTP, mobile, axe y CWV completos         | MEDIUM    | P1        |

No se reportan bugs de producción sin reproducción externa.
