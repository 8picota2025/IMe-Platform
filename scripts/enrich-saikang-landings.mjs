#!/usr/bin/env node
/**
 * Enriquece landings Saikang ya importadas.
 * Copy orientado a problemas operativos, decisión de compra y búsquedas
 * long-tail. No inventa prestaciones: los datos técnicos se toman del JSON
 * existente y la ficha del fabricante enlazada en cada producto.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'src/data/mock-productos.json');
const products = JSON.parse(await readFile(file, 'utf8'));

const categoryMap = [
  {
    test: /mesa de sobrecama|mesa de noche|overbed table|bedside table/i,
    es: { noun: 'mesa clínica de apoyo', area: 'habitaciones de hospitalización, UCI y atención domiciliaria institucional', pain: 'alcance incómodo a objetos, superficies de apoyo insuficientes y movimientos innecesarios alrededor del paciente', solution: 'acercar una superficie funcional al usuario y al equipo asistencial, con dimensiones y configuración que se revisan antes de la compra', edge: 'una mesa auxiliar no clínica que no soporta el ritmo de limpieza ni el flujo de la habitación', applications: ['Hospitalización', 'UCI y cuidados críticos', 'Atención institucional y domiciliaria'] },
    en: { noun: 'clinical overbed table', area: 'inpatient rooms, ICU and institutional home-care settings', pain: 'awkward access to essentials, insufficient support surfaces and unnecessary movement around the patient', solution: 'bring a functional support surface closer to the user and care team, with dimensions and configuration reviewed before purchase', edge: 'a non-clinical side table that does not withstand room workflow and cleaning demands', applications: ['Inpatient care', 'ICU and critical care', 'Institutional and home care'] },
  },
  {
    test: /cama|bed|crib|colchon|mattress/i,
    es: { noun: 'cama hospitalaria', area: 'hospitalización, cuidado intensivo y atención institucional', pain: 'posturas poco consistentes, transferencias exigentes y falta de continuidad entre turnos', solution: 'organizar el posicionamiento y el cuidado alrededor del paciente, con una referencia identificable y una configuración que se valida antes de la compra', edge: 'una cama sin trazabilidad de configuración o sin soporte local', applications: ['Hospitalización', 'UCI y cuidados críticos', 'Clínicas y centros de atención'] },
    en: { noun: 'hospital bed', area: 'inpatient care, intensive care and institutional healthcare', pain: 'inconsistent positioning, demanding transfers and poor continuity between shifts', solution: 'organize patient positioning and care around an identifiable reference whose configuration is confirmed before purchase', edge: 'a bed without configuration traceability or local support', applications: ['Inpatient care', 'ICU and critical care', 'Clinics and healthcare facilities'] },
  },
  {
    test: /camilla|stretcher|trolley.*transport|transportation/i,
    es: { noun: 'camilla de traslado', area: 'urgencias, traslado intrahospitalario y diagnóstico', pain: 'demoras, transferencias manuales y pérdida de coordinación entre urgencias, hospitalización e imagenología', solution: 'hacer más predecible el traslado interno mediante una referencia que se cotiza con medidas, configuración y accesorios confirmados', edge: 'una camilla genérica elegida solo por precio, sin validar el recorrido ni la carga de trabajo', applications: ['Urgencias', 'Traslado intrahospitalario', 'Diagnóstico e imagenología'] },
    en: { noun: 'patient transport trolley', area: 'emergency care, intra-hospital transport and diagnostics', pain: 'delays, manual transfers and poor coordination between emergency, wards and imaging', solution: 'make internal transport more predictable by quoting an identifiable reference with confirmed dimensions, configuration and accessories', edge: 'a generic trolley selected only on price without validating routes and workload', applications: ['Emergency departments', 'Intra-hospital transport', 'Diagnostics and imaging'] },
  },
  {
    test: /mesa quirurg|operating table|mesa de oper|surgical table/i,
    es: { noun: 'mesa quirúrgica', area: 'quirófanos y áreas de procedimiento', pain: 'ajustes que interrumpen el flujo, acceso limitado al paciente y configuraciones que no se documentan bien', solution: 'estructurar la evaluación del quirófano alrededor de la referencia, la configuración solicitada y las especificaciones publicadas', edge: 'una mesa comparable sin documentación clara de configuración, accesorios o servicio', applications: ['Quirófanos', 'Áreas de procedimiento', 'Cirugía ambulatoria'] },
    en: { noun: 'operating table', area: 'operating rooms and procedure areas', pain: 'workflow interruptions, limited patient access and poorly documented configurations', solution: 'structure operating-room evaluation around the reference, requested configuration and published specifications', edge: 'a comparable table without clear documentation for configuration, accessories or service', applications: ['Operating rooms', 'Procedure areas', 'Ambulatory surgery'] },
  },
  {
    test: /l[aá]mpara|operating lamp|shadowless|surgical light/i,
    es: { noun: 'lámpara quirúrgica', area: 'quirófanos, salas de procedimiento y áreas de intervención', pain: 'sombras, fatiga visual y necesidad de reposicionar la iluminación durante el procedimiento', solution: 'evaluar la iluminación como parte del flujo de sala, contrastando alcance, configuración y datos técnicos de la referencia', edge: 'una lámpara seleccionada por potencia nominal sin revisar la geometría real de la sala', applications: ['Quirófanos', 'Salas de procedimiento', 'Cirugía ambulatoria'] },
    en: { noun: 'operating lamp', area: 'operating rooms, procedure rooms and intervention areas', pain: 'shadows, visual fatigue and repeated light repositioning during procedures', solution: 'evaluate lighting as part of room workflow by confirming reach, configuration and technical data for the reference', edge: 'a lamp selected by nominal power without reviewing the room geometry', applications: ['Operating rooms', 'Procedure rooms', 'Ambulatory surgery'] },
  },
  {
    test: /ginecol|obst[eé]tric|gynecolog|delivery bed|exam couch|parto/i,
    es: { noun: 'equipo de ginecología y obstetricia', area: 'consultorios, salas de examen, parto y procedimientos gineco-obstétricos', pain: 'cambios de posición incómodos, tiempos de preparación y falta de adaptación al flujo de atención', solution: 'comparar una referencia clínica identificable con la configuración y dimensiones que necesita cada servicio', edge: 'un equipo de examen que no se adapta al espacio ni a la secuencia asistencial', applications: ['Ginecología', 'Obstetricia y salas de parto', 'Consultorios y procedimientos'] },
    en: { noun: 'gynecology and obstetrics equipment', area: 'consulting rooms, examination, delivery and gynecology procedure areas', pain: 'awkward positioning changes, preparation time and poor fit with the care workflow', solution: 'compare an identifiable clinical reference with the configuration and dimensions required by each service', edge: 'an examination unit that does not fit the room or care sequence', applications: ['Gynecology', 'Obstetrics and delivery rooms', 'Consulting and procedure rooms'] },
  },
  {
    test: /monitor|electrocard|patient monitor/i,
    es: { noun: 'monitor de paciente', area: 'urgencias, hospitalización, UCI y áreas de recuperación', pain: 'lecturas dispersas, alarmas difíciles de gestionar y falta de estandarización entre camas', solution: 'seleccionar una referencia documentada según el entorno, los parámetros requeridos y el flujo de monitorización', edge: 'un monitor elegido por número de parámetros sin validar conectividad, accesorios ni uso real', applications: ['Urgencias', 'Hospitalización', 'UCI y recuperación'] },
    en: { noun: 'patient monitor', area: 'emergency, inpatient, ICU and recovery areas', pain: 'scattered readings, difficult alarm management and inconsistent equipment between beds', solution: 'select a documented reference according to environment, required parameters and monitoring workflow', edge: 'a monitor chosen by parameter count without validating connectivity, accessories or actual use', applications: ['Emergency care', 'Inpatient care', 'ICU and recovery'] },
  },
  {
    test: /bomba|infusion|syringe pump/i,
    es: { noun: 'bomba de infusión', area: 'hospitalización, UCI, urgencias y terapias especializadas', pain: 'programaciones manuales, interrupciones de terapia y necesidad de controlar el equipo junto al paciente', solution: 'partir de una referencia y una ficha técnica que permitan revisar configuración, compatibilidad y protocolo de uso antes de cotizar', edge: 'una bomba similar sin confirmar el escenario de infusión ni los accesorios requeridos', applications: ['Hospitalización', 'UCI y urgencias', 'Terapias especializadas'] },
    en: { noun: 'infusion pump', area: 'inpatient care, ICU, emergency and specialized therapies', pain: 'manual programming, therapy interruptions and the need to control equipment beside the patient', solution: 'start from a reference and datasheet that allow configuration, compatibility and use protocol to be reviewed before quoting', edge: 'a similar pump without confirming the infusion scenario or required accessories', applications: ['Inpatient care', 'ICU and emergency', 'Specialized therapies'] },
  },
  {
    test: /carro|trolley|cart/i,
    es: { noun: 'carro clínico', area: 'hospitalización, urgencias, anestesia, procedimientos y logística interna', pain: 'insumos dispersos, desplazamientos innecesarios y pérdida de tiempo al preparar una atención', solution: 'ordenar el flujo de suministros alrededor de una referencia concreta, con especificaciones y accesorios que se revisan con el servicio', edge: 'un carro genérico que no responde al volumen, recorrido o protocolo del área', applications: ['Hospitalización y urgencias', 'Anestesia y procedimientos', 'Logística clínica'] },
    en: { noun: 'clinical trolley', area: 'inpatient care, emergency, anesthesia, procedures and internal logistics', pain: 'scattered supplies, unnecessary movement and lost time when preparing care', solution: 'organize supply flow around a concrete reference with specifications and accessories reviewed with the service', edge: 'a generic cart that does not match the area volume, route or protocol', applications: ['Inpatient and emergency care', 'Anesthesia and procedures', 'Clinical logistics'] },
  },
  {
    test: /sill[oó]n|chair|stool|wheelchair|dialysis|donation/i,
    es: { noun: 'sillón clínico', area: 'servicios ambulatorios, diálisis, donación y tratamientos prolongados', pain: 'incomodidad durante sesiones extensas, transferencias poco fluidas y mobiliario que no se adapta al servicio', solution: 'evaluar una referencia de mobiliario clínico con su configuración, dimensiones y documentación antes de comprar', edge: 'un sillón convencional sin considerar el flujo, la limpieza y la duración de la atención', applications: ['Servicios ambulatorios', 'Diálisis y donación', 'Áreas de tratamiento'] },
    en: { noun: 'clinical chair', area: 'outpatient, dialysis, donation and extended-treatment services', pain: 'discomfort during long sessions, awkward transfers and furniture that does not fit the service', solution: 'evaluate an identifiable clinical-furniture reference with configuration, dimensions and documentation before purchase', edge: 'a conventional chair selected without considering workflow, cleaning and treatment duration', applications: ['Outpatient services', 'Dialysis and donation', 'Treatment areas'] },
  },
];

const fallback = {
  es: { noun: 'equipo hospitalario', area: 'hospitales, clínicas y servicios de salud', pain: 'fricción operativa, falta de trazabilidad y decisiones de compra basadas solo en precio', solution: 'ordenar la evaluación a partir de una referencia, sus especificaciones y el contexto real del servicio', edge: 'una opción genérica sin documentación ni acompañamiento de selección', applications: ['Hospitales', 'Clínicas', 'Servicios de salud'] },
  en: { noun: 'hospital equipment', area: 'hospitals, clinics and healthcare services', pain: 'operational friction, poor traceability and purchase decisions based only on price', solution: 'structure evaluation around an identifiable reference, its specifications and the actual service context', edge: 'a generic option without documentation or selection support', applications: ['Hospitals', 'Clinics', 'Healthcare services'] },
};

function profile(product, locale) {
  const source = `${product.nombre_es} ${product.nombre_en} ${product.familia_slug ?? ''}`;
  return (categoryMap.find(item => item.test.test(source))?.[locale] ?? fallback[locale]);
}

function modelOf(product) {
  const match = `${product.nombre_es}`.match(/(?:Ref\.?|modelo)\s*([A-Za-z0-9][A-Za-z0-9-]*)/i);
  return match?.[1]?.trim() || product.nombre_es.replace(/.*?\b(Ref\.?|Modelo)\s*/i, '').split(/\s+Saikang/i)[0].trim() || product.nombre_es;
}

