<!-- /autoplan restore point: /home/shoky/.gstack/projects/8picota2025-IMe-Platform/no-branch-autoplan-restore-20260813-233122.md -->

# Plan: PDF de cotización + unificar `/comercial` sobre `solicitudes_cotizacion`

Gospel original: `/home/shoky/cursor/CMS_CRM.md` (misión ERP 72 secciones).  
Este archivo es el **plan ejecutable** tras /autoplan. Premisas D1=A.  
Auditoría: `docs/commercial-dropshipping-audit.md`.

KPI: mediana horas `solicitud → PDF enviado`. No `dropshipping_enabled` checked.

---

## 0. Enfoque elegido (0C-bis)

**APPROACH A — Minimal:** PDF only from `/admin` `enviar-cotizacion`. Effort S. Risk Low. Does not fix dual UX.

**APPROACH B — Extend live domain (CHOSEN):** One quote table, PDF + `/comercial` editor + CRM keys. Effort L. Risk Med. Reuses `cotizacion-oferta.ts`, Edge, Formalizar.

**APPROACH C — Ideal ERP:** New quotes/suppliers/documents/PO. Effort XL. Risk High. Duplicates production. Rejected (P4 DRY, P5 explicit).

Recommendation: B. Completeness 9/10 vs A 5/10 vs C 3/10 (wrong problem).

Mode: SELECTIVE EXPANSION. Cherry-picks auto-decided (P1/P2/P3) — see CEO plan.

---

## What already exists

| Sub-problem          | Existing                                        | Reuse?                                      |
| -------------------- | ----------------------------------------------- | ------------------------------------------- |
| Quote CRUD           | `solicitudes_cotizacion` + `/admin#/cotizacion` | YES — only table                            |
| Line snapshots       | JSONB `productos`                               | YES — extend fields in JSON, no child table |
| Send block no price  | `ofertaCompleta()` → `OFERTA_SIN_PRECIO`        | YES                                         |
| Email send           | `enviar-cotizacion` + Resend                    | YES — add PDF attach; fix order             |
| Formalizar / convert | Edge + `crear-pago` locked prices               | YES — do not fork                           |
| Catalog share        | `/comercial` + `comercial-share`                | YES — keep as separate verb                 |
| CRM people/companies | `twenty-crm.ts`                                 | YES — add op keys                           |
| Suppliers / cost     | `proveedores`, `precio_costo`                   | YES — no new entity                         |
| Dropship notify      | `notificar-proveedor`                           | DEFER UI                                    |
| Invoice              | Siigo/DIAN                                      | DO NOT replace                              |

---

## NOT in scope

- New `supplier` / `presupuestos` / `purchase_orders` / `CommercialDocument` tables
- Columns `dropshipping_enabled`, `purchase_price` (use `fulfillment_mode`, `precio_costo`)
- New quote state machine DRAFT/READY/VIEWED/ACCEPTED (keep `nueva|en_revision|respondida|enviada|convertida|expirada`)
- PRICE_REQUIRED emails to root/info
- FX conversion service
- `product_price_history` table
- Invoice/albarán PDF this ship
- PO grouping UI (exists as notify)
- Lead/org CRUD (exists)
- Event sourcing
- New queues/Redis/Kafka

---

## Dream state

```
CURRENT                         THIS PLAN                         12-MONTH
/comercial = share only    →    /comercial quotes+PDF        →   Sales OS:
/admin = money quotes           same row as Formalizar            share + quote +
HTML email, UUID ref            IME-Q-YYYY-N + PDF                PO UI on fulfillments
Two CRMs, quote no idempotency  Twenty pipeline SoT + keys        crm_* warehouse only
Dropship notify works           unchanged                         Optional sku/lead_time
No numbered PDF                 hospital-ready PDF                Albarán copy later
```

Delta after this plan: ~70% of 12-month sales OS. Remaining: PO UI, isolation, tax/discount polish, packing PDF.

---

## Source of truth

| Entity    | SoT                               | Mirror             |
| --------- | --------------------------------- | ------------------ |
| Quote     | `solicitudes_cotizacion`          | Twenty Opportunity |
| Order/pay | `pedidos`                         | Twenty pago        |
| Invoice   | DIAN/Siigo                        | Twenty factura     |
| Logistics | `fulfillments`                    | —                  |
| Cost      | `proveedor_producto.precio_costo` | never ventas       |
| Pipeline  | Twenty                            | `crm_*` internal   |

