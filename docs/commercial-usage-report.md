# Reporte de uso del portal comercial

## Alcance

Mide uso operativo de `https://i-me.com.co/comercial/` sin guardar datos del destinatario ni contenido de mensajes.

Métricas:

- comerciales activos y sesiones autenticadas;
- inicios de sesión, vistas de Catálogo/Envíos, búsquedas y filtros;
- apertura y envío del modal de catálogo;
- envíos por WhatsApp/email, éxito/error y sincronización CRM;
- vistas principales del portal.

## Destinos

- `/admin#/dashboard`: tarjetas agregadas de los últimos 30 días.
- `/admin#/marketing`: reporte detallado de uso, también de los últimos 30 días.
- `reporte-semanal`: bloque “Uso portal comercial” en correo ejecutivo, con variación frente a semana anterior, gráfica diaria y productos más compartidos.

## Privacidad y seguridad

- El navegador envía eventos solo con sesión Supabase válida.
- Edge Function `comercial-usage` deriva `user_id` del JWT; el cliente no puede elegirlo.
- Metadata tiene lista blanca y no admite email, teléfono, nombre de destinatario ni mensaje.
- RLS permite insertar solo eventos propios; lectura agregada queda para `owner`, `admin` y `lectura`.

## Despliegue

1. Aplicar `supabase/migrations/20260813025202_commercial_usage_report.sql`.
2. Desplegar funciones Supabase; el workflow de funciones publica `comercial-usage` junto al resto.
3. Publicar el sitio estático para activar el cliente del portal.

Si la migración todavía no está aplicada, el reporte semanal conserva sus métricas generales y marca el bloque comercial como no disponible.
