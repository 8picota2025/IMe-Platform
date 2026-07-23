-- ============================================================
-- FASE 1 BACKOFFICE: plantillas de email, log de emails, reembolsos
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  clave       TEXT PRIMARY KEY,
  descripcion TEXT NOT NULL DEFAULT '',
  asunto      TEXT NOT NULL,
  html        TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_templates_admin_all" ON email_templates;
CREATE POLICY "email_templates_admin_all"
  ON email_templates FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

CREATE TABLE IF NOT EXISTS email_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario TEXT NOT NULL,
  plantilla    TEXT NOT NULL,
  referencia   TEXT,
  status       TEXT NOT NULL CHECK (status IN ('enviado', 'fallido')),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_referencia ON email_log (referencia);
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_log_admin_select" ON email_log;
CREATE POLICY "email_log_admin_select"
  ON email_log FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']));

CREATE TABLE IF NOT EXISTS reembolsos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id           UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  monto               NUMERIC NOT NULL CHECK (monto > 0),
  motivo              TEXT NOT NULL,
  metodo              TEXT NOT NULL DEFAULT 'pasarela'
                      CHECK (metodo IN ('pasarela', 'transferencia', 'nota_credito', 'otro')),
  referencia_externa  TEXT,
  estado              TEXT NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'procesado', 'rechazado')),
  nota_credito_dian   BOOLEAN NOT NULL DEFAULT false,
  creado_por          TEXT,
  procesado_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reembolsos_pedido ON reembolsos (pedido_id);
ALTER TABLE reembolsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reembolsos_admin_all" ON reembolsos;
CREATE POLICY "reembolsos_admin_all"
  ON reembolsos FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

-- Seeds de plantillas (no pisan ediciones del admin)
INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
('venta_interna', 'Aviso interno de nueva venta (root@ y ventas@)',
 'Nueva venta {{referencia}} - {{total}} COP',
 '<h2>Nueva venta confirmada</h2><p>Pedido: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Fecha: {{fecha}}</p>'),
('cotizacion_interna', 'Aviso interno de nueva solicitud de cotizacion',
 'Nueva cotizacion de {{cliente_nombre}} - I-ME',
 '<h2>Nueva solicitud de cotizacion</h2><p>Nombre: {{cliente_nombre}}</p><p>Empresa: {{empresa}}</p><p>Email: {{cliente_email}}</p><p>Telefono: {{telefono}}</p><p>Productos:</p><ul>{{items_html}}</ul><p>Mensaje: {{mensaje}}</p><p>Fecha: {{fecha}}</p>'),
('pedido_confirmacion_cliente', 'Confirmacion de compra al cliente',
 'Confirmacion de tu pedido {{referencia}} - I-ME',
 '<h2>Gracias por tu compra, {{cliente_nombre}}</h2><p>Hemos recibido el pago de tu pedido <strong>{{referencia}}</strong>.</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Puedes consultar el estado en <a href="https://i-me.com.co/es/seguimiento/">i-me.com.co/es/seguimiento</a> con tu referencia.</p><p>Equipo I-ME</p>'),
('cotizacion_confirmacion_cliente', 'Confirmacion de recepcion de cotizacion al cliente',
 'Hemos recibido tu solicitud de cotizacion - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud de cotizacion y nuestro equipo comercial te contactara en breve.</p><p>Productos solicitados:</p><ul>{{items_html}}</ul><p>Equipo I-ME<br>ventas@i-me.com.co</p>'),
('pedido_estado_cliente', 'Notificacion de cambio de estado del pedido al cliente',
 'Tu pedido {{referencia}} esta {{estado_label}} - I-ME',
 '<h2>Hola {{cliente_nombre}}</h2><p>Tu pedido <strong>{{referencia}}</strong> cambio de estado: <strong>{{estado_label}}</strong>.</p>{{tracking_html}}<p>Puedes consultar el detalle en <a href="https://i-me.com.co/es/seguimiento/">i-me.com.co/es/seguimiento</a>.</p><p>Equipo I-ME</p>')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- FASE 2/3 BACKOFFICE: portal cliente (RLS), listas de precio B2B,
-- carrito abandonado, tarifas de envio, resenas
-- ============================================================

-- Portal de cliente: el usuario autenticado ve SUS pedidos/cotizaciones/datos
DROP POLICY IF EXISTS "pedidos_cliente_select" ON pedidos;
CREATE POLICY "pedidos_cliente_select"
  ON pedidos FOR SELECT
  TO authenticated
  USING ((cliente->>'email') = (select auth.email()));

DROP POLICY IF EXISTS "cotizaciones_cliente_select" ON solicitudes_cotizacion;
CREATE POLICY "cotizaciones_cliente_select"
  ON solicitudes_cotizacion FOR SELECT
  TO authenticated
  USING (email = (select auth.email()));

DROP POLICY IF EXISTS "clientes_self_select" ON clientes;
CREATE POLICY "clientes_self_select"
  ON clientes FOR SELECT
  TO authenticated
  USING (email = (select auth.email()));