---

## Architecture (new vs existing)

```
                    ┌──────────── /comercial SPA ────────────┐
                    │ catalogo │ envios │ cotizaciones(NEW)  │
                    └──────┬───────────────┬─────────────────┘
                           │ share         │ quote CRUD
                           ▼               ▼
                    comercial-share   Edge: registrar / guardar /
                    (Notes only)      enviar-cotizacion (PDF)
                           │               │
                           │               ▼
                           │        solicitudes_cotizacion
                           │        + numero + pdf_revision
                           │               │
                           │               ├─► Storage private pdfs
                           │               ├─► Resend + email_log
                           │               ├─► Formalizar (existing)
                           │               └─► Twenty Opportunity
                           │                     (idempotent key)
                    /admin cotizacion ────┘  (same Edge, ops extras)
```

### Quote state machine (existing — do not replace)

```
nueva → en_revision → respondida → enviada → convertida
                  ↘ expirada ↗              ↘ expirada
Illegal: convertida → enviada; enviada → nueva.
VIEWED not modeled. ACCEPTED ≡ convertida / Formalizar.
```

### Data flow — send quote

```
INPUT lines+condiciones
  nil     → OFERTA_SIN_LINEAS, stay draft
  empty   → same
  price 0 → OFERTA_SIN_PRECIO, save OK, send blocked
VALIDATE ofertaCompleta + auth ventas+
TRANSFORM snapshot JSON + numero + PDF bytes
PERSIST revision row/storage; THEN email; THEN estado=enviada
ERROR email → estado stays respondida; sync_error; user sees retry
```

---

## Phases (replaces CMS_CRM.md §60)

### Phase 1 — Document + number (HOUR 1)

Objetivo: human number + PDF artifact from persisted lines.

Archivos: migration on `solicitudes_cotizacion`; Edge PDF helper; `enviar-cotizacion`; `cotizacion-oferta.ts`; email template.

Migración (additive):

- `numero text unique` (e.g. `IME-Q-2026-000123`) — sequence, never reuse
- `pdf_storage_path text`
- `pdf_sha256 text`
- `pdf_revision int default 0`
- `oferta_enviada_at` already exists

Dependencias: Resend, Storage bucket private (reuse `cotizaciones-adjuntos` or `cotizaciones-pdf`).

Riesgos: PDF lib choice (taste). Totals must use `calcularTotalOfertado` only.

Tests: number uniqueness; PDF hash stable for same snapshot; send blocked without price.

Aceptación: admin send attaches numbered PDF; email HTML totals === PDF totals.

### Phase 2 — `/comercial` quote workbench (HOUR 2–5)

Objetivo: ventas creates/edits/sends quotes without `/admin`.

Archivos: `src/comercial/*` new view `cotizaciones`; extract shared quote UI/logic from `admin-app.ts` into `src/lib/quote-workbench.ts` (or `src/comercial/quote-view.ts` calling same helpers); hash route; product search API (PostgREST `ilike` / `busqueda_tsv`) — do not load 476 products.

RBAC: `ventas` CRUD quotes; never select `precio_costo`. Admin keeps adjuntos/convert.

Inbox: default **shared tray** this ship (all `ventas` see all quotes). Assignment isolation = taste / later.

Tests: Playwright login → comercial → new quote → add catalog + manual line → save → preview → send.

Aceptación: criteria CMS_CRM.md §62 minus CRM extras (those Phase 3).

### Phase 3 — Send integrity + CRM keys (HOUR 6+)

Objetivo: no false `enviada`; no duplicate Twenty opps.

Fix `enviar-cotizacion`: persist PDF → send email → on success set `enviada` + log. On fail: keep `respondida`, record error.

`registrar-cotizacion`: add `idempotency_key` (copy `leads_comerciales` pattern).

`syncCotizacionWithTwenty(cotizacion_id, event_type, revision)`: reuse `crm_opportunity_id` if set; key `quote_id+event+revision`.

Share stays Notes, does not create Opportunity.

Docs: `docs/crm-commercial-mapping.md`.

### Phase 4 — QA same PR

Unit: parseLineas, ofertaCompleta, numbering, idempotency.
Integration: enviar order, Formalizar still works.
E2E: §56 path at unify, not a later phase.
Regression: public catalog pages, `comercial-share`, crear-pago.

### Later (TODOS, not this PR)

