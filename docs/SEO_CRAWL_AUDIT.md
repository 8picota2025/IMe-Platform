# SEO Crawl Audit — IME Platform

- **Fecha:** 2026-09-13
- **Rama:** `fix/seo-crawlers-blog`
- **Dominio:** `https://i-me.com.co`
- **Stack:** Astro 6 SSG + Apache/`public/.htaccess` + Hostinger `hcdn`
- **Prompt:** `/home/shoky/cursor/cursorseo1309.md`

## 1. Resumen ejecutivo

Hipótesis del prompt (`LIVE_CRAWL_POLICY_BLOCKED` = WAF) **no se confirma** en las pruebas HTTP de esta sesión. Recursos SEO públicos responden **200** con UA normal, Googlebot declarado y UA arbitrario. Capa visible: **Hostinger CDN (`server: hcdn`, `platform: hostinger`)**. No hay headers Cloudflare.

Problemas reales confirmados:

1. `/blog`, `/conocimiento`, `/knowledge`, `/en/blog` → **404** (faltan redirects legacy).
2. **Drift producción vs git:** live `robots.txt` Disallow `/_astro/` (malo); repo no lo tenía.
3. **Sitemap live obsoleto:** `sitemap-index.xml` apunta solo a `sitemap-0.xml`; chunks actuales (`sitemap-pages|products|knowledge-*.xml`) → **404**.
4. `release-manifest.json` → **404** (señal de docroot/FTP desalineado o deploy incompleto).
5. Sitemap live incluye URLs `noindex` (`/es/conocimiento/publicar/`, cotización/quote).
6. hreflang de `publicar` apuntaba a `/en/knowledge/publicar/` (404); canónico EN = `/en/knowledge/publish/`.

## 2. Rutas editoriales reales (repo)

| Ruta                         | Archivo                                                |
| ---------------------------- | ------------------------------------------------------ |
| `/es/conocimiento/`          | `src/pages/es/conocimiento.astro`                      |
| `/es/conocimiento/[slug]/`   | `src/pages/es/conocimiento/[slug].astro`               |
| `/es/conocimiento/publicar/` | `src/pages/es/conocimiento/publicar.astro` (`noindex`) |
| `/en/knowledge/`             | `src/pages/en/knowledge.astro`                         |
| `/en/knowledge/[slug]/`      | `src/pages/en/knowledge/[slug].astro`                  |
| `/en/knowledge/publish/`     | `src/pages/en/knowledge/publish.astro` (`noindex`)     |

No existe árbol `/blog` en `src/pages`.

## 3. `@astrojs/sitemap` (config real)

- Integración en `astro.config.mjs` + `scripts/sitemap-seo.mjs`.
- `trailingSlash: 'always'`, `site: https://i-me.com.co`, `output: 'static'`.
- Chunks: `products`, `knowledge`, resto → `sitemap-pages-*`.
- Filtro: ahora `scripts/sitemap-indexability.mjs` (`isIndexableSitemapUrl`) por pathname/prefijos.

Output local esperado (build actual):

```text
sitemap-index.xml
sitemap-pages-0.xml
sitemap-products-0.xml …
sitemap-knowledge-0.xml
```

## 4. robots.txt

### Repo (antes)

```text
User-agent: *
Disallow: /admin/
Disallow: /comercial/
Disallow: /mkt/
Sitemap: https://i-me.com.co/sitemap-index.xml
```

### Live (2026-09-13)

```text
User-agent: *
Disallow: /admin/
Disallow: /admin
Disallow: /comercial/
Disallow: /comercial
Disallow: /_astro/
Sitemap: https://i-me.com.co/sitemap-index.xml
```

### Política aplicada en esta rama

- Un solo grupo `User-agent: *` (sin Googlebot/Bingbot que eludan Disallow).
- Disallow: admin, comercial, mkt, `/77/`, `/1old/`, `/es/pago/`, `/en/payment/`.
- **Sin** Disallow `/_astro/`.
- Un solo Sitemap: `sitemap-index.xml`.

> `robots.txt` controla crawling voluntario; **no** protege `/admin`. Auth sigue siendo obligatoria.

## 5. `.htaccess`

- Ya: www→apex, `/`→`/es/`, sitemaps alias, `/77/*` legacy, familia query redirects, feed Merchant 302.
- **Añadido:** hubs `/blog`, `/conocimiento`, `/en/blog`, `/knowledge` → conocimiento/knowledge con trailing slash.
- **No** se hizo blanket `/blog/*` (sin mapa de slugs legacy → riesgo soft-404).
- **No** se creó `public/_headers` (Hostinger no lo consume en este proyecto).
- **No** CORS “para Googlebot”.

