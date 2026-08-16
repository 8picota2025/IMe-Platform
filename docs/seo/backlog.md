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

## Ops manual (GSC / PSI / GMB) — checklist

Sin API GSC en este entorno. Hacer en Search Console (property `https://i-me.com.co/`):

1. **Sitemaps** → enviar/confirmar `https://i-me.com.co/sitemap-index.xml`
2. **Inspección de URL** (solicitar indexación) para:
   - `/es/ciudades/bogota/`, `/es/ciudades/medellin/`, `/es/ciudades/cali/`
   - `/es/familias/monitores/`, `/es/recursos/`
   - 4 posts conocimiento Phase 4 (ver `editorial-calendar.md`)
3. **Rendimiento** → export CSV top 50 queries + top pages → pegar en `docs/seo/` (fecha en nombre)
4. **GMB** (Envigado HQ): 1 post/mes enlazando landing ciudad + 1 guía conocimiento
5. **PSI móvil** (cuando haya cuota): home, catálogo, 1 PDP top — anotar LCP/CLS en backlog

| Fuente                    | Estado                           |
| ------------------------- | -------------------------------- |
| GSC top 50 queries/pages  | **Manual** — checklist arriba    |
| PageSpeed Insights móvil  | Re-intentar; antes 429 quota     |
| GSC sitemap + URL inspect | Ops humano — checklist arriba    |
| GMB posts                 | Ops marketing — checklist arriba |

## Top 20 PDP (proxy sin GSC)

Priorizados por intents del audit (monitores, desfibrilador, ventilador, infusión, ECG, US, neo, cirugía, arco C, autoclave). Lista en CSV phase=1.

Keywords `seo_keywords_es/en` sembradas en `mock-productos.json` (17 vacíos + merge 3 existentes). **Prod (Supabase):** script `scripts/seed-seo-keywords-top20.mjs` — ejecutar con service role.

## Gaps abiertos por fase

| Phase | Gap                              | Priority    |
| ----- | -------------------------------- | ----------- |
| 1     | Titles PDP + keywords top20      | P0 **done** |
| 2     | Copy + FAQ categorías / familias | P1 **done** |
| 3     | Landings ciudad                  | P1 **done** |
| 4     | 4 posts conocimiento + linking   | P1 **done** |
| 5     | CWV/LCP (medición PSI)           | P2 ops      |
| 6     | GMB + GSC indexación             | P2–P3 ops   |

## Owners

- **eng** — código SEO, CWV, deploy
- **copy** — keywords/textos
- **seo** — GSC/medición
- **marketing** — GMB/backlinks
