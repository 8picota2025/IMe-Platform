/**
 * Landing comercial: acompañamiento INVIMA para fabricantes (ES/EN).
 * Copy prudente: no promete aprobación, plazos ni ROI. Distingue asesoría de autoridad.
 */
import type { Locale } from '../i18n/utils';

export const INVIMA_FABRICANTES_CAMPAIGN = 'invima_fabricantes' as const;
export const INVIMA_FABRICANTES_FAMILIA = 'invima-regulacion';

export const INVIMA_FABRICANTES_PATHS = {
  es: '/es/registro-sanitario-invima-fabricantes/',
  en: '/en/medical-device-registration-colombia/',
} as const;

export interface InvimaFaq {
  q: string;
  a: string;
}

export interface InvimaDocRow {
  item: string;
  note: string;
}

export interface InvimaFabricantesCopy {
  tag: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  primaryCta: string;
  secondaryCta: string;
  formTitle: string;
  formIntro: string;
  problemTitle: string;
  problemBody: string;
  barriers: { title: string; body: string }[];
  offerTitle: string;
  offerIntro: string;
  offerItems: string[];
  offerLimitsTitle: string;
  offerLimits: string[];
  processTitle: string;
  processSteps: { title: string; body: string }[];
  audienceTitle: string;
  audienceYes: string[];
  audienceNo: string[];
  advantagesTitle: string;
  advantages: string[];
  docsTitle: string;
  docsIntro: string;
  docs: InvimaDocRow[];
  costsTitle: string;
  costsBody: string;
  trustTitle: string;
  trustBody: string;
  faqTitle: string;
  faqs: InvimaFaq[];
  bottomTitle: string;
  bottomBody: string;
  relatedTitle: string;
  relatedGuides: { title: string; href: string }[];
  officialTitle: string;
  officialLinks: { label: string; href: string }[];
  disclaimer: string;
  heroImage: string;
  heroImageAlt: string;
  projectOptions: { value: string; label: string }[];
}

