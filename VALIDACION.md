# VALIDACION F5

Fecha: 2026-06-12  
Rama: `feature/fase-5`

## Evidencia local

- `npm run validate`: Pass el 2026-06-12. Resultado: lint 0 errores, Astro check 0 errores, build 78 páginas.
- Grep de secretos en `src` y `dist`: Pass el 2026-06-12, 0 coincidencias para patrones sensibles.
- Legales ES/EN: implementados como borradores con `COPY_CLIENTE_REVISAR` y `BLOQUEANTE_LEGAL`.
- Footer: enlaza privacidad, habeas data, cookies, términos y copyright.
- Consentimientos: formularios de contacto, carrito y cotización enlazan política de privacidad.
- `robots.txt`: bloquea `/admin`, `/_astro`, `/77` y `/1old`.
- `.htaccess`: contiene 301 explícitos para raíz legacy, `/77/` y `/1old`.
- `llms.txt`: actualizado con comercio F4, financiación orientativa y legales borrador.

## Pipeline completo

1. `npm install` / `npm ci`: NO_EJECUTADO_ENTORNO en F5 local; dependencias ya presentes. Usar Node `>=22.12.0`.
2. Aplicar `supabase/schema.sql`: NO_EJECUTADO_ENTORNO, requiere proyecto Supabase y permisos SQL.
3. Crear admin Supabase: NO_EJECUTADO_ENTORNO, requiere Auth real.
4. Configurar env: NO_EJECUTADO_ENTORNO, faltan secretos cliente.
5. Ingesta PDF -> borrador: NO_EJECUTADO_ENTORNO, requiere `ANTHROPIC_API_KEY` u `OPENAI_API_KEY`.
6. Revisión humana: NO_EJECUTADO_ENTORNO, requiere contenido real del cliente.
7. Publicar: NO_EJECUTADO_ENTORNO, requiere admin real.
8. Generar embeddings: NO_EJECUTADO_ENTORNO, requiere migraciones, Edge Function y `VOYAGE_API_KEY`.
9. Trigger rebuild: NO_EJECUTADO_ENTORNO, requiere deploy hook o GitHub token.
10. Deploy preprod: NO_EJECUTADO_ENTORNO, requiere secretos Hostinger.
11. Auditoría contenido: NO_EJECUTADO_ENTORNO, requiere preprod y revisión humana.
12. Promoción raíz: NO_EJECUTADO_ENTORNO, requiere aprobación del cliente.
13. Verificar 301: NO_EJECUTADO_ENTORNO, ejecutar contra Hostinger tras deploy.
14. Compra Wompi sandbox: NO_EJECUTADO_ENTORNO, requiere credenciales Wompi.
15. Compra Stripe test: NO_EJECUTADO_ENTORNO, requiere credenciales Stripe.
16. Cotización equipo: NO_EJECUTADO_ENTORNO contra Supabase; mock local envía OK.
17. Asesor recupera producto nuevo: NO_EJECUTADO_ENTORNO, requiere RAG desplegado y embeddings.

## Comandos de verificación pendientes

```bash
npm run validate
rg -n "service_role|SERVICE_KEY|service_role_key|ANTHROPIC_API_KEY|OPENAI_API_KEY|VOYAGE_API_KEY|WOMPI_PRIVATE|WOMPI_EVENTS_SECRET|STRIPE_SECRET|STRIPE_WEBHOOK_SECRET|TURNSTILE_SECRET" src dist
npx lighthouse http://localhost:43421/es/ --preset=desktop --output=html --output-path=./lighthouse-home.html
curl -I https://i-me.com.co/77/
curl -I https://i-me.com.co/1old/
```