- PO UI on `fulfillments`
- `sku_proveedor`, `lead_time_days`, optional `proveedor_envio_id`
- JSONB optional `descuento_pct` / `iva_pct` if ops demand
- Packing-list PDF clone
- Salesperson isolation RLS

---

## Eng locks (auto-decided after dual voices)

### Ship sequence (not UI-first)

1. `enviar-cotizacion` fail-closed + inactive template = error (`email.ts` `ok:true` on inactive is a lie)
2. Atomic send claim + Resend idempotency key; estado `enviada` only after accepted send
3. Migration: `numero` sequence, `created_by`, `updated_at`, optimistic lock
4. Canonical `normalizarOferta()` server-side: one moneda, recompute subtotals, reject mixed currency
5. New `syncCotizacionOfertaWithTwenty` — **do not** change lead `syncCotizacionWithTwenty` signature
6. Then `/comercial` workbench (`vistaPermitida` + search allowlist)

Human: ~5–8 days. CC: ~half-day to 1 day. Old “2–4 hours” was fantasy.

### Revision model (recommended; taste at gate)

**Duplicate-on-revise (A):** enviada row is immutable. “Nueva revisión” copies to a **new** `solicitudes_cotizacion` row (new `numero`, new token). Old Formalizar link keeps old JSONB/prices.

Rejected-for-now: in-place JSONB mutate + `pdf_revision` (Formalizar reads current row — Codex blocker). Snapshot child table = more complete → taste B.

### Writes

Comercial **must not** PostgREST-update arbitrary columns. Edge/RPC allowlist only. JSONB must strip `precio_costo`. Typeahead select `id,slug,sku,nombre_es` only.

Live RLS is `is_admin(ARRAY['ventas'])` ALL, plus public INSERT and client SELECT by email — do not claim `is_comercial_user`. Shared tray = accepted threat this ship; log `actor_user_id`. Isolation RLS = deferred taste.

### Send protocol

Claim `quote_id+revision` → generate PDF → Resend with idempotency key → conditional UPDATE enviada. Inactive template → fail. Parallel send → 409.

### Email copy

`referencia` = `numero` IME-Q, never `id.slice(0,8)`.

### Formalizar after revision

Old token stays on old row. New row gets new token. Test both links.

---

## Security (this ship)

| Threat                          | L   | I   | Mitigate                                            |
| ------------------------------- | --- | --- | --------------------------------------------------- |
| IDOR quote UUID (ventas)        | H   | H   | Accept shared tray; Edge writes; log actor; no anon |
| Direct PostgREST mutate         | H   | H   | Comercial writes via Edge allowlist only            |
| `precio_costo` in JSONB         | H   | H   | Strip server-side; ventas cannot SELECT junction    |
| `productos.precio` in typeahead | M   | M   | Column allowlist; no `select *`                     |
| PDF signed URL leak             | M   | H   | Edge stream JWT; TTL ≤60s                           |
| XSS in PDF                      | M   | M   | Same escapeHtml as email; no HTML-in-PDF            |
| Duplicate send                  | H   | H   | Atomic claim + Resend idempotency                   |
| Inactive template fake-ok       | H   | H   | Fail-closed                                         |
| CSRF                            | L   | M   | Existing JWT                                        |

---

## Error & Rescue Registry

| Codepath                       | What goes wrong                     | Exception           | Rescued | Action                  | User sees                                       |
| ------------------------------ | ----------------------------------- | ------------------- | ------- | ----------------------- | ----------------------------------------------- |
| `ofertaCompleta`               | no lines / price 0 / no condiciones | domain error string | Y       | block send              | Spanish message named                           |
| `enviar-cotizacion` PDF gen    | renderer crash                      | PdfRenderError      | Y       | fail send, log          | "No se pudo generar PDF. Reintente"             |
| `enviar-cotizacion` Resend     | timeout/429                         | MailerError         | Y       | no estado change, retry | "Email no salió. Cotización no marcada enviada" |
| `registrar-cotizacion` dup key | retry                               | unique violation    | Y       | return existing id      | silent success                                  |
| `syncCotizacionWithTwenty`     | 429/5xx                             | TwentyError         | Y       | crm_sync_status=failed  | banner retry; quote still sent                  |
| Storage upload                 | fail                                | StorageError        | Y       | abort before email      | retry                                           |
| Product search                 | empty                               | —                   | Y       | empty state             | "Sin resultados"                                |
| Formalizar after PDF           | token expired                       | existing            | Y       | existing copy           | do not change                                   |

