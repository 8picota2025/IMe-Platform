-- Impide que un JWT authenticated con rol distinto de owner escriba/escalé
-- admin_profiles.rol = 'owner' vía PostgREST (bypass del Edge Function admin-users).
-- service_role (Edge Functions) deja auth.uid() NULL y no aplica esta guarda;
-- admin-users enforce su propia jerarquía owner/admin.

CREATE OR REPLACE FUNCTION public.guard_admin_profiles_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_rol text;
  actor_activo boolean;
BEGIN
  -- Invocación sin JWT de usuario (service_role / migraciones): no restringir aquí.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ap.rol, ap.activo
    INTO actor_rol, actor_activo
  FROM public.admin_profiles ap
  WHERE ap.user_id = auth.uid();

  IF actor_rol = 'owner' AND actor_activo IS TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.rol = 'owner' THEN
      RAISE EXCEPTION 'solo_owner_puede_eliminar_perfil_owner'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.rol = 'owner' THEN
      RAISE EXCEPTION 'solo_owner_puede_asignar_rol_owner'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.rol = 'owner' OR NEW.rol = 'owner' THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.activo IS DISTINCT FROM OLD.activo
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'solo_owner_puede_modificar_perfil_owner'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_profiles_owner_role ON public.admin_profiles;
CREATE TRIGGER trg_guard_admin_profiles_owner_role
  BEFORE INSERT OR UPDATE OR DELETE ON public.admin_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_admin_profiles_owner_role();

COMMENT ON FUNCTION public.guard_admin_profiles_owner_role() IS
  'Bloquea escalada a owner / mutación de owners desde JWT no-owner. service_role (uid null) exento.';
