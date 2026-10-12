-- Perfil del asesor "Equipo Comercial I-ME" para las cotizaciones oficiales.
--
-- El asesor que aparece en el email y el PDF de una cotización sale de
-- admin_profiles (nombre, email, telefono). comercial1@i-me.com.co no tenía nombre,
-- así que el correo salía a nombre del email en crudo. Esta migración:
--   1. rellena el nombre solo si está vacío (no pisa un nombre ya editado);
--   2. rellena el teléfono solo si está vacío Y si se pasa por parámetro de sesión
--      `ime.comercial1_telefono` (no se hardcodea ningún número).
-- Si no se pasa el parámetro, el teléfono se edita desde /admin → Usuarios.
--
-- Ejemplo (SQL editor o psql):
--   SET ime.comercial1_telefono = '+57 300 000 0000';
--   -- ...y ejecutar este archivo.
--
-- Idempotente: si el usuario no existe o ya tiene datos, no cambia nada.

UPDATE public.admin_profiles
SET nombre = 'Equipo Comercial I-ME'
WHERE lower(email) = 'comercial1@i-me.com.co'
  AND (nombre IS NULL OR btrim(nombre) = '');

DO $$
DECLARE
  telefono_param text := nullif(btrim(coalesce(current_setting('ime.comercial1_telefono', true), '')), '');
BEGIN
  IF telefono_param IS NOT NULL THEN
    UPDATE public.admin_profiles
    SET telefono = telefono_param
    WHERE lower(email) = 'comercial1@i-me.com.co'
      AND (telefono IS NULL OR btrim(telefono) = '');
  END IF;
END
$$;