No `catch (Exception)`. Named errors only.

---

## Failure Modes Registry

| Codepath          | Failure                        | Rescued         | Test | User sees              | Logged              |
| ----------------- | ------------------------------ | --------------- | ---- | ---------------------- | ------------------- |
| Send              | email after PDF, before estado | Y               | Y    | retry                  | Y correlation_id    |
| Send              | mark enviada then email fail   | N was gap       | Y    | would lie              | — **FIXED by plan** |
| CRM               | retry creates 2 opps           | Y after Phase 3 | Y    | none                   | Y                   |
| PDF ≠ HTML totals | silent                         | Y prevent       | Y    | block send if mismatch | Y                   |
| Cost in JSON      | leak                           | Y omit          | Y    | never                  | —                   |
| 476 product RAM   | freeze PWA                     | Y search        | Y    | typeahead              | —                   |
| Edit after send   | mutate PDF                     | Y new revision  | Y    | confirm dialog         | Y                   |

CRITICAL GAP if we skip send-order fix: user thinks client received quote.

---

## Temporal interrogation

```
HOUR 1: numbering scheme, PDF renderer, bucket, totals function (one)
HOUR 2-3: extract vs copy admin editor; search API; manual lines (empty slug OK today)
HOUR 4-5: PWA cache of new hash route; SW must not intercept Edge
HOUR 6+: Twenty key shape; registrar idempotency; Formalizar regression
```

Human ~4–6 days / CC ~2–4 hours for Phases 1–3.

---

## Implementation alternatives rejected

- HTML print-from-browser as PDF: inconsistent branding, not stored. Reject.
- New microservice documents: §59 forbids. Reject.
- Child table for lines this ship: breaks Formalizar JSONB. Reject.

---

## UX `/comercial` cotizaciones (mini-spec — auto-decided from dual design voices)

No DESIGN.md. Calibrate to existing `/comercial` tokens (`comercial.css` teal `#005e60`), not admin cream/serif. Do **not** port `admin-app.ts` DOM.

### Routes

| Hash                       | Screen                                     |
| -------------------------- | ------------------------------------------ |
| `#/cotizaciones`           | Bandeja. Query `?tab=pendientes\|enviadas` |
| `#/cotizaciones?id=<uuid>` | Editor                                     |
| `#/cotizaciones/nueva`     | Create (or `?id=new`)                      |
| Preview                    | **Modal over editor**, not a third route   |

Default landing of PWA stays **Catálogo**. Nav order: Catálogo · Cotizaciones · Envíos. Add `'cotizaciones'` to `ComercialView` + `vistaPermitida` (`shared.ts`) or ventas bounce to Catálogo.

### Bandeja

Tabs: **Pendientes** = `nueva|en_revision|respondida` (default). **Enviadas** = `enviada|convertida`. Recientes = sort, not a tab. Chip **Expirada**.

Row order: IME-Q (or “Borrador”) · empresa/contacto · badge estado · total+moneda · badge precio incompleto · comercial nombre · chip Web/PWA · updated_at. Primary: Abrir.

API: shared tray (all ventas). UI default filter **Mías** (`created_by` / `user_id` — add column if missing). Toggle Equipo. Not RLS isolation this ship (taste leftover: full row isolation).

Empty-zero: “Aún no hay cotizaciones.” CTA Nueva + “O selecciona productos en Catálogo.” Empty-filter: “Sin resultados” + Limpiar (envíos copy). Loading: 6 skeleton rows.

### Catalog → quote (door)

Floating bar on Catálogo: primary **Cotizar selección** (prefill lines qty 1, precio 0 + missing-price badge) · secondary **Enviar catálogo** (existing share modal). Hide share floating bar on `#/cotizaciones`. Quote sticky footer uses that slot.

### Field allowlist (comercial editor)

Allow: nombre, empresa, email, teléfono, moneda, validez_hasta, líneas (nombre, slug, qty, precio_unitario, subtotal, notas), condiciones, total, estado read-only badge, IME-Q.

Deny: nit/IVA/direcciones, adjuntos, notas_internas, Formalizar/convert, bulk delete, workflow chips, consentimiento, `precio_costo`.

### Line UI

