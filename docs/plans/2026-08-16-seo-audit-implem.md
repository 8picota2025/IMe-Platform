# Plan: SEO I-ME — implementación post-auditoría

**Fuente:** `/home/shoky/Desktop/audit-seo-i-me-com-co.md` (2026-08-16)  
**Repo:** `ime-platform` (`https://i-me.com.co`)  
**Score audit:** 65/100 · Meta: +30% tráfico orgánico / 6 meses

---

## 0. Baseline real (no rehacer)

Verificado en código + prod (2026-08-16). El informe asume gaps que **ya están parcialmente cubiertos**:

| Ítem audit           | Estado real          | Evidencia                                                                        |
| -------------------- | -------------------- | -------------------------------------------------------------------------------- |
| HTTPS                | ✅                   | prod                                                                             |
| hreflang ES/EN       | ✅                   | `BaseHead.astro` + `getAlternateLinks()` → `es`, `es-CO`, `en`, `x-default`      |
| Sitemap              | ✅                   | `@astrojs/sitemap` → `robots.txt` apunta a `/sitemap-index.xml` (HTTP 200)       |
| robots.txt           | ✅                   | bloquea `/admin/`, `/comercial/`, `/_astro/`; no bloquea CSS/JS públicos         |
| Organization schema  | ✅                   | `buildOrganizationJsonLd()` en home, nosotros, catálogo, servicios, conocimiento |
| Product + FAQ schema | ✅                   | `es/productos/[slug].astro` / `en/products/[slug].astro`                         |
| Breadcrumb JSON-LD   | ✅                   | helpers en `seo.ts` + uso en PDP                                                 |
| `llms.txt`           | ✅                   | `public/llms.txt` con intents y secciones                                        |
| Title home           | ✅ (mejor que audit) | `buildHomeSeo()` ya incluye valor + Colombia + financiamiento                    |
| Meta productos       | ⚠️ parcial           | `buildProductoSeo()` = `Nombre \| I-ME`; falta modelo/beneficio keyword          |

**Implicación:** plan se centra en **gaps reales**, no en reimplementar hreflang/sitemap/Organization.

---

## 1. Objetivo y KPIs

| KPI                                  | Baseline       | Meta 90 días           | Cómo medir                |
| ------------------------------------ | -------------- | ---------------------- | ------------------------- |
| Tráfico orgánico                     | GSC actual     | +15% (hacia +30% a 6m) | GSC + GA4                 |
| Keywords top-10 (lista §10 audit)    | ranking actual | ≥5 en top 20           | GSC queries               |
| Leads orgánico (contacto/cotización) | GA4 eventos    | +10%                   | `contacto` / quote submit |
| LCP móvil home + PDP top             | PSI            | LCP ≤2.5s p75          | CWV / PSI                 |
| Indexación landings ciudad           | 0              | 3 URLs indexadas       | GSC URL inspection        |

Toda acción debe poder mapearse a: leads, ranking, o CWV.

---

## 2. Fases de desarrollo

### Phase 0 — Inventario y verdad (1 día)

**Goal:** lista de trabajo priorizada con datos, no opiniones del PDF.

- [x] Export GSC top 50: **manual pendiente** (sin API) — ver `docs/seo/backlog.md`
- [x] Listar top 20 productos (proxy intents audit → `docs/seo/seo-backlog.csv`)
- [x] PSI móvil: **429 quota** — re-run ops; anotado en backlog
- [x] Sitemap live 200; GSC submit = ops pendiente
- [x] Diff + `docs/seo/backlog.md` + CSV

**Done when:** hoja `seo-backlog.csv` con URL, gap, priority, owner.

**Files:** `docs/seo/backlog.md` (nuevo)

---

### Phase 1 — P0 titles/meta top productos (3–5 días) · Impacto alto

**Goal:** titles únicos con keyword + tipo + beneficio; sin inventar specs.

**Approach:**

1. Extender `buildProductoSeo()` para título tipo:  
   `{nombre} | {familia/tipo} INVIMA | I-ME` (ES) / equivalente EN  
   Reglas: max ~60 chars; no duplicar marca dos veces; usar `seo_keywords[0]` si cabe.
