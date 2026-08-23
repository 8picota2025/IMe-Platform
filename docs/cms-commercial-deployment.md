# Despliegue — CMS comercial

## Orden recomendado

1. Aplicar migraciones en Supabase producción (en orden):
   - `20260723040000_cms_comercial.sql`
   - `20260814170000_quote_pdf_numero.sql`
   - `20260815200000_presupuestos_competencia_storage.sql`
2. Configurar secrets Edge:
   - Catálogo: `TWENTY_BASE_URL`, `TWENTY_API_KEY`, `MAILER_API_KEY`, `MAILER_FROM`, `WHATSAPP_MODE`
   - OCR: `OCR_VISION_PROVIDER=ollama`, `OCR_BRIDGE_URL`, `OCR_BRIDGE_SECRET`, `LLM_VISION_MODEL`, opcional `OLLAMA_VISION_TIMEOUT_MS`
   - Transferencia bancaria en PDF: `TRANSFERENCIA_*` (ver `.env.example`)
3. Deploy funciones:
   ```bash
   supabase functions deploy comercial-share comercial-cotizacion comercial-ocr-presupuesto enviar-cotizacion
   ```
   En CI: push a `main` con cambios en `supabase/functions/**` dispara `.github/workflows/deploy-supabase-functions.yml`.
4. Build estático: `npm run build` (incluye `/comercial/`).
5. Deploy Hostinger vía workflow existente (FTP `dist/`) o pipeline preprod.
6. Smoke test en `https://i-me.com.co/comercial/`.

## OCR en producción (puente + Gemini)

La Edge Function sube la foto a Storage y llama al **puente local** vía `OCR_BRIDGE_URL`. **No** envíes base64 grande por túnel Cloudflare ni expongas `GEMINI_API_KEY` en Supabase.

### Arranque del puente

En un host con Node ≥22 y acceso a internet (puede ser la misma máquina de desarrollo del equipo):

```bash
# .env del host del puente (NO commitear)
export GEMINI_API_KEY=...          # preferido
export OCR_BRIDGE_SECRET=...        # mismo valor que Supabase Edge
export OCR_ENGINE=auto              # gemini → google_vision → rapid → moondream

./scripts/ocr-bridge-up.sh
```

El script:

1. Arranca `node scripts/ocr-moondream-bridge.mjs` en `:3850`
2. Abre túnel Cloudflare quick (`trycloudflare.com`)
3. Actualiza `.env` local con `OCR_BRIDGE_URL`
4. Con `gh` disponible: sincroniza GitHub Secrets y dispara deploy de Edge Functions

Estado: `./scripts/ocr-bridge-up.sh --status`

### Motivo del puente

POST base64 de imagen directo a Ollama por túnel Cloudflare puede colgar → timeout Edge → HTTP 500. El flujo estable es:

```
Edge → Storage signed URL → puente /ocr { image_url } → Gemini/RapidOCR/moondream → JSON
```

Timeout recomendado: `OLLAMA_VISION_TIMEOUT_MS=180000` (3 min) para fotos móviles.

### Fallback moondream

Si no hay `GEMINI_API_KEY`, el puente intenta `google_vision`, `rapid` (RapidOCR + qwen) o `moondream` (Ollama local). Para moondream puro:

```bash
ollama pull moondream
cloudflared tunnel --url http://127.0.0.1:11434 --http-host-header localhost
# Registrar en OLLAMA_BASE_URL solo si NO usas puente :3850
```

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
2. OCR con foto de prueba → redirección a editor (requiere puente operativo).
3. `./scripts/ocr-bridge-up.sh --status` → health local + túnel OK.
4. Enviar catálogo email sigue funcionando (`comercial-share`).
