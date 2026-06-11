# PENDIENTES

> Actualizar en cada fase. Usar exactamente las etiquetas definidas.

## TODO_CLIENTE — Datos o credenciales que entrega el cliente

- [ ] `SUPABASE_URL` y `SUPABASE_ANON_KEY`: crear proyecto en supabase.com
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: después de crear el proyecto
- [ ] `ANTHROPIC_API_KEY`: cuenta en console.anthropic.com
- [ ] `OPENAI_API_KEY` (opcional, gateway alternativo)
- [ ] `VOYAGE_API_KEY`: cuenta en voyageai.com
- [ ] `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_EVENTS_SECRET`: cuenta en wompi.co
- [ ] `STRIPE_PUBLIC_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`: cuenta en stripe.com
- [ ] `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`: crear en Cloudflare Dashboard
- [ ] `HOSTINGER_FTP_HOST` / `HOSTINGER_FTP_USER` / `HOSTINGER_FTP_PASSWORD`: panel Hostinger
- [ ] `HOSTINGER_PREPROD_PATH` / `HOSTINGER_PROD_PATH`: confirmar rutas de deploy
- [ ] GitHub repo URL: crear en github.com y configurar como remote
- [ ] Tipos/subcategorías de productos (ausentes en catálogo actual)
- [ ] Dirección física y horario de atención para página de Contacto
- [ ] Favicon real (actualmente sin /favicon.ico)
- [ ] Descripción real de cada familia de equipos para catálogo premium

## BLOQUEANTE_BACKEND — Impide integración real

- [ ] Credenciales Supabase (bloquea Edge Functions, auth, BD real)
- [ ] Credenciales Wompi (bloquea pagos CO) — F4
- [ ] Credenciales Stripe (bloquea pagos INTL) — F4
- [ ] Credenciales LLM (`LLM_PROVIDER`, `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`, `LLM_INGEST_MODEL`) — bloquea ingesta PDF real y Asesor RAG
- [ ] Edge Function asesor/ — lógica RAG llega en Fase Asesor
- [ ] Edge Function crear-pago/ — F4
- [ ] Edge Function webhook-wompi/ — F4
- [ ] Edge Function webhook-stripe/ — F4
- [ ] Edge Function notificar-proveedor/ — F4
- [x] Edge Function ingesta-pdf/ — F3 base implementada; requiere credenciales LLM y texto/OCR revisable
- [x] Edge Function trigger-rebuild/ — F3 base implementada; requiere `CI_DEPLOY_HOOK` o `GITHUB_TOKEN` + `GITHUB_REPOSITORY`
- [ ] Carrito y checkout — F4
- [ ] SimuladorFinanciero real — F4

## BLOQUEANTE_LEGAL — Impide operar o publicar

- [ ] Tasas y condiciones reales de financiación — página financiacion.astro tiene placeholders
- [ ] Política de privacidad (texto legal) — F5
- [ ] Términos y condiciones (texto legal) — F5
- [ ] NIT, razón social y domicilio legal de I-ME para documentos legales
- [ ] Revisión por abogado de consentimiento en formularios de contacto/cotización

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

- [ ] Lighthouse scores Home mobile (objetivo: Perf ≥90, A11y ≥95, SEO ≥95)
- [ ] Test de navegación por teclado en dispositivo real
- [ ] Verificación de contraste AA en tema oscuro
- [ ] Test de video autoplay en mobile (Chrome/Safari iOS)
- [ ] Deploy a preprod en Hostinger
- [x] Prueba real de `/admin` contra Supabase con usuario admin y RLS aplicadas
- [ ] Prueba real de `ingesta-pdf` con ficha PDF/OCR y clave LLM
- [ ] Prueba real de `trigger-rebuild` contra deploy hook o GitHub repository_dispatch

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
