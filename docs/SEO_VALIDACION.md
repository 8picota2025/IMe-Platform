# SEO_VALIDACION — fix/seo-crawlers-blog

> Root `VALIDACION.md` queda para F4.2 comercio. Este archivo es el entregable SEO del prompt `cursorseo1309.md`.

- **Fecha:** 2026-09-13
- **Rama:** `fix/seo-crawlers-blog`
- **Entorno:** local `/home/shoky/cursor/ime-platform` + probes HTTPS a `https://i-me.com.co`
- **Commit:** `02382d4`

## Archivos modificados

- `public/robots.txt`
- `public/.htaccess`
- `astro.config.mjs`
- `scripts/sitemap-indexability.mjs` (nuevo)
- `scripts/validate-seo.mjs` (nuevo)
- `scripts/sitemap-seo.mjs`
- `src/i18n/utils.ts`
- `src/lib/sitemap-seo.test.ts`
- `package.json`
- `docs/SEO_CRAWL_AUDIT.md`
- `docs/SEO_VALIDACION.md`
- `REMEDIACION.md` (sección crawlers)

## Comandos ejecutados

```bash
npm test -- --run src/lib/sitemap-seo.test.ts   # 5 PASS
npm run build                                   # 1659 pages, sitemap-index OK
npm run validate:seo                            # OK — 6 sitemap XML, 1628 URLs
npm run audit:seo-build                         # OK — 1660 HTML, 7 sitemap XML
```

## Política robots (dist)

```text
User-agent: *
Disallow: /admin/
Disallow: /admin
Disallow: /comercial/
Disallow: /comercial
Disallow: /mkt/
Disallow: /mkt
Disallow: /77/
Disallow: /1old/
Disallow: /es/pago/
Disallow: /en/payment/

Sitemap: https://i-me.com.co/sitemap-index.xml
```

Sin grupos Googlebot/Bingbot. Sin `/_astro/`.

## Sitemap generado

- `sitemap-index.xml` → products-0..2, knowledge-0, pages-0
- ~1628 URLs página tras filtros
- Excluye: admin, pago, 77, 1old, blog, cotización, publicar/publish, `/productos/test/`
- Incluye: conocimiento/knowledge

## Redirects

Local: reglas en `.htaccess`. Post-deploy:

```bash
curl -I https://i-me.com.co/blog
curl -I https://i-me.com.co/conocimiento
curl -I https://i-me.com.co/en/blog
curl -I https://i-me.com.co/knowledge
```

## HTTP externo (pre-deploy)

| Recurso                         | Resultado               |
| ------------------------------- | ----------------------- |
| robots / sitemap / conocimiento | 200                     |
| blog                            | 404 (pre-fix)           |
| Googlebot UA                    | sin 403 en SEO públicos |
| Causa WAF                       | **UNCONFIRMED**         |
| Capa                            | Hostinger hcdn          |

## HUMAN_POST_DEPLOY

1. GSC: sitemap-index.xml
2. Inspección `/es/conocimiento/`
3. Artículo ES + EN
4. Confirmar robots sin `/_astro/` + chunks 200
5. Borrar `sitemap-0.xml` huérfano si aplica (ops)

## Riesgos pendientes

- Drift FTP/docroot (`release-manifest` 404 live)
- Sin mapa `/blog/<slug>` legacy

## Seguimiento 2026-10 (`fix/seo-audit-1026`, merge #166)

Cambios en código ya en `main` (verificar tras cada deploy prod):

| Área | Qué hace | Dónde mirar |
| ---- | -------- | ----------- |
| Barras finales | Política `trailingSlash: 'always'`; redirects sin cadena 301→301 | `public/.htaccess`, rutas EN contacto |
| Duplicados catálogo | 301 del slug retirado al canonical del sitemap | `.htaccess` + `supabase/retirar-duplicados-seo1026.sql` |
| Productos retirados | 410 Gone para slugs dados de baja (HTML legacy en FTP) | Bloque «Productos retirados» en `.htaccess` |
| Catálogo sin 404 internos | Landings/enlaces sin productos `activo=false` | Build + `docs/catalogo-productos-retirados.md` |
| Previews PR | Carpetas `/<PR>/` con `X-Robots-Tag` + build `PUBLIC_NOINDEX` | `docs/deploy-preview.md` |

Comandos de regresión local (sin sustituir smoke post-deploy):

```bash
npm run validate:seo
npm run audit:seo-build
```