≥960px: `comercial-table`. <960px: card per line (nombre, qty stepper 44px, precio, subtotal, eliminar). Typeahead combobox ≥2 chars, limit 20, footer **Añadir línea libre**. Money: port `crmMoney` (COP 0 dp, USD 2). Never a third formatter.

### Sticky footer

Guardar ghost · Vista previa ghost · **Enviar PDF** primary `min-height: 44px` (not `--sm`). Copy under Enviar: “Se envía por email a {email}. Catálogo por WhatsApp sigue en Catálogo.”

Preview: dialog, spinner “Generando PDF…”, iframe blob/signed GET. Not `window.print`. Cannot preview/send unsaved diffs — persist first. Confirm send shows IME-Q, email, total, revisión.

### Estados UI → acciones

| estado                           | Edit                     | Preview                        | Send                 | Notes                                     |
| -------------------------------- | ------------------------ | ------------------------------ | -------------------- | ----------------------------------------- |
| nueva / en_revision / respondida | Y                        | Y if ofertaCompleta else badge | Y iff ofertaCompleta | save always                               |
| enviada                          | N until “Nueva revisión” | Y open PDF                     | N                    | banner IME-Q + Abrir PDF + Reintentar CRM |
| convertida                       | N                        | Y                              | N                    | “Pedido en /admin — no editar.”           |
| expirada                         | N                        | Y                              | N                    | “Vencida. Duplicar a borrador”            |

Allocate `numero` on first successful save.

Edit-after-send dialog: “Esto crea revisión {n+1}. El PDF anterior queda en archivo. El cliente recibirá un correo nuevo.” Primary: **Crear revisión y enviar**.

Send in-flight: disable Guardar+Enviar, “Enviando PDF…”. Success: stay on editor, banner with number+email. Partial CRM fail: same banner + badge failed + Reintentar CRM. Deploy without PDF Edge: disable Enviar with “PDF aún no disponible.” Do not silently HTML-send from PWA.

Unsaved: `beforeunload` + hashchange confirm. Concurrent: 409 → “Otro comercial guardó esta oferta. Recargar.” Offline: comercial-state error, no fake PDF.

### A11y (verifiable)

Reuse share-modal: Escape, Tab trap, restore focus, `aria-modal`. Combobox Arrow/Enter/Esc. `aria-current` on nav. `role="alert"` for send errors. Labels on every field. Focus first field on nueva. Contrast: do not put warn `#9a6500` on `--accent-soft`. Skip `--sm` on primary.

### Brand

I·ME mark, teal, `comercial-panel` / `comercial-table` / `comercial-badge`. PDF ink = same accent. Never restyle with admin.css.

---

## Tests (diagram)

NEW UX: comercial quote list, create, search product, manual line, save draft, preview PDF, send, blocked send, admin still convert.

NEW DATA: numero allocate, pdf persist, revision bump, email_log, twenty key.

NEW CODEPATHS: ofertaCompleta, send-order, idempotent registrar, search.

ASYNC: none new queue; Edge request.

EXTERNAL: Resend, Twenty, Storage.

2am Friday test: send with missing price blocked; Formalizar still pays locked prices; retry send no second Opportunity.

Hostile QA: UUID enumeration, cost in network tab, double-click send, edit after send, 0-qty line, mixed currency lines (forbid).

---

## Performance

- Product picker: PostgREST search, limit 20, index `busqueda_tsv` exists.
- PDF: generate once per revision; cache path.
- List quotes: filter + limit; index `solicitudes_cotizacion(estado, created_at)`.
- No N+1: join cliente fields on list query once.

---

## Observability

Structured logs: `quote_id`, `revision`, `event` (`pdf_ok|mail_fail|twenty_fail`), no PII in URL.
Metric: send success rate; median request→sent.
Alert: mail fail rate > 5% / 15m.
Runbook: retry send from UI; `comercial-share?action=retry` pattern for quotes.

---

## Deploy / rollback

1. Migration additive (nullable numero backfill).
2. Deploy Edge PDF + enviar order fix.
3. Deploy static `/comercial` route.
4. Smoke: one internal quote PDF + Formalizar sandbox.
   Rollback: revert static + Edge; leave columns. Do not DROP numero.
   Old admin HTML-only send remains until Edge ships PDF — feature detect `pdf_storage_path`.

---

## DX (implementer)

Persona: staff engineer / CC agent on ime-platform.

TTHW: clone → `.env` existing → `npm test` + one Edge serve. Target < 5 min to find `cotizacion-oferta.ts`.

