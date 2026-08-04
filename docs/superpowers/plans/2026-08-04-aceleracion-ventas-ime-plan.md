# Aceleración de ventas I‑ME — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el ecommerce de I‑ME en un sistema medible de pre-venta B2B que genere y priorice oportunidades calificadas para imagenología y robótica/rehabilitación, sin saturar a una sola persona comercial.

**Architecture:** Dos rutas independientes de adquisición y conversión —imagenología y robótica— compartirán componentes de tracking, formulario, persistencia y seguimiento. Las landings serán Astro estático; la persistencia y notificación de leads se hará mediante Supabase Edge Functions con RLS y sin exponer secretos. El pipeline comercial conservará estados P1/P2/P3 y origen/campaña/categoría para medir desde visita hasta venta.

**Tech Stack:** Astro 6, TypeScript estricto, TailwindCSS, Supabase Postgres/Edge Functions, Vitest, Playwright, analytics existente en `src/lib/analytics.ts`.

## Global Constraints

- Sin React, framer-motion ni Three.js.
- `service_role` y claves privadas solo en Edge Functions; nunca en cliente o `dist/`.
- Cero datos inventados: productos, especificaciones, precios, tasas, certificaciones, evidencia, casos o testimonios.
- `/es/` es español es-CO y `/en/` debe conservar hreflang completo.
- El cliente nunca decide que un pago está aprobado.
- El asesor es comercial puro: no diagnóstico clínico, consejo clínico ni precio comprometido.
- `precio_costo` es confidencial y nunca llega al cliente ni a `dist/`.
- Cada imagen nueva debe incluir `width`/`height`; lazy salvo LCP.
- Toda interacción debe conservar focus visible y respetar `prefers-reduced-motion`.
- Antes de cada cierre: `npm run validate` debe pasar.
- Commits Conventional Commits.

---

## Mapa de archivos y responsabilidades

- Create: `src/lib/comercial.ts` — tipos, validación y clasificación de leads.
- Create: `src/lib/comercial.test.ts` — pruebas unitarias de clasificación/validación.
- Create: `src/components/LeadQualificationForm.astro` — formulario progresivo compartido, con variantes por campaña.
- Create: `src/components/WhatsAppContextLink.astro` — enlace con mensaje contextualizado y tracking.
- Create: `src/pages/es/imagenologia.astro`, `src/pages/en/imaging.astro` — landing de imagenología.
- Create: `src/pages/es/robotica-rehabilitacion.astro`, `src/pages/en/robotics-rehabilitation.astro` — landing de robótica.
- Create: `supabase/functions/registrar-lead-comercial/index.ts` — validación, rate limit, persistencia y notificación server-side.
- Modify: `supabase/schema.sql` y nueva migración en `supabase/migrations/` — tabla, enums, índices y RLS.
- Modify: `src/lib/analytics.ts` — eventos de embudo con UTM y campaign metadata.
- Modify: `src/layouts/Layout.astro` / `src/components/AnalyticsHead.astro` — captura persistente de UTM y referrer.
- Modify: `src/components/CotizacionDrawer.astro`, `src/pages/es/cotizacion.astro`, `src/pages/en/quote.astro` — origen y categoría en cotizaciones existentes.
- Create: `src/data/comercial-contenido.json` — solo metadatos de activos aprobados, sin afirmaciones no verificadas.
- Create: `docs/superpowers/plans/2026-08-04-aceleracion-ventas-ime-plan.md` — este plan.
- Create: `docs/comercial/operacion-90-dias.md` — playbook de seguimiento, ABM y métricas.
- Create: `tests/e2e/comercial-leads.spec.ts` — flujo E2E principal.

## Task 1: Define domain types and lead qualification

**Files:**

- Create: `src/lib/comercial.ts`
- Test: `src/lib/comercial.test.ts`

**Interfaces:**

- `CampaignCategory = 'imagenologia' | 'robotica_rehabilitacion'`
- `LeadPriority = 'P1' | 'P2' | 'P3'`
- `LeadStatus = 'nuevo' | 'contactado' | 'calificado' | 'reunion' | 'demo_visita' | 'cotizacion' | 'negociacion' | 'ganado' | 'perdido' | 'nutrir'`
- `classifyLead(input): LeadPriority`
- `validateCommercialLead(input): { valid: boolean; errors: Record<string,string> }`

