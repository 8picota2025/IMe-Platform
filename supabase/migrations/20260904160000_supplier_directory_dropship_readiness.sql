-- Supplier directory and dropship-readiness foundation.
-- Additive only: no credentials, costs, or existing supplier records are changed.

-- ── Supplier master data ───────────────────────────────────────────────────
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS tipo_entidad TEXT NOT NULL DEFAULT 'proveedor'
    CHECK (tipo_entidad IN ('fabricante', 'distribuidor', 'proveedor', 'logistica')),
  ADD COLUMN IF NOT EXISTS razon_social TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT,
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS direccion_comercial TEXT,
  ADD COLUMN IF NOT EXISTS sitio_web TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (lifecycle_status IN ('prospect', 'contactado', 'calificado', 'onboarding', 'aprobado', 'suspendido', 'rechazado')),
  ADD COLUMN IF NOT EXISTS dropship_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dropship_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dropship_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cobertura_envios TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS almacenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS incoterms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moneda_operativa TEXT,
  ADD COLUMN IF NOT EXISTS sla_respuesta_horas INTEGER CHECK (sla_respuesta_horas IS NULL OR sla_respuesta_horas >= 0),
  ADD COLUMN IF NOT EXISTS sla_despacho_dias_habiles INTEGER CHECK (sla_despacho_dias_habiles IS NULL OR sla_despacho_dias_habiles >= 0),
  ADD COLUMN IF NOT EXISTS devoluciones_rma_notas TEXT,
  ADD COLUMN IF NOT EXISTS stock_feed_tipo TEXT
    CHECK (stock_feed_tipo IS NULL OR stock_feed_tipo IN ('ninguno', 'manual', 'archivo', 'portal', 'api', 'edi')),
  ADD COLUMN IF NOT EXISTS stock_feed_verificado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_notas TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_contacto_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS riesgo_operativo TEXT
    CHECK (riesgo_operativo IS NULL OR riesgo_operativo IN ('bajo', 'medio', 'alto'));

ALTER TABLE proveedores
  DROP CONSTRAINT IF EXISTS proveedores_dropship_approved_check;
ALTER TABLE proveedores
  ADD CONSTRAINT proveedores_dropship_approved_check
  CHECK (NOT dropship_enabled OR lifecycle_status = 'aprobado');

CREATE INDEX IF NOT EXISTS idx_proveedores_lifecycle_status
  ON proveedores (lifecycle_status, activo);
CREATE INDEX IF NOT EXISTS idx_proveedores_dropship_enabled
  ON proveedores (dropship_enabled) WHERE dropship_enabled;

-- ── Normalized, attributable supplier records ───────────────────────────────
CREATE TABLE IF NOT EXISTS proveedor_contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('comercial', 'ventas', 'soporte', 'logistica', 'finanzas', 'regulatorio', 'general')),
  nombre TEXT,
  cargo TEXT,
  email TEXT,
  telefono TEXT,
  whatsapp TEXT,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (verification_status IN ('pendiente', 'verificado', 'obsoleto', 'rechazado')),
  verificado_at TIMESTAMPTZ,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR telefono IS NOT NULL OR whatsapp IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_contactos_principal_tipo_uidx
  ON proveedor_contactos (proveedor_id, tipo) WHERE es_principal;
