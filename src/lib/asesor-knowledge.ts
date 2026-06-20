export type AsesorKnowledgeLocale = 'es' | 'en';

const CONTACT_QUERY_REGEX =
  /\b(whats?app|correo(?:s)?|email|contact(?:o|os|ar|arme|arlos)?|telefono(?:s)?|phone(?:s)?|canal(?:es)?)\b/i;
const CONTENT_QUERY_REGEX =
  /\b(sitio|web|pagina(?:s)?|home|inicio|acerca|quienes somos|about|servici(?:o|os)|catalogo(?:s)?|catalog(?:s)?|conocimiento|articulo(?:s)?|blog|guia(?:s)?|faq(?:s)?|preguntas frecuentes|politica(?:s)?|legal(?:es)?|financi(?:acion|amiento)|soporte|ayuda|proceso(?:s)?|compra|instal(?:acion|acion|es)?|mantenimiento|calibraci(?:on|ones)?|garanti(?:a|as)?|contact(?:o|o))\b/i;
const SERVICES_QUERY_REGEX =
  /\b(servici(?:o|os)|support|soporte|mantenim(?:iento|ientos)|calibr(?:acion|aciones)?|instal(?:acion|aciones|ar)?|asesor(?:ia)?|financi(?:acion|amiento|ar)?)\b/i;
const LEGAL_QUERY_REGEX =
  /\b(legal(?:es)?|ley(?:es)?|law(?:s)?|decreto(?:s)?|decree(?:s)?|resoluci(?:on|ones)|resolution(?:s)?|cookies?|privacidad|privacy|habeas|consumidor(?:es)?|consumer(?:s)?|normativ(?:a|as)|regulator(?:io|ios|y)?|registro(?:s)? sanitario(?:s)?|sanitary registration|invima|tecnovigil(?:ancia|ance)?|certific(?:ado|ada|ados|adas|acion|aciones)|certificate(?:s)?|certification(?:s)?|ce\b|fda|iso|calidad|quality)\b/i;
const FINANCING_QUERY_REGEX =
  /\b(financi(?:acion|amiento|ar|ado|ados)?|credito(?:s)?|cuota(?:s)?|plazo(?:s)?|tasa(?:s)?|leasing|loan(?:s)?|payment plan(?:s)?|installment(?:s)?)\b/i;
const WARRANTY_QUERY_REGEX =
  /\b(garanti(?:a|as)|warrant(?:y|ies)|soporte postventa|posventa|post[- ]?sale|mantenimiento|maintenance|calibraci(?:on|ones)|calibration)\b/i;
const CERTIFICATIONS_QUERY_REGEX =
  /\b(certific(?:ado|ada|ados|adas|acion|aciones)|certificate(?:s)?|certification(?:s)?|registro(?:s)? invima|registro(?:s)? sanitario(?:s)?|sanitary registration(?:s)?|ce\b|fda|iso|bpm|calidad|quality|tecnovigil(?:ancia|ance)?)\b/i;
const MEDICAL_DEVICE_REGULATORY_QUERY_REGEX =
  /\b(invima|dispositivo(?:s)? medic(?:o|os|a|as)|medical device(?:s)?|equipo(?:s)? biomedic(?:o|os|a|as)|biomedical equipment|registro(?:s)? sanitario(?:s)?|sanitary registration(?:s)?|tecnovigil(?:ancia|ance)|clasificaci(?:on|ones)|classific(?:ation|ations)|importaci(?:on|ones)|import(?:s|ation)?)\b/i;

const EXTERNAL_REFERENCES = `REFERENCIAS EXTERNAS DE APOYO
- INVIMA (dispositivos médicos y equipos biomédicos): el Instituto publica que estos productos están sujetos a supervisión, control, autorización de comercialización y cumplimiento de requisitos técnico-legales y sanitarios. También reúne normativa, trámites, registros sanitarios, tecnovigilancia y listados de establecimientos certificados. Úsalo para orientar preguntas sobre clasificación, registro, vigilancia, importación y trazabilidad, siempre con validación del producto específico.
- Distribuidores especializados de equipo médico: los contenidos de referencia resaltan que un distribuidor especializado aporta selección técnica, disponibilidad, logística, soporte, mantenimiento, capacitación y continuidad operativa. Úsalo para responder por qué un distribuidor biomédico no es solo un vendedor, sino un aliado técnico y comercial.
- Valor operativo del distribuidor: las referencias externas también destacan la reducción de errores de compra, mejor adaptación al entorno clínico, acompañamiento postventa y mayor eficiencia en el ciclo de vida del equipo. Úsalo como contexto orientativo, no como promesa comercial específica.`;

