# Agent-ready — lectura por agentes IA

Sitio preparado para [acceptmarkdown.com](https://acceptmarkdown.com) e instrucciones en `llms.txt`. Los agentes pueden leer páginas públicas en Markdown sin scraping HTML.

## Piezas

| Pieza | Ubicación | Rol |
| ----- | --------- | --- |
| `public/llms.txt` | Estático en repo | Mapa de URLs, guía de uso y límites para agentes |
| `src/lib/agent-ready.ts` | Runtime + tests | Negociación `Accept`, copy 404, builders Markdown |
| `scripts/generate-agent-markdown.mjs` | Post-build | Emite `index.md` hermanos y copia `404.md` en `dist/` |
| `public/.htaccess` | Deploy Hostinger | Reglas LiteSpeed/Apache para servir `.md` y 404 Markdown |
| `public/404.md` | Plantilla 404 | Cuerpo Markdown servido cuando el cliente pide `text/markdown` |

Pipeline de build (`package.json`):

```text
mirror-cms-images → astro build → generate-agent-markdown
```

## Negociación de contenido

Cuando el cliente envía `Accept: text/markdown` (y no `q=0`):

1. Si existe `{ruta}/index.md` en `dist/`, Apache sirve ese archivo con `Content-Type: text/markdown`.
2. Si la URL no existe y hay `404.md`, se sirve el cuerpo de recuperación en Markdown.
3. En rutas dinámicas Astro (producto, legal, about), el `.astro` usa `prefersMarkdown()` y responde Markdown generado en servidor.

Helpers en `agent-ready.ts`:

- `prefersMarkdown(acceptHeader)` — detección pragmática (sin cálculo de `q`).
- `appendVaryAccept(vary)` — añade `Vary: Accept` para caches.
- `buildNotFoundMarkdown(path)` — enlaces a sitemap, catálogo y contacto.
- `productToMarkdown`, `pageToMarkdown`, `legalDocumentToMarkdown` — exportadores tipados.

## Post-build: `generate-agent-markdown.mjs`

Tras `astro build`, el script:

1. Recorre HTML en `dist/` y crea `index.md` junto a cada `index.html` (título, description, canonical, texto plano recortado).
2. Genera Markdown de productos desde `mock-productos.json` (fallback cuando no hay HTML por producto).
3. Copia `public/404.md` → `dist/404.md`.

Verificar localmente:

```bash
npm run build
find dist -name 'index.md' | head
curl -H 'Accept: text/markdown' http://localhost:44334/es/catalogo/  # con preview
```

## `llms.txt`

Archivo canónico en `public/llms.txt`. Debe mantenerse alineado con:

- Rutas ES/EN reales del sitemap.
- Secciones de confianza (`/about/`, `/privacy/`, `/contact/`).
- Bloque «When to use I-ME» — la fuente de verdad del texto está en `buildLlmsWhenToUseSection()` (`agent-ready.ts`); al editar el archivo, revisar que no diverja del helper.

**No incluir** en `llms.txt`: admin, checkout, tokens, datos internos ni URLs excluidas del sitemap.

## Páginas de confianza (trust anchors)

Rutas sin prefijo de locale, con alternates hreflang donde aplique:

- `/about/` — acerca de I-ME (Markdown vía `pageToMarkdown`).
- `/privacy/` — resumen legal (Markdown vía `legalDocumentToMarkdown`). **No** emitir alternate roto `/es/privacy/`; el legal ES vive en `/es/legal/privacidad/`.
- `/contact/` — redirección/contacto unificado.

404 HTML (`src/pages/404.astro`) enlaza sitemap, `llms.txt`, catálogos y contacto usando `NOT_FOUND_RECOVERY_LINKS`.

## Reglas Apache (`.htaccess`)

Fragmento generado por `buildAgentReadyHtaccessRules()`:

- `Content-Type` para archivos `.md`.
- `Header merge Vary Accept`.
- Rewrite a `index.md` cuando existe hermano y el cliente prefiere Markdown.
- Rewrite a `/404.md` en 404 con `Accept: text/markdown`.
- `ErrorDocument 404 /404.html` para navegadores normales.

Tras cambiar reglas, validar en preprod con:

```bash
curl -4 -H 'Accept: text/markdown' https://preprod.../es/productos/<slug>/
curl -4 -H 'Accept: text/markdown' https://preprod.../ruta-inexistente
```

## Tests

```bash
npm run check   # incluye src/lib/agent-ready.test.ts
```

Casos cubiertos: `prefersMarkdown`, builders Markdown, reglas htaccess idempotentes, recovery links.

## Operación y SEO

- Actualizar `llms.txt` cuando se publiquen landings de campaña, familias nuevas o rutas de conocimiento — ver `docs/seo/comercial-landings.md`.
- El auditor SEO (`.claude/agents/seo-auditor.md`) exige `llms.txt` al día.
- Productos y precios citados por agentes deben verificarse contra catálogo en vivo; el copy agent-ready repite «confirmar con I-ME».
