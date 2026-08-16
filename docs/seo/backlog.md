# SEO backlog I-ME — Phase 0 inventory (2026-08-16)

Fuente audit: `~/Desktop/audit-seo-i-me-com-co.md`  
Plan: `docs/plans/2026-08-16-seo-audit-implem.md`  
CSV: [`seo-backlog.csv`](./seo-backlog.csv)

## Baseline verificado (no rehacer)

| Check                                        | Resultado                                                        |
| -------------------------------------------- | ---------------------------------------------------------------- |
| HTTPS                                        | OK                                                               |
| hreflang `es` / `es-CO` / `en` / `x-default` | OK en prod                                                       |
| `sitemap-index.xml`                          | HTTP 200 → `sitemap-0.xml` (~708 PDP ES)                         |
| `robots.txt`                                 | Disallow `/admin/`, `/comercial/`, `/_astro/`; Sitemap declarado |
| Organization / Product / FAQ JSON-LD         | OK helpers + uso home/PDP                                        |
| `llms.txt`                                   | Presente                                                         |
| Title home                                   | Ya optimizado (`buildHomeSeo`)                                   |

## Datos que faltaron en esta sesión

| Fuente                   | Estado                                                        |
| ------------------------ | ------------------------------------------------------------- |
| GSC top 50 queries/pages | **Manual** — sin export API aquí                              |
| PageSpeed Insights móvil | **429 quota** — re-correr home `/es/`, `/es/catalogo/`, 1 PDP |
| GSC sitemap submit       | Ops: confirmar property `i-me.com.co`                         |

## Top 20 PDP (proxy sin GSC)

Priorizados por intents del audit (monitores, desfibrilador, ventilador, infusión, ECG, US, neo, cirugía, arco C, autoclave). Lista en CSV phase=1.

Keywords `seo_keywords_es/en` sembradas en `mock-productos.json` (17 vacíos + merge 3 existentes). **Prod (Supabase):** script `scripts/seed-seo-keywords-top20.mjs` — ejecutar con service role.

## Gaps abiertos por fase

| Phase | Gap                                                      | Priority        |
| ----- | -------------------------------------------------------- | --------------- |
| 1     | Titles PDP vía `buildProductoPageTitle` + keywords top20 | P0 **en curso** |
| 2     | Copy + FAQ categorías                                    | P1              |
| 3     | Landings ciudad                                          | P1              |
| 4     | Cadencia blog                                            | P1              |
| 5     | CWV/LCP                                                  | P2              |
| 6     | GMB + lead magnets                                       | P2–P3           |

## Owners

- **eng** — código SEO, CWV, deploy
- **copy** — keywords/textos
- **seo** — GSC/medición
- **marketing** — GMB/backlinks