const ES_SITE_AND_LEGAL_KNOWLEDGE = `CONTEXTO DEL SITIO Y DE I-ME
- I-ME International Medical Enterprise es una empresa colombiana dedicada a la venta, distribucion, importacion, exportacion, instalacion, soporte tecnico, mantenimiento, asesoria e implementacion de equipos y dispositivos medicos para el sector salud.
- El sitio publica informacion sobre catalogo de productos, servicios, financiamiento orientativo, contacto, contenido editorial y paginas legales.
- Servicios destacados del sitio: venta y distribucion, instalacion y puesta en marcha, soporte tecnico preventivo y correctivo, calibracion y verificacion metrologica, repuestos y consumibles, financiamiento orientativo y asesoria biomedica.
- Cobertura declarada: 32 departamentos de Colombia. Experiencia declarada: mas de 15 anos.
- Canales comerciales publicados: WhatsApp +57 313 867 4059, correo info@i-me.com.co y formulario de contacto del sitio.
- Financiamiento: el sitio comunica planes orientativos para instituciones de salud, con referencia a plazos de hasta 60 meses; cualquier aprobacion, tasa, plazo final o condicion vinculante depende de validacion comercial y propuesta formal.
- Certificaciones y registros: el sitio comunica equipos biomédicos certificados y menciona registros INVIMA y certificaciones CE/FDA cuando correspondan. Cada certificado, registro sanitario, vigencia, alcance de garantía y compatibilidad normativa debe confirmarse por producto en ficha técnica, soporte del fabricante o cotización formal.
- Garantías y soporte: la garantía, instalación, puesta en marcha, capacitación, mantenimiento, calibración, repuestos y soporte se confirman según el producto, ciudad, alcance contratado y documentación del fabricante.
- Las solicitudes hechas por el sitio, WhatsApp, correo o asesor virtual no constituyen aceptacion automatica de venta. Precio, disponibilidad, garantia, tiempos, instalacion, soporte y condiciones finales se confirman en cotizacion o propuesta formal.
- El asesor puede responder sobre todo el contenido publicado del sitio: inicio, catálogo, servicios, conocimiento/editorial, financiación, contacto, políticas legales, preguntas frecuentes y guías relacionadas, no solo productos.

MARCO LEGAL Y REGULATORIO COLOMBIANO DISPONIBLE EN EL SITIO
- Proteccion de datos y habeas data: Ley 1581 de 2012, Decreto 1377 de 2013, Decreto 1074 de 2015 y Decreto 886 de 2014 cuando aplique el Registro Nacional de Bases de Datos.
- Contacto comercial y bases especiales: Ley 1266 de 2008 para datos financieros cuando aplique; Ley 2300 de 2023 para comunicaciones comerciales, publicitarias o de cobranza cuando resulte aplicable.
- Consumo y comercio: Ley 1480 de 2011 como Estatuto del Consumidor cuando exista relacion de consumo.
- Cookies: el sitio indica que Colombia no tiene una ley autonoma de cookies equivalente al modelo europeo; si cookies o tecnologias similares identifican o hacen identificable a una persona natural, debe aplicarse la Ley 1581 de 2012.
- Equipos biomedicos y dispositivos medicos: la comercializacion en Colombia puede estar sujeta a requisitos sanitarios, registros, permisos, certificaciones, trazabilidad, tecnovigilancia, mantenimiento, calibracion y condiciones especiales segun el tipo de producto.
- Afirmaciones sobre CE, FDA, INVIMA o equivalentes solo deben darse cuando exista soporte vigente, verificable y aplicable al producto concreto.
- El usuario institucional debe validar aptitud para el uso previsto, habilitacion del servicio, infraestructura, protocolos internos y obligaciones sanitarias.
- El asesor virtual puede ofrecer orientacion comercial, tecnica y regulatoria general basada en el sitio, pero no sustituye asesoria legal definitiva, concepto regulatorio formal ni decision clinica.`;

