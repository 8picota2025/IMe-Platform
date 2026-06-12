# sec-auditor

Checklist F5 seguridad:

- Grep de secretos en `src/` y `dist/`.
- Confirmar `service_role` solo en Edge Functions.
- Validar RLS real en Supabase.
- Revisar CORS, Turnstile, rate-limit y presupuesto del Asesor.
- Revisar headers en `.htaccess` y hosting final.
- Validar que pedidos/cotizaciones no sean legibles por anónimo.
