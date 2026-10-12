# Implementación del CMS comercial I-ME

## Resumen

Se implementó el área privada `/comercial/` en IMe-Platform: catálogo filtrable para el equipo comercial, envío por email/WhatsApp, registro local, sincronización Twenty CRM (best-effort) y PWA instalable, reutilizando Supabase Auth y el catálogo existente sin duplicarlo ni alterar la tienda pública.

## Arquitectura encontrada

Astro 6 SSG + SPA admin, Supabase (Postgres/Auth/Edge Functions), Resend, WhatsApp vía `wa.me`, sin Twenty previo. Catálogo: `productos` / `familias` / `tipos`. Especialidades = agrupación UI. Auth = Supabase + `admin_profiles`.

## Arquitectura implementada

- Frontend SPA: `src/pages/comercial.astro` + `src/comercial/*`
- Edge Function: `comercial-share`
- Capa CRM: `_shared/twenty-crm.ts`
- Tablas: `commercial_shares`, `commercial_share_products`, `commercial_message_templates`, `commercial_audit_log`
- PWA: `manifest-comercial.json` + `comercial-sw.js` + banner instalar
- Telemetría de uso: `commercial_usage_events` + Edge Function `comercial-usage`; agregados en Dashboard/Marketing y reporte semanal.

## Funcionalidades completadas

- Login / logout / recuperación de contraseña (Supabase Auth)
- Roles: `ventas` (catálogo + propios envíos), `admin`/`owner` (+ plantillas, integraciones, listado usuarios)
- Filtros: especialidad → familia → tipo; sección (`tipo_comercial`); búsqueda producto/SKU
- Tarjetas, selección múltiple, abrir landing pública
- Modal email/WhatsApp con plantillas, consentimiento, validación, idempotencia
- Historial de envíos + reintento CRM
- Sesión idle 15 min
- Rate limiting server-side
- Documentación en `docs/cms-commercial-*.md` + `twenty-integration.md`

## Flujo del catálogo

Especialidad (UI) → familias → tipos → productos activos desde Supabase; sección = equipo/consumible; búsqueda debounce.

## Flujo de correo

Plantilla `comercial_catalogo` (DB o default Resend) → HTML escapado → `email_log` → estado `sent`/`failed`.

## Flujo de WhatsApp

Modo `link`: genera `wa.me`, estado `prepared`/`opened`. **No** se marca `sent` sin API Business.

## Integración con Twenty CRM

People + companies + notes (+ noteTargets), dedupe email/teléfono. Si faltan secrets → `skipped`. Fallos → `failed` + reintento manual. Status sin secretos: `GET comercial-share?action=status`.

## Seguridad aplicada

RBAC backend + RLS, CORS allowlist, rate limit, escape HTML, secretos solo en Edge, `/comercial/` noindex y fuera del sitemap. Ver `docs/cms-commercial-security.md`.

## Migraciones

`supabase/migrations/20260723040000_cms_comercial.sql` (reversible documentado).

## Variables de entorno

Añadidas en `.env.example`: `TWENTY_BASE_URL`, `TWENTY_API_KEY`, `WHATSAPP_MODE`, rate limits comerciales. Requiere también `MAILER_*` y Supabase existentes.

## Pruebas ejecutadas

- `npm test` → **101 passed** (incluye 33 de `comercial-cms.test.ts`)
- `npm run lint` → OK
- `npx astro check` → 0 errors
- `npm run build` → **1016 pages**, `/comercial/` generado

## Resultado de build y lint

Build y lint correctos. Hints preexistentes ajenos al CMS comercial.

## Archivos principales modificados / creados

**Nuevos:** `src/comercial/*`, `src/pages/comercial.astro`, `src/lib/comercial-cms.ts(.test.ts)`, `supabase/functions/comercial-share/`, `_shared/{phone,twenty-crm,comercial-templates}.ts`, migración, `public/manifest-comercial.json`, `public/comercial-sw.js`, docs CMS.

**Modificados:** `.env.example`, `astro.config.mjs`, `_shared/{email,cors,rate-limit}.ts`.

## Decisiones técnicas

1. Reutilizar Supabase Auth (no auth artesanal).
2. No duplicar catálogo.
3. Sección = `tipo_comercial` (dato real).
4. WhatsApp Option B hasta Business API.
5. SPA separada de `/admin` para foco comercial.
6. Twenty solo server-side con objetos estándar verificados.

## Limitaciones conocidas

- Migración y Edge Function **no aplicadas aún** en producción (acción manual).
- Edición visual de plantillas: lectura en UI; edición vía DB/`/admin` por ahora.
- CRUD usuarios comerciales: se redirige a `/admin#/usuarios`.
- Sin E2E Playwright automatizado del flujo completo.
- Twenty no probado contra instancia live en este entorno (MCP disponible; falta secret en Edge).
- Bloqueo tras 8 intentos fallidos: depende de políticas Supabase Auth (no reimplementado).

## Acciones manuales necesarias

1. Aplicar migración SQL en Supabase.
2. Deploy `comercial-share` + secrets (`TWENTY_*`, `MAILER_*`, `WHATSAPP_MODE`).
3. Crear usuarios comerciales en Auth + `admin_profiles`.
4. Verificar SMTP/Resend (`MAILER_FROM` autorizado).
5. Configurar Twenty API key / workspace.
6. Deploy estático (CI Hostinger) para publicar `/comercial/`.
7. (Opcional) Plantillas WhatsApp Business / webhooks cuando exista API oficial.
8. Reiniciar/redeploy Edge Functions tras secrets.

## Instrucciones de despliegue

Ver `docs/cms-commercial-deployment.md` y `docs/cms-commercial-setup.md`.

Local: `npm run dev` → `http://localhost:44334/comercial/`.

## Extensiones 2026-08 (cotizaciones OCR + Congreso)

- **Cotizaciones PWA** — `#/cotizaciones/escanear`, Edge `comercial-ocr-presupuesto`, bucket `presupuestos-competencia`. OCR vía puente local con Gemini preferido (`scripts/ocr-moondream-bridge.mjs`). Ver `docs/cms-commercial-architecture.md` § OCR y `docs/plans/2026-08-15-ocr-cms-pwa.md`.
- **IME Congreso** — `/congreso/` captura presencial: OCR tarjeta, multi-producto, lead en `leads_comerciales`, envío vía `comercial-share`. Edge: `congreso-ocr`, `congreso-lead`. Ver `docs/congreso-architecture.md`.
