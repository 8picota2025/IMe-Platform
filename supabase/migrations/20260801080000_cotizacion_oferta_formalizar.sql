-- Oferta comercial en cotizaciones: condiciones, precios admin, token formalizar, vínculo a pedido.

ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS condiciones TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS validez_hasta DATE;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS precio_total_ofertado NUMERIC;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS oferta_enviada_at TIMESTAMPTZ;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS formalizacion_token_hash TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS formalizacion_token_expira_at TIMESTAMPTZ;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_pedido_id
  ON solicitudes_cotizacion (pedido_id)
  WHERE pedido_id IS NOT NULL;

ALTER TABLE solicitudes_cotizacion DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_estado_check;
ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_estado_check
  CHECK (estado IN (
    'nueva',
    'en_revision',
    'respondida',
    'enviada',
    'convertida',
    'expirada'
  ));

INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
(
  'cotizacion_oferta_cliente',
  'Oferta formal de cotizacion enviada al cliente con CTA Formalizar',
  'Tu cotizacion I-ME lista para formalizar — {{referencia}}',
  '<h2>Hola {{cliente_nombre}}</h2><p>Hemos preparado tu cotizacion. Revisa el detalle y formaliza el pedido cuando estes listo.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Total ofertado:</strong> {{total}} {{moneda}}</p><p><strong>Validez:</strong> {{validez}}</p><p><strong>Productos:</strong></p><ul>{{items_html}}</ul><p><strong>Condiciones:</strong></p><pre>{{condiciones}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Formalizar pedido</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Equipo I-ME<br>ventas@i-me.com.co</p>'
),
(
  'cotizacion_oferta_cliente_es',
  'Oferta formal de cotizacion (ES) con CTA Formalizar',
  'Tu cotizacion I-ME lista para formalizar — {{referencia}}',
  '<h2>Hola {{cliente_nombre}}</h2><p>Hemos preparado tu cotizacion. Revisa el detalle y formaliza el pedido cuando estes listo.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Total ofertado:</strong> {{total}} {{moneda}}</p><p><strong>Validez:</strong> {{validez}}</p><p><strong>Productos:</strong></p><ul>{{items_html}}</ul><p><strong>Condiciones:</strong></p><pre>{{condiciones}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Formalizar pedido</a></p><p>Si el boton no funciona, copia este enlace:<br>{{formalizar_url}}</p><p>Equipo I-ME<br>ventas@i-me.com.co</p>'
),
(
  'cotizacion_oferta_cliente_en',
  'Formal quote offer (EN) with Formalize CTA',
  'Your I-ME quote is ready to formalize — {{referencia}}',
  '<h2>Hello {{cliente_nombre}}</h2><p>We prepared your quote. Review the details and formalize the order when ready.</p><p><strong>Reference:</strong> {{referencia}}</p><p><strong>Quoted total:</strong> {{total}} {{moneda}}</p><p><strong>Valid until:</strong> {{validez}}</p><p><strong>Products:</strong></p><ul>{{items_html}}</ul><p><strong>Terms:</strong></p><pre>{{condiciones}}</pre><p><a href="{{formalizar_url}}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">Formalize order</a></p><p>If the button does not work, copy this link:<br>{{formalizar_url}}</p><p>I-ME Team<br>ventas@i-me.com.co</p>'
)
ON CONFLICT (clave) DO NOTHING;
