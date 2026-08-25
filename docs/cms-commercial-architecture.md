# Arquitectura — CMS comercial I-ME

## Superficie

- Ruta privada: `/comercial/` (SPA Astro + TypeScript, `noindex`)
- Auth: Supabase Auth + `admin_profiles` (roles `ventas` | `admin` | `owner`)
- Datos: PostgREST sobre catálogo + tablas `commercial_*` + `solicitudes_cotizacion`
- Edge Functions comerciales:
  - `comercial-share` — envío de catálogo (email / WhatsApp link)
  - `comercial-cotizacion` — CRUD presupuestos, validar → CRM, borrar
  - `comercial-ocr-presupuesto` — OCR foto competencia → borrador
  - `enviar-cotizacion` — PDF numerado + email o WhatsApp formal
- CRM: `supabase/functions/_shared/twenty-crm.ts` (solo server-side)

## Navegación SPA

| Hash | Módulo | Descripción |
| ---- | ------ | ----------- |
| `#/catalogo` | Catálogo | Filtros, selección, envío info |
| `#/envios` | Envíos | Historial `commercial_shares` |
| `#/cotizaciones` | Presupuestos | Bandeja (Mías / Equipo) |
| `#/cotizaciones/nueva` | Presupuestos | Borrador manual |
| `#/cotizaciones/escanear` | Presupuestos | PWA OCR competencia |
| `#/cotizaciones?id=<uuid>` | Presupuestos | Editor de líneas + envío |
| `#/integraciones` | Admin | Estado CRM (admin/owner) |

Routing: `src/comercial/quote-route.ts` (`parseCotizacionesRoute`).

## Flujo catálogo (share)

```
Comercial (browser)
  → Supabase Auth session (cookie/JWT HttpOnly gestionado por supabase-js)
  → Lectura catálogo: productos / familias / tipos (RLS)
  → Envío: POST functions/v1/comercial-share
       → valida rol + rate-limit + idempotencia
       → inserta commercial_shares + snapshots
       → email (Resend) | WhatsApp (wa.me prepared)
       → sync Twenty (people + companies + notes — never Opportunity)
       → audit log
```

## Flujo presupuestos (cotizaciones)

SoT: `solicitudes_cotizacion`. Mismo registro que Formalizar en tienda y `/admin#/cotizacion`.

```
Editor / bandeja (#/cotizaciones)
  → Guardar líneas: POST comercial-cotizacion (allowlist ventas+)
  → Validar → CRM: comercial-cotizacion + syncCotizacionOfertaWithTwenty
       → Twenty Opportunity (PROPOSAL) + nota con Nº, líneas, formalizar URL
  → Enviar formal: POST enviar-cotizacion { cotizacion_id, canal?: email|whatsapp }
       → ofertaCompleta() fail-closed
       → PDF IME-Q-YYYY-NNNNNN → Storage cotizaciones-pdf
       → Resend (email) o wa.me con PDF (WhatsApp link mode)
       → estado=enviada solo si mail aceptado / link preparado
  → Borrar: comercial-cotizacion delete (bloqueado si convertida/enviada)
```

Estados existentes (no reemplazar): `nueva → en_revision → respondida → enviada → convertida` (+ `expirada`).

Ver `docs/commercial-dropshipping-plan.md`, `docs/commercial-quote-dev.md`, ADR `docs/decisions/0010-quote-numero-pdf.md`.

## Flujo OCR competencia

Pantalla PWA `#/cotizaciones/escanear` o botones Cámara/Galería en editor.

```
Tap Cámara | Galería
  → pickCompetenciaImage (input file; capture=environment solo cámara)
  → compressImageForOcr (≤1600px, JPEG ~0.82)
  → POST comercial-ocr-presupuesto { image_base64, mime, quote_id? }
       → rate-limit por usuario
       → sube foto a Storage presupuestos-competencia (temporal si bridge)
       → extractQuoteFromImage (vision-quote-ocr.ts)
            → prod: OCR_BRIDGE_URL + URL firmada (sin base64 por túnel)
            → dev local: Ollama moondream directo con base64
       → puente local (scripts/ocr-moondream-bridge.mjs):
            auto → gemini | google_vision | rapid | moondream
       → mejora líneas vs catálogo I-ME (precio catálogo si match)
       → insert/update solicitudes_cotizacion (origen ocr-competencia)
       → foto → Storage privado presupuestos-competencia/{quote_id}/...
  → navigate #/cotizaciones?id=<uuid>
```

Anti-patterns (iOS/Android PWA): no `getUserMedia` para una foto; no un solo input con `capture` para galería+cámara; no depender de mirror local `:3847` en móvil.

Implementación: `src/comercial/quote-ocr.ts`, `supabase/functions/_shared/vision-quote-ocr.ts`, `scripts/ocr-moondream-bridge.mjs`.

## Mapeo taxonomía

| UI comercial | Fuente                                                |
| ------------ | ----------------------------------------------------- |
| Especialidad | `SPECIALTY_GROUPS` / `taxonomia-catalogo` PRINCIPALES |
| Familia      | `familias`                                            |
| Subfamilia   | `tipos`                                               |
| Sección      | `productos.tipo_comercial`                            |

## Roles

| Rol         | Catálogo | Envíos  | Cotizaciones | Plantillas | Integraciones | Usuarios               |
| ----------- | -------- | ------- | ------------ | ---------- | ------------- | ---------------------- |
| ventas      | sí       | propios | propias      | no         | no            | no                     |
| admin/owner | sí       | todos   | equipo       | ver        | sí            | ver (CRUD en `/admin`) |

## Storage privado

| Bucket | Uso | RLS |
| ------ | --- | --- |
| `cotizaciones-pdf` | PDF numerado por envío | ventas+ lectura |
| `presupuestos-competencia` | Fotos OCR competencia + sidecar JSON | ventas+ lectura/insert |

Migración bucket OCR: `supabase/migrations/20260815200000_presupuestos_competencia_storage.sql`.

## PWA

`manifest-comercial.json` + banner `beforeinstallprompt` + `comercial-sw.js` (shell `/comercial/`). Touch targets ≥44px en pantalla escanear. `Permissions-Policy` en `public/.htaccess` no debe bloquear captura vía `<input type="file">`.

## CRM (presupuestos vs catálogo)

| Acción | Twenty | Referencia |
| ------ | ------ | ---------- |
| Share catálogo | Note only | `docs/crm-commercial-mapping.md` |
| Validar presupuesto | Opportunity PROPOSAL + nota | `syncCotizacionOfertaWithTwenty` |
| Lead web pre-quote | Lead-shaped sync | `syncCotizacionWithTwenty` (sin cambio) |

## Relacionado

- Captura en congresos: `/congreso/` reutiliza `comercial-share` y el mismo puente OCR — ver `docs/congreso-architecture.md`.
