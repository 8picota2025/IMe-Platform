# Despliegue — CMS comercial

## Orden recomendado

1. Aplicar migración `20260723040000_cms_comercial.sql` en Supabase producción.
2. Configurar secrets Edge: `TWENTY_BASE_URL`, `TWENTY_API_KEY`, `MAILER_API_KEY`, `MAILER_FROM`, `WHATSAPP_MODE`.
3. Deploy función: `supabase functions deploy comercial-share`.
4. Build estático: `npm run build` (incluye `/comercial/`).
5. Deploy Hostinger vía workflow existente (FTP `dist/`) o pipeline preprod.
6. Smoke test en `https://i-me.com.co/comercial/`.

## Rollback

Ver comentarios en la migración (DROP tables / columnas / seed email_templates).

Revertir función a versión anterior si es necesario; la tienda pública no depende de estas tablas.

## PWA / DNS

- Manifest en `/manifest-comercial.json` (mismo dominio).
- Instalación Chrome requiere HTTPS (producción) o localhost.
- No requiere DNS adicional.