const EN_SITE_AND_LEGAL_KNOWLEDGE = `SITE AND I-ME CONTEXT
- I-ME International Medical Enterprise is a Colombian company focused on the sale, distribution, import, export, installation, technical support, maintenance, advisory and implementation of medical and biomedical equipment for the healthcare sector.
- The website publishes information about the product catalog, services, indicative financing, contact channels, editorial content and legal pages.
- Main services described on the site: sale and distribution, installation and commissioning, preventive and corrective technical support, calibration and metrological verification, spare parts and consumables, indicative financing and biomedical advisory.
- Declared coverage: Colombia's 32 departments. Declared experience: more than 15 years.
- Published commercial channels: WhatsApp +57 313 867 4059, email info@i-me.com.co and the website contact form.
- Financing: the site communicates indicative plans for healthcare institutions, with references to terms up to 60 months; any approval, rate, final term or binding condition depends on commercial validation and a formal proposal.
- Certifications and registrations: the site communicates certified biomedical equipment and mentions INVIMA registrations and CE/FDA certifications where applicable. Each certificate, sanitary registration, validity, warranty scope and regulatory compatibility must be confirmed per product through the technical sheet, manufacturer support or formal quotation.
- Warranties and support: warranty, installation, commissioning, training, maintenance, calibration, spare parts and support are confirmed according to the product, city, contracted scope and manufacturer documentation.
- Requests submitted through the website, WhatsApp, email or the virtual advisor do not automatically create a sale. Price, availability, warranty, timing, installation, support and final conditions must be confirmed in a quote or formal proposal.
- The advisor can answer about all published website content: home, catalog, services, editorial/knowledge, financing, contact, legal policies, FAQs and related guides, not just products.

COLOMBIAN LEGAL AND REGULATORY FRAMEWORK AVAILABLE ON THE SITE
- Data protection and habeas data: Law 1581 of 2012, Decree 1377 of 2013, Decree 1074 of 2015 and Decree 886 of 2014 where the National Database Registry applies.
- Commercial contact and special databases: Law 1266 of 2008 for financial data when applicable; Law 2300 of 2023 for commercial, advertising or collection communications when applicable.
- Consumer and commerce matters: Law 1480 of 2011 as the Colombian Consumer Statute when a consumer relationship exists.
- Cookies: the site states that Colombia does not have a standalone cookie law equivalent to the European model; if cookies or similar technologies identify or make a natural person identifiable, Law 1581 of 2012 applies.
- Biomedical equipment and medical devices: commercialization in Colombia may be subject to sanitary requirements, registrations, permits, certifications, traceability, technovigilance, maintenance, calibration and special conditions depending on product type.
- Claims about CE, FDA, INVIMA or equivalent certifications should only be made when there is current, verifiable documentation applicable to the specific product.
- Institutional users must validate suitability for intended use, service authorization, infrastructure, internal protocols and sanitary obligations.
- The virtual advisor may provide commercial, technical and general regulatory guidance based on the site, but it does not replace formal legal advice, a binding regulatory opinion or clinical judgment.`;

const SITE_OR_LEGAL_QUERY_REGEX =
  /\b(whats?app|correo(?:s)?|email|contact(?:o|os|ar|arme|arlos)?|telefono(?:s)?|phone(?:s)?|empresa|compania|company|sitio|site|pagina(?:s)?|page(?:s)?|catalogo(?:s)?|catalog(?:s)?|servici(?:o|os)|service(?:s)?|financi(?:acion|amiento|ar|ado|ados)?|credito(?:s)?|cuota(?:s)?|plazo(?:s)?|tasa(?:s)?|garanti(?:a|as)|warrant(?:y|ies)|entreg(?:a|as)|delivery|instal(?:acion|aciones|ar)?|calibr(?:acion|aciones)?|mantenim(?:iento|ientos)|support|soporte|legal(?:es)?|ley(?:es)?|law(?:s)?|decreto(?:s)?|decree(?:s)?|resoluci(?:on|ones)|resolution(?:s)?|invima|fda|ce\b|iso|bpm|certific(?:ado|ada|ados|adas|acion|aciones)|certificate(?:s)?|certification(?:s)?|calidad|quality|registro(?:s)? sanitario(?:s)?|sanitary registration(?:s)?|tecnovigil(?:ancia|ance)?|normativ(?:a|as)|regulator(?:io|ios|y)?|cookies?|privacidad|privacy|habeas|terminos|terms|consumidor(?:es)?|consumer(?:s)?|canal(?:es)?|cotizaci(?:on|ones)|quote(?:s)?)\b/i;

