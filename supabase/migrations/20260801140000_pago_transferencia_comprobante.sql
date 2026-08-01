-- Pago por transferencia bancaria manual desde cotización formalizada.

-- proveedor_pago admite transferencia
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_proveedor_pago_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_proveedor_pago_check
  CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi', 'transferencia'));

ALTER TABLE eventos_pago DROP CONSTRAINT IF EXISTS eventos_pago_proveedor_pago_check;
ALTER TABLE eventos_pago
  ADD CONSTRAINT eventos_pago_proveedor_pago_check
  CHECK (proveedor_pago IN ('bold', 'stripe', 'wompi', 'transferencia'));

-- Campos de comprobante / validación manual
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_pago_path TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_pago_nombre TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_subido_at TIMESTAMPTZ;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_validado_at TIMESTAMPTZ;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_validado_por TEXT;

-- Bucket privado para comprobantes
INSERT INTO storage.buckets (id, name, public)
  VALUES ('comprobantes-pago', 'comprobantes-pago', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "comprobantes_admin_select" ON storage.objects;
CREATE POLICY "comprobantes_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comprobantes-pago'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "comprobantes_admin_insert" ON storage.objects;
CREATE POLICY "comprobantes_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprobantes-pago'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

-- Plantillas email: CTA pago por transferencia
INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
(
  'cotizacion_oferta_cliente',
  'Oferta formal con CTA pago por transferencia y carga de comprobante',
  'Tu cotizacion I-ME — pago por transferencia {{referencia}}',
  '<h2>Hola {{cliente_nombre}}</h2><p>Hemos preparado tu cotizacion. Revisa el resumen y las observaciones de configuracion. Para formalizar, realiza la transferencia bancaria por el total ofertado y carga el comprobante en la plataforma.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Total a transferir:</strong> {{total}} {{moneda}}</p><p><strong>Validez:</strong> {{validez}}</p><p><strong>Productos:</strong></p><ul>{{items_html}}</ul><p><strong>Observaciones / condiciones:</strong></p><pre>{{condiciones}}</pre><p><strong>Datos bancarios:</strong></p><pre>{{datos_bancarios}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Pagar por transferencia</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Equipo I-ME<br>ventas@i-me.com.co</p>'
),
(
  'cotizacion_oferta_cliente_es',
  'Oferta formal ES con CTA transferencia',
  'Tu cotizacion I-ME — pago por transferencia {{referencia}}',
  '<h2>Hola {{cliente_nombre}}</h2><p>Hemos preparado tu cotizacion. Revisa el resumen y las observaciones de configuracion. Para formalizar, realiza la transferencia bancaria por el total ofertado y carga el comprobante en la plataforma.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Total a transferir:</strong> {{total}} {{moneda}}</p><p><strong>Validez:</strong> {{validez}}</p><p><strong>Productos:</strong></p><ul>{{items_html}}</ul><p><strong>Observaciones / condiciones:</strong></p><pre>{{condiciones}}</pre><p><strong>Datos bancarios:</strong></p><pre>{{datos_bancarios}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Pagar por transferencia</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Equipo I-ME<br>ventas@i-me.com.co</p>'
),
(
  'cotizacion_oferta_cliente_en',
  'Formal quote EN with bank transfer CTA',
  'Your I-ME quote — pay by bank transfer {{referencia}}',
  '<h2>Hello {{cliente_nombre}}</h2><p>We prepared your quote. Review the summary and configuration notes. To formalize, transfer the quoted total and upload the payment receipt on the platform.</p><p><strong>Reference:</strong> {{referencia}}</p><p><strong>Amount to transfer:</strong> {{total}} {{moneda}}</p><p><strong>Valid until:</strong> {{validez}}</p><p><strong>Products:</strong></p><ul>{{items_html}}</ul><p><strong>Notes / terms:</strong></p><pre>{{condiciones}}</pre><p><strong>Bank details:</strong></p><pre>{{datos_bancarios}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Pay by bank transfer</a></p><p>If the button does not work, copy this link:<br>{{formalizar_url}}</p><p>I-ME Team<br>ventas@i-me.com.co</p>'
),
(
  'transferencia_recibida_interna',
  'Aviso interno: cliente cargo comprobante de transferencia',
  'Comprobante pendiente de validacion {{referencia}}',
  '<h2>Comprobante de transferencia recibido</h2><p>Pedido: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><p>Validar el comprobante en el CMS de pedidos.</p>'
),
(
  'transferencia_recibida_cliente',
  'Confirmacion al cliente: comprobante recibido, pendiente validacion',
  'Recibimos tu comprobante — pedido {{referencia}}',
  '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu comprobante de transferencia para el pedido <strong>{{referencia}}</strong> por <strong>{{total}} {{moneda}}</strong>.</p><p>Nuestro equipo validara el pago y te confirmara por este correo.</p><p>Equipo I-ME</p>'
)
ON CONFLICT (clave) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  asunto = EXCLUDED.asunto,
  html = EXCLUDED.html;
