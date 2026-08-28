-- SKR-R10 es un carro clínico Saikang, no un monitor. Corrección detectada al
-- validar el índice público completo después de la primera migración.
UPDATE productos AS product
SET familia_id = family.id,
    tipo_id = NULL,
    updated_at = now()
FROM familias AS family
WHERE product.slug = 'carro-clinico-ref-skr-r10-saikang'
  AND family.slug = 'mobiliario'
  AND product.familia_id IS DISTINCT FROM family.id;
