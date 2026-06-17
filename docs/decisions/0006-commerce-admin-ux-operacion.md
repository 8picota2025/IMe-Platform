# ADR-0006: UX operativa de e-commerce - catálogo, cotizaciones, pedidos y fulfilment

- Fecha: 2026-06-17
- Estado: aceptado
- Alcance: front web, backoffice y trazabilidad comercial

## Contexto

La plataforma ya cubría catálogo, checkout, cotizaciones, pedidos y fulfilment,
pero el flujo operativo seguía siendo demasiado fragmentado para un uso diario
tipo WooCommerce: el front no ofrecía una exploración comercial rica y el
backoffice no concentraba los cambios de estado, notas e inteligencia operativa
en una sola ficha.

## Decisión

Se refuerza la experiencia en dos capas:

- Front web:
  - vista rápida de producto desde la tarjeta;
  - filtros por disponibilidad y modalidad de fulfillment;
  - acciones rápidas para consumibles y equipos;
  - resumen comercial más explícito en ficha de producto.

- Backoffice:
  - pedidos con acciones masivas, filtros y seguimiento interno;
  - ficha de pedido con timeline unificado, notas y atajos de estado;
  - ficha de cotización con notas internas, acciones rápidas y resumen
    copiable;
  - vista de fulfilment con acciones rápidas, notas con marca temporal y
    acceso directo al tracking;
  - trazabilidad adicional en `pedido_eventos` para cambios manuales y notas.

No se elimina ninguna funcionalidad existente. Las mejoras se apoyan sobre las
tablas ya presentes en `supabase/schema.sql` y reutilizan los campos de
seguimiento que ya habían sido modelados para pedidos, cotizaciones y
fulfilments.

## Consecuencias

- La operación diaria es más rápida y menos dependiente de navegación entre
  pantallas.
- La trazabilidad mejora sin exigir nuevas migraciones para este bloque.
- El front gana capacidad de filtrado y decisión rápida, reduciendo fricción
  antes de pasar a checkout o a cotización.

## Validación

- `npm run check`
- `npm run build`
