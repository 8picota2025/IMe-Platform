# Guía Deployment — Dropshipping Fase 1/2/3

## 1. Preparación pre-deploy

```bash
# Verificar estado
git log --oneline | head -5
# 0add05a docs: add phase 3 summary
# c54f12f feat(dropshipping): phase 3 - integrate...
# 2735a2d feat(dropshipping): phase 2 - notification...
# 8c3fd74 feat(dropshipping): implement fulfillment...

# Tests
npm run validate
npm run test # si existen

# Verificar schema
supabase db lint
```

## 2. Aplicar schema a Supabase

```bash
# Desarrollo
supabase db push

# Producción (requiere confirmación)
supabase db push --db-url postgresql://...
```

**Cambios aplicados**:

- Tabla `notification_log` (auditoría)
- Campo `api_token` en `proveedores`

## 3. Deploy Edge Functions

```bash
# Supabase CLI
supabase functions deploy actualizar-fulfillment
supabase functions deploy confirmar-notificacion-proveedor
supabase functions deploy notificar-proveedor  # Fase 3 refactorizado

# O manual via Supabase dashboard
```

## 4. Configurar proveedores

```sql
-- Generar token seguro
SELECT encode(gen_random_bytes(32), 'hex');
-- Resultado: abc123def456...

-- Crear/actualizar proveedor
UPDATE proveedores
SET api_token = 'sk_live_abc123def456...'
WHERE slug = 'proveedor-xyz';

-- Verificar
SELECT id, nombre, canal, api_token FROM proveedores WHERE api_token IS NOT NULL;
```

## 5. Verificación

```bash
# Test endpoint actualizar-fulfillment
curl -X POST https://i-me.com.co/rest/v1/functions/v1/actualizar-fulfillment \
  -H "Authorization: Bearer sk_live_TEST" \
  -H "Content-Type: application/json" \
  -d '{"fulfillment_id":"invalid","estado":"enviado"}'
# Esperado: 401 (token inválido) o 400 (fulfillment_id inválido)

# Verificar notification_log existe
SELECT COUNT(*) FROM notification_log;
# Esperado: 0 (vacío)
```

## 6. Monitoreo post-deploy

```sql
-- Notificaciones últimas 24h
SELECT tipo, status, COUNT(*)
FROM notification_log
WHERE created_at > NOW() - interval '24 hours'
GROUP BY tipo, status;

-- Providers con errores
SELECT proveedor_id, COUNT(*)
FROM notification_log
WHERE status = 'fallido' AND created_at > NOW() - interval '1 hour'
GROUP BY proveedor_id;
```

## Rollback

Si algo falla:

```bash
# Revert Fase 3 integration
git revert c54f12f --no-edit

# Supabase schema: restaurar backup
# (notification_log persiste, no se elimina)

# Redeploy notificar-proveedor (Fase 1 version)
supabase functions deploy notificar-proveedor
```

---

## Checklist final

- [ ] Schema aplicado (`notification_log` visible)
- [ ] 3 Edge Functions deployed y accesibles
- [ ] Proveedores tienen `api_token` configurado
- [ ] Test curl exitoso (401 con token inválido)
- [ ] Monitoreo activo en Datadog/Sentry
- [ ] Documentación compartida con proveedores
