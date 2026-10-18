-- Set marca on high-confidence previously unbranded Advanced products
-- Safe jsonb merge; idempotent

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'monitor-multiparametrico-uci-avanzado';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'monitor-multiparametrico-basico';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'monitor-de-transporte-prehospitalario';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'monitor-central-uci-multicama';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'electrocardiografo-12-derivaciones-digital';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'mesa-quirurgica-motorizada-multiposicion';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'incubadora-neonatal-de-transporte';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'cuna-de-calor-radiante-neonatal-servo';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'ecografo-color-doppler-diagnostico-vascular';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'ecografo-portatil-con-wifi-y-dicom';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'ultrasonido-point-of-care-pocket';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'bomba-de-infusion-volumetrica-uci';

UPDATE public.productos SET atributos = COALESCE(atributos, '{}'::jsonb) || '{"marca":"Advanced Instrumentations"}'::jsonb WHERE slug = 'camilla-hospitalaria-electrica-articulable';

