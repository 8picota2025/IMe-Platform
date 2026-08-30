# QA APIs

41 Edge Functions inventariadas. Capas auth, CORS, rate-limit, telemetry y
Supabase server existen. Tests compartidos cubren utilidades y lógica, no todos
los endpoints desplegados.

Pendiente por función: método/status, schema de entrada, JWT/RBAC, RLS, rate
limit, idempotencia, timeout, errores y payload mínimo. Prioridad: pagos,
webhooks, registrar lead/cotización, admin-import, CRM y asesor.

Riesgos observados para verificar: diferencias entre `service_role` y JWT admin,
webhook replay, CORS allowlist, mass assignment y errores externos que deben
conservar lead/cotización sin duplicar.