2. Revisar `seo_keywords` / `descripcion_corta` en CMS/admin para top 20 (dato editorial, no hardcode).
3. Tests en `seo.test.ts` para truncado y unicidad.
4. Meta description: asegurar primary intent + mercado (ya parcialmente en helper).

**Anti-patterns:** keywords stuffing; inventar “mejor precio”; titles idénticos entre SKUs hermanos.

**Done when:**

- [x] `buildProductoPageTitle` + keywords top20 (mock + Supabase)
- [x] Tests unitarios pasan
- [ ] Spot-check HTML prod post-deploy

**Files:**

- `src/lib/seo.ts` (`buildProductoSeo`)
- `src/lib/seo.test.ts`
- datos producto (admin / CSV sync) — solo campos SEO existentes

---

### Phase 2 — P0/P1 schema + categorías (1 semana)

**Goal:** cerrar huecos de rich results y contenido único en categorías.

**2a — Product / MedicalDevice**

- [ ] Enriquecer `buildProductJsonLd`: `additionalType` / `category` estable; `gtin`/`mpn` solo si dato real existe
- [ ] Opcional: `@type: ["Product","MedicalDevice"]` **solo** si hay campo certificable (INVIMA/CE) en row — no inventar
- [ ] Home: confirmar Organization en `<head>` (ya); añadir `sameAs` redes reales cuando existan (LinkedIn, etc.)

**2b — Categorías / familias**

- [ ] Audit H1–H3 en templates de familia/categoría
- [ ] Bloque copy único 150–300 palabras por familia top (UCI, cardio, cirugía, neo, US, IV) — i18n ES/EN
- [ ] FAQ por categoría + `buildFaqJsonLd` en página familia (no solo PDP)

**Done when:** Rich Results Test OK en 3 PDP + 2 categorías; copy no es grid-only.

**Files:**

- `src/lib/seo.ts`
- templates familia/categoría bajo `src/pages/es/` / `en/`
- `src/i18n/` o `src/data/` para copy categoría

---

### Phase 3 — P1 landings ciudad (1–2 semanas) · Impacto alto leads locales

**Goal:** 3 landings indexables: Bogotá, Medellín, Cali (luego Barranquilla).

**Approach:**

1. Rutas: `/es/ciudades/{slug}/` + `/en/cities/{slug}/` (o patrón ya usado en landings comerciales)
2. Contenido: cobertura I-ME, tipos de cliente, categorías fuerte, CTA cotización, NAP Envigado (HQ), **sin inventar oficinas locales**
3. JSON-LD: `Service` + `areaServed` City; breadcrumb; Organization `@id` ref
4. Internal links: home, catálogo, contacto ↔ ciudades
5. Entrada sitemap automática (páginas Astro)

**Anti-patterns:** fake street address por ciudad; thin doorways (mismo texto ×3).

**Done when:**

- [ ] 3× ES + 3× EN live
- [ ] GSC URL inspect “can be indexed”
- [ ] CTA → `/es/contacto` o flujo cotización existente

**Files:**

- `src/data/city-landings.ts` (nuevo)
- `src/pages/es/ciudades/[slug].astro`
- `src/pages/en/cities/[slug].astro`
- nav/footer links selectivos

---

### Phase 4 — P1/P2 contenido conocimiento + linking (continuo 30 días)

**Goal:** 1 pieza/semana en `/es/conocimiento/` alineada a keywords §10 audit.

**Cadencia editorial (no solo code):**
| Semana | Tema (ES) | Keyword ancla |
|--------|-----------|---------------|
| 1 | Guía monitores multiparamétricos UCI | monitores multiparamétricos UCI |
| 2 | Desfibrilador INVIMA: checklist compra | desfibrilador INVIMA certificado |
| 3 | Financiamiento equipos médicos Colombia | financiamiento equipos médicos Colombia |
| 4 | Ventilador mecánico: criterios hospital | ventilador mecánico hospital |

**Dev support:**

- [ ] Template post: H2/H3, TOC, CTA, related products (slugs reales)
- [ ] Internal links automáticos o checklist en PR editorial
- [ ] Author org attribution consistente (ya Organization)

**Done when:** ≥4 posts publicados + cada uno enlaza ≥2 PDP/categoría.

---

