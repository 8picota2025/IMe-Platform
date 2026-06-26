# Tareas Pendientes — Fase 4 (Producción)

**Status**: BLOQUEANTE = bloquea deployment | TODO = puede esperar

---

## BLOQUEANTE (Antes de ir a producción)

- [ ] **DB Schema**: `supabase db push` → aplicar `notification_log` + `api_token`
- [ ] **Generar tokens**: Para cada proveedor, ejecutar `SELECT encode(gen_random_bytes(32), 'hex')` → `sk_live_xxx`
- [ ] **Guardar tokens**: `UPDATE proveedores SET api_token = 'sk_live_xxx' WHERE slug = 'proveedor-yyy'`
- [ ] **Deploy functions**: 3 edge functions en Supabase
  - `actualizar-fulfillment`
  - `confirmar-notificacion-proveedor`
  - `notificar-proveedor` (verificar que Fase 3 integración está)
- [ ] **Verificar RLS**: `notification_log` y `fulfillments` tienen políticas correctas
- [ ] **MAILER_API_KEY**: Si hay email, configurar en Supabase secrets
- [ ] **Test manual**: curl a cada endpoint (verificar auth, validaciones)

---

## TODO (Próximas semanas)

### Observabilidad

- [ ] Datadog/Sentry setup
- [ ] Dashboard admin: queries sobre `notification_log`
- [ ] Alertas: "Notificaciones fallidas last 10min"

### Operación

- [ ] Compartir `PROVIDER_INTEGRATION_GUIDE.md` con proveedores
- [ ] Distribuir tokens seguros
- [ ] Capacitar equipo en dashboard fulfillments

### Mejoras (Backlog)

- [ ] Background job para reintentos diferidos (si rate limit)
- [ ] Webhook signature validation (si proveedores envían data)
- [ ] Provider dashboard (ver propio historial)
- [ ] SMS notifications (canal 'sms')

---

## Checklist Deployment

```bash
# 1. Verificar estado
git log --oneline | head -10
npm run validate

# 2. Schema
supabase db push

# 3. Tokens (SQL en Supabase)
SELECT encode(gen_random_bytes(32), 'hex');
UPDATE proveedores SET api_token = 'sk_live_...' WHERE slug = '...';

# 4. Deploy functions
supabase functions deploy actualizar-fulfillment
supabase functions deploy confirmar-notificacion-proveedor
supabase functions deploy notificar-proveedor

# 5. Verificar
curl -X POST https://i-me.com.co/rest/v1/functions/v1/actualizar-fulfillment \
  -H "Authorization: Bearer sk_live_TEST" \
  -d '{"fulfillment_id":"x","estado":"enviado"}'
# Esperado: 401 o 400

# 6. Monitor
SELECT COUNT(*) FROM notification_log;
```

---

## Próxima sesión

1. Leer: `DROPSHIPPING_CHECKLIST_PRODUCCION.md`
2. Leer: `DEPLOYMENT_GUIDE.md`
3. Ejecutar checklist
4. Verificar logs post-deploy

**Memory**: `ime-dropshipping-complete.md` (todo documentado)
