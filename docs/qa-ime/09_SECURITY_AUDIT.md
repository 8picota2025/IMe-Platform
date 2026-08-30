# Auditoría de seguridad

## Controles positivos

- `service_role` aparece en Edge Functions, no debe entrar a cliente/dist.
- Auth admin usa verificación JWT; pagos y Auth fueron probados según confirmación
  del usuario. RLS y rate-limit tienen módulos dedicados.
- Webhook/payment code contiene verificación de firmas según documentación.
- Generación HTML usa `escapeHtml` en múltiples fronteras dinámicas.
- Build y lint pasan; no se leyeron secretos ni valores de `.env`.
- `npm audit --omit=dev --audit-level=high` no pudo consultar registry por DNS;
  estado de advisories: `NO_EJECUTADO_ENTORNO`, no "sin vulnerabilidades".

## Pendiente de verificación

RBAC/IDOR, CSRF, CORS efectivo, SSRF de URLs PDF, uploads, webhook replay,
headers, cookies, dependencias y secretos del CI requieren entorno controlado.

No declarar vulnerabilidad confirmada sin reproducción. F5 permanece abierta.
