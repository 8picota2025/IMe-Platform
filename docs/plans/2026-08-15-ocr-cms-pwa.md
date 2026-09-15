# Plan: OCR competencia dentro del CMS comercial (PWA)

## Phase 0 — Allowed APIs (docs + repo)

### Allowed

| API                                                               | Uso                             | Fuente                                          |
| ----------------------------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| `<input type="file" accept="image/*">`                            | Galería                         | web.dev media-capturing-images                  |
| `capture="environment"`                                           | Cámara trasera (botón separado) | MDN `capture`                                   |
| `File` → base64 → `callEdgeFunction('comercial-ocr-presupuesto')` | OCR Edge                        | `quote-ocr.ts`, Edge fn                         |
| Hash `#/cotizaciones/escanear`                                    | Pantalla dedicada PWA           | patrón `cotizaciones/nueva` en `quote-route.ts` |
| Tras OCR → `#/cotizaciones?id=<uuid>`                             | Abrir borrador                  | ya en `quote-view.ts`                           |

### Anti-patterns (NO)

- `getUserMedia` para una sola foto OCR (iOS PWA frágil)
- Un solo input con `capture` esperando galería (Android no muestra galería)
- Servidor mirror `127.0.0.1:3847` como UX del CMS
- Interceptar POST OCR en service worker
- Inventar `#/cotizaciones/ocr` sin UI móvil full-bleed

### Estado actual (gap)

OCR existe en botones pequeños de bandeja/editor + mirror local. Usuario necesita flujo PWA móvil claro: **Nueva** o **pestaña/pantalla aparte** con Tomar foto / Galería.

---

## Phase 1 — Pantalla `#/cotizaciones/escanear`

- Extender `quote-route.ts` mode `escanear`
- `renderScanView()`: UI full móvil (2 CTAs grandes + preview + progreso)
- Bind: pick → OCR → `#/cotizaciones?id=`
- Docs: copiar `pickCompetenciaImage` de `quote-ocr.ts:116-138`

## Phase 2 — Entradas CMS

- Bandeja: tab/enlace «Escanear» + CTA en vacío
- En `#/cotizaciones/nueva`: bloque «Crear desde foto competencia»
- Quitar toasts/descargas del mirror local en PWA móvil

## Phase 3 — PWA hardening

- CSS touch targets ≥44px
- Revisar `Permissions-Policy` en `.htaccess` (no bloquear captura file)
- No tocar SW (ya no intercepta POST cross-origin)

## Phase 4 — Verify

- [x] Hash `#/cotizaciones/escanear` renderiza
- [x] Cámara y galería abren desde gesto de tap
- [ ] OCR crea presupuesto y navega al editor
- [x] Sin dependencia de `:3847` para UX
- [x] Deploy prod + hard refresh PWA

## Phase 5 — Vision vía puente local (Gemini preferido)

- `vision-quote-ocr.ts` → `OCR_VISION_PROVIDER=ollama` en Edge; visión real en puente `:3850`
- Puente `scripts/ocr-moondream-bridge.mjs` — pipeline `OCR_ENGINE=auto`:
  1. **gemini** — `GEMINI_API_KEY` + `gemini-3.6-flash` (rápido, preferido)
  2. **google_vision** — Cloud Vision OCR → qwen texto → JSON
  3. **rapid** — RapidOCR local → qwen texto → JSON
  4. **moondream** — Ollama VLM (último recurso)
- Prod: Edge sube foto a Storage → URL firmada → `POST /ocr { image_url }` por túnel Cloudflare
- Motivo: POST base64 directo por trycloudflare cuelga → Edge timeout → 500
- Arranque: `./scripts/ocr-bridge-up.sh` (bridge + túnel + sync secrets)
- Secrets Edge: `OCR_BRIDGE_URL`, `OCR_BRIDGE_SECRET`, `LLM_VISION_MODEL`, `OLLAMA_VISION_TIMEOUT_MS`
- Secrets puente (host local, NO Edge): `GEMINI_API_KEY`, `OCR_ENGINE`, `OCR_GEMINI_MODEL`
