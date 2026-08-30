# Oportunidades de mejora

| Problema                          | Mejora                                        | Impacto             | Coste | Prioridad |
| --------------------------------- | --------------------------------------------- | ------------------- | ----- | --------- |
| Fallback mock puede ocultar drift | Build fail-closed o banner/artifact explícito | calidad y confianza | Bajo  | P0        |
| FTP parcial                       | deploy atómico por release + smoke + rollback | disponibilidad      | Medio | P0        |
| Productos sin vector              | cola de embeddings con retry y métrica        | conversión/asesor   | Medio | P1        |
| Datos comerciales fragmentados    | correlation ID único lead→quote→order→CRM     | ventas              | Medio | P1        |
| QA remoto manual                  | Playwright + contract tests en preprod        | fiabilidad          | Medio | P1        |
| Performance histórica baja        | budgets y carga diferida por ruta             | SEO/CWV             | Medio | P1        |
| DR no demostrado                  | proyecto restore automatizado                 | resiliencia         | Medio | P1        |
| Claims distribuidos               | matriz legal versionada en CI                 | legal               | Bajo  | P1        |
