# Testing — CMS comercial

## Unitarias (Vitest)

Archivo: `src/lib/comercial-cms.test.ts`

Cubre:

- Normalización email/teléfono E.164
- Render de plantillas y rechazo de variables desconocidas
- Filtros jerárquicos (especialidad → familia → tipo → sección → búsqueda)
- Clave de idempotencia
- Helpers de permisos comerciales

Ejecutar:

```bash
npm test
```

## Integración / E2E manual

Checklist catálogo:

1. Login comercial (`ventas`) en `/comercial/`.
2. Especialidad → familia → subfamilia → productos.
3. Filtro sección (`equipo` / `consumible`).
4. Búsqueda por nombre/SKU con debounce.
5. Abrir landing pública en nueva pestaña.
6. Selección múltiple → modal → email (requiere `MAILER_*`).
7. WhatsApp → estado `prepared` + apertura `wa.me` (no marcar `sent`).
8. Historial `#/envios`.
9. Admin: `#/integraciones` status + reintento CRM.
10. Usuario sin perfil comercial: acceso denegado.
11. PWA: banner instalar en Chrome desktop/móvil (HTTPS o localhost).

Checklist cotizaciones + OCR:

1. `#/cotizaciones/escanear` — botones **Tomar foto** y **Galería** abren picker (mismo gesto tap).
2. Foto legible de presupuesto competencia → borrador en `#/cotizaciones?id=<uuid>`.
3. Líneas con precio catálogo I-ME cuando hay match; `precio_pendiente_validar` si OCR sin precio.
4. Guardar borrador → recargar editor conserva líneas.
5. **Validar → CRM** bloqueado si hay líneas con `precio_pendiente_validar`.
6. Tras validar: Opportunity en Twenty (`docs/crm-commercial-mapping.md`).
7. Enviar presupuesto por **email** (Resend) o **WhatsApp** (link + PDF); CRM no se dispara en envío.
8. PDF numerado `IME-Q-YYYY-NNNNNN` en Storage `cotizaciones-pdf`.
9. Borrar presupuesto en bandeja (admin) o editor — falla si `convertida`/`enviada`.
10. OCR sobre presupuesto existente (editor → Escanear foto) actualiza líneas, no duplica fila.
11. Foto competencia en bucket `presupuestos-competencia` (service_role o ventas autenticado).

Checklist OCR errores esperados:

| Código | Cuándo |
| ------ | ------ |
| `OCR_FAILED` | Puente/Gemini inalcanzable o modelo no responde JSON |
| `OCR_EMPTY` | Imagen ilegible o sin datos útiles |
| `IMAGE_TOO_LARGE` | >8 MB tras compresión |
| `QUOTE_LOCKED` | OCR sobre presupuesto enviada/convertida |
| `RATE_LIMIT` | Demasiados OCR seguidos |

Diagnóstico puente:

```bash
./scripts/ocr-bridge-up.sh --status
curl -H "Authorization: Bearer $OCR_BRIDGE_SECRET" "$OCR_BRIDGE_URL/health"
```

## Unitarias adicionales

- `src/comercial/quote-route.test.ts` — rutas `#/cotizaciones/*` incl. `escanear`
- `src/comercial/quote-api.test.ts` — helpers API presupuestos
- `src/lib/cotizacion-oferta.test.ts`, `condiciones-oferta.test.ts` — validación oferta/PDF

## Automatización pendiente

- E2E Playwright del flujo completo (recomendado tras deploy de función + migración).
- Tests Deno de `twenty-crm.ts` con mock fetch.
