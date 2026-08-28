-- Nueve ventiladores oficiales estaban sin familia resoluble en el índice.
WITH ventilators(product_slug) AS (
  VALUES
    ('ventilador-neonatal-pedriatrico-convencional-ref-6000-sle'),
    ('ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-teo-air-liquide'),
    ('ventilador-neonatal-pediatrico-alta-frecuencia-plus-convencional-ref-6000-sle'),
    ('ventilador-mecanico-neonatal-pediatrico-adulto-ref-tv-100-bio-med'),
    ('ventilador-neonatal-no-invasivo-ref-nc3-medin'),
    ('ventilador-mecanico-de-transporte-monnal-ref-t60-advanced-air-liquide'),
    ('ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide'),
    ('ventilador-mecanico-de-transporte-monnal-ref-t60-air-liquide'),
    ('ventilador-mecanico-uci-adulto-pediatrico')
)
UPDATE productos AS product
SET familia_id = family.id,
    tipo_id = NULL,
    updated_at = now()
FROM ventilators AS candidate
JOIN familias AS family ON family.slug = 'ventiladores'
WHERE product.slug = candidate.product_slug
  AND product.familia_id IS DISTINCT FROM family.id;
