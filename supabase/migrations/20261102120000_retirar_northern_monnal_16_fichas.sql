-- Retira las 16 fichas Northern Meditec y Monnal (Air Liquide) del catálogo (arreglos011126, ítem 6).
--
-- Se usa activo = false (no DELETE): siete tablas referencian productos(id) ON DELETE CASCADE
-- (reservas de stock, auditoría, ítems de pedido…); borrar arrastraría historial comercial.
-- src/lib/datos.ts filtra por activo, así que las fichas salen del build, del sitemap y del
-- catálogo, y la operación es reversible (UPDATE ... SET activo = true).
--
-- Redirecciones 301 a la categoría de ventiladores en public/.htaccess (ES y EN), desplegadas
-- con este PR. NO aplicar a producción sin OK explícito.
--
-- Ejecutar tras el OK:  supabase db push  (o el workflow manual de migraciones).

DO $$
DECLARE
  objetivos text[] := ARRAY[
    -- Northern Meditec (12)
    'maquina-de-anestesia-ref-atlas-n3-northern',
    'maquina-de-anestesia-ref-atlas-n5-northern',
    'maquina-de-anestesia-ref-atlas-n7-northern',
    'monitor-fetal-y-materno-ref-fm-9000-northern',
    'monitor-modular-multiparametro-ref-virgo-northern',
    'monitor-multiparametro-ref-acuarius-northern',
    'monitor-multiparametro-ref-gemini-northern',
    'monitor-multiparametro-ref-pisces-northern',
    'monitor-multiparametro-ref-taurus-northern',
    'monitor-multiparametro-ref-venus-northern',
    'oximetro-ref-aquarius-lite-northern',
    'ventilador-mecanico-ref-crius-v6-northern',
    -- Monnal / Air Liquide (4)
    'ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide',
    'ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-teo-air-liquide',
    'ventilador-mecanico-de-transporte-monnal-ref-t60-advanced-air-liquide',
    'ventilador-mecanico-de-transporte-monnal-ref-t60-air-liquide'
  ];
  encontrados integer;
BEGIN
  SELECT count(*) INTO encontrados FROM productos WHERE slug = ANY (objetivos);
  IF encontrados <> 16 THEN
    RAISE EXCEPTION 'Se esperaban 16 fichas Northern/Monnal y se encontraron %', encontrados;
  END IF;

  UPDATE productos
     SET activo = false,
         updated_at = now()
   WHERE slug = ANY (objetivos);
END $$;
