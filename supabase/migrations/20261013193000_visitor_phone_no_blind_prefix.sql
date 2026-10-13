-- El teléfono de formularios públicos ya no recibe +57 a ciegas.
-- crm_normalize_phone se usa en los triggers de leads, cotizaciones y pedidos
-- ANTES de guardar la fila que luego sale en el correo a pedidos@.
--
-- Reglas (espejo de src/lib/visitor-phone.ts cuando no hay país extranjero):
--   * Si empieza por + o 00, se conserva ese indicativo.
--   * +57 solo si son 10 dígitos y empiezan por 3 (móvil CO), o si ya vienen
--     como 57 + ese móvil.
--   * Cualquier otro número se guarda tal cual, sin prefijo.
--
-- No modifica filas existentes. El indicativo elegido en el selector lo aplica
-- la Edge Function antes del INSERT; aquí solo se evita volver a anteponer 57.

CREATE OR REPLACE FUNCTION crm_normalize_phone(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  trimmed text := btrim(coalesce(value, ''));
  digits text;
BEGIN
  IF trimmed = '' THEN
    RETURN NULL;
  END IF;

  IF left(trimmed, 1) = '+' THEN
    digits := regexp_replace(trimmed, '[^0-9]', '', 'g');
    IF digits = '' THEN
      RETURN NULL;
    END IF;
    RETURN '+' || digits;
  END IF;

  IF trimmed ~ '^00' THEN
    digits := regexp_replace(trimmed, '[^0-9]', '', 'g');
    IF left(digits, 2) = '00' THEN
      digits := substring(digits FROM 3);
    END IF;
    IF digits = '' THEN
      RETURN NULL;
    END IF;
    RETURN '+' || digits;
  END IF;

  digits := regexp_replace(trimmed, '[^0-9]', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;

  IF char_length(digits) = 12 AND left(digits, 2) = '57' AND substring(digits FROM 3 FOR 1) = '3' THEN
    RETURN '+' || digits;
  END IF;

  IF char_length(digits) = 10 AND left(digits, 1) = '3' THEN
    RETURN '+57' || digits;
  END IF;

  RETURN digits;
END;
$$;