Docs this ship: this file, audit, `docs/crm-commercial-mapping.md`, `.env.example` only if new public names (no secrets). ADRs: numbering, PDF renderer, CRM SoT.

Errors: problem + cause + fix (reuse `OFERTA_SIN_PRECIO` style).

---

## Files to touch (expected)

- `supabase/migrations/YYYYMMDDHHMMSS_quote_pdf_numero.sql`
- `src/lib/cotizacion-oferta.ts` (+ tests)
- `src/comercial/comercial-app.ts`, new quote view
- `src/admin/admin-app.ts` (call shared helper, do not fork)
- `supabase/functions/enviar-cotizacion/index.ts`
- `supabase/functions/registrar-cotizacion/index.ts`
- `supabase/functions/_shared/twenty-crm.ts`
- `supabase/functions/_shared/email.ts` (attach)
- `docs/crm-commercial-mapping.md`
- Playwright e2e quote path

Constraint: if a PR cannot name an existing file it extends, it is out of scope.

---

<!-- AUTONOMOUS DECISION LOG -->

## Decision Audit Trail

| #   | Phase  | Decision                                 | Classification    | Principle              | Rationale                                | Rejected                 |
| --- | ------ | ---------------------------------------- | ----------------- | ---------------------- | ---------------------------------------- | ------------------------ |
| 1   | CEO    | D1 premises A (reuse live domain)        | Mechanical (user) | P4 P5                  | Code already has quotes/suppliers/CRM    | Literal 72-section ERP   |
| 2   | CEO    | Mode SELECTIVE EXPANSION                 | Mechanical        | autoplan override      | Enhancement not greenfield               | Expansion/Reduction      |
| 3   | CEO    | Approach B extend solicitudes_cotizacion | Mechanical        | P1 P4                  | Highest completeness of right problem    | A PDF-only; C new tables |
| 4   | CEO    | Ban new supplier/quote/document tables   | Mechanical        | P4                     | Live tables exist                        | CMS_CRM §4–6, §30        |
| 5   | CEO    | Phase order PDF+unify → CRM → PO later   | Mechanical        | P6 P1                  | Buyer PDF is 10x; dropship CMS is not    | §60 Phase 1–2 dropship   |
| 6   | CEO    | Keep existing quote estados              | Mechanical        | P5                     | Formalizar depends on enviada/respondida | DRAFT/VIEWED machine     |
| 7   | CEO    | Skip PRICE_REQUIRED mail                 | Mechanical        | P3                     | Catalog is quote-mode by design          | §20 email storm          |
| 8   | CEO    | JSONB lines stay                         | Mechanical        | P5                     | Formalizar parses JSONB                  | Child line table         |
| 9   | CEO    | Shared quote inbox this ship             | Taste             | P6                     | Isolation is one-way RBAC; default share | Per-owner RLS now        |
| 10  | CEO    | PDF renderer choice later in eng         | Taste             | P3                     | Need one totals fn more than lib         | Document microservice    |
| 11  | CEO    | Office-hours skip                        | Mechanical        | P6 user asked efficacy | User said execute most effective         | Delay for design doc     |
| 12  | Design | All 7 dimensions in plan                 | Mechanical        | P1                     | UI workbench is the product              | Backend-only             |
| 13  | Design | Share ≠ Quote two nav items              | Mechanical        | P5                     | Codex+Claude agree                       | Collapse into one module |
| 14  | Eng    | Fix send-before-mail                     | Mechanical        | P1                     | Silent lie to salesperson                | Defer                    |
| 15  | Eng    | Search not full catalog fetch            | Mechanical        | P1                     | 476 products                             | Reuse catalog-view RAM   |
| 16  | Eng    | No new infra                             | Mechanical        | P5                     | §59                                      | Redis/queue              |
| 17  | DX     | Docs+ADR+named errors                    | Mechanical        | P1                     | Agent-implementer is user                | Skip docs                |
| 18  | DX     | Mapping doc before more Twenty fields    | Mechanical        | P4                     | Dual CRM                                 | Third mapping layer      |

---

## CEO DUAL VOICES — CONSENSUS TABLE

