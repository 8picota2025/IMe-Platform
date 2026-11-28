-- Superficie MCP pública con rol `client` (función Edge `mcp-cliente`).
-- Migración ADITIVA: solo crea objetos nuevos; no altera ni borra nada existente.
-- Rollback documentado en docs/MCP_CLIENT_GUIDE.md §Rollback.
--
-- Todas las tablas son deny-all para anon/authenticated (RLS sin políticas de
-- escritura). Solo la Edge Function, con service_role, escribe. El CMS lee
-- clientes, auditoría y descargas con is_admin(ventas/operaciones/catalogo).

-- 1. Clientes registrados por agentes externos -------------------------------
CREATE TABLE IF NOT EXISTS public.mcp_clientes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 hex del token opaco; el token en claro no se guarda nunca.
  token_hash            text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  nombre                text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 120),
  email                 text NOT NULL CHECK (char_length(email) BETWEEN 6 AND 200),
  empresa               text NOT NULL CHECK (char_length(empresa) BETWEEN 2 AND 160),
  telefono              text NOT NULL CHECK (char_length(telefono) BETWEEN 7 AND 40),
  pais                  text CHECK (pais IS NULL OR pais ~ '^[A-Z]{2}$'),
  agente                text CHECK (agente IS NULL OR char_length(agente) <= 80),
  consentimiento_datos  boolean NOT NULL CHECK (consentimiento_datos),
  consentimiento_at     timestamptz NOT NULL DEFAULT now(),
  ip_hash               text CHECK (ip_hash IS NULL OR ip_hash ~ '^[a-f0-9]{64}$'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  expira_en             timestamptz NOT NULL DEFAULT now() + interval '30 days',
  ultimo_uso_at         timestamptz,
  revocado_at           timestamptz,
  revocado_motivo       text
);
CREATE INDEX IF NOT EXISTS idx_mcp_clientes_email ON public.mcp_clientes (lower(email));

-- 2. Auditoría de cada invocación (sin PII en claro) --------------------------
CREATE TABLE IF NOT EXISTS public.mcp_cliente_auditoria (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  en            timestamptz NOT NULL DEFAULT now(),
  metodo        text NOT NULL CHECK (char_length(metodo) <= 40),
  herramienta   text CHECK (herramienta IS NULL OR char_length(herramienta) <= 80),
  cliente_id    uuid REFERENCES public.mcp_clientes(id) ON DELETE SET NULL,
  ip_hash       text CHECK (ip_hash IS NULL OR ip_hash ~ '^[a-f0-9]{64}$'),
  resultado     text NOT NULL
                CHECK (resultado IN ('en_curso', 'ok', 'error', 'denegado', 'limitado', 'invalido')),
  codigo        text CHECK (codigo IS NULL OR char_length(codigo) <= 60),
  entidad_id    text CHECK (entidad_id IS NULL OR char_length(entidad_id) <= 200),
  duracion_ms   integer CHECK (duracion_ms IS NULL OR duracion_ms >= 0)
);
CREATE INDEX IF NOT EXISTS idx_mcp_cliente_auditoria_en ON public.mcp_cliente_auditoria (en DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_cliente_auditoria_cliente
  ON public.mcp_cliente_auditoria (cliente_id, en DESC);

-- 3. Idempotencia de request_quote / request_contact --------------------------
CREATE TABLE IF NOT EXISTS public.mcp_cliente_idempotencia (
  cliente_id   uuid NOT NULL REFERENCES public.mcp_clientes(id) ON DELETE CASCADE,
  herramienta  text NOT NULL CHECK (char_length(herramienta) <= 80),
  clave        text NOT NULL CHECK (clave ~ '^[A-Za-z0-9_-]{16,128}$'),
  huella       text NOT NULL CHECK (huella ~ '^[a-f0-9]{64}$'),
  estado       text NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'completada')),
  respuesta    jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, herramienta, clave)
);