const ES: InvimaFabricantesCopy = {
  tag: 'Fabricantes · INVIMA',
  title: 'Registro sanitario INVIMA para fabricantes de dispositivos médicos | I-ME',
  description:
    'Acompañamiento para fabricantes extranjeros que evalúan el registro sanitario INVIMA y el acceso regulatorio a Colombia. Solicite evaluación de su producto.',
  h1: 'Registro sanitario INVIMA para fabricantes de dispositivos médicos',
  lead: 'Si fabrica dispositivos médicos o equipos biomédicos fuera de Colombia y necesita determinar la ruta regulatoria, preparar el expediente y coordinar actores locales, I-ME le ayuda a reducir fricción y avanzar con claridad — sin confundir asesoría con la decisión de INVIMA.',
  primaryCta: 'Solicitar evaluación de mi producto',
  secondaryCta: 'Cotizar acompañamiento INVIMA',
  formTitle: 'Cuéntenos su producto y su objetivo de mercado',
  formIntro:
    'Indique empresa, país, fabricante, tipo de producto y número aproximado de referencias. Un asesor le responde con alcance y siguiente paso — no con un checklist genérico.',
  problemTitle: 'Entrar a Colombia implica más que «obtener un certificado»',
  problemBody:
    'En búsquedas aparece «certificación INVIMA», pero el acto aplicable suele ser un registro sanitario, un registro sanitario automático o un permiso de comercialización, según clasificación y tipo de tecnología. Un fabricante extranjero casi siempre necesita alinear titularidad, importador, autorización del fabricante y documentación legalizada — y eso cambia caso a caso.',
  barriers: [
    {
      title: 'Clasificación y ruta poco claras',
      body: 'Clases I, IIa, IIb y III, y la distinción entre dispositivo médico y equipo biomédico de tecnología controlada, definen requisitos y tipo de acto. Una plantilla única suele fallar.',
    },
    {
      title: 'Roles locales incompletos',
      body: 'Titular, importador y autorización del fabricante deben cuadrar con el marco vigente. Presuponer que la matriz extranjera actúa sola como importador o titular sin evaluar el caso genera reprocesos.',
    },
    {
      title: 'Expediente y tiempos variables',
      body: 'CVL, pruebas de existencia, traducciones, calidad y evidencia clínica (cuando aplica) condicionan la preparación. Los plazos oficiales orientativos no son una promesa de aprobación ni de calendario fijo.',
    },
  ],
  offerTitle: 'Qué ofrece I-ME en el acompañamiento INVIMA',
  offerIntro:
    'Acompañamos proyectos de tecnología biomédica en Colombia con foco en claridad de requisitos, coordinación y preparación. El alcance se confirma tras una evaluación inicial de su producto.',
  offerItems: [
    'Diagnóstico de viabilidad y ruta regulatoria aplicable (orientativa, sujeta a clasificación y normativa vigente).',
    'Revisión de documentación disponible y brechas frente a requisitos típicos del trámite.',
    'Apoyo en la preparación del expediente y coordinación con fabricante, titular e importador habilitado cuando corresponda.',
    'Seguimiento del trámite y orientación ante requerimientos o subsanaciones, dentro del alcance acordado.',
    'Soporte posterior y enlace con capacidades comerciales/distribución de I-ME cuando el proyecto lo requiera y exista servicio real.',
  ],
  offerLimitsTitle: 'Límites claros (importante)',
  offerLimits: [
    'I-ME no es INVIMA ni un organismo certificador; no garantiza aprobación, plazos ni resultados regulatorios.',
    'La decisión, las tarifas oficiales y los actos administrativos corresponden a la autoridad sanitaria.',
    'No todos los productos siguen el mismo registro o permiso; la ruta se confirma por producto.',
  ],
  processTitle: 'Proceso paso a paso',
  processSteps: [
    {
      title: '1. Diagnóstico inicial',
      body: 'Revisamos marca, modelo, uso previsto, país de fabricación, documentos disponibles y objetivo de lanzamiento.',
    },
    {
      title: '2. Clasificación y ruta',
      body: 'Ordenamos la hipótesis de clase/tipo de acto y los actores locales necesarios, con referencias a fuentes oficiales.',
    },
    {
      title: '3. Revisión documental',
      body: 'Identificamos faltantes, traducciones/legalizaciones y evidencia técnica o clínica cuando aplique.',
    },
    {
      title: '4. Preparación y presentación',
      body: 'Coordinamos la preparación del expediente y la radicación mediante el actor habilitado que corresponda a su caso.',
    },
    {
      title: '5. Seguimiento y soporte',
      body: 'Acompañamos requerimientos, cambios y, si aplica, la transición a comercialización o distribución.',
    },
  ],
  audienceTitle: 'Para quién es esta página',
  audienceYes: [
    'Fabricantes internacionales o marcas OEM que evalúan entrar a Colombia.',
    'Empresas con catálogo sin registrar o con referencias nuevas a habilitar.',
    'Equipos de asuntos regulatorios o comerciales que necesitan un aliado local coordinado.',
    'Fabricantes que ya tienen importador o buscan alinear representación y titularidad.',
  ],
  audienceNo: [
    'Quien busca que I-ME actúe como INVIMA o «garantice» la aprobación.',
    'Compras hospitalarias de equipos ya registrados (use el catálogo o cotización de producto).',
    'Trámites de reactivos IVD u otros regímenes no cubiertos en esta página sin evaluación previa.',
  ],
  advantagesTitle: 'Ventajas verificables de trabajar con I-ME',
  advantages: [
    'Presencia operativa en Colombia y experiencia con tecnología biomédica en el mercado local.',
    'Coordinación entre requisitos regulatorios y realidad de importación/distribución.',
    'Enlace a guías del Centro de Conocimiento y a fuentes oficiales INVIMA, sin sustituirlas.',
    'Canal comercial y de cotización ya operativo en i-me.com.co para continuar el proyecto.',
  ],
  docsTitle: 'Documentos habituales (orientativos)',
  docsIntro:
    'La lista varía por producto, clase, modalidad (importar/comercializar) y si aplica permiso de comercialización. No sustituye el checklist oficial ni el formulario vigente de INVIMA.',
  docs: [
    {
      item: 'Formulario y pago de tarifa INVIMA',
      note: 'Según el trámite y el tarifario oficial vigente.',
    },
    {
      item: 'Prueba de existencia / representación',
      note: 'Titular, fabricante e importador; documentos extranjeros según reglas de legalización/apostilla.',
    },
    {
      item: 'Autorización del fabricante',
      note: 'Para que un establecimiento en Colombia importe/comercialice y, según el caso, figure como titular.',
    },
    {
      item: 'Certificado de venta libre (CVL) u equivalente',
      note: 'Para importados; no confundir con un simple certificado de exportación.',
    },
    {
      item: 'Dossier técnico y etiquetado',
      note: 'Información técnica, artes e insertos; comercio en español cuando aplique.',
    },
    {
      item: 'CCAA del importador (si almacena/acondiciona)',
      note: 'Habilitación paralela del importador; no sustituye el registro o permiso del producto.',
    },
  ],
  costsTitle: 'Plazos, costes y viabilidad',
  costsBody:
    'Los costes combinan tarifas oficiales INVIMA, preparación documental, traducciones, ensayos cuando apliquen, acompañamiento profesional y tiempo interno. Los plazos publicados (p. ej. orientativos para RSA o evaluación previa) asumen expediente completo y no garantizan aprobación. Cotizamos alcance y presupuesto de acompañamiento de forma individualizada tras la evaluación.',
  trustTitle: 'Confianza sin inventar resultados',
  trustBody:
    'No publicamos aquí cifras de «éxito», años de experiencia no verificados ni casos de clientes sin autorización. Si necesita referencias o un alcance contractual concreto, solicítelo en la evaluación: solo compartimos lo que podemos respaldar.',
  faqTitle: 'Preguntas frecuentes',
  faqs: [
    {
      q: '¿«Certificación INVIMA» es el nombre oficial del trámite?',
      a: 'Es lenguaje de búsqueda frecuente. En dispositivos médicos el acto suele ser registro sanitario, registro sanitario automático o permiso de comercialización, según el caso. Usamos la terminología correcta en el acompañamiento.',
    },
    {
      q: '¿Todos los dispositivos siguen el mismo registro?',
      a: 'No. Depende de la clasificación de riesgo, de si es dispositivo médico o equipo biomédico de tecnología controlada, y de la modalidad de autorización. Por eso empezamos con un diagnóstico por producto.',
    },
    {
      q: '¿Un fabricante extranjero puede actuar solo como titular o importador?',
      a: 'No lo presuponga. Suele requerirse un establecimiento con domicilio en Colombia para importar/comercializar y, según el caso, titularidad, más la autorización del fabricante. Evaluamos el esquema aplicable a su caso.',
    },
    {
      q: '¿Qué es la autorización del fabricante?',
      a: 'Documento con el que el fabricante autoriza a un actor en Colombia a importar, comercializar y, cuando corresponda, figurar como titular del acto sanitario. Es un requisito frecuente en importados.',
    },
    {
      q: '¿Se necesita CCAA?',
      a: 'El Certificado de Capacidad de Almacenamiento y Acondicionamiento aplica al importador/almacenador según la normativa vigente; no sustituye el registro o permiso del producto. Confirmamos si aplica en su esquema.',
    },
    {
      q: '¿Cuánto tarda el proceso?',
      a: 'No hay un plazo único. Existen plazos orientativos en la normativa para ciertos trámites cuando la documentación está completa, pero hay preparación, posibles requerimientos y variables por producto. No prometemos fechas de aprobación.',
    },
    {
      q: '¿Cuánto cuesta?',
      a: 'Separe tarifas oficiales INVIMA del coste de preparación y acompañamiento. Cotizamos el acompañamiento tras conocer producto, referencias y documentos disponibles.',
    },
    {
      q: '¿I-ME garantiza la aprobación de INVIMA?',
      a: 'No. Acompañamos la preparación y el seguimiento; la autoridad decide. Cualquier afirmación en contrario sería incorrecta.',
    },
    {
      q: '¿Sirve un certificado de exportación en lugar del CVL?',
      a: 'En orientación oficial suele distinguirse el CVL (o equivalente válido) de un certificado de exportación. Revisamos el documento concreto frente a los requisitos vigentes.',
    },
    {
      q: '¿Puedo comercializar antes de tener el acto sanitario?',
      a: 'Como regla general, la comercialización e importación controlada requieren el acto aplicable. Confirme el régimen de su producto en fuentes oficiales antes de planificar ventas.',
    },
    {
      q: '¿Qué pasa con renovaciones o cambios?',
      a: 'Los actos tienen vigencia y reglas de renovación/modificación. Tras la autorización puede haber obligaciones de vigilancia y comercialización. Las cubrimos cuando formen parte del alcance acordado.',
    },
    {
      q: '¿Ofrecen también distribución o venta en Colombia?',
      a: 'I-ME opera como aliado comercial y técnico en equipos biomédicos. Si su proyecto combina registro y canal, lo evaluamos; no es automático ni sustituye el trámite sanitario.',
    },
  ],
  bottomTitle: 'Dé el siguiente paso con información de su producto',
  bottomBody:
    'Comparta fabricante, referencias y país. Le respondemos con una propuesta de evaluación y, si aplica, cotización de acompañamiento INVIMA.',
  relatedTitle: 'Guías del Centro de Conocimiento',
  relatedGuides: [
    {
      title: 'Tema INVIMA: regulación y consulta de registro',
      href: '/es/conocimiento/tema/invima-regulacion/',
    },
    {
      title: 'Registro sanitario INVIMA para equipos biomédicos',
      href: '/es/conocimiento/registro-sanitario-invima-equipos-biomedicos/',
    },
    {
      title: 'Checklist INVIMA al comprar equipos médicos',
      href: '/es/conocimiento/checklist-invima-compra-equipos-medicos/',
    },
  ],
  officialTitle: 'Fuentes oficiales',
  officialLinks: [
    {
      label: 'INVIMA — Dispositivos médicos y equipos biomédicos',
      href: 'https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos',
    },
    {
      label: 'INVIMA — Preguntas frecuentes dispositivos',
      href: 'https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/preguntas-frecuentes-dispositivos',
    },
    {
      label: 'INVIMA — Tarifas',
      href: 'https://www.invima.gov.co/tramites-y-servicios/tarifas',
    },
  ],
  disclaimer:
    'Contenido informativo y comercial. No constituye asesoría legal vinculante ni sustituye las resoluciones, decretos o instrucciones vigentes de INVIMA o el Ministerio de Salud. Consulte siempre las fuentes oficiales antes de radicar.',
  heroImage: '/assets/img/registro-sanitario-invima-equipos-biomedicos.webp',
  heroImageAlt:
    'Orientación sobre registro sanitario INVIMA para dispositivos médicos — I-ME Colombia',
  projectOptions: [
    { value: 'evaluacion_producto', label: 'Evaluación de mi producto / ruta regulatoria' },
    { value: 'cotizar_acompanamiento', label: 'Cotizar acompañamiento INVIMA' },
    { value: 'esquema_importador', label: 'Definir titular / importador / autorización' },
    { value: 'expediente', label: 'Revisión o preparación de expediente' },
  ],
};

