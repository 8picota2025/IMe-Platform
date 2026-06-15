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
- [x] Nueva familia "Radiología y Diagnóstico por Imagen" (`radiologia`, orden 9) y 9 productos (prod-25..prod-33) sembrados el 2026-06-14 vía `scripts/seed-catalogo.mjs` (total ahora 9 familias / 33 productos). Origen: catálogo de Szangell (proveedor/fabricante de I-ME en dropshipping, confirmado por el cliente); descripciones y especificaciones ES/EN redactadas de forma original a partir de las características publicadas (no copiadas literalmente), `especificaciones` solo incluye datos verificados (algunos productos tienen pocas specs por falta de datos numéricos en la fuente — "cero invención"). Imágenes descargadas y servidas localmente desde `public/assets/productos/radiologia/*.jpg` (mismo patrón que el resto del catálogo, no Supabase Storage). Verificado en `/es/catalogo` (33 equipos / 9 categorías) y `/es/productos/sistema-radiografico-3d-wr-3d`; `npm run validate` OK (96 páginas).
- [ ] Credenciales Wompi (bloquea pagos CO) — F4
- [ ] Credenciales Stripe (bloquea pagos INTL) — F4
- [ ] Credenciales LLM (`LLM_PROVIDER`, `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`, `LLM_INGEST_MODEL`) — bloquea ingesta PDF real y Asesor RAG
- [ ] Credenciales embeddings (`EMBEDDING_PROVIDER`, `VOYAGE_API_KEY` u `OPENAI_API_KEY`) — bloquea `generar-embeddings` y la búsqueda vectorial del Asesor (sin esto, el Asesor degrada a búsqueda por palabra clave)
- [x] Vía de prueba local sin credenciales: `LLM_PROVIDER=ollama` / `EMBEDDING_PROVIDER=ollama`
      (Ollama autoalojado, `mxbai-embed-large` 1024 dims = sin migración, coste $0) —
      `docs/decisions/0005-ollama-asesor-local.md`. No sustituye las credenciales de
      producción (Anthropic/Voyage), pero permite probar `asesor`/`generar-embeddings`
      de extremo a extremo en local mientras llegan.
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

### F4.1 — Escenario A y cierre de Comercio (Wompi v1.1)

Spec: `plataforma/prompts/IME_F4_Commerce_Pasarelas_v1.1.md` + huecos de F1 §8.3/§8.5
(flag `productos.disponible` y valores ampliados de `pedidos.estado`, especificados en
F1 pero nunca implementados). Decisiones documentadas en `docs/decisions/0001-0003`.

- [x] Migración SQL aplicada el 2026-06-15 vía Management API: `productos.disponible
BOOLEAN NOT NULL DEFAULT true` + `disponible_actualizado_at TIMESTAMPTZ` y
      `solicitudes_cotizacion.estado TEXT NOT NULL DEFAULT 'nueva' CHECK (estado IN
('nueva','en_revision','respondida'))` + `notas_internas TEXT` (ver
      `docs/decisions/0004-cotizaciones-estado-seguimiento.md`). Estas columnas estaban
      solo dentro de `CREATE TABLE IF NOT EXISTS` (no-op en BD existente); se añadieron
      sus `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` correspondientes en `schema.sql`.
      Verificado en `information_schema.columns`.
- [x] `.env.example` completado con `WOMPI_INTEGRITY_SECRET`, `CREAR_PAGO_RATE_LIMIT_*`
      y `MAILER_API_KEY`/`MAILER_FROM` (faltaban variables ya usadas por
      `payment-gateway.ts`/`notificar-proveedor` pero no documentadas como
      `TODO_CLIENTE`)
