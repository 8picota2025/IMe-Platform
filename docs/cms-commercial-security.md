# Seguridad — CMS comercial

## Controles aplicados

- Autenticación: Supabase Auth (password hash gestionado por Supabase; no artesanal).
- RBAC backend: `admin_profiles` + `is_comercial_user()` + comprobación en Edge Function.
- RLS en tablas `commercial_*` (ventas solo propios shares; admin/owner todos).
- Cookies/sesión: supabase-js (HttpOnly donde aplica el proveedor; no tokens en localStorage propios).
- CSRF: requests autenticados con Bearer de sesión + Same-origin esperado; CORS allowlist.
- Rate limiting: `comercial-share` 30/hora y 100/día por usuario.
- Bloqueo/login: delegado a Supabase Auth (rate limits del proveedor).
- Idle 15 min: logout client-side en SPA comercial.
- Validación: email regex, teléfono E.164, longitud mensaje, `consentContact`.
- Sanitización: `escapeHtml` en emails y UI.
- Idempotencia: `idempotency_key` único.
- Secretos: `TWENTY_API_KEY`, `MAILER_API_KEY`, service role solo en Edge Functions.
- Logs: no se registran contraseñas ni API keys; teléfonos enmascarables (`maskPhone`).
- Sitemap: `/comercial/` excluido; `noindex`.

## No declarado

Esta solución **no** se presenta como certificación legal (Habeas Data / GDPR). Minimización y trazabilidad de consentimiento (`consent_contact`) están implementadas a nivel técnico.