function verifiedSpecs(product, locale) {
  const ignored = /fabricante|documentaci[oó]n|modelo|tipo de equipo/i;
  const rows = (product.especificaciones ?? [])
    .filter(item => item?.valor && !ignored.test(`${item.clave} ${item.grupo}`))
    .slice(0, 5)
    .map(item => `${item.clave}: ${item.valor}`);
  if (!rows.length) return locale === 'es' ? 'La ficha técnica del fabricante reúne la configuración y los parámetros que deben confirmarse para cada pedido.' : 'The manufacturer datasheet gathers the configuration and parameters that must be confirmed for each order.';
  return locale === 'es' ? `Entre los datos publicados que conviene revisar están: ${rows.join('; ')}.` : `Published data worth reviewing include: ${rows.join('; ')}.`;
}

function technicalSource(product, locale) {
  const source = locale === 'es' ? product.descripcion_corta_es : product.descripcion_corta_en;
  // Solo conserva texto que parece contener un dato técnico real. El copy
  // generado incluye el modelo, por eso no usamos presencia de dígitos como
  // detector.
  if (!source || !/(?:\bmm\b|\bkg\b|\bhz\b|\bcm\b|\binch(?:es)?\b|\b(?:volt|volts|watt|watts)\b|×)/i.test(source)) return '';
  return source.trim().replace(/\.$/, '') + (locale === 'es' ? '.' : '.');
}

