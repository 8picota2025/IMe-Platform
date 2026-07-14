-- Agregar campo imagen a tabla articulos
-- Permite almacenar la URL de la imagen principal de cada artículo

ALTER TABLE articulos ADD COLUMN IF NOT EXISTS imagen TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN articulos.imagen IS 'URL de la imagen principal del artículo (almacenada en Supabase Storage)';