-- 4. Descargas de fichas (captación de interés por producto) ------------------
CREATE TABLE IF NOT EXISTS public.mcp_cliente_descargas (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id    uuid NOT NULL REFERENCES public.mcp_clientes(id) ON DELETE CASCADE,
  producto_id   uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  producto_slug text NOT NULL CHECK (char_length(producto_slug) <= 200),
  en            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_cliente_descargas_cliente
  ON public.mcp_cliente_descargas (cliente_id, en DESC);

-- RLS: deny-all salvo lectura de administración -------------------------------
ALTER TABLE public.mcp_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_cliente_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_cliente_idempotencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_cliente_descargas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.mcp_clientes, public.mcp_cliente_auditoria,
  public.mcp_cliente_idempotencia, public.mcp_cliente_descargas FROM anon, authenticated;
-- Lectura CMS por columnas: token_hash nunca sale del servidor.
GRANT SELECT (id, nombre, email, empresa, telefono, pais, agente, consentimiento_datos,
  consentimiento_at, created_at, expira_en, ultimo_uso_at, revocado_at, revocado_motivo)
  ON public.mcp_clientes TO authenticated;
GRANT SELECT ON public.mcp_cliente_auditoria, public.mcp_cliente_descargas TO authenticated;

DROP POLICY IF EXISTS mcp_clientes_admin_lectura ON public.mcp_clientes;
CREATE POLICY mcp_clientes_admin_lectura ON public.mcp_clientes
  FOR SELECT TO authenticated USING (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']));
DROP POLICY IF EXISTS mcp_cliente_auditoria_admin_lectura ON public.mcp_cliente_auditoria;
CREATE POLICY mcp_cliente_auditoria_admin_lectura ON public.mcp_cliente_auditoria
  FOR SELECT TO authenticated USING (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']));
DROP POLICY IF EXISTS mcp_cliente_descargas_admin_lectura ON public.mcp_cliente_descargas;
CREATE POLICY mcp_cliente_descargas_admin_lectura ON public.mcp_cliente_descargas
  FOR SELECT TO authenticated USING (is_admin(ARRAY['catalogo', 'operaciones', 'ventas']));

-- 5. Rate limit atómico con ventana de 60 s y tope diario --------------------
-- Reutiliza asesor_rate_limit (RLS deny-all). Prefijo `mcpc:` propio, de modo
-- que no comparte contadores con `mcp:` (operador) ni con el asesor.
CREATE OR REPLACE FUNCTION public.consume_mcp_cliente_rate_limit(
  p_keys text[],
  p_max_ventana integer,
  p_max_dia integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_ventana integer;
  v_dia integer;
  v_allowed boolean := true;
  v_now timestamptz := clock_timestamp();
  v_hoy date := (clock_timestamp() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF p_keys IS NULL OR cardinality(p_keys) NOT BETWEEN 1 AND 3
     OR p_max_ventana NOT BETWEEN 1 AND 600 OR p_max_dia NOT BETWEEN 1 AND 20000
     OR EXISTS (
       SELECT 1 FROM unnest(p_keys) AS k
       WHERE k IS NULL OR k !~ '^mcpc:(ip|cli|reg|ficha|esc):[a-f0-9]{64}$'
     ) THEN
    RAISE EXCEPTION 'Invalid rate limit arguments';
  END IF;
  FOR v_key IN SELECT DISTINCT k FROM unnest(p_keys) AS k ORDER BY k LOOP
    INSERT INTO public.asesor_rate_limit AS l
      (identificador, ventana_inicio, contador_ventana, dia, contador_dia, updated_at)
    VALUES (v_key, v_now, 1, v_hoy, 1, v_now)
    ON CONFLICT (identificador) DO UPDATE SET
      ventana_inicio = CASE WHEN l.ventana_inicio <= v_now - interval '60 seconds'
                            THEN v_now ELSE l.ventana_inicio END,
      contador_ventana = CASE WHEN l.ventana_inicio <= v_now - interval '60 seconds'
                              THEN 1 ELSE least(l.contador_ventana + 1, p_max_ventana + 1) END,
      contador_dia = CASE WHEN l.dia = v_hoy
                          THEN least(l.contador_dia + 1, p_max_dia + 1) ELSE 1 END,
      dia = v_hoy,
      updated_at = v_now
    RETURNING contador_ventana, contador_dia INTO v_ventana, v_dia;
    IF v_ventana > p_max_ventana OR v_dia > p_max_dia THEN v_allowed := false; END IF;
  END LOOP;
  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_mcp_cliente_rate_limit(text[], integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mcp_cliente_rate_limit(text[], integer, integer)
  TO service_role;

-- 6. Bucket PRIVADO para fichas entregadas por MCP ----------------------------
-- Copia bajo demanda de /assets/productos/fichas/** del sitio estático. Las
-- URLs públicas de las páginas de producto no cambian. Sin políticas de
-- storage: solo service_role sube y firma (URLs firmadas de 10 min).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fichas-clientes', 'fichas-clientes', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