- [x] `COMMERCE_GUIDE.md` (entregable #12 de v1.1): configuración de webhooks
      Wompi/Stripe, secrets, métodos de pago a habilitar, checklist de pruebas
- [x] Cotizaciones: seguimiento comercial `estado` (nueva/en_revision/respondida) +
      `notas_internas` en `/admin#cotizaciones` (código listo, columnas SQL pendientes
      de migración — ver punto anterior) — `docs/decisions/0004-cotizaciones-estado-seguimiento.md`
- [x] Catálogo/ficha de producto: badge "Temporalmente agotado" y CTA alternativo
      cuando `disponible=false` (sin afectar `activo`/SEO)
- [x] Carrito: `revalidarDisponibilidad()` al abrir el drawer, quita ítems con
      `disponible=false` y avisa al usuario (`carrito.item_no_disponible`)
- [x] `crear-pago`: rechazo `422 PRODUCTO_NO_DISPONIBLE_TEMPORAL` con `slugs` afectados
      si algún item ya no está disponible; el carrito los elimina automáticamente al
      recibir ese código
- [x] Admin: `PEDIDO_ESTADOS` ampliado (`procesando|enviado|entregado|retrasado` +
      estados existentes), confirmación extra al marcar `retrasado` (Escenario A,
      pedido pagado sin stock), toggle `disponible` en el formulario de producto
- [x] Rate-limit dedicado para `crear-pago` (10/hora/IP vía `CREAR_PAGO_RATE_LIMIT_*`,
      `checkRateLimit(..., 'crear-pago')`) — `docs/decisions/0001-rate-limit-crear-pago.md`
- [x] Campos PSE: no se requieren en el formulario propio — Wompi Web Checkout
      (hosted) ya los captura — `docs/decisions/0002-pse-checkout-hospedado.md`
- [x] Habeas Data: `consentimiento_datos`/`consentimiento_timestamp` ≡
      `habeas_data_ok`/`habeas_data_at`; checkbox de carrito/contacto/cotización
      actualizado para citar Ley 1581/2012 y enlazar `/legal/privacidad` —
      `docs/decisions/0003-habeas-data-equivalencia.md`
- [x] Stripe/INTL: implementado desde F4, activación real diferida — ver BACKLOG_V2.md
      §Comercio
- [x] CTA WhatsApp (+57 313 867 4059) en páginas de resultado de pago `exito`/`fallo`
      (TAREA 5 v1.1), con la referencia del pedido añadida automáticamente al mensaje
      prellenado una vez resuelve `consultarPedido()` — `ResultadoPago.astro`

### Paridad WooCommerce/B2B-B2C y RBAC admin (PR #7, mergeado 2026-06-14)

Trabajo de otra sesión/agente, integrado junto con el cierre de F4.1 anterior.

- [x] Migración SQL aplicada el 2026-06-15 vía Management API — nuevas tablas
      `producto_variantes`, `clientes`, `cliente_direcciones`, `cupones`,
      `cupon_usos`, `pedido_notas`, `pedido_eventos`, `admin_profiles`; nuevas
      columnas en `productos` (`sku`, `gtin`, `atributos`, `peso_kg`,
      `dimensiones_cm`, `precio_regular`, `precio_oferta`, `oferta_inicio`,
      `oferta_fin`, `gestionar_stock`, `stock_estado`, `backorder_policy`) y en
      `pedidos` (`cliente_id`, `descuento_total`, `impuesto_total`, `envio_total`,
      `cupon_codigo`, `direccion_facturacion`, `direccion_envio`); función
      `is_admin()` y reescritura de las políticas RLS `*_admin_all` para usar
      `is_admin(roles)` en vez de `TO authenticated USING (true)`. Verificado en
      `information_schema`.
- [x] **Riesgo de bloqueo del admin resuelto**: `admin_profiles` se sembró en el
      mismo lote/transacción con el único usuario de Supabase Auth
      (`8picota2025@gmail.com`, `rol='owner'`, `activo=true`), evitando que las
      nuevas políticas RLS (`is_admin(roles)`) dejen `/admin` sin permisos de
      escritura.
- [x] Verificación post-migración (2026-06-15) de `/admin` vía navegador contra
      Supabase real: login con `8picota2025@gmail.com` OK, dashboard y listados leen
      datos reales (33 productos, cotizaciones, etc.) bajo las nuevas políticas RLS,
      y se probó un `UPDATE` real en `solicitudes_cotizacion.estado`/`notas_internas`
      (columnas F4.1 nuevas) desde `/admin#/cotizacion` — pasó de `nueva` a
      `en_revision` en BD y se revirtió a `nueva` tras la prueba. Confirma que
      `is_admin()` + `admin_profiles` seed no bloquean la escritura de `/admin`.
- [x] Bug de orden corregido en `schema.sql`: las columnas `productos.sku` (y el
      resto de columnas B2B/B2C) y `productos.disponible`/`disponible_actualizado_at`
      y `solicitudes_cotizacion.estado`/`notas_internas` solo estaban dentro de
      `CREATE TABLE IF NOT EXISTS` (no-op en BD ya existente) o, en el caso de `sku`,
      los índices que la referencian se creaban antes del `ALTER TABLE ADD COLUMN`.
      Se añadieron los `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` faltantes y se
      reordenaron las secciones de `productos` para que las columnas existan antes
      de los índices que las usan. `schema.sql` ahora es idempotente y re-ejecutable
      completo contra la BD real (`ime-platform`, ref `nnfbucwiasuggyfoyydo`).

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

- [x] Traducción EN de todo el contenido factual (specs, descripciones, cifras) — revisada
      y aprobada por el cliente (2026-06-15); se quitó el marcador `COPY_CLIENTE_REVISAR`
      de `mock-familias.json`, `mock-productos.json`, `src/i18n/en.json`, `src/lib/seo.ts`
      y `src/pages/en/{financing,catalog,contact}.astro`
- [x] Slogan EN de la Home — aprobado (2026-06-15)
- [x] Visión, Misión, Calidad, Compromiso en EN — aprobado (2026-06-15)
- [x] Textos de servicios en EN — aprobado (2026-06-15)
- [x] Teaser financiación EN — aprobado (2026-06-15); el contenido de tasas/condiciones
      reales sigue pendiente bajo `BLOQUEANTE_LEGAL` (no es un tema de traducción)
- [x] Mensaje de bienvenida del Asesor EN — aprobado (2026-06-15)
- [x] EN de la familia "radiologia" y sus 9 productos (prod-25..prod-33) — aprobado
      (2026-06-15), marcador `COPY_CLIENTE_REVISAR` retirado de
      `mock-familias.json`/`mock-productos.json`

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
- [x] Migración SQL de `supabase/schema.sql` (F4.1 — `productos.disponible` +
      `disponible_actualizado_at` + `solicitudes_cotizacion.estado`/`notas_internas` —
      y paridad B2B/B2C de PR #7 — `producto_variantes`, `clientes`,
      `cliente_direcciones`, `cupones`, `cupon_usos`, `pedido_notas`,
      `pedido_eventos`, `admin_profiles`/RBAC, columnas nuevas de `productos`/`pedidos`)
      aplicada a la base de datos real el 2026-06-15 vía Management API, con
      `admin_profiles` sembrado en el mismo paso (`8picota2025@gmail.com`,
      `rol='owner'`) — ver detalle en secciones F4.1 y "Paridad WooCommerce/B2B-B2C"
      en BLOQUEANTE_BACKEND.
- [ ] Prueba real de Wompi sandbox CO y Stripe test INTL — depende de que la migración
      de F4.1 (`productos.disponible`) esté aplicada en BD real; sin ella, el rechazo
      422 por `disponible=false` en `crear-pago` no puede validarse end-to-end aunque
      lleguen credenciales Wompi
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
