# Arquitectura — CMS comercial I-ME

## Superficie

- Ruta privada: `/comercial/` (SPA Astro + TypeScript, `noindex`)
- Auth: Supabase Auth + `admin_profiles` (roles `ventas` | `admin` | `owner`)
- Datos: PostgREST sobre tablas existentes de catálogo + tablas `commercial_*`
- Backend de envío: Edge Function `comercial-share`
- CRM: capa `supabase/functions/_shared/twenty-crm.ts` (solo server-side)

## Flujo de datos

```
Comercial (browser)
  → Supabase Auth session (cookie/JWT HttpOnly gestionado por supabase-js)
  → Lectura catálogo: productos / familias / tipos (RLS)
  → Envío: POST functions/v1/comercial-share
       → valida rol + rate-limit + idempotencia
       → inserta commercial_shares + snapshots
       → email (Resend) | WhatsApp (wa.me prepared)
       → sync Twenty (people + companies + notes)
       → audit log
```

## Mapeo taxonomía

| UI comercial | Fuente                                                |
| ------------ | ----------------------------------------------------- |
| Especialidad | `SPECIALTY_GROUPS` / `taxonomia-catalogo` PRINCIPALES |
| Familia      | `familias`                                            |
| Subfamilia   | `tipos`                                               |
| Sección      | `productos.tipo_comercial`                            |

## Roles

| Rol         | Catálogo | Envíos  | Plantillas | Integraciones | Usuarios               |
| ----------- | -------- | ------- | ---------- | ------------- | ---------------------- |
| ventas      | sí       | propios | no         | no            | no                     |
| admin/owner | sí       | todos   | ver        | sí            | ver (CRUD en `/admin`) |

## PWA

`manifest-comercial.json` + banner `beforeinstallprompt` + `comercial-sw.js` (shell `/comercial/`).
