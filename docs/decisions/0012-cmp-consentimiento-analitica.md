# ADR-0012: CMP mínimo propio + Google Consent Mode v2 para GA4/GTM/Clarity

- Fecha: 2026-09-22
- Estado: aceptado
- Contexto: Growth Engine, Fase 1 — Foundation (`docs/growth-engine/IMPLEMENTATION_PLAN.md`)

## Contexto

La política de cookies ya publicada y validada legalmente
(`src/lib/legal.ts`, `kind: 'cookies'`, badge "POLÍTICA VALIDADA") establece
que la analítica no esencial (GA4/GTM/Clarity) requiere **consentimiento
previo**, y que "I-ME implementará banner o CMP antes de activar cookies no
necesarias, analítica avanzada, publicidad, remarketing o perfilamiento. El
panel deberá permitir aceptar, rechazar y modificar preferencias, conservar
prueba del consentimiento y no bloquear la navegación esencial cuando el
usuario rechace cookies no necesarias."

`src/components/AnalyticsHead.astro` cargaba GTM, GA4 y Microsoft Clarity de
forma **incondicional** en cada page view, sin ningún gate — incumplimiento
directo de la política propia del sitio. `AnalyticsNoScript.astro` además
inyectaba el iframe `<noscript>` de GTM incondicionalmente para visitantes
sin JavaScript.

## Decisión

CMP mínimo propio (sin vendor de pago), no un servicio gestionado tipo
Cookiebot/Osano — decisión de negocio explícita para evitar coste
recurrente y una dependencia externa nueva, dado que sólo hay una categoría
no esencial activa hoy (analítica; no hay publicidad/remarketing).

Componentes:

- `src/lib/consent.ts` — estado de consentimiento en `localStorage`
  (`ime_consent`), versionado contra `CONSENT_POLICY_VERSION` (debe
  mantenerse igual al campo `updated` de la política de cookies; si la
  política cambia de forma relevante, subir la versión fuerza a volver a
  pedir consentimiento). Expone `applyDefaultConsentMode()` /
  `applyConsentModeUpdate()` (Google Consent Mode v2:
  `analytics_storage`/`ad_storage`/... con default `denied`) y
  `loadAnalyticsScripts()` (inyección real de los tags GTM/GA4/Clarity,
  idempotente).
- `src/components/ConsentBanner.astro` — banner + panel "Personalizar" con
  Aceptar todo / Rechazar no esenciales / Guardar preferencias, bilingüe
  (`src/i18n/{es,en}.json`, clave `consent.*`), enlaza a
  `/legal/cookies/`. Montado en `Layout.astro` (todas las páginas).
- `src/components/AnalyticsHead.astro` reescrito: ya no inyecta tags de
  forma estática. Emite la señal Consent Mode "default" siempre, y sólo
  llama `loadAnalyticsScripts()` si `hasAnalyticsConsent()` es `true` (i.e.
  ya había una decisión guardada de una visita anterior).
- `src/components/AnalyticsNoScript.astro` — el iframe `<noscript>` de GTM
  se **eliminó**, no se gateó. No hay forma de comprobar consentimiento sin
  JavaScript, así que cargarlo incondicionalmente para esos visitantes
  seguía violando la política. Comportamiento correcto para un visitante
  sin JS: no recibe analítica de terceros.
- `Footer.astro` gana un botón "Personalizar" junto a los enlaces legales,
  que despacha un evento (`ime:open-consent-preferences`) para reabrir el
  panel — cumple el requisito de "modificar preferencias" de forma
  persistente, no sólo en el primer visit.

**Deliberadamente fuera de alcance de esta ADR:** la analítica de primera
parte (`src/lib/analytics.ts` → Edge Function `track-analytics` →
`analytics_eventos`) **no se gateó**. No instala cookies de terceros, no
carga scripts externos, y ya tiene su propio denylist de PII — no es la
categoría "Analítica no esencial" que la política de cookies regula (esa
categoría se refiere explícitamente a "Google Analytics 4, Matomo,
Microsoft Clarity u otra analítica"). Gatear esa tubería habría sido
ampliar el alcance más allá de lo que el hallazgo original (R-1) pedía.

**Aceptar en la primera visita:** el `page_view` de esa página ya se emitió
antes de que existiera `gtag`. GTM lo recupera solo (al cargar procesa lo que
ya está en `dataLayer`), pero GA4 vía gtag lo perdía, y esa página suele ser
la landing con los UTM. Al aceptar desde el banner se reenvía ese `page_view`
sólo a `gtag` (`replayPageViewToGtag()` en `src/lib/analytics.ts`), sin
duplicarlo en `dataLayer` ni en la analítica propia.

**Retiro del consentimiento:** si el visitante rechaza con los tags ya
cargados, no hay forma fiable de descargar GTM/GA4/Clarity en caliente: se
expiran sus cookies (`_ga*`, `_gid`, `_gat`, `_gcl_*`, `_clck`, `_clsk`) en el
host y en cada dominio padre (`clearAnalyticsCookies()`) y se recarga la
página, que ya no los carga. Si no estaban cargados, sólo se borran las
cookies que pudieran quedar de una visita anterior.

Tampoco se añade un toggle de "Publicidad/remarketing": la política es
explícita en que esa categoría no está activa y requiere aprobación
jurídica + actualización expresa de la política antes de activarse.

## Alternativas consideradas

- **Vendor de pago (Cookiebot, Osano, etc.)**: descartado por decisión de
  negocio — coste recurrente y dependencia externa nueva no justificados
  para una sola categoría no esencial activa hoy. Puede reconsiderarse si
  se activa publicidad/remarketing más adelante (más categorías, más
  jurisdicciones vía IAB TCF, etc.).
- **Gatear también la analítica de primera parte**: descartado — no es
  cookie de terceros ni lo que la política regula bajo "Analítica no
  esencial"; hacerlo habría sido scope creep sin base en el hallazgo
  original.
- **Cookie en vez de localStorage para el estado de consentimiento**: se
  eligió `localStorage` por simplicidad (el sitio es 100% estático, sin
  SSR que necesite leer el consentimiento server-side); la política nombra
  ambos mecanismos como "tecnologías similares" válidos.

## Consecuencias

- Verificado en build real: el HTML generado ya no contiene
  `googletagmanager.com/gtag/js` ni el iframe `noscript` de GTM; el banner
  (`id="ime-consent-banner"`) está presente en cada página.
- Cobertura: `src/lib/consent.test.ts` (5 tests, lógica pura de
  lectura/escritura/versionado) + actualización de
  `src/lib/analytics-config.test.ts` (verifica que `AnalyticsHead` importa
  el gate de consentimiento en vez de cargar tags directamente).
- Deuda reconocida: el gate de GTM sigue confiando en que, si alguien
  configura tags adicionales _dentro_ del propio contenedor GTM en el
  futuro, esos tags respeten las señales de Consent Mode — eso es
  configuración del lado de GTM, fuera del control de este repo. El gate
  de carga (no inyectar el script en absoluto sin consentimiento) es la
  defensa principal, independiente de esa configuración.
