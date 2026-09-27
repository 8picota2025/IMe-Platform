# Fase 3 — Landing & Tool Foundation: plan

> Estado: **GO del usuario (2026-09-25) con D1, D2 y la opción A de D3.** Paso 1 del gate del
> mandato (§20, `CLAUDE PLAN`) cerrado; en implementación (3A).

## Alcance según el mandato

§19 Phase 3: _landing factory_, _first high-value landing_, _first high-value tool/lead
magnet_. §24 (caso piloto): una landing y un lead magnet o herramienta para el cluster
piloto. Restricciones: sin landings doorway ni casi duplicadas (§6); herramientas
priorizadas por valor × demanda × dificultad × captación, con eventos de intención que
respeten el consentimiento (§7); asesor comercial puro, sin consejo clínico (AGENTS.md).

## Punto de partida (ya en producción)

- **Renderer de landings:** `CampaignLandingPage.astro` + `CampaignLandingContent`, ≈88
  landings programáticas (campaña, fabricante, ciudad, familia). Autoría en archivos TS;
  ADR-0015 fija el CMS como vía única futura y deja la migración para esta fase.
- **Captación:** `PdfDownloadGate.astro` + Edge Function `registrar-lead-comercial`
  (idempotencia, honeypot, consentimiento Habeas Data, atribución UTM/sesión/landing,
  sincronización con Twenty). Analítica con `emitAnalyticsEvent`, sujeta al banner
  (ADR-0012).
- **Contenido validado del cluster piloto:** checklist de recepción e instalación
  (A1–A8) y criterios por tipo de UCI (B1–B6), firmados por el Ing. Rojas el 2026-09-24,
  y ya publicados en el cluster Monitoreo/UCI.
- `pdf-lib` ya es dependencia del proyecto.

## Decisiones que necesitan tu GO

### D1 — Primera herramienta / lead magnet: checklist de recepción e instalación de monitores (recomendado)

Herramienta web interactiva en `/es/recursos/checklist-recepcion-monitor/` (y `/en/`):
el ingeniero biomédico o el comprador marca cada punto A1–A8 durante la recepción, ve lo
que falta y **descarga el checklist en PDF** (vacío para imprimir, o con su avance) tras
dejar sus datos en el mismo formulario del `PdfDownloadGate`.

| Criterio (§7)          | Valoración                                                                    |
| ---------------------- | ----------------------------------------------------------------------------- |
| Valor                  | Alto: se usa en cada compra, lo firma ingeniería biomédica                    |
| Demanda                | Media-alta: es el artículo más operativo del cluster                          |
| Dificultad             | Baja: contenido ya validado; PDF generado con `pdf-lib` desde la misma fuente |
| Captación              | Buena: descarga con lead; señal de compra inminente (equipo en camino)        |
| Riesgo de cumplimiento | Bajo: procedimiento de recepción, no consejo clínico                          |

Descartadas por ahora: **selector de monitor** (más datos por modelo, más riesgo de
parecer recomendación clínica; buen candidato para la segunda herramienta), **checklist
INVIMA** (usa clases de riesgo, diferidas por tu decisión del 2026-09-23),
**calculadora de financiación** (bloqueada por la firma legal de tasas), **TCO** (sin
datos de costes de operación validados).

### D2 — Primera landing de alto valor: dotación de monitoreo para proyectos de UCI

Landing por **proyecto/ICP**, no por producto: IPS que abren o amplían camas de UCI y
necesitan dotar el monitoreo (monitores de cabecera + central, recepción, capacitación).
No duplica `monitores-biolight-uci` (campaña de marca) ni la landing de la familia
`monitores` (catálogo): esas venden un producto; esta resuelve un proyecto. Contenido:

- pain → solución, a partir de B1–B6 (adulto/pediátrica/neonatal, central vs.
  independientes);
- productos reales del catálogo (sin specs ni precios inventados);
- la herramienta de D1 como lead magnet;
- RFQ con el formulario de cotización existente, WhatsApp según ADR-0016;
- enlaces a la pilar y a los 3 artículos de apoyo;
- UTM del mapa ya aprobado (`paquetes-canal-utm-clusters-piloto.md`), eventos
  `landing_view`, `tool_start`, `tool_complete`, `lead_magnet_download`, `rfq_submit`.

### D3 — Landing Factory en CMS (ADR-0015): cuándo

- **Opción A (recomendada):** 3A primero: herramienta + landing piloto; la landing
  nueva va en TS (la vía provisional que la ADR-0015 permite). Después **3B**: modelo
  `landings` en Supabase (contenido validado contra el esquema `CampaignLandingContent`),
  edición en `/admin`, rebuild por `trigger-rebuild`, y migración por tandas empezando por
  las 11 landings de campaña, comparando el HTML y el JSON-LD antes y después de cada una.
- **Opción B:** CMS primero y la landing piloto ya nace en el CMS. Más coherente con la
  ADR, pero retrasa el piloto varias semanas y la migración de las 88 es la parte con más
  riesgo de romper SEO.

## Cambios técnicos previstos (3A)

| Pieza                                     | Cambio                                                                                                            | Riesgo                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `src/data/checklist-recepcion-monitor.ts` | fuente única de A1–A8 (ES/EN), usada por la web y el PDF                                                          | bajo                           |
| Página de la herramienta (ES/EN)          | UI accesible (checkboxes nativos, progreso con `aria-live`), estado solo en `localStorage`                        | bajo                           |
| Generación del PDF                        | `pdf-lib` en el navegador o en build; sin datos personales dentro del PDF                                         | bajo                           |
| `registrar-lead-comercial`                | nuevo valor de `campaign` (`herramienta`) + `tipo_proyecto` = id de la herramienta; si hay CHECK en BD, migración | medio: toca Edge Function y BD |
| Landing piloto                            | entrada en `comercial-landings.ts` + wrappers ES/EN, hreflang, sitemap                                            | bajo                           |
| Eventos                                   | `tool_start`, `tool_complete`, `lead_magnet_download` con `content_id`, solo con consentimiento                   | bajo                           |

## Tests y gate

Unit: fuente del checklist completa en ES/EN, PDF generado sin campos vacíos, payload del
lead. Deno: nuevo `campaign` aceptado, el resto sigue rechazado. E2E: completar la
herramienta, descargar con lead, rechazo sin consentimiento. SEO: hreflang, sitemap,
canonical y JSON-LD de la landing. Build de producción con datos reales antes de fusionar.
Revisión de seguridad del endpoint y de cumplimiento del texto (el Ing. Rojas revisa la
versión PDF antes de publicarla). QA en navegador en 320/375/1366 px. Sandbox antes de
cada push, como en Fase 2.

## Fuera de alcance

Publicar en redes (Fase 4, con aprobación), scoring e intent en el CRM (Fase 5), A/B
testing (no hay infraestructura), migración de las ≈88 landings (3B).
