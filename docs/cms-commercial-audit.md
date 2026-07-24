# Auditoría — CMS comercial I-ME

Fecha: 2026-07-23
Proyecto: `/home/shoky/cursor/IMe-Platform`
Objetivo: área privada `/comercial` para equipo comercial.

## Arquitectura encontrada

| Capa             | Tecnología                                                 | Evidencia                                         |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Frontend público | Astro 6 SSG (`output: 'static'`)                           | `astro.config.mjs`, `package.json`                |
| Estilos          | Tailwind CSS v4                                            | `@tailwindcss/vite`                               |
| Back-office      | SPA vanilla TS en `/admin`                                 | `src/pages/admin.astro`, `src/admin/admin-app.ts` |
| Backend          | Supabase (Postgres + Auth + Storage + Edge Functions Deno) | `supabase/`                                       |
| ORM              | Ninguno — PostgREST vía `@supabase/supabase-js`            | `src/lib/supabase.ts`, `src/lib/datos.ts`         |
| Auth             | Supabase Auth + `admin_profiles` RBAC                      | `supabase/schema.sql`, `admin-app.ts`             |
| Email            | Resend (`MAILER_API_KEY` / `RESEND_API_KEY`)               | `supabase/functions/_shared/email.ts`             |
| WhatsApp         | Deep-links `wa.me` (sin Business API)                      | `ProductoCard.astro`, `notificar-proveedor`       |
| Twenty CRM       | **No integrado** (verificado por grep + MCP workspace)     | —                                                 |
| Deploy           | GitHub Actions → FTP Hostinger `dist/`                     | `.github/workflows/deploy-prod.yml`               |
| Docker app       | No                                                         | Solo `.dockerignore`                              |
| PWA              | Básica (`manifest.json` + SW)                              | `public/manifest.json`, `PWABanner.astro`         |

## Componentes reutilizables

- `ProductoCard.astro` — tarjeta de catálogo público (referencia visual).
- `CatalogoExplorer.astro` + `catalogo-cliente.ts` — filtros cliente.
- `taxonomia-catalogo.ts` — agrupación UI de **especialidades** (no tabla DB).
- `admin-app.ts` / `admin.css` — patrón SPA autenticada a clonar en `/comercial`.
- Edge helpers: `email.ts`, `cors.ts`, `rate-limit.ts`, `supabase-server.ts`.

## Modelo de datos actual (catálogo)

Fuente de verdad: tablas Supabase.

```
familias (1) ──< tipos (N)
    │                │
    └──── productos ─┘
```

| Concepto del prompt | Realidad en IMe-Platform                                        |
| ------------------- | --------------------------------------------------------------- |
| Especialidad médica | Grupos UI en `PRINCIPALES` (`taxonomia-catalogo.ts`) — no tabla |
| Familia             | Tabla `familias`                                                |
| Subfamilia          | Tabla `tipos` (FK `familia_id`)                                 |
| Sección             | Campo `productos.tipo_comercial` (`equipo` \| `consumible`)     |
| Producto            | Tabla `productos`                                               |

Campos producto disponibles: `id`, `slug`, `nombre_es/en`, `descripcion_corta_*`, `imagen_principal`, `familia_id`, `tipo_id`, `sku`, `ficha_pdf`, `activo`, `disponible`, `tipo_comercial`. URL pública derivada: `/{locale}/productos|products/{slug}/`.

## Riesgos

1. Sitio estático: cambios de catálogo en CMS requieren rebuild (`trigger-rebuild`) para tienda pública; el área `/comercial` lee Supabase en vivo (OK).
2. Sin Business API WhatsApp: solo estados `prepared` / `opened`.
3. Twenty CRM nuevo: requiere `TWENTY_BASE_URL` + `TWENTY_API_KEY`; fallos deben quedar pendientes con reintento.
4. Roles existentes (`ventas`, `admin`, `owner`…) — mapear comercial↔`ventas` sin inventar auth artesanal.
5. No alterar `/admin` ni tienda pública.

## Dependencias

- `@supabase/supabase-js`
- Resend (ya presente)
- Twenty REST API (nueva, server-side only)
- Astro static + SPA client scripts

## Propuesta de implementación

1. Nueva ruta `/comercial/` (SPA, mismo patrón que `/admin`).
2. Auth: reutilizar `supabase.auth.signInWithPassword` + `admin_profiles`.
3. Catálogo: lectura directa de `productos`/`familias`/`tipos` con filtros jerárquicos.
4. Envíos: tablas `commercial_shares` + productos snapshot; Edge Function `comercial-share`.
5. Email: plantilla `comercial_catalogo` vía Resend.
6. WhatsApp: generar `wa.me` (modo `link`).
7. Twenty: capa `supabase/functions/_shared/twenty-crm.ts` — people/companies/notes con deduplicación.
8. PWA dedicada: `manifest-comercial.json` + start_url `/comercial/`.

## Migraciones necesarias

- Extender `admin_profiles` (`nombre`, `telefono`, `cargo`, `last_login_at`).
- Tablas: `commercial_message_templates`, `commercial_shares`, `commercial_share_products`, `commercial_audit_log`.
- RLS por rol (`ventas` ve propios shares; `admin`/`owner` ven todo).
- Seed plantillas email/WhatsApp.
- Ampliar rate-limit acción `comercial-share`.

## Variables de entorno requeridas

```env
# Existentes
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MAILER_API_KEY=
MAILER_FROM=
SITE_URL=

# Nuevas (CMS comercial)
TWENTY_BASE_URL=
TWENTY_API_KEY=
WHATSAPP_MODE=link
PUBLIC_COMERCIAL_PWA=1
```

## Decisiones técnicas

1. **No Auth.js / no Prisma** — el proyecto ya tiene Supabase Auth + PostgREST.
2. **No duplicar catálogo** — reutilizar tablas existentes; especialidad = taxonomía UI.
3. **Sección = `tipo_comercial`** — única dimensión real de “sección” en datos.
4. **WhatsApp = Option B** hasta existir tokens Business API.
5. **Twenty solo en Edge Functions** — nunca desde el navegador.
6. **SPA separada de `/admin`** — `/comercial` enfocada al flujo comercial; admin global del catálogo permanece en `/admin`.
7. **PWA comercial** — manifesto propio para facilitar “Instalar app” en Chrome (desktop/móvil).
