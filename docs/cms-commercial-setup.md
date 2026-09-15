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

# OCR presupuestos competencia (Edge comercial-ocr-presupuesto / congreso-ocr)
OCR_VISION_PROVIDER=ollama          # Edge solo soporta ollama; visión real vía puente
LLM_VISION_MODEL=moondream          # fallback del puente si no hay Gemini
# Prod: puente local + túnel (recomendado)
OCR_BRIDGE_URL=                     # https://xxxx.trycloudflare.com
OCR_BRIDGE_SECRET=                  # Bearer compartido Edge ↔ puente
# Dev local sin puente:
OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_VISION_TIMEOUT_MS=180000

# Secrets del puente (scripts/ocr-moondream-bridge.mjs — NO en Supabase Edge)
# GEMINI_API_KEY=...                # preferido: gemini-3.6-flash
# OCR_ENGINE=auto                   # auto | gemini | google_vision | rapid | moondream
# OCR_GEMINI_MODEL=gemini-3.6-flash
# GOOGLE_VISION_API_KEY=...         # opcional
# OCR_RAPID_PYTHON=/path/.venv-ocr/bin/python
# OCR_TEXT_MODEL=qwen3-imeia
```

Configura en Supabase Edge Functions (Dashboard → Secrets): `OCR_BRIDGE_URL`, `OCR_BRIDGE_SECRET`, `OCR_VISION_PROVIDER`, `LLM_VISION_MODEL`, `OLLAMA_VISION_TIMEOUT_MS`. El workflow CI `.github/workflows/deploy-supabase-functions.yml` sincroniza estos valores desde GitHub Secrets.

**Importante:** `GEMINI_API_KEY` vive solo en el host del puente local, nunca en Edge ni en `dist/`.

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

### Opción A — Puente con Gemini (recomendado, igual que prod)

1. Exportar `GEMINI_API_KEY` en el shell del puente.
2. Arrancar puente + túnel:
   ```bash
   ./scripts/ocr-bridge-up.sh
   ```
   Escribe `OCR_BRIDGE_URL` en `.env` y sincroniza GitHub Secrets si `gh` está disponible.
3. Configurar Edge local/serve con `OCR_BRIDGE_URL` y `OCR_BRIDGE_SECRET`.
4. Health check: `curl -H "Authorization: Bearer $OCR_BRIDGE_SECRET" "$OCR_BRIDGE_URL/health"`

### Opción B — Ollama directo (solo `supabase functions serve`)

1. Instalar [Ollama](https://ollama.com) y modelo: `ollama pull moondream`
2. Verificar: `curl http://localhost:11434/api/tags`
3. Dejar `OCR_BRIDGE_URL` vacío; Edge usa base64 → Ollama.
4. Si `supabase functions serve` corre en Docker, usar `http://172.17.0.1:11434` como `OLLAMA_BASE_URL`.

### Verificación UI

Login `/comercial/` → `#/cotizaciones/escanear` → Tomar foto / Galería.

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
