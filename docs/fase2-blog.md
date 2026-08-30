# Fase 2 — Descubrimiento blog + nosotros

Fecha: 2026-07-13
Rama: `feature/fase2-blog-nosotros`

## Estado actual de `conocimiento/`

- La seccion publica de conocimiento ya existe en:
  - `src/pages/es/conocimiento.astro`
  - `src/pages/es/conocimiento/[slug].astro`
  - `src/pages/en/knowledge.astro`
  - `src/pages/en/knowledge/[slug].astro`
- La fuente de verdad actual es la tabla `articulos` en Supabase cuando hay configuracion activa; si no, cae a `src/data/mock-articulos.json`.
- El acceso publico lo hace `src/lib/datos.ts`:
  - `getArticulos(locale)` consulta `articulos` con filtro `publicado = true`
  - `getArticuloBySlug(slug, locale)` consulta `articulos` con filtro `slug` + `publicado = true`
- La interfaz actual `Articulo` en `src/lib/datos.ts` solo expone:
  - `id`
  - `slug`
  - `titulo`
  - `cuerpo`
  - `publicado`
  - `created_at`
  - `updated_at`

## Esquema actual de articulos

- La tabla vive en `supabase/schema.sql`.
- Columnas actuales:
  - `id uuid primary key default gen_random_uuid()`
  - `slug text unique not null`
  - `titulo_es text not null`
  - `titulo_en text`
  - `cuerpo_es text`
  - `cuerpo_en text`
  - `publicado boolean not null default false`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Hay trigger `set_articulos_updated_at`.
- RLS actual:
  - `SELECT` publico solo para filas `publicado = true`
  - `ALL` para `authenticated` con `is_admin(ARRAY['catalogo'])`

## Flujo actual de publicacion

- El admin ya tiene un CMS editorial basico en `src/admin/admin-app.ts`.
- Vista principal:
  - `conocimientoView()` lista, edita y crea filas directas en `articulos`
  - hoy no existe bandeja de moderacion separada
- El formulario guarda directamente en `articulos`.
- El rebuild se dispara desde el admin con `triggerRebuild()` en `src/admin/admin-app.ts`.
- `triggerRebuild()` invoca la Edge Function `trigger-rebuild`.
- La function `supabase/functions/trigger-rebuild/index.ts`:
  - exige `Authorization: Bearer <user token>`
  - valida el usuario con `supabase.auth.getUser(token)`
  - dispara `CI_DEPLOY_HOOK` o `repository_dispatch` en GitHub

## Render publico actual

- La pagina de detalle de articulo usa `renderMarkdown(...)` para convertir el cuerpo.
- El JSON-LD actual del articulo en:
  - `src/pages/es/conocimiento/[slug].astro`
  - `src/pages/en/knowledge/[slug].astro`
- Hoy siempre declara el autor como organizacion fija:
  - `I-ME International Medical Enterprise`
- No existe byline editorial variable ni badge de tipo de autor.

## Implicaciones para Fase 2

- No hay que crear un blog nuevo ni una ruta nueva `/blog/`.
- La moderacion debe montarse sobre el admin existente, no sobre un CMS nuevo.
- Hace falta separar:
  - propuesta de articulo
  - articulo publicado
- Hace falta ampliar `articulos` con metadatos editoriales del autor para:
  - byline publica
  - badge `ime | cliente | fabricante`
  - JSON-LD `Article.author` variable
- El flujo correcto queda:
  - propuesta publica -> `articulos_propuestos`
  - moderacion admin
  - aprobacion -> insercion/actualizacion en `articulos`
  - `trigger-rebuild`

## Imágenes de artículo (build + runtime)

Prioridad en `src/lib/conocimiento-imagenes.ts` → `resolverImagenArticulo()`:

1. Mirror estático generado en build desde `articulos.imagen` (CMS).
2. URL CMS en Supabase (`articulos.imagen`).
3. Fallback por slug o palabra clave (`POR_SLUG`, `POR_PALABRA`) solo si no hay imagen CMS.

Pipeline pre-build (`scripts/mirror-cms-images.mjs`):

- Descarga imágenes CMS, optimiza a WebP (hero + variante OG 1200×630).
- Escribe manifest en `src/data/generated/articulo-imagenes.json` (leído por `conocimiento-imagen-manifest.ts`).
- Requiere `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en CI/prod (ver deploy workflows).
- Nombre de archivo: `{slug}-conocimiento-equipos-biomedicos-ime-{hash8}.webp`.

Tras publicar imagen nueva en admin: **rebuild obligatorio** — sin deploy el sitio sigue mostrando la imagen anterior (`ADMIN_GUIDE.md`).

## Slugs de artículo

`src/lib/articulo-slug.ts`:

- `sanitizeArticuloSlug()` — corrige URLs pegadas (`https://...`) y normaliza a kebab-case.
- `isValidArticuloSlug()` — rechaza reservados (`conocimiento`, `blog`, etc.) y slugs con `://`.
- Admin y mirror comparten la misma lógica; tests en `articulo-slug.test.ts`.

## Cuerpo del artículo en detalle

`src/lib/conocimiento-articulo.ts`:

- `renderArticleBody()` — Markdown completo del CMS (no truncar).
- `demoteLeadingMarkdownH1()` — evita duplicar el `<h1>` del hero de página.

Páginas: `src/pages/es/conocimiento/[slug].astro`, `src/pages/en/knowledge/[slug].astro`.

JSON-LD `Article` incluye imagen OG cuando `resolverImagenArticulo` devuelve asset.

## Nosotros / About

Páginas institucionales publicadas:

- `/es/nosotros/`, `/en/about/`, `/about/` (trust anchor agent-ready).
- Copy editorial en Astro; no dependen de tabla `articulos`.

## Huecos confirmados

- No existe tabla `articulos_propuestos` (moderación futura).
- No existen columnas de autor en `articulos` (byline variable pendiente).
- Formulario público `/es/conocimiento/publicar/` y moderación de propuestas: ver backlog Fase 2.

## Decision para la tarea 2

La migracion aditiva de esta fase debe:

- crear `articulos_propuestos`
- habilitar RLS sin policies publicas
- anadir a `articulos` las columnas de autor necesarias para byline y JSON-LD
- no romper el CMS actual ni las consultas publicas existentes
