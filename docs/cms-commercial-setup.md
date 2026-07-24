# Setup — CMS comercial I-ME

## Requisitos

1. Proyecto IMe-Platform con Supabase configurado.
2. Usuario en `admin_profiles` con `rol` ∈ `ventas` | `admin` | `owner` y `activo = true`.
3. Node ≥ 22.12.

## Variables

Copia desde `.env.example` (nunca commits de secretos):

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MAILER_API_KEY=
MAILER_FROM=
TWENTY_BASE_URL=          # ej. https://api.twenty.com o self-host
TWENTY_API_KEY=
WHATSAPP_MODE=link
COMERCIAL_SHARE_RATE_LIMIT_VENTANA_SEGUNDOS=3600
COMERCIAL_SHARE_RATE_LIMIT_MAX_VENTANA=30
COMERCIAL_SHARE_RATE_LIMIT_MAX_DIA=100
```

Configura las mismas secrets en Supabase Edge Functions (Dashboard → Edge Functions → Secrets).

## Migración

```bash
# Con CLI de Supabase vinculado al proyecto
supabase db push
# o aplica manualmente:
# supabase/migrations/20260723040000_cms_comercial.sql
```

## Deploy Edge Function

```bash
supabase functions deploy comercial-share
```

## Desarrollo local

```bash
npm run dev
# Abrir http://localhost:44334/comercial/
```

## Crear comercial

1. Crear usuario en Supabase Auth (email/password).
2. Insertar fila en `admin_profiles` (`rol='ventas'`, `activo=true`, opcional `nombre`/`telefono`).
3. Alternativa: UI `/admin#/usuarios` (owner/admin).

## Verificación rápida

1. Login en `/comercial/`.
2. Filtrar por especialidad → familia → sección.
3. Seleccionar producto → Enviar catálogo (email o WhatsApp).
4. Revisar `#/envios` y, como admin, `#/integraciones`.