### Phase 5 — P2 Core Web Vitals / imágenes (2 semanas, paralelo)

**Goal:** LCP/CLS en home + PDP top.

- [ ] Inventario imágenes hero/PDP sin `width`/`height` o sin WebP
- [ ] Astro `Image` / responsive `srcset` donde falte
- [ ] Lazy below-fold; priority solo LCP candidate
- [ ] Revisar Font Awesome CDN en páginas que lo piden (costo LCP)
- [ ] Caching headers Hostinger (ops) — no inventar CDN nuevo sin decisión

**Done when:** PSI móvil home LCP mejora vs baseline Phase 0; CLS sin regresiones graves.

**Files:** componentes producto/hero, `astro.config.mjs` image service si aplica

---

### Phase 6 — P2/P3 ops local + lead magnets (2–4 semanas)

**Ops (fuera de repo o docs):**

- [ ] Claim/optimize Google Business Profile (Envigado / I-ME)
- [ ] Posts GMB mensuales enlazando landings ciudad + blog
- [ ] Outreach directorios salud CO (lista en `docs/seo/backlinks.md`)

**Dev:**

- [ ] Hub “recursos” / catálogo PDF descargable **solo si PDF real existe** (lead gate Turnstile/form existente)
- [ ] FAQ schema en más categorías (Phase 2b)

---

### Phase 7 — P3 AI/GEO refuerzo (opcional, tras P0–P1)

Baseline `llms.txt` ya existe.

- [ ] Actualizar `llms.txt` con landings ciudad + posts nuevos
- [ ] Revisar `sameAs` / entity completeness
- [ ] Bloques “respuesta citables” (definición corta + bullets) en guías conocimiento

---

## 3. Orden de ejecución recomendado

```
Week 1:  Phase 0 + Phase 1 (titles top 20)
Week 2:  Phase 2a/2b (schema + copy categorías top)
Week 3:  Phase 3 (3 city landings) + arrancar Phase 5 (CWV)
Week 4:  Phase 4 post #1–2 + GMB (Phase 6 ops)
Week 5–6: Phase 5 cierre + Phase 4 posts #3–4 + recursos PDF si hay asset
```

---

## 4. Ownership (I-ME equipo)

| Rol                               | Responsable sugerido         | Entregable                 |
| --------------------------------- | ---------------------------- | -------------------------- |
| SEO técnico / titles / schema     | Eng (repo)                   | PRs Phases 1–3, 5          |
| Copy categorías + ciudades + blog | Copywriter técnico-comercial | textos ES; EN review       |
| Keywords / GSC                    | Especialista SEO biomédico   | backlog + medición         |
| GMB / backlinks                   | Marketing + Alianzas         | ops Phase 6                |
| Deploy prod                       | Eng                          | workflow Deploy Producción |

---

## 5. Riesgos

| Riesgo                                   | Mitigación                       |
| ---------------------------------------- | -------------------------------- |
| Audit desactualizado → trabajo duplicado | Phase 0 obligatorio              |
| Thin city pages → filtro doorway         | copy único + datos reales + CTA  |
| Inventar certificaciones en schema       | solo campos DB existentes        |
| CWV sin medición                         | PSI baseline antes/después       |
| Blog sin publicación                     | calendar + owner o no contar KPI |

---

## 6. Out of scope (este plan)

- Redesign visual completo
- Migración a otro CMS
- Compra de backlinks
- Precios públicos en PDP (catálogo cotización)
- Cambiar arquitectura i18n Astro

---

## 7. Definition of done (programa)

- [ ] Phases 1–3 merged + deploy prod
- [ ] GSC: sitemap OK, 3 city URLs enviadas
- [ ] Top 20 PDP titles actualizados
- [ ] ≥4 posts conocimiento con internal links
- [ ] PSI LCP documentado mejora vs Phase 0
- [ ] Dashboard semanal: impresiones, clics, leads contacto (Marketing)

---

## 8. Primer PR sugerido (arranque)

1. `docs/seo/backlog.md` + este plan
2. Patch `buildProductoSeo` + tests
3. Seed `seo_keywords` top 20 vía admin (editorial)

**No empezar por city landings ni CWV** hasta cerrar titles top 20 (mejor ROI/effort del audit).
