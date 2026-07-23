insert into email_templates (clave, descripcion, asunto, html) values
(
  'cotizacion_confirmacion_cliente_es',
  'Confirmacion de recepcion de presupuesto al cliente en espanol',
  'Hemos recibido tu solicitud de presupuesto - I-ME',
  '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud de presupuesto y te contactaremos en breve.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Resumen solicitado:</strong></p><ul>{{items_html}}</ul><p><strong>Mensaje recibido:</strong></p><pre>{{mensaje}}</pre><p>Equipo I-ME<br>ventas@i-me.com.co</p>'
),
(
  'compra_valorar_interna',
  'Aviso a compras cuando el carrito se convierte en compra a valorar',
  'Compra a valorar {{referencia}} - {{total}} {{moneda}}',
  '<h2>Compra a valorar desde carrito</h2><p><strong>Accion requerida:</strong> validar precio unitario, disponibilidad, impuestos, envio y total final.</p><p>Referencia: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Empresa: {{empresa}}</p><p>Telefono: {{telefono}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Mensaje:</p><pre>{{mensaje}}</pre><p>Fecha: {{fecha}}</p>'
),
(
  'compra_valorar_confirmacion_cliente',
  'Confirmacion al cliente cuando el carrito se convierte en compra a valorar',
  'Recibimos tu solicitud de compra a valorar - I-ME',
  '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu carrito. El pago online esta temporalmente no disponible, por eso nuestro equipo validara precio unitario, disponibilidad, impuestos, envio y total final antes de confirmar.</p><p><strong>Referencia:</strong> {{referencia}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Resumen solicitado:</p><ul>{{items_html}}</ul><p>Te contactaremos con la valoracion final.</p><p>Equipo I-ME</p>'
),
(
  'compra_valorar_confirmacion_cliente_es',
  'Confirmacion al cliente en espanol cuando el carrito se convierte en compra a valorar',
  'Recibimos tu solicitud de compra a valorar - I-ME',
  '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu carrito. El pago online esta temporalmente no disponible, por eso nuestro equipo validara precio unitario, disponibilidad, impuestos, envio y total final antes de confirmar.</p><p><strong>Referencia:</strong> {{referencia}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Resumen solicitado:</p><ul>{{items_html}}</ul><p>Te contactaremos con la valoracion final.</p><p>Equipo I-ME</p>'
),
(
  'cotizacion_confirmacion_cliente_en',
  'Customer quote request receipt confirmation in English',
  'We received your quote request - I-ME',
  '<h2>Hello {{cliente_nombre}}</h2><p>We received your quote request and our commercial team will contact you shortly.</p><p><strong>Reference:</strong> {{referencia}}</p><p><strong>Request summary:</strong></p><ul>{{items_html}}</ul><p><strong>Message received:</strong></p><pre>{{mensaje}}</pre><p>I-ME Team<br>ventas@i-me.com.co</p>'
),
(
  'compra_valorar_confirmacion_cliente_en',
  'Customer purchase valuation receipt confirmation in English',
  'We received your purchase valuation request - I-ME',
  '<h2>Hello {{cliente_nombre}}</h2><p>We received your cart. Online payment is temporarily unavailable, so our team will validate unit prices, availability, taxes, shipping and final total before confirmation.</p><p><strong>Reference:</strong> {{referencia}}</p><p>Estimated total: <strong>{{total}} {{moneda}}</strong></p><p>Request summary:</p><ul>{{items_html}}</ul><p>We will contact you with the final valuation.</p><p>I-ME Team</p>'
)
on conflict (clave) do nothing;
