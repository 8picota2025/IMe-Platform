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

## BLOQUEANTE_BACKEND — Impide integración real

- [ ] Credenciales Supabase (bloquea Edge Functions, auth, BD real)
- [ ] Credenciales Wompi (bloquea pagos CO)
- [ ] Credenciales Stripe (bloquea pagos INTL)
- [ ] Credenciales LLM (bloquea asesor RAG e ingesta PDF)

## BLOQUEANTE_LEGAL — Impide operar o publicar

- [ ] Tasas y condiciones reales de financiación
- [ ] Revisión de legales (Política privacidad, T&C) por abogado
- [ ] NIT, razón social y domicilio legal de I-ME para documentos legales

## COPY_CLIENTE_REVISAR — Textos que requieren aprobación

- [ ] Traducción EN de todo el contenido factual (specs, descripciones, cifras)

## BACKLOG_V2

Ver BACKLOG_V2.md
