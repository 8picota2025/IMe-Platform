# Plan de Contenido — Clusters Piloto

**Clusters:** Monitoreo / UCI + INVIMA / Regulación (decisión del usuario, 2026-09-22 —
ver `ORCHESTRATION_STATE.md`, "Decisiones vigentes")
**Estado:** DRAFT — plan para revisión, **cero contenido producido todavía**
**Referencia:** mandato §24 (deliverables del cluster piloto), `IMPLEMENTATION_PLAN.md` §16

> Este documento es sólo el plan. Ningún artículo, landing, tool ni post de redes se ha
> escrito. El mandato exige que todo quede en DRAFT/REVIEW hasta aprobación humana — este
> plan es el paso previo a esa producción, no la producción en sí.

> **Decisión del usuario (2026-09-23): por ahora no se produce contenido sobre clases de
> riesgo INVIMA.** Quedan fuera, hasta nueva decisión, todas las piezas de este plan que
> presentan o dependen de la clase de riesgo de un dispositivo: la parte de "clases de
> riesgo" de la pilar §2.2, los artículos §1.3.4 y §2.3.2-§2.3.4, la entrada por "clase
> estimada" de la tool §2.4, el carrusel de clases de §2.6 y el artículo puente de §3.
> Motivo adicional: `src/data/invima-knowledge-base.json` usa "Clase II", mientras que el
> Decreto 4725/2005 define I, IIa, IIb y III — esa fuente no debe alimentar contenido
> sobre clases sin corregirse y verificarse antes.

---

## 0. Regla de fuentes — aplica a los dos clusters, especialmente INVIMA

Ningún dato nuevo se inventa. Cada cluster cita exactamente qué activos ya existentes en
el repo respaldan cada pieza. Para INVIMA en particular (categoría regulatoria sensible
per mandato §15): **ningún claim de certificación específica de un producto se publica
sin pasar por `producto_claims_evidencia`** (ADR-0013) con `fuente_url` real y
`revisado_por`. El contenido _educativo general_ sobre el marco regulatorio colombiano
(qué es una clase de dispositivo, qué exige un registro sanitario) puede citar
directamente `src/data/invima-knowledge-base.json` — ya está curado con fuente
(`invima.gov.co`, extraído 2026-06-18) — pero **no autoriza** afirmar que un producto
específico del catálogo tiene tal registro sin verificación individual.

---

## 1. Cluster: Monitoreo / UCI

### 1.1 Activos ya existentes (no se duplican)

- Family hub `monitores` (+ `cardiologia`), con `FAMILIA_HUB_LINKS['monitores']` ya
  enlazando a `/es/monitores-biolight-uci/` y al PDP del monitor Biolight P15.
- Landing de campaña `/es/monitores-biolight-uci/` (`comercial-landings.ts`).
- Keywords ya seedeadas (`docs/seo/top20-keywords.json`): 4 PDPs con sets ES/EN —
  `monitor-multiparametrico-basico`, `monitor-multiparametrico-uci-avanzado`,
  `monitor-central-uci-multicama`, `monitor-de-paciente-ref-m12-biolight`. Términos
  reales: "monitores multiparamétricos UCI", "monitor central UCI", "monitor paciente
  crítico", "monitor hospitalario Colombia".
- 2 artículos ya referenciados en el discovery de Fase 0 (verificar en prod antes de
  asumir publicados — `docs/seo/editorial-calendar.md` los marca "Live" vía seed, pero el
  build local con mock data no los muestra; confirmar con acceso a Supabase antes de
  producir más contenido para no duplicar).

### 1.2 Página pilar (propuesta)

**"Guía completa de monitores multiparamétricos hospitalarios en Colombia"** —
consolida: qué mide un monitor multiparamétrico, diferencias básico/avanzado/central
multicama, criterios de selección por tipo de UCI (adulto/pediátrica/neonatal),
mantenimiento y calibración a alto nivel (sin inventar cifras), y una sección corta de
"¿qué exige INVIMA?" que enlaza al cluster INVIMA (ver §3, sinergia cruzada). Reemplaza o
absorbe la landing de campaña existente como hub de contenido — a decidir en implementación
si la pillar page es nueva o si se enriquece `/es/monitores-biolight-uci/`.

### 1.3 Artículos de apoyo (3-5, sobre lo ya existente)

1. Cómo elegir un monitor multiparamétrico según el nivel de UCI (si no está ya cubierto
   por el artículo existente — verificar antes de crear uno redundante).
2. Monitor central multicama vs. monitores individuales: cuándo se justifica cada uno
   (keyword real: "central de monitores hospital").
3. Checklist de recepción e instalación de un monitor hospitalario (reutiliza el patrón
   de checklists ya mencionado en el mandato §7, sin inventar pasos — basarse en
   `CRITERIOS_ACEPTACION.md`/prácticas ya documentadas del negocio si existen, o marcar
   como `REQUIRES_VERIFICATION` con el equipo biomédico de I-ME antes de publicar).
