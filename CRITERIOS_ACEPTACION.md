# CRITERIOS DE ACEPTACION F5

## Para aceptar preproducción

- `npm run validate` pasa.
- Legales ES/EN existen, están enlazados y marcados como borrador.
- Consentimiento obligatorio en contacto, cotización y checkout.
- `robots.txt`, `llms.txt`, sitemap y canonical revisados.
- Grep de secretos en `src/` y `dist/` da 0 hallazgos reales.
- No hay bloqueantes técnicos locales abiertos.

## Para aceptar producción raíz

- Cero Bloqueantes y cero Mayores abiertos en `REMEDIACION.md`.
- Legales aprobados por abogado y cliente.
- RLS probada con usuario anónimo/admin.
- Edge Functions desplegadas y probadas.
- Wompi sandbox y Stripe test verificados.
- Asesor RAG probado con Turnstile, rate-limit, presupuesto y fallback.
- Lighthouse Home/Catálogo/Landing cumple objetivos o tiene remediación aprobada.
- Preprod auditada por humano.
- `.htaccess` desplegado y 301 verificados sin bucles.