CREATE UNIQUE INDEX IF NOT EXISTS proveedor_contactos_email_uidx
  ON proveedor_contactos (proveedor_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proveedor_contactos_proveedor
  ON proveedor_contactos (proveedor_id, tipo);

DROP TRIGGER IF EXISTS set_proveedor_contactos_updated_at ON proveedor_contactos;
CREATE TRIGGER set_proveedor_contactos_updated_at
  BEFORE UPDATE ON proveedor_contactos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS proveedor_fuentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sitio_oficial', 'documento_oficial', 'directorio_publico', 'investigacion_local', 'confirmacion_comercial')),
  url TEXT,
  referencia_local TEXT,
  titulo TEXT,
  consultado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (verification_status IN ('pendiente', 'verificado', 'obsoleto', 'rechazado')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR referencia_local IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_fuentes_unique_source_uidx
  ON proveedor_fuentes (proveedor_id, tipo, coalesce(url, ''), coalesce(referencia_local, ''));
CREATE INDEX IF NOT EXISTS idx_proveedor_fuentes_proveedor
  ON proveedor_fuentes (proveedor_id, consultado_at DESC);

CREATE TABLE IF NOT EXISTS proveedor_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('registro_legal', 'fiscal', 'bancario', 'calidad', 'regulatorio', 'contrato', 'seguro', 'catalogo', 'otro')),
  nombre TEXT NOT NULL,
  storage_path TEXT,
  source_url TEXT,
  vence_at DATE,
  verification_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (verification_status IN ('pendiente', 'verificado', 'vencido', 'rechazado')),
  verificado_at TIMESTAMPTZ,
  verificado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (storage_path IS NOT NULL OR source_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_proveedor_documentos_vencimiento
  ON proveedor_documentos (proveedor_id, vence_at) WHERE vence_at IS NOT NULL;

-- Configuración de canal sin tokens, contraseñas ni secretos. Estos permanecen
-- exclusivamente en infraestructura de servidor cuando el canal sea aprobado.
CREATE TABLE IF NOT EXISTS proveedor_canales_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('email', 'whatsapp', 'portal', 'api', 'edi', 'webhook', 'manual')),
  etiqueta TEXT NOT NULL,
  destino_publico TEXT,
  instrucciones TEXT,
  activo BOOLEAN NOT NULL DEFAULT false,
  aprobado_at TIMESTAMPTZ,
  aprobado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, tipo, etiqueta)
);
CREATE INDEX IF NOT EXISTS idx_proveedor_canales_pedido_activos
  ON proveedor_canales_pedido (proveedor_id) WHERE activo;

DROP TRIGGER IF EXISTS set_proveedor_canales_pedido_updated_at ON proveedor_canales_pedido;
CREATE TRIGGER set_proveedor_canales_pedido_updated_at
  BEFORE UPDATE ON proveedor_canales_pedido
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── Product-operational data (never cost data) ──────────────────────────────
ALTER TABLE proveedor_producto
  ADD COLUMN IF NOT EXISTS sku_proveedor TEXT,
  ADD COLUMN IF NOT EXISTS disponibilidad TEXT NOT NULL DEFAULT 'desconocida'
    CHECK (disponibilidad IN ('en_stock', 'bajo_pedido', 'agotado', 'descontinuado', 'desconocida')),
  ADD COLUMN IF NOT EXISTS unidades_disponibles INTEGER CHECK (unidades_disponibles IS NULL OR unidades_disponibles >= 0),
  ADD COLUMN IF NOT EXISTS stock_verificado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cantidad_minima_pedido INTEGER CHECK (cantidad_minima_pedido IS NULL OR cantidad_minima_pedido > 0),
  ADD COLUMN IF NOT EXISTS multiplo_pedido INTEGER CHECK (multiplo_pedido IS NULL OR multiplo_pedido > 0),
  ADD COLUMN IF NOT EXISTS lead_time_dias_habiles INTEGER CHECK (lead_time_dias_habiles IS NULL OR lead_time_dias_habiles >= 0),
  ADD COLUMN IF NOT EXISTS pais_origen TEXT,
  ADD COLUMN IF NOT EXISTS pais_despacho TEXT,
  ADD COLUMN IF NOT EXISTS incoterm TEXT,
  ADD COLUMN IF NOT EXISTS apto_dropship BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS datos_operativos_verificados_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notas_operativas TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_producto_sku_uidx
  ON proveedor_producto (proveedor_id, lower(sku_proveedor)) WHERE sku_proveedor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proveedor_producto_disponibilidad
  ON proveedor_producto (proveedor_id, disponibilidad, activo);

-- Append-only supplier updates. Payload is a redacted operational snapshot;
-- customer address, payment data, tokens and raw webhook bodies do not belong here.
CREATE TABLE IF NOT EXISTS fulfillment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  origen TEXT NOT NULL CHECK (origen IN ('manual', 'email', 'portal', 'api', 'edi', 'webhook')),
  external_event_id TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'notificado', 'preparando', 'enviado', 'entregado', 'cancelado', 'error')),
  tracking_number TEXT,
  tracking_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  observado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_snapshots_external_event_uidx
  ON fulfillment_snapshots (fulfillment_id, origen, external_event_id)
  WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fulfillment_snapshots_timeline
  ON fulfillment_snapshots (fulfillment_id, observado_at DESC);