4. **Puente a INVIMA**: "¿Qué clase de riesgo INVIMA tiene un monitor multiparamétrico y
   qué significa para el comprador" — cita directa de `invima-knowledge-base.json`
   (`dispositivos.clasificacion.clase_ii.ejemplos` incluye explícitamente "Monitores de
   presión" y "Equipos de electrocardiografía").

### 1.4 Landing / Tool

Landing: reutilizar `/es/monitores-biolight-uci/` ya existente (no crear una nueva, per
ADR-0015 — cualquier landing nueva de este cluster va por el CMS admin cuando exista, no
por TS ni SQL). Tool: ninguno específico de monitoreo identificado con datos ya
disponibles — no se propone un tool nuevo en este plan para no inventar uno sin base.

### 1.5 CTA / UTM / CRM mapping

- `campaign` en `leads_comerciales`/Twenty: reutilizar el slug ya existente si la landing
  de campaña ya tiene uno asignado en `CampaignLandingId`; si no, `monitoreo-uci` (mismo
  slug que `topic_clusters.slug`, ya sembrado en ADR-0014, para trazabilidad 1:1).
- UTM: `utm_campaign=monitoreo-uci`, `utm_source`/`utm_medium` por canal de distribución
  real (linkedin/instagram/facebook/x/email), siguiendo la taxonomía ya definida en
  `src/lib/commercial-attribution.ts` — sin inventar una taxonomía nueva.
- CRM: gracias a ADR-0011, la atribución completa (utm/landing/referrer/sesión) ya llega
  a Twenty en el body de la nota de la Task — ningún trabajo adicional de mapping
  necesario para este cluster.

### 1.6 Paquetes por canal (dirección, no copy todavía)

- **LinkedIn**: thought leadership dirigido a ingeniería biomédica/compras — ángulo
  "cómo evaluar técnicamente un monitor antes de licitar/comprar".
- **Instagram**: formato visual — comparativa básico vs. avanzado, reel corto mostrando
  la interfaz de un monitor (si hay material audiovisual real disponible; no generar
  imágenes de producto ficticias).
- **Facebook**: redistribución del pilar + testimonios/casos si existen (verificar con
  negocio antes de publicar cualquier testimonio — el mandato prohíbe inventarlos).
- **X**: social listening de la conversación MedTech sobre monitoreo — no contenido
  original nuevo en la primera iteración, sólo escucha (mandato §8, prioridad de X).

### 1.7 Dashboard mínimo (qué medir)

`quote_submit`, `whatsapp_click`, `begin_checkout`, `purchase` filtrados por
`utm_campaign=monitoreo-uci` (eventos ya instrumentados en `analytics_eventos` +
Twenty), más impresiones/clics orgánicos de Search Console para las keywords ya
seedeadas (fuente: GSC, no disponible en este repo — requiere acceso del cliente).

### 1.8 Hipótesis de experimento

"Consolidar el contenido de monitoreo en una página pilar con internal linking real
(reemplazando el `FAMILIA_HUB_LINKS` estático) aumenta el CTR interno hacia PDPs de
monitores y el volumen de `quote_submit` atribuido a `monitoreo-uci` en 90 días,
comparado con la línea base de la landing actual sola." — hipótesis, no promesa de
resultado (mandato: no declarar causalidad antes de tener muestra).

---

## 2. Cluster: INVIMA / Regulación

> Ver la decisión del 2026-09-23 al inicio del documento: sin contenido sobre clases de
> riesgo por ahora. El resto del cluster (registro sanitario en general, normatividad,
> checklist para compradores sin clasificar el equipo) sigue en el plan.

### 2.1 Activos ya existentes

- `src/data/invima-knowledge-base.json` (227 líneas): clasificación de dispositivos
  (Clase I/II/IIB/III con ejemplos y requisitos reales), normatividad clave (Decreto
  4725/2005, Resolución 4002/2007, Resolución 0214/2022, cada una con su URL oficial),
  procedimientos de registro con tiempos promedio por clase.
- `src/lib/invima.ts`: clasificador ya escrito (`getDeviceClass`, `getClassInfo`,
  `getRegistrationTimeline`, `getRequirements`, `getNormativeReferences`,
  `validateConformity`, `getComplianceTips`) — **hoy no lo importa nada**. Es la base
  lista para el tool de §2.4, no hay que reescribir la lógica.
- ADR-0013 (`producto_claims_evidencia`): la precondición que este plan asumía necesaria
  ya está mergeada — gate de evidencia real disponible para cualquier claim específico
  de producto que este cluster genere.

### 2.2 Página pilar (propuesta)

**"Guía INVIMA para compradores de equipos médicos en Colombia: clases de riesgo,
registro sanitario y qué debe verificar antes de comprar"** — contenido 100% derivado de
`invima-knowledge-base.json` (clasificación I/II/IIB/III, qué es un registro sanitario,
tiempos de trámite por clase) + enlaces oficiales reales a los 3 documentos normativos ya
citados en la KB. Sin afirmaciones sobre productos específicos del catálogo en esta
página — es contenido regulatorio general, no comercial.

### 2.3 Artículos de apoyo (3-5)

1. ¿Qué es un registro sanitario INVIMA y por qué importa al comprar un equipo médico?
2. Clase I vs. II vs. IIB vs. III: diferencias de riesgo y requisitos (tabla derivada
   directo de `dispositivos.clasificacion`).
3. Cuánto tarda el registro sanitario según la clase del dispositivo (tabla de
   `procedimientos_registro.tiempo_promedio`).
4. **Puente a Monitoreo** (mismo artículo que §1.3.4, contado desde el ángulo INVIMA):
   qué implica que un monitor multiparamétrico sea Clase II.
5. Checklist INVIMA para compradores — ver §2.4, el mismo contenido puede servir de
   artículo _y_ de superficie de tool.

### 2.4 Landing / Tool

**Tool: Checklist INVIMA interactivo**, usando `src/lib/invima.ts` (ya escrito, sin usar)

- `invima-knowledge-base.json` como motor. El usuario indica el tipo de equipo o su
  clase estimada; el tool devuelve requisitos, tiempo estimado de registro, y referencias
  normativas oficiales — exactamente lo que `getClassInfo`/`getRegistrationTimeline`/
  `getRequirements`/`getNormativeReferences` ya calculan. Es el tool más barato de todo el
  backlog del plan original (`IMPLEMENTATION_PLAN.md` §15: complejidad S, "dato y lógica ya
  existen"). Landing: nueva, bajo el mismo cluster; por ADR-0015, cuando se construya debe
  ir por el camino CMS admin, no un archivo TS nuevo.

**Límite explícito:** el tool orienta sobre el marco regulatorio general. No certifica ni
afirma que un producto específico del catálogo de I-ME tiene un registro sanitario
vigente — esa afirmación, si se hace en cualquier PDP, pasa obligatoriamente por
`producto_claims_evidencia` con evidencia real por producto.

### 2.5 CTA / UTM / CRM mapping

Mismo patrón que §1.5, `utm_campaign=invima-regulacion`. CTA principal del tool: no es
"comprar" sino "hablar con un asesor sobre el proceso de registro" — dado que INVIMA es
contenido de intención informativa/regulatoria, no transaccional directa; el lead que
genera es de tipo consultivo (`tipo_proyecto`/`horizonte` más exploratorios), no de
compra inmediata.

### 2.6 Paquetes por canal

- **LinkedIn**: prioridad alta — ángulo "qué debe saber un fabricante internacional que
  quiere entrar a Colombia" conecta directamente con la Sección 10B del mandato (Supply
  Generation Internacional / fabricantes). Es el cluster con más fit natural a esa
  audiencia B2B secundaria.
- **Instagram/Facebook**: menor prioridad — contenido regulatorio es menos nativo a
  formato visual corto; considerar sólo carruseles explicativos (clase I/II/IIB/III como
  infografía derivada de datos reales).
- **X**: social listening de conversación regulatoria/MedTech Colombia — mismo tratamiento
  que Monitoreo, sin publicación original en la primera iteración.

### 2.7 Dashboard mínimo

Mismos eventos que §1.7, filtrados por `utm_campaign=invima-regulacion`, más uso del
tool en sí (evento nuevo a instrumentar, p. ej. `invima_tool_query`, siguiendo el patrón
ya existente de `emitAnalyticsEvent` en `src/lib/analytics.ts` — no requiere tabla nueva).

### 2.8 Hipótesis de experimento

"El checklist INVIMA genera leads consultivos de mayor prioridad (`P1`/`P2` en
`classifyLead`) desde audiencia de fabricantes internacionales que desde audiencia
doméstica de compradores — si se confirma, prioriza la promoción de este cluster hacia
Sección 10B (Supply Generation) sobre Sección 10A." — hipótesis a validar, no asumida.

---

## 3. Sinergia entre los dos clusters

El vínculo no es forzado: la propia base de conocimiento INVIMA ya cita "Monitores de
presión" y "Equipos de electrocardiografía" como ejemplos de dispositivos Clase II. Un
mismo artículo puente (§1.3.4 / §2.3.4) sirve a ambos clusters con `tags[]` (ADR-0014)
en vez de necesitar contenido duplicado — exactamente el caso de uso que motivó diseñar
`tags TEXT[]` además de `cluster_id` en esa migración.

## 4. Qué falta antes de producir cualquier pieza

1. **Aprobación de este plan** por el usuario (este documento).
2. **Verificar en Supabase real** cuántos artículos de Monitoreo ya están publicados en
   producción (el build local con mock data no lo confirma) — evita duplicar contenido.
3. **Confirmar con el equipo biomédico de I-ME** cualquier checklist operativo
   (instalación/recepción) que no esté ya documentado en el repo, en vez de
   inventarlo — marcado `REQUIRES_VERIFICATION` en §1.3.3.
4. **Redactar el copy real** sólo después de (1)-(3) — sigue siendo trabajo de Fase 2,
   no de esta sesión.
