# PENDIENTES

> Actualizar en cada fase. Usar exactamente las etiquetas definidas.

## Criterio operativo actual

- [ ] Se puede avanzar con QA, performance, contenido aprobado, Supabase/Asesor y deploy técnico sin cerrar aprobación jurídica ni pruebas reales de medios de pago. Jurídica queda bajo `BLOQUEANTE_LEGAL`; Wompi/Stripe quedan bajo `BLOQUEANTE_BACKEND`/`NO_EJECUTADO_ENTORNO` hasta recibir credenciales y ejecutar sandbox real.

## TODO_CLIENTE — Datos o credenciales que entrega el cliente

- [ ] `SUPABASE_URL` y `SUPABASE_ANON_KEY`: crear proyecto en supabase.com
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: después de crear el proyecto
- [ ] `ANTHROPIC_API_KEY`: cuenta en console.anthropic.com
- [ ] `OPENAI_API_KEY` (opcional, gateway alternativo)
- [ ] `VOYAGE_API_KEY`: cuenta en voyageai.com
- [ ] `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_EVENTS_SECRET`: cuenta en wompi.co
- [ ] `STRIPE_PUBLIC_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`: cuenta en stripe.com
- [ ] `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` / `PUBLIC_TURNSTILE_SITE_KEY` (mismo valor que `TURNSTILE_SITE_KEY`): crear en Cloudflare Dashboard — sin esto el Asesor responde 503 (modo "no disponible")
- [ ] `HOSTINGER_FTP_HOST` / `HOSTINGER_FTP_USER` / `HOSTINGER_FTP_PASSWORD`: panel Hostinger
- [ ] `HOSTINGER_PREPROD_PATH` / `HOSTINGER_PROD_PATH`: confirmar rutas de deploy
- [ ] GitHub repo URL: crear en github.com y configurar como remote
- [ ] Tipos/subcategorías de productos (ausentes en catálogo actual)
- [ ] Dirección física y horario de atención para página de Contacto
- [ ] Favicon real (actualmente sin /favicon.ico)
- [ ] Descripción real de cada familia de equipos para catálogo premium

## BLOQUEANTE_BACKEND — Impide integración real

- [x] Credenciales Supabase de lectura/escritura básica (`.env` ya tiene `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` reales); tablas `familias` (8) y `productos` (24) sembradas el 2026-06-12 con datos reales de F0 vía `scripts/seed-catalogo.mjs` (idempotente, upsert por slug). RLS verificada: anon lee catálogo y escribe `solicitudes_cotizacion`, no puede escribir `productos`. Migraciones pgvector/Asesor aplicadas y Edge Functions desplegadas el 2026-06-14 (ver ítems siguientes).
- [ ] Credenciales Wompi (bloquea pagos CO) — F4
- [ ] Credenciales Stripe (bloquea pagos INTL) — F4
- [ ] Credenciales LLM (`LLM_PROVIDER`, `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`, `LLM_INGEST_MODEL`) — bloquea ingesta PDF real y Asesor RAG
- [ ] Credenciales embeddings (`EMBEDDING_PROVIDER`, `VOYAGE_API_KEY` u `OPENAI_API_KEY`) — bloquea `generar-embeddings` y la búsqueda vectorial del Asesor (sin esto, el Asesor degrada a búsqueda por palabra clave)
- [x] Edge Function asesor/ — RAG completo implementado (Turnstile, rate-limit, presupuesto, match vectorial + fallback keyword, system prompt comercial §5, validación de slugs citados, registro de uso)
- [x] Edge Function generar-embeddings/ — implementada (embedding individual por producto y reindexado masivo con estimación de coste)
- [x] Migraciones nuevas de `supabase/schema.sql` aplicadas el 2026-06-14 vía Management API (pgvector, `productos.embedding`, `llm_uso`, `asesor_uso`, `asesor_rate_limit`, RPC `match_productos`/`buscar_productos_keyword` verificados en `information_schema`/`pg_extension`)
- [x] Edge Functions `asesor/` y `generar-embeddings/` desplegadas el 2026-06-14 (antes 404 `NOT_FOUND`; ahora responden 400/401 — desplegadas y validando input/auth correctamente). Sigue faltando: credenciales LLM/embeddings (ver ítems anteriores) para que el Asesor responda en modo `rag` en vez de `keyword_degradado`
- [x] Edge Function crear-pago/ — F4 implementada; prueba real bloqueada por credenciales/Supabase desplegado
- [x] Edge Function webhook-wompi/ — F4 implementada; prueba real bloqueada por credenciales Wompi
- [x] Edge Function webhook-stripe/ — F4 implementada; prueba real bloqueada por credenciales Stripe
- [x] Edge Function notificar-proveedor/ — F4 implementada; envío real por canal proveedor requiere configuración operativa
- [x] Edge Function ingesta-pdf/ — F3 base implementada; requiere credenciales LLM y texto/OCR revisable
- [x] Edge Function trigger-rebuild/ — F3 base implementada; requiere `CI_DEPLOY_HOOK` o `GITHUB_TOKEN` + `GITHUB_REPOSITORY`
- [x] Carrito y checkout — F4 implementado; prueba end-to-end bloqueada por Supabase/pasarelas
- [x] SimuladorFinanciero orientativo — F4 implementado sin tasas ni cuotas vinculantes

