-- Correcciones conservadoras de familia: solo referencias cuya denominación y
-- descripción oficial contradicen inequívocamente la familia almacenada.
WITH corrections(product_slug, family_slug) AS (
  VALUES
    ('lampara-cielitica-led-x36', 'sala-cirugia'),
    ('lampara-cielitica-led-x3618-con-satelite', 'sala-cirugia'),
    ('lampara-cielitica-led-x3636-con-satelite', 'sala-cirugia'),
    ('led-x18-100k', 'sala-cirugia'),
    ('ventilador-mecanico-crius-v6', 'ventiladores'),
    ('ventilador-para-uci-v-1000', 'ventiladores'),
    ('monitor-modular-multiparametro-virgo', 'monitores'),
    ('monitor-multiparametrico-basico', 'monitores'),
    ('monitor-multiparametrico-uci-avanzado', 'monitores'),
    ('monitor-multiparametro-acuarius', 'monitores'),
    ('monitor-multiparametro-gemini', 'monitores'),
    ('monitor-multiparametro-pisces', 'monitores'),
    ('monitor-multiparametro-taurus', 'monitores'),
    ('monitor-multiparametro-venus', 'monitores'),
    ('electrocardiografo-ref-sk-em103-saikang', 'cardiologia'),
    ('monitor-de-paciente-ref-sk-em005-saikang', 'monitores'),
    ('monitor-fetal-ref-sk-em006-saikang', 'neonatologia'),
    ('mesa-quirurgica-electrica-ref-skl-c-saikang', 'sala-cirugia'),
    ('mesa-quirurgica-electrica-ref-skl-d-saikang', 'sala-cirugia'),
    ('g-des-kbe1462ff-m23-d', 'insumos-accesorios'),
    ('g-desde-kbe1462ff-m23-d', 'insumos-accesorios'),
    ('g-kbe1432rf-mp23l-llt', 'insumos-accesorios'),
    ('g-kbe1462-fr', 'insumos-accesorios'),
    ('g-kbe1462ff-m23d-a', 'insumos-accesorios'),
    ('g-kbe1462ff-m23d-rp', 'insumos-accesorios'),
    ('g-kbe1462re-p23l-rp', 'insumos-accesorios'),
    ('g-kbo1432rf-mp23-fr', 'insumos-accesorios'),
    ('g-kbo1432rf-mp23-rp', 'insumos-accesorios'),
    ('g-srels-lt', 'insumos-accesorios'),
    ('g-srels-pad', 'insumos-accesorios'),
    ('g-srels-rpe', 'insumos-accesorios'),
    ('g-srels-rpr', 'insumos-accesorios'),
    ('skb-1a-skb2a10', 'emergencias-traslado-inmovilizacion'),
    ('skb-2a-skb2a11', 'emergencias-traslado-inmovilizacion'),
    ('skb-4a-skb2a12', 'emergencias-traslado-inmovilizacion')
)
UPDATE productos AS product
SET familia_id = family.id,
    tipo_id = NULL,
    updated_at = now()
FROM corrections AS correction
JOIN familias AS family ON family.slug = correction.family_slug
WHERE product.slug = correction.product_slug
  AND product.familia_id IS DISTINCT FROM family.id;