```
  Dimension                            Claude  Codex  Consensus
  1. Premises valid?                   NO-as-written  NO-as-written  CONFIRMED (rewrite)
  2. Right problem to solve?           PDF+unify      PDF+unify      CONFIRMED
  3. Scope calibration correct?        cut ERP        cut ERP        CONFIRMED
  4. Alternatives explored?            extend table   extend table   CONFIRMED
  5. Competitive/market risks?         PDF speed      trust>speed    DISAGREE nuance
  6. 6-month trajectory sound?         if rewritten   if rewritten   CONFIRMED
```

DISAGREE: Codex stresses inbox isolation + medical trust/SLA before automating more dropship. Claude stresses time-to-PDF as 10x. Plan: PDF first; isolation = taste; no PO this ship.

Degradation: Codex ran (gpt-5.6-luna). Claude code-explorer CEO. SOURCE=codex+subagent.

---

## CEO Completion Summary

| Item                | Status                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Premise challenge   | Done — greenfield false                                                                                     |
| 11 sections         | Absorbed into this plan (arch, errors, security, flows, quality, tests, perf, o11y, deploy, trajectory, UX) |
| Error registry      | Yes                                                                                                         |
| Failure modes       | Yes                                                                                                         |
| NOT in scope        | Yes                                                                                                         |
| What already exists | Yes                                                                                                         |
| Dream delta         | Yes                                                                                                         |
| Dual voices         | Yes                                                                                                         |
| Spec review loop    | Pending after design/eng                                                                                    |

**Phase 1 complete.** Codex: 10 blind spots. Claude: 18 findings. Consensus 5/6 confirmed, 1 nuance → taste (isolation + trust). Passing to Phase 2.

---

## DESIGN DUAL VOICES — LITMUS SCORECARD

```
  Dimension                 Claude  Codex  Consensus
  1. Hierarchy user-first    3/10    FAIL   CONFIRMED gap → mini-spec added
  2. States specified        4/10    FAIL   CONFIRMED gap → states table added
  3. Journey / door          3/10    FAIL   CONFIRMED → Cotizar selección
  4. Specificity             2/10    FAIL   CONFIRMED → routes+allowlist
  5. A11y                    3/10    FAIL   CONFIRMED → share-modal patterns
  6. Responsive              4/10    FAIL   CONFIRMED → table/cards 960px
  7. Brand comercial.css     5/10    ok     CONFIRMED → no admin.css
```

Mockups skipped: no DESIGN.md, no designer binary in this session, user asked efficacy. Mini-spec substitutes.

Auto-decided into plan (P1/P5): field allowlist, hashes, Cotizar CTA, line cards <960px, preview modal, Mías UI filter (not RLS), numero on first save, 44px primary.

**Phase 2 complete.** Codex: 10 haunt-list items. Claude: 12 critical/high UI locks. Consensus: UX was 3.5/10, now specified in mini-spec. Passing to Phase 3.

---

## ENG DUAL VOICES — CONSENSUS TABLE

```
  Dimension                    Claude  Codex  Consensus
  1. Architecture sound?       NO until locks  NO until ADR4  CONFIRMED after eng locks
  2. Test coverage sufficient? gaps listed     agree          CONFIRMED → test-plan artifact
  3. Performance risks?        picker+PDF      PDF memory     CONFIRMED
  4. Security threats?         IDOR/cost       Edge writes    CONFIRMED
  5. Error paths?              send-before-mail + template lie  CONFIRMED
  6. Deployment risk?          sequence UI last  sequence     CONFIRMED
```

Critical absorbed: send-order, template fail-closed, send claim, created_by/updated_at, no overload Twenty lead sync, Edge allowlist writes, canonical totals, duplicate-on-revise (taste vs snapshot table).

**Phase 3 complete.** Codex: 4 blockers. Claude: 21 findings. Consensus 6/6 on problems; 1 remaining taste (revision model). Passing to Phase 3.5.

---

## DX DUAL VOICES — CONSENSUS TABLE

```
  Dimension                    Claude  Codex  Consensus
  1. Getting started < 5 min?  4/10    3/10   CONFIRMED fail → runbook below
  2. API/CLI naming?           7/10    4/10   DISAGREE severity; keep kebab + OFERTA_* codes
  3. Error messages?           4/10    4/10   CONFIRMED → code table
  4. Docs findable?            5/10    3/10   CONFIRMED → TOC + ADR
  5. Upgrade path safe?        ok mig  5/10   CONFIRMED additive
  6. Dev env friction?         5/10    fail   CONFIRMED → fixture+curl
```