function buildCopy(product, locale) {
  const es = locale === 'es';
  const p = profile(product, locale);
  const model = modelOf(product);
  const name = es ? product.nombre_es : product.nombre_en;
  const brand = product.marca || (/led-rx|lampara-rodable-led/i.test(product.slug) ? 'Ilumitec' : 'Saikang Medical');
  const reference = es ? `la referencia ${model}` : `reference ${model}`;
  const detail = verifiedSpecs(product, locale);
  const technical = technicalSource(product, locale);
  const intro = es
    ? `${name} es ${reference} de ${brand} para ${p.area}. Está pensada para instituciones que necesitan resolver ${p.pain}, con una ficha técnica que permite validar la configuración antes de solicitar una cotización.`
    : `${name} is ${reference} from ${brand} for ${p.area}. It is intended for institutions dealing with ${p.pain}, with a datasheet that helps validate configuration before requesting a quote.`;
  const problem = es
    ? `En este tipo de servicio, el problema no suele ser únicamente adquirir un equipo: es integrarlo a un flujo con tiempos, recorridos, personal y protocolos concretos. ${name} ayuda a ${p.solution}. La selección debe considerar espacio disponible, intensidad de uso, accesorios, instalación y soporte que la institución necesita.`
    : `In this type of service, the challenge is not only buying equipment: it is fitting it into a workflow with specific times, routes, staff and protocols. ${name} helps to ${p.solution}. Selection should consider available space, workload, accessories, installation and the support the institution requires.`;
  const evidence = es
    ? `La referencia queda identificada por modelo y marca, y la documentación del fabricante sirve como base para comparar alternativas de forma trazable. ${detail}${technical ? ` La información publicada también indica: ${technical}` : ''}`
    : `The reference is identified by model and brand, while the manufacturer's documentation supports a traceable comparison. ${detail}${technical ? ` Published information also states: ${technical}` : ''}`;
  const comparison = es
    ? `Para comparar ${name} (${model}) con ${p.edge}, conviene revisar en esta referencia ${detail.toLowerCase()} La decisión puede basarse en la adecuación de ${name} al servicio, sus accesorios, instalación, mantenimiento y coste total de operación, no solo en el precio inicial.`
    : `To compare ${name} (${model}) with ${p.edge}, review this reference's ${detail.toLowerCase()} The decision can then consider how ${name} fits the service, its accessories, installation, maintenance and total operating cost—not only the initial price.`;
  const implementation = es
    ? `Antes de comprar, el equipo biomédico y el responsable del servicio deberían confirmar recorrido o espacio, usuarios, frecuencia de uso, limpieza, consumibles o accesorios, capacitación y mantenimiento. I-ME puede orientar la cotización con la ficha técnica y el contexto de la institución.`
    : `Before purchase, biomedical engineering and the service lead should confirm route or space, users, workload, cleaning, consumables or accessories, training and maintenance. I-ME can support the quote using the datasheet and institutional context.`;
  const long = [intro, problem, evidence, comparison, implementation].join('\n\n');
  const short = es
    ? `${name} para ${p.area}. Resuelve necesidades de ${p.noun} con referencia, ficha técnica y cotización para Colombia.`
    : `${name} for ${p.area}. Address ${p.noun} needs with an identifiable reference, datasheet and quotation support in Colombia.`;
  const benefits = es
    ? [
        `${name} (${model}) aborda ${p.pain} en ${p.area}.`,
        `${name} está documentado como ${p.noun}; esa identificación ayuda a compras, ingeniería biomédica y mantenimiento a pedir exactamente la configuración requerida.`,
        `La referencia ${model} permite revisar ${detail.replace(/^Entre los datos publicados que conviene revisar están: /i, '').replace(/\.$/, '')} antes de comparar o cotizar.`,
        `Frente a ${p.edge}, ${name} ofrece una base concreta para contrastar medidas, accesorios, instalación, limpieza y soporte según el flujo real del servicio.`,
        `La ficha de ${name} permite preparar una cotización con contexto de uso, espacio disponible, intensidad de trabajo y mantenimiento; no obliga a elegir por precio aislado.`,
        `I-ME canaliza disponibilidad y condiciones de entrega en Colombia para ${name}, manteniendo modelo, documentación y página de referencia en la solicitud.`,
      ]
    : [
        `${name} (${model}) addresses ${p.pain} in ${p.area}.`,
        `${name} is documented as ${p.noun}; that identification helps procurement, biomedical engineering and maintenance request the required configuration.`,
        `Reference ${model} lets teams review ${detail.replace(/^Published data worth reviewing include: /i, '').replace(/\.$/, '')} before comparing or requesting a quote.`,
        `Compared with ${p.edge}, ${name} provides a concrete basis for checking dimensions, accessories, installation, cleaning and support against the real workflow.`,
        `${name}'s datasheet supports a quote built around use case, available space, workload and maintenance—not isolated price.`,
        `I-ME can confirm availability and delivery conditions in Colombia for ${name}, keeping model, documentation and product page in the request.`,
      ];
  const faqs = es
    ? [
        { q: `¿Para qué sirve ${name}?`, a: `${name} está destinado a ${p.area}. Su utilidad concreta depende del protocolo, configuración y condiciones de cada institución; la ficha técnica ayuda a validar ese encaje antes de comprar.` },
        { q: `¿Qué problema ayuda a resolver la referencia ${model}?`, a: `Ayuda a abordar ${p.pain}. No reemplaza protocolos ni personal: aporta una referencia documentada para ordenar el flujo y reducir incertidumbre durante la evaluación.` },
        { q: `¿Qué debo revisar antes de cotizar este equipo?`, a: `Confirme espacio y recorrido, intensidad de uso, usuarios, accesorios, instalación, capacitación, mantenimiento y requisitos regulatorios aplicables. I-ME revisa estos datos junto con la ficha del fabricante.` },
        { q: `¿Dónde consulto las especificaciones de ${model}?`, a: `La ficha técnica está disponible en esta página para descarga. Las dimensiones, configuración y parámetros definitivos deben confirmarse en el documento del fabricante y en la cotización.` },
        { q: `¿Es mejor que una marca o producto similar?`, a: `No existe una respuesta universal. La comparación debe considerar adecuación al servicio, documentación, accesorios, soporte, mantenimiento y coste total. Esta referencia facilita una comparación trazable frente a opciones sin información suficiente.` },
      ]
    : [
        { q: `What is ${name} used for?`, a: `${name} is intended for ${p.area}. Its suitability depends on each institution's protocol, configuration and conditions; the datasheet helps validate the fit before purchase.` },
        { q: `What problem can reference ${model} help solve?`, a: `It helps address ${p.pain}. It does not replace protocols or staff; it provides documented equipment for a more predictable evaluation and workflow.` },
        { q: `What should I confirm before requesting a quote?`, a: `Confirm space and route, workload, users, accessories, installation, training, maintenance and applicable regulatory requirements. I-ME reviews these details with the manufacturer's datasheet.` },
        { q: `Where can I find ${model} specifications?`, a: `The technical datasheet is available for download on this page. Final dimensions, configuration and parameters must be confirmed in the manufacturer document and quotation.` },
        { q: `Is it better than a similar brand or product?`, a: `There is no universal answer. Compare service fit, documentation, accessories, support, maintenance and total cost. This reference enables a traceable comparison against options with insufficient information.` },
      ];
  return { short, long, benefits, faqs, applications: p.applications, model, noun: p.noun };
}

