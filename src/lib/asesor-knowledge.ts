export type AsesorKnowledgeLocale = 'es' | 'en';

const CONTACT_QUERY_REGEX =
  /\b(whats?app|correo(?:s)?|email|contact(?:o|os|ar|arme|arlos)?|telefono(?:s)?|phone(?:s)?|canal(?:es)?)\b/i;
const SERVICES_QUERY_REGEX =
  /\b(servici(?:o|os)|support|soporte|mantenim(?:iento|ientos)|calibr(?:acion|aciones)?|instal(?:acion|aciones|ar)?|asesor(?:ia)?|financi(?:acion|amiento|ar)?)\b/i;
const LEGAL_QUERY_REGEX =
  /\b(legal(?:es)?|ley(?:es)?|law(?:s)?|decreto(?:s)?|decree(?:s)?|resoluci(?:on|ones)|resolution(?:s)?|cookies?|privacidad|privacy|habeas|consumidor(?:es)?|consumer(?:s)?|normativ(?:a|as)|regulator(?:io|ios|y)?|registro(?:s)? sanitario(?:s)?|sanitary registration|invima|tecnovigil(?:ancia|ance)?)\b/i;

const ES_SITE_AND_LEGAL_KNOWLEDGE = `CONTEXTO DEL SITIO Y DE I-ME
- I-ME International Medical Enterprise es una empresa colombiana dedicada a la venta, distribucion, importacion, exportacion, instalacion, soporte tecnico, mantenimiento, asesoria e implementacion de equipos y dispositivos medicos para el sector salud.
- El sitio publica informacion sobre catalogo de productos, servicios, financiamiento orientativo, contacto, contenido editorial y paginas legales.
- Servicios destacados del sitio: venta y distribucion, instalacion y puesta en marcha, soporte tecnico preventivo y correctivo, calibracion y verificacion metrologica, repuestos y consumibles, financiamiento orientativo y asesoria biomedica.
- Cobertura declarada: 32 departamentos de Colombia. Experiencia declarada: mas de 15 anos.
- Canales comerciales publicados: WhatsApp +57 313 867 4059, correo info@i-me.com.co y formulario de contacto del sitio.
- Financiamiento: el sitio comunica planes orientativos para instituciones de salud, con referencia a plazos de hasta 60 meses; cualquier aprobacion, tasa, plazo final o condicion vinculante depende de validacion comercial y propuesta formal.
- Las solicitudes hechas por el sitio, WhatsApp, correo o asesor virtual no constituyen aceptacion automatica de venta. Precio, disponibilidad, garantia, tiempos, instalacion, soporte y condiciones finales se confirman en cotizacion o propuesta formal.

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
- Requests submitted through the website, WhatsApp, email or the virtual advisor do not automatically create a sale. Price, availability, warranty, timing, installation, support and final conditions must be confirmed in a quote or formal proposal.

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
  /\b(whats?app|correo(?:s)?|email|contact(?:o|os|ar|arme|arlos)?|telefono(?:s)?|phone(?:s)?|empresa|compania|company|sitio|site|pagina(?:s)?|page(?:s)?|catalogo(?:s)?|catalog(?:s)?|servici(?:o|os)|service(?:s)?|financi(?:acion|amiento|ar)?|garanti(?:a|as)|warrant(?:y|ies)|entreg(?:a|as)|delivery|instal(?:acion|aciones|ar)?|calibr(?:acion|aciones)?|mantenim(?:iento|ientos)|support|soporte|legal(?:es)?|ley(?:es)?|law(?:s)?|decreto(?:s)?|decree(?:s)?|resoluci(?:on|ones)|resolution(?:s)?|invima|fda|ce\b|registro(?:s)? sanitario(?:s)?|sanitary registration|tecnovigil(?:ancia|ance)?|normativ(?:a|as)|regulator(?:io|ios|y)?|cookies?|privacidad|privacy|habeas|terminos|terms|consumidor(?:es)?|consumer(?:s)?|canal(?:es)?|cotizaci(?:on|ones)|quote(?:s)?)\b/i;

export function getAsesorKnowledgeBase(locale: AsesorKnowledgeLocale): string {
  return locale === 'en' ? EN_SITE_AND_LEGAL_KNOWLEDGE : ES_SITE_AND_LEGAL_KNOWLEDGE;
}

export function esConsultaSitioOLegal(texto: string): boolean {
  return SITE_OR_LEGAL_QUERY_REGEX.test(texto);
}

export function buildAsesorStaticFallback(
  locale: AsesorKnowledgeLocale,
  texto: string
): string | null {
  const wantsContact = CONTACT_QUERY_REGEX.test(texto);
  const wantsServices = SERVICES_QUERY_REGEX.test(texto);
  const wantsLegal = LEGAL_QUERY_REGEX.test(texto);

  if (locale === 'en') {
    if (wantsLegal) {
      return 'Based on the information published by I-ME, personal data processing in Colombia is generally framed by Law 1581 of 2012 and Decrees 1377 of 2013 and 1074 of 2015, plus Decree 886 of 2014 when the National Database Registry applies. For commercial contact, Law 1266 of 2008 and Law 2300 of 2023 may also apply when relevant. The site also states that Colombia does not have a standalone cookie law like the European model, so if cookies identify a natural person, Law 1581 of 2012 should be considered. This is general guidance based on the published site content, not formal legal advice.';
    }

    if (wantsServices || wantsContact) {
      return 'I-ME states that it provides sale and distribution of biomedical equipment, installation and commissioning, preventive and corrective technical support, calibration and metrological verification, spare parts and consumables, indicative financing, and biomedical advisory. The published commercial channels are WhatsApp +57 313 867 4059, email info@i-me.com.co, and the website contact form.';
    }
  } else {
    if (wantsLegal) {
      return 'Con base en la información publicada por I-ME, el tratamiento de datos personales en Colombia se enmarca de forma general en la Ley 1581 de 2012 y los Decretos 1377 de 2013 y 1074 de 2015, además del Decreto 886 de 2014 cuando aplique el Registro Nacional de Bases de Datos. Para contacto comercial también pueden aplicar la Ley 1266 de 2008 y la Ley 2300 de 2023 cuando corresponda. El sitio además indica que Colombia no tiene una ley autónoma de cookies equivalente al modelo europeo, por lo que si las cookies identifican a una persona natural debe considerarse la Ley 1581 de 2012. Esta es una orientación general basada en el contenido publicado, no asesoría legal definitiva.';
    }

    if (wantsServices || wantsContact) {
      return 'I-ME publica que ofrece venta y distribución de equipos biomédicos, instalación y puesta en marcha, soporte técnico preventivo y correctivo, calibración y verificación metrológica, repuestos y consumibles, financiamiento orientativo y asesoría biomédica. Los canales comerciales publicados son WhatsApp +57 313 867 4059, correo info@i-me.com.co y el formulario de contacto del sitio.';
    }
  }

  return null;
}
