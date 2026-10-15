-- Cotizaciones: el correo ofrece transferencia y Wompi, y muestra el total a pagar.

UPDATE email_templates
SET html = html || '<p>{{iva_resumen}}</p>{{pago_wompi_html}}'
WHERE clave IN (
  'presupuesto',
  'cotizacion_oferta_cliente',
  'cotizacion_oferta_cliente_es',
  'cotizacion_oferta_cliente_en'
)
AND html NOT LIKE '%pago_wompi_html%';