let updated = 0;
for (const product of products) {
  const catalogProduct = /saikang/i.test(`${product.marca ?? ''} ${product.slug}`)
    || /^skm-b-|^sk-cd1-|^led-rx|^lampara-rodable-led-rx/i.test(product.slug);
  if (!catalogProduct) continue;
  product.marca ??= /^led-rx|^lampara-rodable-led-rx/i.test(product.slug) ? 'Ilumitec' : 'Saikang Medical';
  const es = buildCopy(product, 'es');
  const en = buildCopy(product, 'en');
  product.descripcion_corta_es = es.short;
  product.descripcion_corta_en = en.short;
  product.descripcion_larga_es = es.long;
  product.descripcion_larga_en = en.long;
  product.aplicaciones_es = es.applications;
  product.aplicaciones_en = en.applications;
  product.beneficios_es = es.benefits;
  product.beneficios_en = en.benefits;
  product.preguntas_frecuentes_es = es.faqs;
  product.preguntas_frecuentes_en = en.faqs;
  product.valor_es = `La referencia ${es.model} se evalúa con ficha técnica, configuración y contexto de servicio para evitar compras genéricas que no resuelven el flujo real.`;
  product.valor_en = `Reference ${en.model} should be evaluated with its datasheet, configuration and service context to avoid generic purchases that do not fit the real workflow.`;
  const categoryEs = es.noun;
  const categoryEn = en.noun;
  product.seo_keywords_es = [...new Set([
    product.nombre_es, `${categoryEs} Saikang`, `${categoryEs} para hospitales`, `${categoryEs} para clínicas`, `${categoryEs} Colombia`, `ficha técnica ${es.model}`, `cotizar ${es.model}`, `precio ${categoryEs}`, `proveedor ${categoryEs} Colombia`, `equipos biomédicos ${categoryEs}`,
  ])];
  product.seo_keywords_en = [...new Set([
    product.nombre_en, `Saikang ${categoryEn}`, `${categoryEn} for hospitals`, `${categoryEn} for clinics`, `${categoryEn} Colombia`, `${en.model} datasheet`, `request a quote ${en.model}`, `${categoryEn} supplier Colombia`, `biomedical ${categoryEn}`,
  ])];
  updated += 1;
}
await writeFile(file, `${JSON.stringify(products, null, 2)}\n`);
console.log(`Saikang enriquecidos: ${updated}`);
