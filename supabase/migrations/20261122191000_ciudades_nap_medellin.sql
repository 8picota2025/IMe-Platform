-- NAP del RUT: CR 43 A 1 50, Medellín. Sustituye Envigado en las landings de ciudad.

-- clave = 'bogota'
UPDATE public.landings
   SET contenido_es = $ime_landing${"name":"Bogotá","region":"Cundinamarca","title":"Equipos biomédicos en Bogotá | Venta y soporte I-ME","description":"Equipos biomédicos para hospitales y clínicas en Bogotá. Cotización, soporte técnico y financiamiento con I-ME — cobertura nacional desde Medellín.","h1":"Equipos biomédicos para instituciones en Bogotá","lead":"I-ME acompaña a hospitales, clínicas y centros de salud en Bogotá con catálogo certificado, asesoría de tipología y soporte. Sede operativa en Medellín (Antioquia); atención comercial y técnica a nivel nacional.","body":["En Bogotá el volumen de proyectos suele concentrarse en UCI, quirófano, imagen y terapia IV. Ayudamos a priorizar tipologías antes de pedir referencias para no mezclar compras.","La cotización incluye condiciones comerciales, alcance de instalación cuando aplica y canal de soporte. No operamos una sucursal pública inventada en Bogotá: coordinamos visitas y logística desde la red I-ME.","También orientamos financiamiento institucional cuando el proyecto lo requiere — simulador indicativo en el sitio; tasas finales en cotización formal."]}$ime_landing$::jsonb,
       contenido_en = $ime_landing${"name":"Bogotá","region":"Cundinamarca","title":"Biomedical equipment in Bogotá | Sales and support I-ME","description":"Biomedical equipment for hospitals and clinics in Bogotá. Quotes, technical support and financing with I-ME — national coverage from Medellín.","h1":"Biomedical equipment for institutions in Bogotá","lead":"I-ME supports hospitals, clinics and care centers in Bogotá with a certified catalog, typology advisory and support. Operating HQ in Medellín (Antioquia); commercial and technical reach nationwide.","body":["In Bogotá projects often cluster around ICU, OR, imaging and IV therapy. We prioritize typologies before SKUs so purchases stay coherent.","Quotes include commercial terms, installation scope when applicable and a support channel. We do not invent a public Bogotá branch — visits and logistics are coordinated through the I-ME network.","We also guide institutional financing when needed — on-site simulator is indicative; final rates appear in the formal quote."]}$ime_landing$::jsonb,
       version = version + 1,
       publicado_at = NOW()
 WHERE tipo = 'ciudad' AND clave = 'bogota';

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'ciudad' AND clave = 'bogota'
ON CONFLICT (landing_id, version) DO NOTHING;


-- clave = 'medellin'
UPDATE public.landings
   SET contenido_es = $ime_landing${"name":"Medellín","region":"Antioquia","title":"Equipos biomédicos en Medellín y Antioquia | I-ME","description":"Equipos biomédicos para Medellín y Antioquia. I-ME en Medellín: catálogo, soporte técnico y financiamiento para hospitales y clínicas.","h1":"Equipos biomédicos en Medellín y el Valle de Aburrá","lead":"Con sede en Medellín, I-ME atiende instituciones del Valle de Aburrá y Antioquia con cercanía operativa: catálogo biomédico, instalación acordada y soporte técnico.","body":["Para Medellín priorizamos tiempos de respuesta en soporte y claridad de tipología (monitores, anestesia, neonatología, esterilización y equipos de ultrasonido).","Puede visitarnos o coordinar asesoría remota; el NAP oficial es CR 43 A 1 50, Medellín, Antioquia — +57 313 724 7353 — info@i-me.com.co."]}$ime_landing$::jsonb,
       contenido_en = $ime_landing${"name":"Medellín","region":"Antioquia","title":"Biomedical equipment in Medellín and Antioquia | I-ME","description":"Biomedical equipment for Medellín and Antioquia. I-ME in Medellín: catalog, technical support and financing for hospitals and clinics.","h1":"Biomedical equipment in Medellín and the Aburrá Valley","lead":"Based in Medellín, I-ME serves Aburrá Valley and Antioquia institutions with operational proximity: biomedical catalog, agreed installation and technical support.","body":["For Medellín we prioritize support response and clear typology (monitors, anesthesia, neonatology, sterilization and ultrasound equipment).","Visit or book remote advisory; official NAP is CR 43 A 1 50, Medellín, Antioquia — +57 313 724 7353 — info@i-me.com.co."]}$ime_landing$::jsonb,
       version = version + 1,
       publicado_at = NOW()
 WHERE tipo = 'ciudad' AND clave = 'medellin';

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'ciudad' AND clave = 'medellin'
ON CONFLICT (landing_id, version) DO NOTHING;


-- clave = 'cali'
UPDATE public.landings
   SET contenido_es = $ime_landing${"name":"Cali","region":"Valle del Cauca","title":"Equipos biomédicos en Cali | Venta y soporte I-ME","description":"Equipos biomédicos para hospitales y clínicas en Cali y el Valle. Cotización y soporte I-ME con cobertura nacional.","h1":"Equipos biomédicos para instituciones en Cali","lead":"I-ME acompaña proyectos biomédicos en Cali: desde monitores y cardiología hasta quirófano y terapia IV. Operación nacional con sede en Medellín.","body":["Definimos tipología con biomédica y compras antes de cotizar referencias. Así se reduce reproceso y se alinea soporte postventa.","No publicamos una dirección inventada en Cali: la logística y visitas se coordinan según el proyecto desde la red I-ME."]}$ime_landing$::jsonb,
       contenido_en = $ime_landing${"name":"Cali","region":"Valle del Cauca","title":"Biomedical equipment in Cali | Sales and support I-ME","description":"Biomedical equipment for hospitals and clinics in Cali and Valle. I-ME quotes and support with national coverage.","h1":"Biomedical equipment for institutions in Cali","lead":"I-ME supports biomedical projects in Cali: from monitors and cardiology to OR and IV therapy. National operations with HQ in Medellín.","body":["We define typology with biomed and procurement before quoting SKUs. That cuts rework and aligns after-sales support.","We do not publish an invented Cali address: logistics and visits are coordinated per project through the I-ME network."]}$ime_landing$::jsonb,
       version = version + 1,
       publicado_at = NOW()
 WHERE tipo = 'ciudad' AND clave = 'cali';

INSERT INTO public.landings_historial (landing_id, version, contenido_es, contenido_en)
SELECT id, version, contenido_es, contenido_en
FROM public.landings
WHERE tipo = 'ciudad' AND clave = 'cali'
ON CONFLICT (landing_id, version) DO NOTHING;