DROP POLICY IF EXISTS "direcciones_self_select" ON cliente_direcciones;
CREATE POLICY "direcciones_self_select"
  ON cliente_direcciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = cliente_direcciones.cliente_id AND c.email = (select auth.email())
    )
  );

-- Listas de precio B2B
CREATE TABLE IF NOT EXISTS listas_precio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  descripcion   TEXT NOT NULL DEFAULT '',
  descuento_pct NUMERIC NOT NULL DEFAULT 0 CHECK (descuento_pct >= 0 AND descuento_pct <= 90),
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lista_precio_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id    UUID NOT NULL REFERENCES listas_precio(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio      NUMERIC NOT NULL CHECK (precio > 0),
  UNIQUE (lista_id, producto_id)
);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lista_precio_id UUID REFERENCES listas_precio(id) ON DELETE SET NULL;

ALTER TABLE listas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "listas_precio_admin_all" ON listas_precio;
CREATE POLICY "listas_precio_admin_all"
  ON listas_precio FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));
DROP POLICY IF EXISTS "listas_precio_cliente_select" ON listas_precio;
CREATE POLICY "listas_precio_cliente_select"
  ON listas_precio FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.lista_precio_id = listas_precio.id AND c.email = (select auth.email())
    )
  );
DROP POLICY IF EXISTS "lista_precio_items_admin_all" ON lista_precio_items;
CREATE POLICY "lista_precio_items_admin_all"
  ON lista_precio_items FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas']))
  WITH CHECK (is_admin(ARRAY['ventas']));

-- Carrito abandonado (escritura solo via Edge Functions con service_role)
CREATE TABLE IF NOT EXISTS carritos_abandonados (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    TEXT NOT NULL,
  nombre                   TEXT,
  items                    JSONB NOT NULL,
  subtotal                 NUMERIC NOT NULL DEFAULT 0,
  estado                   TEXT NOT NULL DEFAULT 'activo'
                           CHECK (estado IN ('activo', 'recordado', 'convertido')),
  recordatorio_enviado_at  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carritos_abandonados_email_activo
  ON carritos_abandonados (email) WHERE estado = 'activo';
ALTER TABLE carritos_abandonados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "carritos_admin_select" ON carritos_abandonados;
CREATE POLICY "carritos_admin_select"
  ON carritos_abandonados FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['ventas']));

-- Tarifas de envio por zona (departamentos de Colombia)
CREATE TABLE IF NOT EXISTS tarifas_envio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona          TEXT NOT NULL UNIQUE,
  departamentos TEXT[] NOT NULL DEFAULT '{}',
  tarifa        NUMERIC NOT NULL CHECK (tarifa >= 0),
  gratis_desde  NUMERIC,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tarifas_envio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tarifas_envio_select_public" ON tarifas_envio;
CREATE POLICY "tarifas_envio_select_public"
  ON tarifas_envio FOR SELECT
  TO anon, authenticated
  USING (activo = true);
DROP POLICY IF EXISTS "tarifas_envio_admin_all" ON tarifas_envio;
CREATE POLICY "tarifas_envio_admin_all"
  ON tarifas_envio FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['operaciones']))
  WITH CHECK (is_admin(ARRAY['operaciones']));

-- Resenas de productos (insert solo via Edge Function; select publico si aprobada)
CREATE TABLE IF NOT EXISTS resenas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comentario  TEXT NOT NULL DEFAULT '',
  aprobada    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resenas_producto ON resenas (producto_id) WHERE aprobada = true;
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resenas_select_public" ON resenas;
CREATE POLICY "resenas_select_public"
  ON resenas FOR SELECT
  TO anon, authenticated
  USING (aprobada = true);
DROP POLICY IF EXISTS "resenas_admin_all" ON resenas;
CREATE POLICY "resenas_admin_all"
  ON resenas FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['ventas', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['ventas', 'operaciones']));

-- Plantilla de email para carrito abandonado
INSERT INTO email_templates (clave, descripcion, asunto, html) VALUES
('carrito_abandonado_cliente', 'Recordatorio de carrito abandonado (24h)',
 'Tu carrito en I-ME te espera',
 '<h2>Hola {{cliente_nombre}}</h2><p>Dejaste estos productos en tu carrito:</p><ul>{{items_html}}</ul><p>Subtotal: <strong>{{total}} COP</strong></p><p><a href="https://i-me.com.co/es/carrito/">Completar mi compra</a></p><p>Si necesitas asesoria, responde a este correo.</p><p>Equipo I-ME</p>')
ON CONFLICT (clave) DO NOTHING;

-- Programacion del recordatorio de carritos (requiere extensiones pg_cron + pg_net
-- activas en Supabase; ejecutar una vez, ajustando el service key en Vault):
-- SELECT cron.schedule('recordatorio-carritos', '0 * * * *', $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/recordatorio-carritos',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_key'))
--   );
-- $$);
