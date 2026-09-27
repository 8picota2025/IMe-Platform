-- Fase 2 (Knowledge Hub): corrige enlaces internos rotos en dos artículos
-- publicados. Apuntaban a slugs de producto anteriores al renombrado con
-- "-ref-" (PR #114). Mientras el renderizador imprimía los enlaces internos
-- como texto no se detectaban; al convertirlos en enlaces reales, la auditoría
-- SEO del build los marcó como destinos inexistentes.
--
-- Aplicado ya en producción el 2026-09-24 (el build del CI lee los artículos
-- de producción y no podía pasar hasta corregirlos); esta migración deja
-- constancia y es idempotente: si las cadenas viejas ya no están, no cambia
-- nada.

UPDATE articulos
SET cuerpo_es = replace(replace(replace(cuerpo_es,
      '(/es/productos/g-kp1-8160l/)', '(/es/productos/caminador-desarmable-en-aluminio-ref-kp1-8160l-konfort-plus/)'),
      '(/es/productos/autoclave-horizontal-5075)', '(/es/productos/autoclave-horizontal-ref-5075-tuttnauer/)'),
      '(/es/productos/t-max-6)', '(/es/productos/autoclave-ref-t-max-6-tuttnauer/)'),
    cuerpo_en = replace(replace(replace(cuerpo_en,
      '(/en/products/g-kp1-8160l/)', '(/en/products/caminador-desarmable-en-aluminio-ref-kp1-8160l-konfort-plus/)'),
      '(/en/products/autoclave-horizontal-5075)', '(/en/products/autoclave-horizontal-ref-5075-tuttnauer/)'),
      '(/en/products/t-max-6)', '(/en/products/autoclave-ref-t-max-6-tuttnauer/)')
WHERE slug IN ('caminadores-para-adultos-guia-compra-colombia', 'guia-autoclave-central-esterilizacion-colombia');
