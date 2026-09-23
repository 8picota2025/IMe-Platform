-- ADR-0013: modelo minimo de Evidence & Compliance para claims biomedicos.
-- Tabla nueva en vez de columnas en productos (VALIDACION.md item 4 ya
-- senalaba explicitamente "no crear columna a ciegas" para politica INVIMA
-- por producto). 3 campos obligatorios antes de "aprobado" en vez del
-- modelo completo de 10 campos del mandato original (CLAIM/SOURCE/
-- SOURCE_TYPE/JURISDICTION/VALID_FROM/VALID_UNTIL/VERIFIED_AT/CONFIDENCE):
-- fuente_url, revisado_por, estado_aprobacion. Alcance reducido para no
-- bloquear Fase 2; ver docs/decisions/0013-evidencia-claims-biomedicos.md.

CREATE TABLE IF NOT EXISTS producto_claims_evidencia (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id        UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  claim_texto        TEXT NOT NULL,
  categoria          TEXT NOT NULL DEFAULT 'otro'
                     CHECK (categoria IN (
                       'invima', 'ce', 'fda', 'iso', 'indicacion',
                       'precision', 'eficacia', 'seguridad',
                       'compatibilidad', 'garantia', 'otro'
                     )),
  fuente_url         TEXT,
  revisado_por       TEXT,
  estado_aprobacion  TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado')),
  notas              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Regla del mandato: "INSUFFICIENT EVIDENCE -> DO NOT PUBLISH". No se
  -- puede marcar aprobado sin fuente_url ni revisado_por.
  CONSTRAINT producto_claims_evidencia_aprobado_requiere_evidencia CHECK (
    estado_aprobacion <> 'aprobado'
    OR (fuente_url IS NOT NULL AND revisado_por IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_producto_claims_evidencia_producto_id
  ON producto_claims_evidencia(producto_id);
CREATE INDEX IF NOT EXISTS idx_producto_claims_evidencia_estado
  ON producto_claims_evidencia(estado_aprobacion);

CREATE OR REPLACE FUNCTION set_updated_at_producto_claims_evidencia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producto_claims_evidencia_updated_at ON producto_claims_evidencia;
CREATE TRIGGER trg_producto_claims_evidencia_updated_at
  BEFORE UPDATE ON producto_claims_evidencia
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_producto_claims_evidencia();

-- RLS: SELECT publico solo de claims aprobados (para que el sitio/asesor
-- puedan citar evidencia real); escritura solo admin/catalogo. Mismo
-- patron que articulos_select_public / articulos_admin_all.
ALTER TABLE producto_claims_evidencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "producto_claims_evidencia_select_aprobado" ON producto_claims_evidencia;
CREATE POLICY "producto_claims_evidencia_select_aprobado"
  ON producto_claims_evidencia FOR SELECT
  TO anon, authenticated
  USING (estado_aprobacion = 'aprobado');

DROP POLICY IF EXISTS "producto_claims_evidencia_admin_all" ON producto_claims_evidencia;
CREATE POLICY "producto_claims_evidencia_admin_all"
  ON producto_claims_evidencia FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'ventas']));