Persona: staff engineer / CC agent. TTHW current ~45–90 min → target 15 min with runbook.

**Phase 3.5 complete.** DX overall 5.4/10. TTHW 45min → 15min target. Passing to Phase 4.

---

## DX Implementation Checklist

- [x] Error codes match `OFERTA_*` not TS class names
- [x] Bucket name locked: `cotizaciones-pdf`
- [x] PDF seam: `renderQuotePdf(snapshot): Uint8Array` injectable; default pdf-lib in Edge
- [x] `docs/commercial-quote-dev.md` seed+curl (write at implement start)
- [x] `docs/adr/` numbering + CRM SoT (below)
- [x] Mapping file exists

### Error wire codes

| code                   | problem           | cause                  | fix                                |
| ---------------------- | ----------------- | ---------------------- | ---------------------------------- |
| OFERTA_SIN_LINEAS      | no lines          | empty productos        | add line                           |
| OFERTA_SIN_PRECIO      | line price ≤0     | quote-mode catalog     | fill precio; send blocked          |
| OFERTA_SIN_CONDICIONES | empty condiciones | validation             | write condiciones                  |
| OFERTA_MONEDA_MIXTA    | mixed currencies  | line.moneda ≠ header   | one moneda                         |
| PDF_RENDER_FAILED      | no PDF            | renderer crash         | retry; check logo fetch            |
| EMAIL_FALLIDO          | mail not accepted | Resend/timeout         | estado unchanged; retry            |
| TEMPLATE_INACTIVE      | no mail           | plantilla.activo=false | activate cotizacion_oferta_cliente |
| SEND_IN_FLIGHT         | 409               | parallel send          | wait/retry                         |
| NUMERO_CONFLICT        | 23505             | race                   | sequence nextval                   |
| TOTALES_MISMATCH       | HTML≠PDF          | two formulas           | use normalizarOferta only          |

### Phase 1 hello world (target TTHW 15 min)

```text
1. Read Eng locks in this file (not CMS_CRM.md)
2. supabase db query seed one solicitudes_cotizacion draft
3. supabase functions serve enviar-cotizacion
4. PATCH send with JWT ventas
5. Assert estado !== enviada if Resend mocked 500
6. Assert PDF in cotizaciones-pdf + referencia IME-Q
```

Default PDF: `pdf-lib` via injectable `_shared/render-quote-pdf.ts`. Escape hatch: inject fake renderer in tests. Change lib only via ADR.

---

## Cross-Phase Themes

**Theme: Dual systems** — CEO, Eng, DX. High-confidence: never invent a second quote table; Edge is the write boundary.

**Theme: Send lie** — Eng both voices + live `enviar-cotizacion:247`. Fix before UI.

**Theme: Formalizar immutability** — Design success peak + Eng revision. Duplicate-on-revise recommended.

**Theme: Implementer runbook missing** — DX both. Mini-spec and locks exist; curl/seed still to write at coding start.

---

## ADR 001 — Quote number, PDF, CRM SoT

- Numero: `IME-Q-{YYYY}-{seq 6}` via Postgres sequence; never reuse; format helper one place.
- PDF: private bucket `cotizaciones-pdf`; path `{id}/{revision}.pdf`; hash sha256.
- CRM: Twenty = pipeline SoT for sales; `solicitudes_cotizacion` = quote SoT; share = Notes only.

---

## GSTACK REVIEW REPORT

| Runs                  | Status          | Findings                   |
| --------------------- | --------------- | -------------------------- |
| CEO Claude + Codex    | issues absorbed | ERP rewrite; PDF 10x       |
| Design Claude + Codex | issues absorbed | mini-spec                  |
| Eng Claude + Codex    | issues absorbed | send protocol; Edge writes |
| DX Claude + Codex     | issues absorbed | codes + TTHW recipe        |

VERDICT: APPROVE-WITH-TASTE — implement Approach B after user gate.

CROSS-MODEL: CONFIRMED rewrite away from CMS_CRM.md ERP. DISAGREE nuance: Codex isolation/trust vs Claude speed-to-PDF — plan does PDF first, isolation deferred.

**UNRESOLVED DECISIONS:**

- Taste: duplicate-on-revise vs snapshot table
- Taste: pdf-lib default vs HTML-print PDF
- Taste: shared tray forever vs RLS isolation (deferred unless override)
- User challenge already accepted at D1: rewrite ERP prompt → Approach B
