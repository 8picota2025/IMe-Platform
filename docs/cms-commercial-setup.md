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
TWENTY_BASE_URL=          # ej. https://crm.i-me.com.co
TWENTY_API_KEY=
WHATSAPP_MODE=link
COMERCIAL_SHARE_RATE_LIMIT_VENTANA_SEGUNDOS=3600
COMERCIAL_SHARE_RATE_LIMIT_MAX_VENTANA=30
COMERCIAL_SHARE_RATE_LIMIT_MAX_DIA=100

# OCR presupuestos competencia (Edge comercial-ocr-presupuesto)
OCR_VISION_PROVIDER=ollama
LLM_VISION_MODEL=moondream
OLLAMA_BASE_URL=http://localhost:11434   # prod: túnel alcanzable desde Edge
# OLLAMA_VISION_TIMEOUT_MS=180000
# PRESUPUESTOS_COMP_DIR=                 # opcional: espejo filesystem en Edge
```

Configura las mismas secrets en Supabase Edge Functions (Dashboard → Edge Functions → Secrets). El workflow CI `.github/workflows/deploy-supabase-functions.yml` sincroniza `OCR_VISION_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_VISION_TIMEOUT_MS` y `LLM_VISION_MODEL` cuando tienen valor en GitHub Secrets.

## Migraciones

```bash
# Con CLI de Supabase vinculado al proyecto
supabase db push
# o aplica manualmente en orden:
# supabase/migrations/20260723040000_cms_comercial.sql
# supabase/migrations/20260814170000_quote_pdf_numero.sql
# supabase/migrations/20260815200000_presupuestos_competencia_storage.sql
```

## Deploy Edge Functions

```bash
supabase functions deploy comercial-share comercial-cotizacion comercial-ocr-presupuesto enviar-cotizacion
```

## OCR local (desarrollo)

1. Instalar [Ollama](https://ollama.com) y modelo: `ollama pull moondream`
2. Verificar: `curl http://localhost:11434/api/tags`
3. Si `supabase functions serve` corre en Docker, usar `http://172.17.0.1:11434` como `OLLAMA_BASE_URL` (ver `.env.example`).
4. Opcional (desktop): espejo local de fotos — `node scripts/presupuesto-comp-mirror-server.mjs` en `:3847` (no requerido en PWA móvil).
5. Login `/comercial/` → `#/cotizaciones/escanear` → Tomar foto / Galería.

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
5. Cotizaciones: `#/cotizaciones/escanear` con foto de prueba → borrador en `#/cotizaciones?id=…`.
6. Revisar precios OCR vs catálogo → **Validar → CRM** → enviar PDF por email o WhatsApp.
