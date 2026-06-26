# Guía de Integración para Proveedores — I-ME Dropshipping

## Inicio rápido

### 1. Recibe notificación de I-ME

```json
Canal: email / webhook / whatsapp / api
{
  "pedido_id": "...",
  "referencia": "PEDIDO-2026-0001",
  "fecha": "2026-06-26T15:30:00Z",
  "cliente": {
    "nombre": "Juan",
    "apellido": "García",
    "email": "juan@hospital.com",
    "telefono": "+57 300 123 4567",
    "institucion": "Hospital Central"
  },
  "items": [
    {
      "producto_id": "uuid",
      "slug": "equipo-rx-digital",
      "nombre": "Equipo RX Digital Marca XYZ",
      "cantidad": 1
    }
  ]
}
```

### 2. Tu sistema procesa pedido

```
Lógica interna:
1. Valida stock disponible
2. Asigna almacén/bodega
3. Genera orden interna
4. Guarda referencia (fulfillment_id de I-ME)
```

### 3. Confirma recepción a I-ME

```bash
curl -X POST https://i-me.com.co/rest/v1/functions/v1/confirmar-notificacion-proveedor \
  -H "Authorization: Bearer sk_live_tu_token_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "fulfillment_id": "550e8400-e29b-41d4-a716-446655440000",
    "confirmado": true,
    "mensaje": "Confirmado en nuestro ERP, iniciamos preparación",
    "metadatos": {
      "orden_interna": "OP-2026-1234",
      "bodega": "BG-01"
    }
  }'
```

### 4. Reporta estados (mientras prepara/envía)

```bash
# Cuando empieza a preparar
curl -X POST https://i-me.com.co/rest/v1/functions/v1/actualizar-fulfillment \
  -H "Authorization: Bearer sk_live_tu_token_aqui" \
  -d '{
    "fulfillment_id": "...",
    "estado": "preparando",
    "notas": "Recibido en almacén, iniciando preparación"
  }'

# Cuando envía
curl -X POST https://i-me.com.co/rest/v1/functions/v1/actualizar-fulfillment \
  -H "Authorization: Bearer sk_live_tu_token_aqui" \
  -d '{
    "fulfillment_id": "...",
    "estado": "enviado",
    "tracking_number": "DHL123456789",
    "tracking_url": "https://tracking.dhl.com/123456789",
    "notas": "Despachado con DHL"
  }'

# Cuando se entrega
curl -X POST https://i-me.com.co/rest/v1/functions/v1/actualizar-fulfillment \
  -H "Authorization: Bearer sk_live_tu_token_aqui" \
  -d '{
    "fulfillment_id": "...",
    "estado": "entregado",
    "notas": "Entregado al cliente"
  }'
```

---

## Documentación completa

- **Confirmación**: `supabase/functions/confirmar-notificacion-proveedor/README.md`
- **Actualización de estados**: `supabase/functions/actualizar-fulfillment/README.md`

---

## Soporte

- Email: proveedores@i-me.com.co
- Token seguro: Guardar en variables de entorno, no en código
- Errores: Ver respuesta HTTP (401=token, 404=fulfillment inexistente, 400=parámetros)
