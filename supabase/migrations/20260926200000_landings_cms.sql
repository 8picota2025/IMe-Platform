-- Fase 3B, tanda 0 (ADR-0015, docs/growth-engine/fase3b-plan.md): landings editables en el CMS.
--
-- - landings: versión publicada (la lee la build con la clave anónima).
-- - landings_borradores: edición en curso desde el admin (sólo roles del blog).
-- - landings_historial: cada versión publicada, para volver atrás.
-- Se publica sólo con publicar_landing(): copia el borrador, sube la versión y la guarda en el
-- historial en una transacción. La forma del contenido la valida la build (landings-cms.ts).

CREATE TABLE IF NOT EXISTS public.landings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('campana', 'fabricante', 'ciudad', 'familia')),
  clave         TEXT NOT NULL CHECK (clave ~ '^[a-z0-9_-]{2,80}$'),
  contenido_es  JSONB NOT NULL CHECK (jsonb_typeof(contenido_es) = 'object'),
  contenido_en  JSONB NOT NULL CHECK (jsonb_typeof(contenido_en) = 'object'),
  version       INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  publicado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, clave)
);

CREATE TABLE IF NOT EXISTS public.landings_borradores (
  landing_id      UUID PRIMARY KEY REFERENCES public.landings(id) ON DELETE CASCADE,
  contenido_es    JSONB NOT NULL CHECK (jsonb_typeof(contenido_es) = 'object'),
  contenido_en    JSONB NOT NULL CHECK (jsonb_typeof(contenido_en) = 'object'),
  actualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.landings_historial (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  landing_id    UUID NOT NULL REFERENCES public.landings(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  contenido_es  JSONB NOT NULL,
  contenido_en  JSONB NOT NULL,
  publicado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publicado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (landing_id, version)
);

ALTER TABLE public.landings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landings_borradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landings_historial ENABLE ROW LEVEL SECURITY;

-- Lo publicado es público (la build usa la clave anónima). Sin políticas de escritura: sólo
-- se escribe con publicar_landing().
DROP POLICY IF EXISTS "landings_select_public" ON public.landings;
CREATE POLICY "landings_select_public"
  ON public.landings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Mismos roles que el blog (20260816033000): catalogo y ventas; owner y admin vía is_admin.
DROP POLICY IF EXISTS "landings_borradores_admin_all" ON public.landings_borradores;
CREATE POLICY "landings_borradores_admin_all"
  ON public.landings_borradores FOR ALL
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'ventas']))
  WITH CHECK (is_admin(ARRAY['catalogo', 'ventas']));

DROP POLICY IF EXISTS "landings_historial_admin_select" ON public.landings_historial;
CREATE POLICY "landings_historial_admin_select"
  ON public.landings_historial FOR SELECT
  TO authenticated
  USING (is_admin(ARRAY['catalogo', 'ventas']));

CREATE OR REPLACE FUNCTION public.publicar_landing(p_landing_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrador public.landings_borradores%ROWTYPE;
  v_version  INTEGER;
BEGIN
  IF NOT COALESCE(is_admin(ARRAY['catalogo', 'ventas']), false) THEN
    RAISE EXCEPTION 'Sin permiso para publicar landings' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_borrador
  FROM public.landings_borradores
  WHERE landing_id = p_landing_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La landing no tiene borrador que publicar' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.landings
  SET contenido_es = v_borrador.contenido_es,
      contenido_en = v_borrador.contenido_en,
      version = version + 1,
      publicado_por = (SELECT auth.uid()),
      publicado_at = NOW()
  WHERE id = p_landing_id
  RETURNING version INTO v_version;

  INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en, publicado_por)
  VALUES (p_landing_id, v_version, v_borrador.contenido_es, v_borrador.contenido_en, (SELECT auth.uid()));

  DELETE FROM public.landings_borradores WHERE landing_id = p_landing_id;
  RETURN v_version;
END;
$$;

-- Copia una versión del historial al borrador; se revisa en el admin y se publica como nueva versión.
CREATE OR REPLACE FUNCTION public.restaurar_version_landing(p_landing_id UUID, p_version INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(is_admin(ARRAY['catalogo', 'ventas']), false) THEN
    RAISE EXCEPTION 'Sin permiso para editar landings' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.landings_borradores (landing_id, contenido_es, contenido_en, actualizado_por, updated_at)
  SELECT landing_id, contenido_es, contenido_en, (SELECT auth.uid()), NOW()
  FROM public.landings_historial
  WHERE landing_id = p_landing_id AND version = p_version
  ON CONFLICT (landing_id) DO UPDATE
    SET contenido_es = EXCLUDED.contenido_es,
        contenido_en = EXCLUDED.contenido_en,
        actualizado_por = EXCLUDED.actualizado_por,
        updated_at = EXCLUDED.updated_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versión % no encontrada', p_version USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.publicar_landing(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restaurar_version_landing(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_landing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurar_version_landing(UUID, INTEGER) TO authenticated;
