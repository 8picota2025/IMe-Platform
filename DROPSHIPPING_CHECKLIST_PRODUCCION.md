# Checklist Producción — Dropshipping

## Antes de Deploy (Fase 4)

### Base de datos

- [ ] `supabase db push` — aplicar schema.sql (notification_log, api_token)
- [ ] Crear proveedores con `api_token` seguro (`sk_live_...`)
- [ ] Verificar RLS policies en `fulfillments`, `notification_log`, `proveedores`

### Environment variables

- [ ] `MAILER_API_KEY` — Resend API key (si hay notificaciones por email)
- [ ] `MAILER_FROM` — remitente (default: `pedidos@i-me.com.co`)

### Edge Functions

- [ ] Deploy: `actualizar-fulfillment`
- [ ] Deploy: `confirmar-notificacion-proveedor`
- [ ] Update: `notificar-proveedor` (Fase 3 refactorizado)
- [ ] Verificar imports de módulos shared

### Monitoreo (TODO_CLIENTE)

- [ ] Datadog/Sentry setup
- [ ] Alertas: "Notificaciones fallidas en últimos 10min"
- [ ] Dashboard: `SELECT COUNT(*) FROM notification_log WHERE status='fallido' AND created_at > NOW() - interval '1 hour'`

### Proveedor: Compartir

- [ ] Documentación: `PROVIDER_INTEGRATION.md`
- [ ] Token generado: `sk_live_...`
- [ ] Endpoints: `actualizar-fulfillment`, `confirmar-notificacion-proveedor`

---

## Rollback plan

Si algo falla en Fase 3:

1. Revert commit `c54f12f` — vuelve a Fase 2
2. `notificar-proveedor` usa Fase 1 (sin logging/retry mejorado)
3. Datos en `notification_log` se preservan (solo lectura)

---

## Métricas producción

Rastrear en dashboard admin:

- % notificaciones confirmadas (vs enviadas)
- Latencia promedio notificación → confirmación
- Tasa de error por proveedor/canal
- Número de reintentos por fulfillment