-- ── RLS: supplier and fulfillment data stay internal ─────────────────────────
ALTER TABLE proveedor_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_fuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_canales_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proveedor_contactos_admin_all ON proveedor_contactos;
CREATE POLICY proveedor_contactos_admin_all ON proveedor_contactos FOR ALL TO authenticated
  USING (is_admin(ARRAY['catalogo', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones']));

DROP POLICY IF EXISTS proveedor_fuentes_admin_all ON proveedor_fuentes;
CREATE POLICY proveedor_fuentes_admin_all ON proveedor_fuentes FOR ALL TO authenticated
  USING (is_admin(ARRAY['catalogo', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones']));

DROP POLICY IF EXISTS proveedor_documentos_admin_all ON proveedor_documentos;
CREATE POLICY proveedor_documentos_admin_all ON proveedor_documentos FOR ALL TO authenticated
  USING (is_admin(ARRAY['catalogo', 'operaciones']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'operaciones']));

DROP POLICY IF EXISTS proveedor_canales_pedido_operaciones_all ON proveedor_canales_pedido;
CREATE POLICY proveedor_canales_pedido_operaciones_all ON proveedor_canales_pedido FOR ALL TO authenticated
  USING (is_admin(ARRAY['operaciones']))
  WITH CHECK (is_admin(ARRAY['operaciones']));

DROP POLICY IF EXISTS fulfillment_snapshots_operaciones_all ON fulfillment_snapshots;
CREATE POLICY fulfillment_snapshots_operaciones_all ON fulfillment_snapshots FOR ALL TO authenticated
  USING (is_admin(ARRAY['operaciones']))
  WITH CHECK (is_admin(ARRAY['operaciones']));

-- ── Initial local research seed ─────────────────────────────────────────────
-- All entries require commercial verification before use. No supplier is active
-- or approved for dropshipping merely because a public contact was discovered.
INSERT INTO proveedores (
  slug, nombre, razon_social, tipo_entidad, sitio_web, pais, ciudad,
  direccion_comercial, contacto_email, contacto_whatsapp, canal,
  lifecycle_status, dropship_enabled, activo, notas
) VALUES
  ('advanced', 'Advanced', NULL, 'fabricante', NULL, NULL, NULL, NULL, NULL, NULL, 'manual', 'prospect', false, false,
    'Marca comercial en catálogo I-ME; fabricante original no identificado públicamente.'),
  ('angell-technology', 'Angell Technology', 'Shenzhen Angell Technology Co., Ltd.', 'fabricante', 'http://en.szangell.com/', 'China', 'Shenzhen',
    'Room 201, Building G3, TCL International E City, Shuguang Community, Xili Street, Nanshan District, Shenzhen, China', 'market@szangell.com', NULL, 'manual', 'prospect', false, false, NULL),
  ('brother-medical', 'Brother Medical', 'Shanghai Brother Medical Manufacturer Co., Ltd.', 'fabricante', 'https://www.brothermedical.com/', 'China', 'Shanghai', NULL,
    'info@brothermedical.com', '+8613916895529', 'manual', 'prospect', false, false, NULL),
  ('ime-importmedical-colombia', 'I-ME Importmedical Colombia', 'IME Importmedical Colombia SAS', 'fabricante', 'https://www.i-me.com.co/', 'Colombia', 'Bogotá D.C.',
    'Carrera 50 # 22 - 41 Local 203 Centro Comercial Cipres Plaza, Bogotá D.C., Colombia', NULL, NULL, 'manual', 'prospect', false, false,
    'Registro interno: no habilita dropshipping ni representa una relación de proveedor.'),
  ('ilumitec', 'Ilumitec', 'Ilumitec S.A.S. (Iluminación y Tecnología Médico Quirúrgica S.A.S.)', 'fabricante', 'https://www.ilumitecsas.com/', 'Colombia', 'Bogotá',
    'Calle 70 B N.° 58 - 43, Barrio San Fernando, Bogotá, Colombia', 'ventasilumitec@gmail.com', '+576017011687', 'manual', 'prospect', false, false, NULL),
  ('m-bombas-infusion', 'M', NULL, 'fabricante', NULL, NULL, NULL, NULL, NULL, NULL, 'manual', 'prospect', false, false,
    'Denominación comercial en catálogo I-ME; fabricante original pendiente de identificar.'),
  ('northern-meditec', 'Northern Meditec', 'Shenzhen Northern Meditec Limited', 'fabricante', 'https://en.northernmeditec.com/', 'China', 'Shenzhen', NULL,
    NULL, NULL, 'manual', 'prospect', false, false, NULL),
  ('perlong-medical', 'Perlong Medical', 'Perlong Medical Equipment Co., Ltd.', 'fabricante', 'https://www.perlong-china.com/', 'China', 'Nanjing',
    'Block A, 24th Floor, No. 1 Hanzhongmen Street, Nanjing 210029, China', 'perlong@perlong-china.com', '+862552635350', 'manual', 'prospect', false, false, NULL),
  ('saikang-medical', 'Saikang Medical', 'Jiangsu Saikang Medical Equipment Co., Ltd.', 'fabricante', 'https://www.saikangmedical.com/', 'China', 'Zhangjiagang',
    'No. 35 Lehong Road, Modern Agriculture Demonstration Park, Zhangjiagang City, Jiangsu, China', 'export@saikangmedical.com', '+8618021230101', 'manual', 'prospect', false, false, NULL),
  ('tuttnauer', 'Tuttnauer', 'Tuttnauer B.V.', 'fabricante', 'https://tuttnauer.com/', 'Países Bajos', 'Breda',
    'Hoeksteen 11, Breda, PR 4815, Netherlands', NULL, NULL, 'manual', 'prospect', false, false, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Fabricantes adicionales investigados en sus sitios públicos. Se crean solo
-- como prospectos: URL pública no equivale a autorización de compra ni envío.
INSERT INTO proveedores (
  slug, nombre, tipo_entidad, sitio_web, canal, lifecycle_status,
  dropship_enabled, activo, notas
) VALUES
  ('air-liquide-medical-systems', 'Air Liquide Medical Systems', 'fabricante', 'https://medicaldevice.airliquide.com/', 'manual', 'prospect', false, false,
    'Fabricante identificado para la línea Monnal; validar canal comercial regional.'),
  ('baumer', 'Baumer', 'fabricante', 'https://www.baumer.com.br/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.'),
  ('biobase', 'BIOBASE', 'fabricante', 'https://www.biobase.com/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.'),
  ('eden-medical', 'Eden Medical', 'proveedor', 'https://www.edenmedical.co.uk/', 'manual', 'prospect', false, false,
    'Entidad incluida como posible proveedor; relación comercial y capacidad de dropship pendientes.'),
  ('smaf-medical', 'SMAF', 'fabricante', 'https://www.smaf.com.cn/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.'),
  ('perlove-medical', 'Perlove Medical', 'fabricante', 'https://perlove.com.cn/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.'),
  ('bemems', 'BEMEMS', 'proveedor', NULL, 'manual', 'prospect', false, false,
    'Referencia de directorio; identidad comercial y sitio oficial pendientes de confirmar.'),
  ('medrena', 'MedRena', 'fabricante', 'https://www.medrena.com/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.'),
  ('gemmy', 'Gemmy', 'fabricante', 'https://www.gemmy.com.tw/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.'),
  ('meling-biomedical', 'Meling Biomedical', 'fabricante', 'https://www.melingbiomedical.com/', 'manual', 'prospect', false, false,
    'Contacto comercial, representación regional y catálogo aplicable pendientes.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO proveedor_fuentes (proveedor_id, tipo, url, titulo, verification_status, notas)
SELECT p.id, 'sitio_oficial', s.url, s.titulo, 'pendiente',
  'Sitio público localizado. Confirmar titularidad y canal comercial antes de uso operativo.'
FROM (VALUES
  ('air-liquide-medical-systems', 'https://medicaldevice.airliquide.com/', 'Air Liquide Medical Systems'),
  ('baumer', 'https://www.baumer.com.br/', 'Baumer'),
  ('biobase', 'https://www.biobase.com/', 'BIOBASE'),
  ('eden-medical', 'https://www.edenmedical.co.uk/', 'Eden Medical'),
  ('smaf-medical', 'https://www.smaf.com.cn/', 'SMAF'),
  ('perlove-medical', 'https://perlove.com.cn/', 'Perlove Medical'),
  ('medrena', 'https://www.medrena.com/', 'MedRena'),
  ('gemmy', 'https://www.gemmy.com.tw/', 'Gemmy'),
  ('meling-biomedical', 'https://www.melingbiomedical.com/', 'Meling Biomedical')
) AS s(slug, url, titulo)
JOIN proveedores p ON p.slug = s.slug
ON CONFLICT DO NOTHING;

INSERT INTO proveedor_fuentes (proveedor_id, tipo, url, referencia_local, titulo, verification_status, notas)
SELECT p.id, 'investigacion_local', s.url, s.referencia_local, s.titulo, 'pendiente',
  'Datos extraídos localmente; verificar contra fuente oficial antes de uso operativo.'
FROM (VALUES
  ('advanced', NULL::TEXT, '/home/shoky/ftp/Fabricantes/Advanced/contacto.txt', 'Advanced contact research'),
  ('angell-technology', 'http://en.szangell.com/', '/home/shoky/ftp/Fabricantes/Angell_Technology/contacto.txt', 'Angell Technology official website'),
  ('brother-medical', 'https://www.brothermedical.com/', '/home/shoky/ftp/Fabricantes/BM/contacto.txt', 'Brother Medical official website'),
  ('ime-importmedical-colombia', 'https://www.i-me.com.co/', '/home/shoky/ftp/Fabricantes/IME/contacto.txt', 'I-ME official website'),
  ('ilumitec', 'https://www.ilumitecsas.com/', '/home/shoky/ftp/Fabricantes/Ilumitec/contacto.txt', 'Ilumitec official website'),
  ('m-bombas-infusion', NULL::TEXT, '/home/shoky/ftp/Fabricantes/M/contacto.txt', 'M contact research'),
  ('northern-meditec', 'https://en.northernmeditec.com/', '/home/shoky/ftp/Fabricantes/Northern/contacto.txt', 'Northern Meditec official website'),
  ('perlong-medical', 'https://www.perlong-china.com/', '/home/shoky/ftp/Fabricantes/Perlong/contacto.txt', 'Perlong Medical official website'),
  ('saikang-medical', 'https://www.saikangmedical.com/', '/home/shoky/ftp/Fabricantes/Saikang/contacto.txt', 'Saikang Medical official website'),
  ('tuttnauer', 'https://tuttnauer.com/', '/home/shoky/ftp/Fabricantes/Tuttnauer/contacto.txt', 'Tuttnauer official website')
) AS s(slug, url, referencia_local, titulo)
JOIN proveedores p ON p.slug = s.slug
ON CONFLICT DO NOTHING;

INSERT INTO proveedor_contactos (proveedor_id, tipo, email, telefono, whatsapp, es_principal, verification_status, source_note)
SELECT p.id, 'general', c.email, c.telefono, c.whatsapp, true, 'pendiente',
  'Extraído de archivo local de investigación. Confirmar en canal oficial antes de contacto comercial u operación.'
FROM (VALUES
  ('angell-technology', 'market@szangell.com', '+8675586966744', NULL::TEXT),
  ('brother-medical', 'info@brothermedical.com', '+862151876643', '+8613916895529'),
  ('ilumitec', 'ventasilumitec@gmail.com', '+576017011687', '+573183770301'),
  ('perlong-medical', 'perlong@perlong-china.com', '+862552635350', NULL::TEXT),
  ('saikang-medical', 'export@saikangmedical.com', '+8618021230101', NULL::TEXT)
) AS c(slug, email, telefono, whatsapp)
JOIN proveedores p ON p.slug = c.slug
ON CONFLICT DO NOTHING;

INSERT INTO proveedor_fuentes (proveedor_id, tipo, url, titulo, verification_status, notas)
SELECT id, 'sitio_oficial', 'https://www.brothermedical.com/', 'Brother Medical official website', 'verificado',
  'Correo, teléfono y WhatsApp publicados en el sitio oficial; verificación comercial pendiente.'
FROM proveedores
WHERE slug = 'brother-medical'
ON CONFLICT DO NOTHING;