export function getAsesorKnowledgeBase(locale: AsesorKnowledgeLocale): string {
  return locale === 'en'
    ? `${EN_SITE_AND_LEGAL_KNOWLEDGE}\n\n${EXTERNAL_REFERENCES}`
    : `${ES_SITE_AND_LEGAL_KNOWLEDGE}\n\n${EXTERNAL_REFERENCES}`;
}

export function esConsultaSitioOLegal(texto: string): boolean {
  return SITE_OR_LEGAL_QUERY_REGEX.test(texto);
}

export function buildAsesorStaticFallback(
  locale: AsesorKnowledgeLocale,
  texto: string
): string | null {
  const wantsContact = CONTACT_QUERY_REGEX.test(texto);
  const wantsContent = CONTENT_QUERY_REGEX.test(texto);
  const wantsServices = SERVICES_QUERY_REGEX.test(texto);
  const wantsLegal = LEGAL_QUERY_REGEX.test(texto);
  const wantsFinancing = FINANCING_QUERY_REGEX.test(texto);
  const wantsWarranty = WARRANTY_QUERY_REGEX.test(texto);
  const wantsCertifications = CERTIFICATIONS_QUERY_REGEX.test(texto);
  const wantsMedicalDeviceRegulatory = MEDICAL_DEVICE_REGULATORY_QUERY_REGEX.test(texto);

  if (locale === 'en') {
    if (wantsMedicalDeviceRegulatory) {
      return 'For medical devices and biomedical equipment in Colombia, INVIMA is the health authority that oversees sanitary registration, market authorization, technovigilance and compliance with technical and legal requirements. As general guidance, the applicable route depends on the specific device, its intended use, risk class, manufacturer documentation, traceability and current certificates. I-ME can help review the product reference and supporting documents, but final regulatory validation must be confirmed for the specific product and current documentation.';
    }

    if (wantsCertifications) {
      return 'I-ME publishes biomedical equipment with regulatory and quality support such as INVIMA registrations and CE/FDA certifications where applicable. The exact certificate, sanitary registration, validity and scope must be confirmed for the specific product through its technical sheet, manufacturer documentation or a formal quotation. For a purchase decision, ask I-ME to validate the product reference, intended use, regulatory support and warranty conditions before closing the order.';
    }

    if (wantsLegal) {
      return 'Based on the information published by I-ME, personal data processing in Colombia is generally framed by Law 1581 of 2012 and Decrees 1377 of 2013 and 1074 of 2015, plus Decree 886 of 2014 when the National Database Registry applies. For commercial contact, Law 1266 of 2008 and Law 2300 of 2023 may also apply when relevant. The site also states that Colombia does not have a standalone cookie law like the European model, so if cookies identify a natural person, Law 1581 of 2012 should be considered. This is general guidance based on the published site content, not formal legal advice.';
    }

    if (wantsFinancing) {
      return 'I-ME publishes indicative financing options for healthcare institutions, including acquisition plans for biomedical equipment and clinical projects. Final rates, terms, approvals, documentation requirements and binding conditions are confirmed only through a formal proposal from I-ME or the relevant financing partner.';
    }

    if (wantsWarranty) {
      return 'Warranty, installation, commissioning, preventive or corrective maintenance, calibration and spare parts depend on the product, manufacturer documentation, city, contracted scope and formal quotation. I-ME can guide the institution through technical support and after-sales coordination, but final coverage must be confirmed in the proposal or invoice.';
    }

    if (wantsServices || wantsContact) {
      return 'I-ME states that it provides sale and distribution of biomedical equipment, installation and commissioning, preventive and corrective technical support, calibration and metrological verification, spare parts and consumables, indicative financing, and biomedical advisory. The published commercial channels are WhatsApp +57 313 867 4059, email info@i-me.com.co, and the website contact form.';
    }

    if (wantsContent) {
      return 'I-ME publishes more than products: the website also includes the home page, services, knowledge articles, financing guidance, contact channels and legal policies. For questions about the site structure, editorial content, policies or service flow, I can guide you using what is published on the website and the external reference material we use as support. If you need a product-level decision, we can narrow it down afterward.';
    }
  } else {
    if (wantsMedicalDeviceRegulatory) {
      return 'Para dispositivos médicos y equipos biomédicos en Colombia, INVIMA es la autoridad sanitaria que supervisa registros sanitarios, autorización de comercialización, tecnovigilancia y cumplimiento de requisitos técnicos y legales. Como orientación general, la ruta aplicable depende del dispositivo concreto, su uso previsto, clase de riesgo, documentación del fabricante, trazabilidad y certificados vigentes. I-ME puede ayudar a revisar la referencia y los soportes del producto, pero la validación regulatoria final debe confirmarse caso por caso con documentación vigente.';
    }

    if (wantsCertifications) {
      return 'I-ME publica equipos biomédicos con soporte regulatorio y de calidad como registros INVIMA y certificaciones CE/FDA cuando aplican. El certificado exacto, registro sanitario, vigencia y alcance deben confirmarse para el producto específico mediante ficha técnica, documentación del fabricante o cotización formal. Para decidir una compra, conviene validar referencia, uso previsto, soporte regulatorio y condiciones de garantía antes de cerrar el pedido.';
    }

    if (wantsLegal) {
      return 'Con base en la información publicada por I-ME, el tratamiento de datos personales en Colombia se enmarca de forma general en la Ley 1581 de 2012 y los Decretos 1377 de 2013 y 1074 de 2015, además del Decreto 886 de 2014 cuando aplique el Registro Nacional de Bases de Datos. Para contacto comercial también pueden aplicar la Ley 1266 de 2008 y la Ley 2300 de 2023 cuando corresponda. El sitio además indica que Colombia no tiene una ley autónoma de cookies equivalente al modelo europeo, por lo que si las cookies identifican a una persona natural debe considerarse la Ley 1581 de 2012. Esta es una orientación general basada en el contenido publicado, no asesoría legal definitiva.';
    }

    if (wantsFinancing) {
      return 'I-ME publica opciones de financiación orientativas para instituciones de salud, incluyendo planes de adquisición de equipos biomédicos y proyectos clínicos. Tasas, plazos, aprobación, documentos requeridos y condiciones vinculantes se confirman únicamente mediante propuesta formal de I-ME o del aliado financiero correspondiente.';
    }

    if (wantsWarranty) {
      return 'La garantía, instalación, puesta en marcha, mantenimiento preventivo o correctivo, calibración y repuestos dependen del producto, documentación del fabricante, ciudad, alcance contratado y cotización formal. I-ME puede orientar a la institución en soporte técnico y posventa, pero la cobertura final debe quedar confirmada en la propuesta o factura.';
    }

    if (wantsServices || wantsContact) {
      return 'I-ME publica que ofrece venta y distribución de equipos biomédicos, instalación y puesta en marcha, soporte técnico preventivo y correctivo, calibración y verificación metrológica, repuestos y consumibles, financiamiento orientativo y asesoría biomédica. Los canales comerciales publicados son WhatsApp +57 313 867 4059, correo info@i-me.com.co y el formulario de contacto del sitio.';
    }

    if (wantsContent) {
      return 'I-ME publica mucho más que productos: el sitio también incluye la página de inicio, servicios, artículos y guías de conocimiento, financiación orientativa, canales de contacto y políticas legales. Para consultas sobre estructura del sitio, contenido editorial, políticas o flujo de servicio, puedo orientarte con lo publicado en la web y con material externo de apoyo. Si luego necesitas aterrizarlo a un equipo concreto, lo hacemos.';
    }
  }

  return null;
}
