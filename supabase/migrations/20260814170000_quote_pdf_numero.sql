-- Quote PDF + send integrity. Additive. No DROP.
-- SoT: solicitudes_cotizacion. Formalizar still reads current row.

ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS pdf_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS send_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_cotizacion_numero_uidx
  ON solicitudes_cotizacion (numero)
  WHERE numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_created_by
  ON solicitudes_cotizacion (created_by);

CREATE INDEX IF NOT EXISTS idx_solicitudes_cotizacion_estado_created
  ON solicitudes_cotizacion (estado, created_at DESC);

DROP TRIGGER IF EXISTS set_solicitudes_cotizacion_updated_at ON solicitudes_cotizacion;
CREATE TRIGGER set_solicitudes_cotizacion_updated_at
  BEFORE UPDATE ON solicitudes_cotizacion
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE SEQUENCE IF NOT EXISTS cotizacion_numero_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_cotizacion_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('cotizacion_numero_seq');
  RETURN 'IME-Q-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION ensure_cotizacion_numero(p_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_num TEXT;
BEGIN
  SELECT numero INTO current_num
  FROM solicitudes_cotizacion
  WHERE id = p_id
  FOR UPDATE;

  IF current_num IS NOT NULL AND btrim(current_num) <> '' THEN
    RETURN current_num;
  END IF;

  UPDATE solicitudes_cotizacion
  SET numero = next_cotizacion_numero()
  WHERE id = p_id
    AND (numero IS NULL OR btrim(numero) = '')
  RETURNING numero INTO current_num;

  RETURN current_num;
END;
$$;

CREATE OR REPLACE FUNCTION claim_cotizacion_send(p_id uuid)
RETURNS SETOF solicitudes_cotizacion
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE solicitudes_cotizacion
  SET
    send_claimed_at = NOW(),
    send_error = NULL,
    pdf_revision = COALESCE(pdf_revision, 0) + 1
  WHERE id = p_id
    AND pedido_id IS NULL
    AND estado IS DISTINCT FROM 'convertida'
    AND (
      send_claimed_at IS NULL
      OR send_claimed_at < NOW() - INTERVAL '2 minutes'
    )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION next_cotizacion_numero() FROM PUBLIC;
REVOKE ALL ON FUNCTION ensure_cotizacion_numero(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_cotizacion_send(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_cotizacion_numero() TO service_role;
GRANT EXECUTE ON FUNCTION ensure_cotizacion_numero(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION claim_cotizacion_send(uuid) TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cotizacion_numero_seq TO service_role;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('cotizaciones-pdf', 'cotizaciones-pdf', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cotizaciones_pdf_ventas_select" ON storage.objects;
CREATE POLICY "cotizaciones_pdf_ventas_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cotizaciones-pdf'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "cotizaciones_pdf_ventas_insert" ON storage.objects;
CREATE POLICY "cotizaciones_pdf_ventas_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cotizaciones-pdf'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );

DROP POLICY IF EXISTS "cotizaciones_pdf_ventas_update" ON storage.objects;
CREATE POLICY "cotizaciones_pdf_ventas_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cotizaciones-pdf'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  )
  WITH CHECK (
    bucket_id = 'cotizaciones-pdf'
    AND public.is_admin(ARRAY['ventas', 'operaciones'])
  );
