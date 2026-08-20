# Despliegue — CMS comercial

## Orden recomendado

1. Aplicar migraciones en Supabase producción (en orden):
   - `20260723040000_cms_comercial.sql`
   - `20260814170000_quote_pdf_numero.sql`
   - `20260815200000_presupuestos_competencia_storage.sql`
2. Configurar secrets Edge:
   - Catálogo: `TWENTY_BASE_URL`, `TWENTY_API_KEY`, `MAILER_API_KEY`, `MAILER_FROM`, `WHATSAPP_MODE`
   - Cotizaciones/OCR: `OCR_VISION_PROVIDER=ollama`, `LLM_VISION_MODEL=moondream`, `OLLAMA_BASE_URL`, opcional `OLLAMA_VISION_TIMEOUT_MS`
   - Transferencia bancaria en PDF: `TRANSFERENCIA_*` (ver `.env.example`)
3. Deploy funciones:
   ```bash
   supabase functions deploy comercial-share comercial-cotizacion comercial-ocr-presupuesto enviar-cotizacion
   ```
   En CI: push a `main` con cambios en `supabase/functions/**` dispara `.github/workflows/deploy-supabase-functions.yml`.
4. Build estático: `npm run build` (incluye `/comercial/`).
5. Deploy Hostinger vía workflow existente (FTP `dist/`) o pipeline preprod.
6. Smoke test en `https://i-me.com.co/comercial/`.

## Ollama en producción (OCR)

La Edge Function `comercial-ocr-presupuesto` llama a Ollama vía `OLLAMA_BASE_URL`. **No** uses `localhost` en prod — la función corre en Supabase.

Opciones verificadas en repo:

1. Host con Ollama + modelo `moondream` (`ollama pull moondream`).
2. Túnel HTTPS hacia `:11434`, p. ej. Cloudflare:
   ```bash
   cloudflared tunnel --url http://127.0.0.1:11434 --http-host-header localhost
   ```
3. Registrar la URL pública del túnel en GitHub Secret `OLLAMA_BASE_URL` (CI la propaga a Supabase).

Timeout recomendado: `OLLAMA_VISION_TIMEOUT_MS=180000` (3 min) para fotos móviles.

## Rollback

Ver comentarios en cada migración (DROP tables / columnas / seed email_templates).

Revertir funciones a versión anterior si es necesario; la tienda pública no depende de tablas `commercial_*`. Presupuestos OCR usan `solicitudes_cotizacion` compartida con tienda — no borrar filas en rollback.

## PWA / DNS

- Manifest en `/manifest-comercial.json` (mismo dominio).
- Instalación Chrome requiere HTTPS (producción) o localhost.
- Tras deploy frontend: hard refresh PWA instalada para cargar `#/cotizaciones/escanear`.
- No requiere DNS adicional.

## Smoke post-deploy

1. Login ventas → `#/cotizaciones/escanear` carga UI full-bleed.
2. OCR con foto de prueba → redirección a editor (requiere Ollama operativo).
3. Enviar catálogo email sigue funcionando (`comercial-share`).
