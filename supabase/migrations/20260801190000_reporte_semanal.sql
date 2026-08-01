-- Plantilla visible en CMS para el cuadro de resultados semanal (el HTML
-- real se genera en la Edge Function reporte-semanal; esta fila documenta
-- el flujo y permite desactivarlo via activo=false en el futuro si se desea).

INSERT INTO email_templates (clave, descripcion, asunto, html, activo) VALUES
(
  'reporte_semanal_interno',
  'Cuadro de resultados semanal (visitas, cotizaciones, pedidos validados + graficas). Generado por Edge Function reporte-semanal.',
  'I-ME reporte semanal {{periodo}} · {{importe_pedidos}} validados',
  '<p>Este correo se genera dinamicamente por la funcion <code>reporte-semanal</code> con HTML completo y graficas. No editar el cuerpo aqui salvo para documentacion.</p><p>Periodo: {{periodo}}</p><p>Visitas: {{visitas}} · Cotizaciones: {{cotizaciones}} · Pedidos validados: {{pedidos_validados}} · Importe: {{importe_pedidos}}</p>',
  true
)
ON CONFLICT (clave) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    asunto = EXCLUDED.asunto;
