# Landings consultivas de campaña (SEO B2B)

Páginas estáticas orientadas a intención de compra institucional (quirófano, imagen, movilidad, etc.). Copy en código; formulario conectado a CRM vía `registrar-lead-comercial`.

## Arquitectura

```text
src/data/comercial-landings.ts   → copy + productSlugs + FAQs
src/data/fabricante-landings.ts  → perfiles de marca (sin logo del fabricante)
src/lib/comercial-leads.ts       → tipos CampaignLandingId, Turnstile opcional
src/components/CampaignLandingPage.astro
src/pages/es/{slug}.astro        → getCampaignLanding(id, 'es')
src/pages/en/{slug}.astro        → getCampaignLanding(id, 'en')
```

Índice de campañas: `/es/proyectos/` · `/en/projects/` (`listCampaignLandings`).

## Campañas estándar (2026-08)

| ID | ES | EN | Familia catálogo |
| -- | -- | -- | ---------------- |
| `torres_laparoscopia` | `/es/torres-laparoscopia/` | `/en/laparoscopy-towers/` | `sala-cirugia` |
| `esterilizacion` | `/es/esterilizacion/` | `/en/sterilization/` | `esterilizacion-control-infecciones` |
| `imagenologia` | `/es/imagenologia/` | `/en/imaging/` | `radiologia` |
| `robotica_rehabilitacion` | `/es/robotica-rehabilitacion/` | `/en/robotics-rehabilitation/` | `robots` |
| `caminadores_adultos` | `/es/caminadores-para-adultos/` | `/en/adult-walkers/` | `movilidad-rehabilitacion` / tipo `caminadores` |
| `sillas_ruedas` | `/es/sillas-de-ruedas/` | `/en/wheelchairs/` | `movilidad-rehabilitacion` / tipo `sillas-de-ruedas` |

IDs especiales (no en `listCampaignLandings`): `proyectos`, `pdf_descarga`, `evento`, y landings de fabricante (`fab_*`).

## Añadir una campaña

1. **Extender el tipo** en `src/lib/comercial-leads.ts` → `CampaignLandingId`.
2. **Copy ES/EN** en `comercial-landings.ts`: objeto `ContentMap` + entrada en `META` y `BY_ID`.
3. **Páginas Astro** en `src/pages/es/` y `src/pages/en/` que importen `CampaignLandingPage` + `getCampaignLanding`.
4. **Product slugs** — solo referencias que existen en catálogo vivo o mock verificado (`productSlugs[]`). El test `src/lib/seo-p0.test.ts` valida slugs contra catálogo.
5. **Footer / proyectos** — añadir enlace en hub si aplica (`listCampaignLandings` lo incluye automáticamente).
6. **Turnstile** — campañas en `OPTIONAL_TURNSTILE_CAMPAIGNS` (`comercial-leads.ts`) omiten captcha en modal navbar; landings consultivas en página sí lo exigen salvo excepción documentada.
7. **Post-deploy** — actualizar `public/llms.txt` y verificar sitemap tras rebuild.

## Restricciones de contenido

- Sin claims clínicos inventados ni precios comprometidos.
- Sin logos ni contacto directo del fabricante en landings de marca (`brandProfileBody` es texto I-ME).
- `description` ~150–160 caracteres; `title` coherente con `src/lib/seo.ts` (sufijo `| I-ME` idempotente).
- Tipologías (`TypologyItem`) describen categorías de producto, no fichas individuales.

## SEO técnico

- JSON-LD Organization en layout; landings usan `buildPageTitle` / canonical por locale.
- Landings de familia de catálogo (distintas de campaña) viven en `src/data/familia-seo.ts` y rutas `/es/familias/[slug]/` — ver migraciones de corrección de familias en `src/lib/datos.ts` (`PRODUCT_FAMILY_CORRECTIONS`).
- Tests: `npm run check` → `seo-p0.test.ts` (slugs, títulos, listado campañas).

## Flujo comercial

Envío del formulario → Edge `registrar-lead-comercial` → `leads_comerciales` → sync Twenty (best-effort) → emails internos.

Ver también:

- `docs/crm-flujos-normalizados.md` — pipeline CRM.
- `docs/twenty-integration.md` — mapeo Twenty.
- `docs/observabilidad.md` — canary de cotización (flujo distinto pero relacionado).
