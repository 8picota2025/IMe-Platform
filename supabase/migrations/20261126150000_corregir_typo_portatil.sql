-- Typo de catálogo: «Pórtatil» → «Portátil».
-- No cambia slugs, precios ni disponibilidad. Los NULL siguen NULL.
-- El HTML también corrige el texto al mapear el producto, por si esta
-- migración aún no corrió en el build.

UPDATE public.productos
SET
  nombre_es = replace(nombre_es, 'Pórtatil', 'Portátil'),
  nombre_en = CASE
    WHEN nombre_en IS NULL THEN NULL
    ELSE replace(nombre_en, 'Pórtatil', 'Portátil')
  END,
  descripcion_corta_es = CASE
    WHEN descripcion_corta_es IS NULL THEN NULL
    ELSE replace(descripcion_corta_es, 'Pórtatil', 'Portátil')
  END,
  descripcion_corta_en = CASE
    WHEN descripcion_corta_en IS NULL THEN NULL
    ELSE replace(descripcion_corta_en, 'Pórtatil', 'Portátil')
  END,
  descripcion_larga_es = CASE
    WHEN descripcion_larga_es IS NULL THEN NULL
    ELSE replace(descripcion_larga_es, 'Pórtatil', 'Portátil')
  END,
  descripcion_larga_en = CASE
    WHEN descripcion_larga_en IS NULL THEN NULL
    ELSE replace(descripcion_larga_en, 'Pórtatil', 'Portátil')
  END,
  atributos = CASE
    WHEN atributos IS NULL THEN NULL
    ELSE replace(atributos::text, 'Pórtatil', 'Portátil')::jsonb
  END
WHERE
  nombre_es LIKE '%Pórtatil%'
  OR COALESCE(nombre_en, '') LIKE '%Pórtatil%'
  OR COALESCE(descripcion_corta_es, '') LIKE '%Pórtatil%'
  OR COALESCE(descripcion_corta_en, '') LIKE '%Pórtatil%'
  OR COALESCE(descripcion_larga_es, '') LIKE '%Pórtatil%'
  OR COALESCE(descripcion_larga_en, '') LIKE '%Pórtatil%'
  OR COALESCE(atributos::text, '') LIKE '%Pórtatil%';