## Coste estimado — Asesor RAG

Estimación con los modelos por defecto (`LLM_CHAT_MODEL=claude-sonnet-4-6`,
`EMBEDDING_PROVIDER=voyage`/`voyage-3`) y la tabla de precios de
`supabase/functions/_shared/llm-gateway.ts` (`PRICING_USD_POR_1M`):

- **Por turno de conversación (modo `rag`)**:
  - Embedding de la consulta (voyage-3, ~50-100 tokens): ~$0.000003-0.000006
  - Chat (entrada ~1.500-2.500 tokens con system prompt + contexto + historial,
    salida hasta `MAX_TOKENS_RESPUESTA=700`): entrada ~$0.0045-0.0075,
    salida hasta ~$0.0105
  - **Total aproximado por turno: ~$0.01-0.02 USD**
- **Modo `keyword_degradado` o presupuesto agotado**: $0 (no se invoca al LLM; solo
  búsqueda por palabra clave vía RPC `buscar_productos_keyword`)
- **Reindexar catálogo (`generar-embeddings` masivo)**: ~$0.06 por cada 1M tokens de
  texto de producto (voyage-3). Para un catálogo de ~50 productos con ~200 tokens de
  texto cada uno (~10.000 tokens totales), el coste es prácticamente nulo
  (< $0.001 USD). El panel admin "Reindexar catálogo" muestra una estimación previa
  antes de confirmar.
- Con `BUDGET_MENSUAL_USD=50` (valor de ejemplo en `.env.example`), esto permite del
  orden de 2.500-5.000 turnos de conversación en modo `rag` por mes antes de que el
  Asesor degrade automáticamente a `keyword_degradado`.

Estos valores son estimaciones de diseño basadas en los límites configurados
(`MAX_HISTORIAL_CHARS`, `MAX_TOKENS_RESPUESTA`, `MATCH_COUNT`), no mediciones de uso
real — NO_EJECUTADO_ENTORNO hasta tener tráfico real con credenciales LLM activas.

## BLOQUEANTE_LEGAL — Impide operar o publicar

- [ ] Tasas y condiciones reales de financiación — página financiacion.astro tiene placeholders
- [x] Política de privacidad (borrador enlazado) — F5; BLOQUEANTE_LEGAL hasta revisión jurídica
- [x] Términos y condiciones (borrador enlazado) — F5; BLOQUEANTE_LEGAL hasta revisión jurídica
- [x] Autorización tratamiento de datos / Habeas Data (borrador enlazado) — F5; BLOQUEANTE_LEGAL hasta revisión jurídica
- [x] Política de cookies (borrador enlazado) — F5; BLOQUEANTE_LEGAL hasta revisión jurídica
- [x] Aviso de copyright (borrador enlazado) — F5; COPY_CLIENTE_REVISAR
- [ ] NIT, razón social y domicilio legal de I-ME para documentos legales
- [ ] Revisión por abogado de consentimiento en formularios de contacto/cotización
- [ ] Revisión por abogado de legales F5 y autorización de datos

## COPY_CLIENTE_REVISAR — Textos que requieren aprobación

- [ ] Traducción EN de todo el contenido factual (specs, descripciones, cifras)
- [ ] Slogan EN de la Home
- [ ] Visión, Misión, Calidad, Compromiso en EN
- [ ] Textos de servicios en EN
- [ ] Teaser financiación EN
- [ ] Mensaje de bienvenida del Asesor EN

## BLOQUEANTE_CONTENIDO — Falta contenido real

