# Arquitectura — IME Congreso

Captura presencial de leads en congresos y ferias. SPA privada para comerciales en piso de evento: OCR de tarjeta, selección multi-producto, registro en CRM y envío inmediato de información por email/WhatsApp.

## Superficie

| Elemento | Ubicación |
| -------- | --------- |
| Ruta | `/congreso/` (`noindex`) |
| Query param | `?evento=<slug>` — default `acise2026` si omitido |
| Frontend | `src/pages/congreso.astro` + `src/congreso/*` |
| Auth | Misma sesión Supabase que `/comercial/` (`admin_profiles`, roles `ventas` \| `admin` \| `owner`) |
| PWA | `manifest-congreso.json` + `congreso-sw.js` (scope `/congreso/`) |
| Eventos | `src/congreso/events.ts` — lista estática `CONGRESO_EVENTS` |

No hay pantalla de configuración en `/congreso`; productos y plantillas se gestionan desde `/admin` (ver `docs/congreso-admin.md`).

## Edge Functions

| Función | Rol |
| ------- | --- |
| `congreso-ocr` | OCR tarjeta de visita → campos editables (nombre, empresa, email, teléfono) |
| `congreso-lead` | Inserta lead en `leads_comerciales` con idempotencia y validación server-side |
| `comercial-share` | Envío post-registro por email o WhatsApp (reutiliza catálogo share) |

Deploy:

```bash
supabase functions deploy congreso-ocr congreso-lead comercial-share
```

## Flujo completo

```
Comercial autenticado (/congreso/)
  → (opcional) Escanear tarjeta
       → POST congreso-ocr { image_base64, mime }
            → sube temp a presupuestos-competencia/congreso/{user}/{uuid}
            → extractQuoteFromImage (mismo puente OCR que CMS — ver cms-commercial-architecture.md)
            → borra temp; devuelve nombres/apellidos/institución/email/teléfono
       → campos editables en formulario (revisar siempre antes de enviar)
  → Seleccionar uno o más productos (checkbox; selección persiste al filtrar)
  → Completar contacto + consentimiento + canal(es) email/WhatsApp
  → POST congreso-lead
       → rate-limit + idempotencyKey
       → valida productos: activos, landing enriquecida, ficha_pdf, congreso_habilitado ≠ false
       → insert leads_comerciales (campaign=evento, tipo_proyecto=registro_evento, prioridad P3)
  → POST comercial-share (por canal) con copy ACISE + lista productos
       → email: plantilla comercial_catalogo
       → WhatsApp: wa.me con mensaje preformateado (messageOnly)
  → Pantalla éxito + enlace WhatsApp si aplica
```

## Elegibilidad de productos

Un producto aparece en Congreso si cumple **todas** las condiciones (validadas también en `congreso-lead`):

1. `activo = true`
2. `ficha_pdf` no vacío
3. Landing enriquecida (`valor_es`, `beneficios_es` o `descripcion_corta_es`)
4. `atributos.congreso_habilitado !== false` (admin puede ocultar — ver `congreso-admin.md`)

## Datos del lead

Tabla `leads_comerciales`:

| Campo | Valor Congreso |
| ----- | -------------- |
| `campaign` | `evento` |
| `tipo_proyecto` | `registro_evento` |
| `familia_slug` | `evento` |
| `prioridad` | `P3` |
| `landing_path` | `/congreso` |
| `metadata.origen` | `congreso` |
| `metadata.evento` | `{ slug, nombre }` |
| `metadata.productos_interes` | snapshots con slug, landing, brochure |
| `metadata.canales_solicitados` | `email` / `whatsapp` |

## Seguridad

- Ruta privada: requiere JWT comercial activo; sin perfil → mensaje de acceso denegado.
- Validación de productos en Edge — un comercial no puede enviar IDs arbitrarios no habilitados.
- Idempotencia: `idempotencyKey` 16–200 chars alfanuméricos; reintentos devuelven mismo `leadId`.
- Rate limit: bucket `cotizacion` para leads, bucket `ocr` para escaneos.
- Sesión idle: `startIdleWatch` compartido con CMS comercial (15 min).

## Relacionado

- Config admin: `docs/congreso-admin.md`
- Setup y deploy: `docs/congreso-setup.md`
- Checklist QA: `docs/congreso-testing.md`
- OCR puente: `docs/cms-commercial-deployment.md` § OCR
