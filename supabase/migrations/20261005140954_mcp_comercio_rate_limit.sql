-- Shared atomic rate limit across Edge isolates; uses the existing deny-all RLS table.
CREATE OR REPLACE FUNCTION public.consume_mcp_comercio_rate_limit(p_keys text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_count integer;
  v_allowed boolean := true;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_keys IS NULL OR cardinality(p_keys) != 2 OR EXISTS (
    SELECT 1 FROM unnest(p_keys) AS k
    WHERE k IS NULL OR k !~ '^mcp:(ip|token):[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'Invalid rate limit keys';
  END IF;
  -- Consistent order avoids deadlocks. ON CONFLICT locks serialize increments.
  FOR v_key IN SELECT DISTINCT k FROM unnest(p_keys) AS k ORDER BY k LOOP
    INSERT INTO public.asesor_rate_limit AS limits
      (identificador, ventana_inicio, contador_ventana, dia, contador_dia, updated_at)
    VALUES (v_key, v_now, 1, v_now::date, 1, v_now)
    ON CONFLICT (identificador) DO UPDATE SET
      ventana_inicio = CASE WHEN limits.ventana_inicio <= v_now - interval '60 seconds' THEN v_now ELSE limits.ventana_inicio END,
      contador_ventana = CASE WHEN limits.ventana_inicio <= v_now - interval '60 seconds' THEN 1 ELSE least(limits.contador_ventana + 1, 61) END,
      dia = v_now::date,
      contador_dia = 0,
      updated_at = v_now
    RETURNING contador_ventana INTO v_count;
    IF v_count > 60 THEN v_allowed := false; END IF;
  END LOOP;
  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_mcp_comercio_rate_limit(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mcp_comercio_rate_limit(text[]) TO service_role;