- [ ] FAQ real (faq_preguntas y faq_respuestas estaban vacíos en contenido_ime.json) — sección FAQ de Home queda pendiente
- [ ] Descripción real de las 8 familias de equipos (extraccion_ime.json tenía descripcion vacía)
- [ ] Logos/iconos específicos por familia en catálogo

## NO_EJECUTADO_ENTORNO — Validación pendiente

- [x] Lighthouse scores Home (`/es/`, dist estático, preset móvil simulado, 2026-06-12): Accessibility 1.0 ✓, SEO 1.0 ✓, Best Practices 1.0 ✓, **Performance 0.66-0.79 ✗** (objetivo ≥90; mayor oportunidad: `total-byte-weight` ~3.1MB, `unused-javascript` ~248KiB — ver REMEDIACION.md, no bloqueante)
- [ ] Test de navegación por teclado en dispositivo real (solo se probó interacción con click/Playwright; falta recorrido Tab/Enter/Esc completo en dispositivo)
- [x] Verificación de contraste AA en tema oscuro: encontrado y corregido el 2026-06-12 — el footer quedaba casi blanco-sobre-blanco en `data-theme="dark"` (fondo `var(--ink)` invertido + texto `rgba(255,255,255,X)`); ahora usa tokens fijos `--footer-bg`/`--footer-text-muted` independientes del tema (ver REMEDIACION.md)
- [ ] Test de video autoplay en mobile (Chrome/Safari iOS)
- [ ] Deploy a preprod en Hostinger
- [ ] Verificación 301 `/77/` y `/1old` en Hostinger tras deploy
- [ ] Prueba real de Wompi sandbox CO y Stripe test INTL
- [x] Prueba real de `/admin` contra Supabase con usuario admin y RLS aplicadas
- [ ] Prueba real de `ingesta-pdf` con ficha PDF/OCR y clave LLM
- [ ] Prueba real de `trigger-rebuild` contra deploy hook o GitHub repository_dispatch
- [x] Smoke test post-despliegue (2026-06-14) de `asesor`/`generar-embeddings` ya desplegadas:
      `asesor` con `mensaje` válido responde `503 NOT_CONFIGURED` "BLOQUEANTE_BACKEND:
      TURNSTILE_SECRET_KEY no configurado" (fail-closed correcto antes de tocar presupuesto/RAG,
      confirma routing/CORS/conexión a Supabase OK); `generar-embeddings` responde `401`
      tanto sin `Authorization` (`UNAUTHORIZED_NO_AUTH_HEADER`) como con `SUPABASE_SERVICE_ROLE_KEY`
      como Bearer (`UNAUTHORIZED` — `auth.getUser()` exige sesión de usuario admin real, no
      service_role). Ambas respuestas son el comportamiento esperado dado el estado actual de
      credenciales.
- [ ] Prueba real del Asesor RAG end-to-end (migraciones y despliegue ya OK desde 2026-06-14;
      pendiente credenciales `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`/`TURNSTILE_SECRET_KEY` y un
      usuario admin Supabase Auth para `generar-embeddings`): validar respuesta en modo `rag`,
      fallback `keyword_degradado`, `sin_resultados`, rate-limit (429) y degradación por
      presupuesto agotado
- [x] Widget Asesor probado en navegador (es): abre, muestra bienvenida, envía mensaje y
      degrada correctamente al estado de error con CTA de WhatsApp/reintentar cuando la
      Edge Function no responde (404 por no estar desplegada aún)

## OPCIONAL_MEJORA — Admin CMS (F3)

- [ ] Editor de especificaciones de producto: reemplazar el textarea JSON por un
      editor estructurado fila a fila (clave/valor/grupo), igual al usado en la
      revision de ingesta PDF
- [ ] Subida múltiple de imágenes para `productos.galeria` (hoy solo existe
      `imagen_principal`; la columna `galeria TEXT[]` no se edita desde el admin)
- [ ] Editar/eliminar familias y tipos desde Taxonomía (hoy solo se pueden crear);
      validar que no queden productos huérfanos al eliminar
- [ ] Dashboard: cards adicionales (p.ej. fulfillments con error, solicitudes de
      cotización del último mes) más allá de las 5 métricas actuales
- [ ] Estado/historial de publicaciones: registrar y mostrar el resultado de cada
      `trigger-rebuild` (hoy solo se muestra un toast puntual, sin persistencia)

## BACKLOG_V2

Ver BACKLOG_V2.md
