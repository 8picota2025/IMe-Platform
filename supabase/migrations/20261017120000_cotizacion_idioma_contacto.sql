-- Contacto del cliente e idioma de salida de la cotización.
-- ciudad / pais se imprimen en el bloque del cliente.
-- idioma: es = solo castellano (COP nacional); es-en = castellano e inglés (INTL / USD).
-- condiciones_en y condicion_pago_en son la versión en inglés que escribe el usuario.
-- NULL en esas dos columnas: la salida bilingüe conserva el texto en castellano
-- (la condición de pago vacía se imprime como Contado / Prepaid).

ALTER TABLE solicitudes_cotizacion
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT,
  ADD COLUMN IF NOT EXISTS idioma TEXT,
  ADD COLUMN IF NOT EXISTS condiciones_en TEXT,
  ADD COLUMN IF NOT EXISTS condicion_pago_en TEXT;

ALTER TABLE solicitudes_cotizacion
  DROP CONSTRAINT IF EXISTS solicitudes_cotizacion_idioma_check;

ALTER TABLE solicitudes_cotizacion
  ADD CONSTRAINT solicitudes_cotizacion_idioma_check
  CHECK (idioma IS NULL OR idioma IN ('es', 'es-en'));

COMMENT ON COLUMN solicitudes_cotizacion.idioma IS
  'Idioma de salida. es = solo castellano (COP nacional). es-en = castellano e inglés (INTL/USD). NULL se resuelve al leer.';
COMMENT ON COLUMN solicitudes_cotizacion.condiciones_en IS
  'Condiciones libres en inglés. NULL: la oferta bilingüe muestra el texto en castellano.';
COMMENT ON COLUMN solicitudes_cotizacion.condicion_pago_en IS
  'Condición de pago en inglés. NULL = Prepaid en la salida bilingüe.';
COMMENT ON COLUMN solicitudes_cotizacion.ciudad IS
  'Ciudad del cliente. No rellenar con datos de I-ME.';
COMMENT ON COLUMN solicitudes_cotizacion.pais IS
  'País del cliente. No rellenar con datos de I-ME.';
