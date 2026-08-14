# ADR-0010: Numero de cotizacion, PDF y orden de envio

- Fecha: 2026-08-14
- Estado: aceptado
- Contexto: Plan `docs/commercial-dropshipping-plan.md` — Phase 1 send integrity

## Contexto

`enviar-cotizacion` marcaba `estado='enviada'` **antes** de Resend. Si el correo
fallaba, la fila quedaba enviada (`EMAIL_FALLIDO` mentia: "oferta guardada").
Plantilla inactiva en `email_templates` devolvia `{ ok: true }`. La referencia
del correo era `id.slice(0, 8)`, no un numero humano. No habia PDF corporativo
(`pdfjs` solo ingesta).

SoT de cotizacion: `solicitudes_cotizacion`. Formalizar lee JSONB actual.
Pedido = `pedidos`. Factura = Siigo/DIAN. No segunda tabla de quotes.

## Decision

1. **Numero** `IME-Q-{YYYY}-{seq 6}` via `cotizacion_numero_seq` +
   `ensure_cotizacion_numero(id)`. Nunca reutilizar. Helper
   `formatQuoteNumero()` en `src/lib/cotizacion-oferta.ts`.
2. **PDF** `pdf-lib` en `supabase/functions/_shared/render-quote-pdf.ts`,
   seam `renderQuotePdf(snapshot): Uint8Array`. Bucket privado
   `cotizaciones-pdf`, path `{id}/{revision}.pdf`, hash sha256.
   Cambiar libreria solo con ADR nuevo.
3. **Send order:** persist (si no `enviada`) → `normalizarOferta()` →
   `ensure_cotizacion_numero` → `claim_cotizacion_send` (2 min) → token →
   PDF+upload → Resend (`failOnInactive: true`, `Idempotency-Key`
   `quote-send:{id}:{revision}`) → **entonces** `estado='enviada'`.
4. **Plantilla inactiva:** otros callers siguen skip-as-ok. Oferta pasa
   `failOnInactive: true` → `TEMPLATE_INACTIVE`.
5. **Revisiones:** taste duplicate-on-revise (fila nueva). Phase 1 no crea
   tabla snapshot. Resend de la misma fila regenera PDF; Formalizar sigue
   leyendo JSONB de esa fila. UI `/comercial` no entra en este ADR.
6. **CRM:** no cambiar firma de `syncCotizacionWithTwenty` (lead). Sync de
   oferta Twenty = Phase posterior.

## Consecuencias

- Migracion `20260814170000_quote_pdf_numero.sql` (additive).
- Codigos: `OFERTA_*`, `EMAIL_FALLIDO`, `TEMPLATE_INACTIVE`,
  `PDF_RENDER_FAILED`, `SEND_IN_FLIGHT`, `NUMERO_CONFLICT`.
- Runbook: `docs/commercial-quote-dev.md`.