## 6. Matriz indexabilidad (adaptada)

| Ruta/patrón         | HTTP observado (live) | Indexable | Sitemap |    Robots | Canonical      |
| ------------------- | --------------------: | --------: | ------: | --------: | -------------- |
| `/es/`              |                   200 |        Sí |      Sí |     Allow | self           |
| `/en/`              |                   200 |        Sí |      Sí |     Allow | self           |
| `/es/catalogo/`     |                   200 |        Sí |      Sí |     Allow | self           |
| `/es/conocimiento/` |           301→200 `/` |        Sí |      Sí |     Allow | self           |
| `/en/knowledge/`    |           301→200 `/` |        Sí |      Sí |     Allow | self           |
| `/blog`             |     **404** (pre-fix) |        No |      No |       n/a | → conocimiento |
| `/admin/`           |  200 shell + auth app |        No |      No |  Disallow | n/a            |
| `/es/pago/`         |   **403** (Hostinger) |        No |      No |  Disallow | n/a            |
| `/77/…`             |            301 legacy |        No |      No |  Disallow | destino        |
| `/_astro/…`         |      assets (403 dir) |       n/a |      No | **Allow** | n/a            |

## 7. Evidencia HTTP (sesión)

Headers comunes: `platform: hostinger`, `server: hcdn`, HSTS/CSP de `.htaccess`. Sin `cf-ray` / `via: cloudflare`.

| URL                  | UA                                   |                                Status |
| -------------------- | ------------------------------------ | ------------------------------------: |
| `/robots.txt`        | browser / Googlebot / SEO-Audit-Test |                                   200 |
| `/sitemap-index.xml` | idem                                 | 200 (contenido viejo: solo sitemap-0) |
| `/es/conocimiento/`  | browser                              |                                   200 |
| `/blog`              | browser / Googlebot                  |                                   404 |
| `/es/pago/`          | browser / Googlebot                  |                                   403 |

**UA Googlebot falsificado ≠ bot verificado.** Solo prueba reglas por string.

## 8. Canonical / hreflang

- Artículos y hubs usan `buildCanonical` + `BaseHead` / `getAlternateLinks`.
- Equivalencias de sección en `src/i18n/utils.ts` + `scripts/sitemap-seo.mjs`.
- Fix: nested pair `publicar` ↔ `publish`.
- No se inventaron hreflang artículo↔artículo sin mapping de datos.

## 9. Divergencias prompt ↔ repo

| Prompt                     | Repo/realidad                                                                |
| -------------------------- | ---------------------------------------------------------------------------- |
| WAF bloquea blog/sitemap   | No reproducido; 404 / 200                                                    |
| Crear validate-seo         | Ya existía `audit-seo-build.mjs` → se añade `validate-seo.mjs` y se encadena |
| Sobrescribir VALIDACION.md | Root `VALIDACION.md` = F4.2 → SEO en `docs/SEO_VALIDACION.md`                |
| `sitemap-0.xml` fijo       | Build genera chunks + index                                                  |
| Cloudflare steps           | No aplica (capa = Hostinger)                                                 |

## 10. Causa raíz / hipótesis

| Hallazgo                         | Confianza            | Causa                                                                                                                |
| -------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Blog 404                         | **Confirmado**       | Falta RewriteRule                                                                                                    |
| robots live ≠ git (`/_astro/`)   | **Confirmado** drift | Archivo en docroot no alineado con repo (edición panel o deploy parcial)                                             |
| Sitemap chunks 404 + index viejo | **Confirmado**       | Artefactos antiguos en Hostinger; FTP no destructivo deja `sitemap-0.xml`; index no actualizado o path deploy dudoso |
| release-manifest 404             | **Alta**             | Docroot/FTP path o sync incompleto                                                                                   |
| LIVE_CRAWL_POLICY_BLOCKED        | **No confirmado**    | Posible entorno/herramienta distinta; no visto en curl                                                               |

## 11. Cambios de esta rama (código)

- `public/robots.txt`
- `public/.htaccess` (redirects editorial)
- `scripts/sitemap-indexability.mjs` + `astro.config.mjs`
- `scripts/validate-seo.mjs` + `package.json`
- hreflang `publicar`/`publish` en i18n + sitemap-seo
- Docs: este archivo, `REMEDIACION.md` (sección), `docs/SEO_VALIDACION.md`