- [ ] Escribir tests para institución ausente, horizonte 0–3 meses → P1, 4–12 meses → P2, exploración/sin plazo → P3.
- [ ] Ejecutar `npm test -- src/lib/comercial.test.ts`; esperar fallo inicial.
- [ ] Implementar tipos, reglas y validación sin `any`.
- [ ] Ejecutar la prueba y `npm run check`.
- [ ] Commit: `feat(comercial): add lead qualification domain rules`.

## Task 2: Add persistence and secure lead registration

**Files:**

- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/20260804000000_comercial_leads.sql`
- Create: `supabase/functions/registrar-lead-comercial/index.ts`
- Test: `src/lib/comercial.test.ts`

**Interfaces:**

- Table `leads_comerciales`: `id`, `created_at`, `nombre`, `cargo`, `institucion`, `ciudad`, `telefono`, `email`, `categoria`, `tipo_proyecto`, `horizonte_compra`, `presupuesto_estado`, `necesidad`, `priority`, `status`, `source`, `campaign`, `content_asset`, `landing_path`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `referrer`, `last_contacted_at`, `potential_value`, `estimated_margin`, `loss_reason`.
- Edge Function accepts validated JSON and returns `{ ok: true, leadId: string, priority: LeadPriority }`.

- [ ] Escribir pruebas de contrato para payload válido y rechazo de categoría/horizonte inválido.
- [ ] Añadir enum/check constraints, índices por `status`, `priority`, `categoria`, `created_at`, y RLS que impida lectura pública.
- [ ] Implementar CORS restringido al `SITE_URL`, rate limit por IP/acción usando el patrón existente de cotizaciones, y notificación interna sin filtrar secretos.
- [ ] Verificar que el cliente solo recibe `ok`, id y prioridad.
- [ ] Ejecutar migración en entorno de prueba, `npm run check` y tests.
- [ ] Commit: `feat(comercial): persist qualified commercial leads securely`.

## Task 3: Implement shared form and contextual WhatsApp CTA

**Files:**

- Create: `src/components/LeadQualificationForm.astro`
- Create: `src/components/WhatsAppContextLink.astro`
- Modify: `src/lib/analytics.ts`
- Modify: `src/layouts/Layout.astro`
- Test: `src/lib/comercial.test.ts`

**Interfaces:**

- Form props: `locale`, `category`, `primaryCta`, `contentAsset?`, `source?`.
- `buildWhatsAppMessage(values): string` must include institution, city, category, project type, horizon and need.
- Events: `commercial_landing_view`, `commercial_form_start`, `commercial_lead_submitted`, `commercial_whatsapp_click`, `commercial_meeting_requested`.

- [ ] Escribir pruebas para mensaje URL-encoded y ausencia de valores privados.
- [ ] Añadir captura de `utm_*`, referrer, landing y campaign desde query/localStorage, sin guardar datos sensibles innecesarios.
- [ ] Construir formulario progresivo: datos básicos primero; proyecto, horizonte y presupuesto después; checkbox de autorización de contacto enlazado a habeas-data.
- [ ] Mostrar errores accesibles, estado loading, éxito y fallo; no enviar dos veces; enviar a la Edge Function.
- [ ] Añadir CTA WhatsApp con mensaje contextual y eventos.
- [ ] Probar teclado, focus visible y reduced motion.
- [ ] Ejecutar `npm run lint && npm run check && npm test`.
- [ ] Commit: `feat(comercial): add qualified lead form and contextual WhatsApp`.

## Task 4: Build the two campaign landings

**Files:**

- Create: `src/pages/es/imagenologia.astro`
- Create: `src/pages/en/imaging.astro`
- Create: `src/pages/es/robotica-rehabilitacion.astro`
- Create: `src/pages/en/robotics-rehabilitation.astro`
- Create: `src/data/comercial-contenido.json`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:**

- Both landings consume `LeadQualificationForm` and `WhatsAppContextLink`.
- Content metadata contains only approved title, description, category, audience, asset type and verification source.

- [ ] Crear landing imagenología con problema institucional, apertura/renovación/ampliación, modalidad y volumen, instalación/capacitación/garantía/soporte, financiación existente solo con texto verificado, FAQ y CTA “Evaluar mi proyecto”.
- [ ] Crear landing robótica con diseño de servicio, espacio/personal/capacitación, demo, evidencia verificable y límites explícitos de afirmaciones clínicas.
- [ ] Crear versiones EN equivalentes con enlaces hreflang/canonical correctos.
- [ ] No inventar casos, ROI, resultados clínicos, certificaciones ni modelos; usar solo datos ya presentes en catálogo/CMS.
- [ ] Añadir SEO title/description, schema válido y eventos de landing view.
- [ ] Ejecutar `npm run check`, build y pruebas E2E de navegación.
- [ ] Commit: `feat(comercial): add imaging and robotics campaign landings`.

## Task 5: Integrate attribution into existing quotation flow

**Files:**

- Modify: `src/components/CotizacionDrawer.astro`
- Modify: `src/pages/es/cotizacion.astro`
- Modify: `src/pages/en/quote.astro`
- Modify: `src/lib/datos.ts`
- Modify: existing quote Edge Function only where needed
- Test: existing quote tests plus new attribution tests

- [ ] Añadir categoría, campaign, source, landing y UTM al payload existente.
- [ ] Preservar compatibilidad con cotizaciones iniciadas desde producto o carrito.
- [ ] Garantizar que `precio_costo` y otros campos internos nunca se serializan al cliente.
- [ ] Añadir estados y fecha de contacto visibles solo al rol comercial/admin.
- [ ] Probar regresión de cotización ES/EN, producto y carrito.
- [ ] Ejecutar `npm run validate`.
- [ ] Commit: `feat(comercial): attribute existing quote conversions`.

## Task 6: Add commercial operations view and 90-day playbook

**Files:**

- Modify: admin/commercial view following existing `src/admin/admin-app.ts` patterns.
- Create: `docs/comercial/operacion-90-dias.md`
- Modify: reporting queries/components only as required.

- [ ] Mostrar pipeline filtrable por categoría, priority, status, source y campaign.
- [ ] Añadir columnas: último contacto, próxima acción, valor potencial, margen estimado y motivo de pérdida.
- [ ] Implementar transición de estados con permisos existentes y audit trail.
- [ ] Añadir métricas: leads institucionales, P1/P2, reuniones, demos, cotizaciones, ganados, coste por oportunidad y tiempo de primera respuesta.
- [ ] Documentar cadencia día 0/24h/2–3/5–7/10–14/21, 30–40 cuentas ABM, cinco cuentas/contactos por semana y regla de máximo 2–3 seguimientos.
- [ ] Documentar regla de escalamiento: no escalar por CTR; exigir oportunidades repetibles, respuesta <24h, trazabilidad, margen y capacidad comercial.
- [ ] Ejecutar tests de permisos, `npm run validate`.
- [ ] Commit: `feat(comercial): add pipeline operations and 90-day playbook`.

## Task 7: Add end-to-end verification and launch checklist

**Files:**

- Create: `tests/e2e/comercial-leads.spec.ts`
- Create: `docs/comercial/lanzamiento-90-dias.md`
- Modify: CI only if E2E conventions require it.

- [ ] Probar landing imagenología: view → form → validation → submit → success → WhatsApp.
- [ ] Probar landing robótica: CTA demo, category, UTM and attribution.
- [ ] Probar rechazo de payload inválido y rate limit sin exponer detalles internos.
- [ ] Probar que una cotización existente mantiene flujo y registra origen.
- [ ] Ejecutar `npm run lint`, `npm run check`, `npm test`, build y Playwright contra preview.
- [ ] Documentar checklist de producción: migración, Edge Function, variables públicas/privadas, RLS, emails, consentimiento, analytics, Google Ads conversion mapping y rollback.
- [ ] Commit: `test(comercial): verify lead generation and attribution flows`.

## Orden de ejecución y puertas

1. Tasks 1–2: dominio y backend seguro; no publicar landings sin persistencia y RLS.
2. Task 3: formulario/tracking; no comprar tráfico hasta verificar eventos.
3. Task 4: landings; revisión de contenido factual antes de publicar.
4. Task 5: integración con cotización; regresión obligatoria.
5. Task 6: operación; una persona comercial debe poder priorizar P1/P2.
6. Task 7: E2E, `npm run validate`, despliegue controlado y medición.

## Self-review

- **Cobertura:** diagnóstico, dos campañas, ecommerce/pre-venta, formulario, WhatsApp, Google attribution, referidos/ABM operativo, seis activos como metadatos, seguimiento, métricas, experimentos, presupuesto por evidencia, seguridad y restricciones están cubiertos.
- **Placeholders:** no se dejan TBD/TODO; los valores de financiación, productos, evidencia y certificaciones deben provenir de fuentes ya verificadas.
- **Consistencia:** `CampaignCategory`, `LeadPriority`, `LeadStatus` y los nombres de columnas se mantienen iguales entre formulario, Edge Function, base de datos y admin.
- **Alcance:** la creación de campañas externas de Google Ads, negociación de alianzas y producción audiovisual quedan como operación/marketing, no como código; el plan solo deja tracking y activos publicables listos.
