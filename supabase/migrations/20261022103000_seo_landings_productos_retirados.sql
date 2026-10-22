-- Las campañas siguen en el CMS. Estos textos afirmaban modelos que ya
-- responden 410 (torres SonoScape, Biolight P15/P12, tercer equipo de
-- esterilización). El catálogo activo no los publica.

UPDATE public.landings AS landing
SET
  contenido_es = replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(landing.contenido_es::text,
                'Alternativas reales del catálogo (hoy: SonoScape 4K y FHD)',
                'Alternativas publicadas en el catálogo de quirófano, confirmadas por referencia'),
              'Torre de Laparoscopia 4K SonoScape SV-M4K120 y Torre FHD SonoScape X-2600. Le ayudamos a ver cuál encaja con su sala.',
              'Las referencias de torre que siguen publicadas están en el catálogo de quirófano. Confirmamos modelo y disponibilidad al cotizar.'),
            'Partimos del P15 publicado y definimos módulos obligatorios vs opcionales según protocolo.',
            'Partimos de las referencias Biolight publicadas y definimos módulos obligatorios vs opcionales según protocolo.'),
          'Referencias P15, S12, P12 y M12 del catálogo I-ME',
          'Referencias S12, M12 y PM-200M del catálogo I-ME'),
        'Sí. El P15 modular está publicado. Confirmamos configuración, módulos y disponibilidad al cotizar.',
        'El P15 modular no está en el catálogo activo. Publicamos S12, M12 y el PM-200M. Confirmamos configuración y disponibilidad al cotizar.'),
      'Depende del protocolo y criticidad. Lo evaluamos contra P15/P12 según parámetros y flujo del servicio.',
      'Depende del protocolo y la criticidad. Lo comparamos con las referencias Biolight publicadas, según parámetros y flujo del servicio.'),
    'Tres referencias para conversar con datos. Abra la ficha si quiere detalle; aquí decidimos por escenario de central.',
    'Referencias del catálogo para conversar con datos. Abra la ficha si quiere detalle; aquí decidimos por escenario de central.'
  )::jsonb,
  contenido_en = replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(landing.contenido_en::text,
                'Real catalog alternatives (today: SonoScape 4K and FHD)',
                'Published operating-room catalog alternatives, confirmed by reference'),
              '4K SonoScape SV-M4K120 and FHD SonoScape X-2600. We help you see which fits your room.',
              'Published tower references are in the operating-room catalog. We confirm model and availability when quoting.'),
            'We start from the published P15 and define mandatory vs optional modules by protocol.',
            'We start from the published Biolight references and define mandatory vs optional modules by protocol.'),
          'P15, S12, P12 and M12 references in the I-ME catalog',
          'S12, M12 and PM-200M references in the I-ME catalog'),
        'Yes. The modular P15 is published. We confirm configuration, modules and availability when quoting.',
        'The modular P15 is not in the active catalog. We publish the S12, the M12 and the PM-200M. We confirm configuration and availability when quoting.'),
      'It depends on protocol and criticality. We evaluate it against P15/P12 by parameters and workflow.',
      'It depends on protocol and criticality. We compare it with the published Biolight references, by parameters and workflow.'),
    'Three references to talk with data. Open the sheet for detail; here we decide by central scenario.',
    'Catalog references to talk with data. Open the sheet for detail; here we decide by central scenario.'
  )::jsonb,
  version = landing.version + 1,
  publicado_at = NOW()
WHERE landing.tipo = 'campana'
  AND landing.clave IN ('torres_laparoscopia', 'monitores_biolight', 'esterilizacion')
  AND (
    landing.contenido_es::text LIKE '%SonoScape SV-M4K120%'
    OR landing.contenido_es::text LIKE '%P15 modular está publicado%'
    OR landing.contenido_es::text LIKE '%Tres referencias para conversar%'
    OR landing.contenido_es::text LIKE '%P15, S12, P12 y M12%'
    OR landing.contenido_en::text LIKE '%SonoScape SV-M4K120%'
    OR landing.contenido_en::text LIKE '%modular P15 is published%'
    OR landing.contenido_en::text LIKE '%Three references to talk with data%'
    OR landing.contenido_en::text LIKE '%P15, S12, P12 and M12%'
  );

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'campana'
  AND clave IN ('torres_laparoscopia', 'monitores_biolight', 'esterilizacion')
ON CONFLICT (landing_id, version) DO NOTHING;