const EN: InvimaFabricantesCopy = {
  tag: 'Manufacturers · INVIMA',
  title: 'Medical device registration Colombia (INVIMA) for foreign manufacturers | I-ME',
  description:
    'Support for foreign medical device manufacturers evaluating INVIMA registration and Colombia market entry. Request a product assessment — no approval guarantees.',
  h1: 'INVIMA registration for foreign medical device manufacturers',
  lead: 'If you manufacture medical devices or biomedical equipment outside Colombia and need to determine the regulatory pathway, prepare the dossier and coordinate local actors, I-ME helps reduce friction and clarify next steps — without confusing advisory work with INVIMA’s decision.',
  primaryCta: 'Request a product assessment',
  secondaryCta: 'Quote INVIMA support',
  formTitle: 'Tell us about your product and market goal',
  formIntro:
    'Share company, country, manufacturer, product type and approximate number of SKUs. An advisor replies with scope and next step — not a generic checklist.',
  problemTitle: 'Entering Colombia is more than “getting a certificate”',
  problemBody:
    'Search language often says “INVIMA certification”, but the applicable act is usually a sanitary registration, an automatic registration, or a marketing permit — depending on classification and technology type. Foreign manufacturers typically need aligned local roles, manufacturer authorization and legalized documentation. That varies by product.',
  barriers: [
    {
      title: 'Unclear classification and pathway',
      body: 'Classes I–III and controlled biomedical equipment rules change requirements. One template rarely fits all devices.',
    },
    {
      title: 'Incomplete local roles',
      body: 'Holder, importer and manufacturer authorization must fit the current framework. Assuming the foreign parent can act alone often causes rework.',
    },
    {
      title: 'Variable dossier and timelines',
      body: 'Free sale certificates, existence proofs, translations, quality and clinical evidence (when applicable) drive preparation. Official indicative timelines are not an approval promise.',
    },
  ],
  offerTitle: 'What I-ME provides',
  offerIntro:
    'We support biomedical technology projects in Colombia with clarity on requirements, coordination and dossier preparation. Scope is confirmed after an initial product assessment.',
  offerItems: [
    'Viability diagnosis and applicable regulatory pathway (indicative; subject to classification and current rules).',
    'Document gap review against typical requirements for the applicable procedure.',
    'Dossier preparation support and coordination with manufacturer, holder and authorized importer when needed.',
    'Follow-up on submissions and guidance on information requests within the agreed scope.',
    'Post-authorization support and commercial/distribution linkage when I-ME actually provides that service for the project.',
  ],
  offerLimitsTitle: 'Clear limits',
  offerLimits: [
    'I-ME is not INVIMA and not a certification body; we do not guarantee approval, timelines or regulatory outcomes.',
    'Decisions, official fees and administrative acts belong to the health authority.',
    'Not every product follows the same registration or permit; the pathway is confirmed per product.',
  ],
  processTitle: 'Step-by-step process',
  processSteps: [
    {
      title: '1. Initial assessment',
      body: 'We review brand, model, intended use, country of manufacture, available documents and launch goal.',
    },
    {
      title: '2. Classification and pathway',
      body: 'We organize the working hypothesis for class/act type and required local actors, with official references.',
    },
    {
      title: '3. Document review',
      body: 'We identify gaps, legalization/translation needs and technical or clinical evidence when applicable.',
    },
    {
      title: '4. Preparation and filing',
      body: 'We coordinate dossier preparation and filing through the authorized actor for your case.',
    },
    {
      title: '5. Follow-up and support',
      body: 'We support information requests, changes and, when in scope, the transition to commercialization.',
    },
  ],
  audienceTitle: 'Who this page is for',
  audienceYes: [
    'International manufacturers or OEM brands evaluating Colombia entry.',
    'Companies with unregistered catalogs or new SKUs to enable.',
    'RA or commercial teams needing a coordinated local partner.',
    'Manufacturers aligning importer representation and holder structure.',
  ],
  audienceNo: [
    'Anyone expecting I-ME to act as INVIMA or guarantee approval.',
    'Hospital buyers of already-registered equipment (use catalog/quote flows).',
    'IVD or other regimes not covered here without a prior assessment.',
  ],
  advantagesTitle: 'Practical advantages of working with I-ME',
  advantages: [
    'Operational presence in Colombia and experience with biomedical technology locally.',
    'Coordination between regulatory requirements and import/distribution reality.',
    'Links to Knowledge Hub guides and official INVIMA sources — without replacing them.',
    'An existing commercial and quote channel on i-me.com.co to continue the project.',
  ],
  docsTitle: 'Typical documents (indicative)',
  docsIntro:
    'Lists vary by product, class, modality and whether a marketing permit applies. This does not replace INVIMA’s official checklist or current form.',
  docs: [
    {
      item: 'INVIMA form and fee payment',
      note: 'Per the applicable procedure and current official fee schedule.',
    },
    {
      item: 'Existence / representation proof',
      note: 'Holder, manufacturer and importer; foreign documents per legalization/apostille rules.',
    },
    {
      item: 'Manufacturer authorization',
      note: 'Authorizes a Colombian establishment to import/market and, when applicable, act as holder.',
    },
    {
      item: 'Free sale certificate (or valid equivalent)',
      note: 'For imports; do not confuse with a mere export certificate.',
    },
    {
      item: 'Technical dossier and labeling',
      note: 'Technical information, artwork and inserts; Spanish labeling for commerce when applicable.',
    },
    {
      item: 'Importer CCAA (if storing/conditioning)',
      note: 'Parallel importer capability certificate; does not replace the product act.',
    },
  ],
  costsTitle: 'Timelines, costs and viability',
  costsBody:
    'Costs combine official INVIMA fees, dossier preparation, translations, testing when needed, professional support and internal time. Published indicative timelines assume a complete file and do not guarantee approval. We quote support scope after assessment.',
  trustTitle: 'Trust without invented results',
  trustBody:
    'We do not publish unverifiable success rates, unverified tenure claims or client cases without authorization. Ask for references or contractual scope in the assessment — we only share what we can support.',
  faqTitle: 'Frequently asked questions',
  faqs: [
    {
      q: 'Is “INVIMA certification” the official name?',
      a: 'It is common search language. For medical devices the act is usually sanitary registration, automatic registration or a marketing permit. We use the correct terminology in delivery.',
    },
    {
      q: 'Do all devices follow the same registration?',
      a: 'No. Risk class, device vs controlled biomedical equipment, and authorization modality change the path. That is why we start with a per-product assessment.',
    },
    {
      q: 'Can a foreign manufacturer act alone as holder or importer?',
      a: 'Do not assume so. A Colombia-domiciled establishment is often required to import/market and, depending on the case, hold the act, plus manufacturer authorization. We evaluate your structure.',
    },
    {
      q: 'What is manufacturer authorization?',
      a: 'The document by which the manufacturer authorizes a Colombian actor to import, market and, when applicable, appear as holder of the sanitary act.',
    },
    {
      q: 'Is CCAA required?',
      a: 'The storage/conditioning capability certificate applies to the importer/warehouse under current rules; it does not replace the product registration or permit.',
    },
    {
      q: 'How long does it take?',
      a: 'There is no single timeline. Some procedures have indicative statutory periods when documentation is complete, plus preparation and possible information requests. We do not promise approval dates.',
    },
    {
      q: 'How much does it cost?',
      a: 'Separate official INVIMA fees from preparation and advisory costs. We quote support after we know the product, SKUs and available documents.',
    },
    {
      q: 'Does I-ME guarantee INVIMA approval?',
      a: 'No. We support preparation and follow-up; the authority decides.',
    },
    {
      q: 'Does an export certificate replace a free sale certificate?',
      a: 'Official guidance typically distinguishes a valid free sale certificate (or equivalent) from a mere export certificate. We review your specific document against current requirements.',
    },
    {
      q: 'Can I sell before the sanitary act is granted?',
      a: 'As a general rule, marketing and controlled import require the applicable act. Confirm your product’s regime in official sources before planning sales.',
    },
    {
      q: 'What about renewals or changes?',
      a: 'Acts have validity and renewal/modification rules. Post-market obligations may apply. We cover them when included in the agreed scope.',
    },
    {
      q: 'Do you also distribute in Colombia?',
      a: 'I-ME operates as a commercial and technical partner for biomedical equipment. If your project combines registration and channel, we evaluate it — it is not automatic and does not replace the sanitary procedure.',
    },
  ],
  bottomTitle: 'Take the next step with your product details',
  bottomBody:
    'Share manufacturer, SKUs and country. We reply with an assessment proposal and, when applicable, an INVIMA support quote.',
  relatedTitle: 'Knowledge Hub guides',
  relatedGuides: [
    {
      title: 'INVIMA topic: regulation and registration lookup',
      href: '/en/knowledge/topic/invima-regulacion/',
    },
    {
      title: 'INVIMA sanitary registration for biomedical equipment',
      href: '/en/knowledge/registro-sanitario-invima-equipos-biomedicos/',
    },
    {
      title: 'INVIMA checklist when buying medical equipment',
      href: '/en/knowledge/checklist-invima-compra-equipos-medicos/',
    },
  ],
  officialTitle: 'Official sources',
  officialLinks: [
    {
      label: 'INVIMA — Medical devices and biomedical equipment',
      href: 'https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos',
    },
    {
      label: 'INVIMA — Device FAQs',
      href: 'https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/preguntas-frecuentes-dispositivos',
    },
    {
      label: 'INVIMA — Fees',
      href: 'https://www.invima.gov.co/tramites-y-servicios/tarifas',
    },
  ],
  disclaimer:
    'Informational and commercial content. Not binding legal advice and not a substitute for current INVIMA or Ministry of Health rules. Always check official sources before filing.',
  heroImage: '/assets/img/registro-sanitario-invima-equipos-biomedicos.webp',
  heroImageAlt: 'Guidance on INVIMA medical device registration for manufacturers — I-ME Colombia',
  projectOptions: [
    { value: 'evaluacion_producto', label: 'Product assessment / regulatory pathway' },
    { value: 'cotizar_acompanamiento', label: 'Quote INVIMA support' },
    { value: 'esquema_importador', label: 'Define holder / importer / authorization' },
    { value: 'expediente', label: 'Dossier review or preparation' },
  ],
};

export function getInvimaFabricantesCopy(locale: Locale): InvimaFabricantesCopy {
  return locale === 'en' ? EN : ES;
}
