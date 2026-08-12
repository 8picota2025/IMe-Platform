#!/usr/bin/env node
/**
 * Crea/actualiza landings Saikang desde fichas técnicas entregadas por fabricante.
 * Fuente única de archivos: /home/shoky/0 IME/saikang pdfs/FICHA TECNICA.
 * No descarga contenido externo ni infiere certificaciones, precios o prestaciones.
 */
import { createCanvas } from '@napi-rs/canvas';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const repoRoot = process.cwd();
const inputDir = '/home/shoky/0 IME/saikang pdfs/FICHA TECNICA';
const productsPath = path.join(repoRoot, 'src/data/mock-productos.json');
const assetRoot = path.join(repoRoot, 'public/assets/productos/importados');
const dryRun = process.argv.includes('--dry-run');

const MOBILIARIO = '3d631fe7-2f3b-4b43-a07c-861844755476';
const CIRUGIA = '42daf82e-4b05-479c-9557-74214a9e655b';
const GINECO = '2f70b322-e498-4924-8630-3a1ee268c01f';
const TRASLADO = '5c8c5719-4488-4723-99e6-77b7342c1a40';
const tipos = {
  camas: '4ee8572c-0766-4463-9adf-e77056fb1338', camillas: 'fd3f59cb-27cf-4fde-8422-ec71f2893cf4',
  mesas: '1e55f2c4-7408-4ed2-a885-cbc12a26cce2', carros: '2b86e33e-2846-4485-8057-a715ea179ed1',
  sillas: '62391ada-aa83-49d8-9019-64a26bd8f4ea', quirofano: '2effbcdd-fcbc-4184-90f3-f3636b4662a7',
  lamparas: '981d6cc2-2445-48eb-956c-1337ae4125d3', gineco: 'e01b746c-9916-4c17-8c1d-2b8fd4d8f269',
};

// modelo, nombre ES/EN y uso son derivados del título de cada ficha, no de copy inventado.
const LANDINGS = [
  ['A048', 'Mesa de Examen Ginecológico A048', 'A048 Gynecological Examination Table', 'gineco', GINECO, tipos.gineco, 'A048_Gynecological-Examination-Table_SaikangMedical.pdf'],
  ['A302', 'Mesa Quirúrgica Eléctrica A302', 'A302 Electric Operating Table', 'quirofano', CIRUGIA, tipos.quirofano, 'A302_Electric-Operating-Table_SaikangMedical.pdf'],
  ['A307', 'Mesa Quirúrgica Electrohidráulica A307', 'A307 Electric-Hydraulic Operating Table', 'quirofano', CIRUGIA, tipos.quirofano, 'A307_Electric-Hydraulic-Operating-Table_Saikang.pdf'],
  ['A99-5', 'Cama Obstétrica Eléctrica A99-5', 'A99-5 Electric Obstetric Bed', 'gineco', GINECO, tipos.gineco, 'A99-5_Electric-Obstetric-Bed_SaikangMedical.pdf'],
  ['A99-7', 'Cama Obstétrica Eléctrica A99-7', 'A99-7 Electric Obstetric Bed', 'gineco', GINECO, tipos.gineco, 'A99-7_Electric-Obstetric-Bed_SaikangMedical.pdf'],
  ['AInno L21', 'Columna de Techo Eléctrica de Doble Brazo AInno L21', 'AInno L21 Electric Double-Arm Pendant', 'quirofano', CIRUGIA, tipos.quirofano, 'AInno L21_Electric-Double-arm-Pendant_SaikangMedical.pdf'],
  ['AInno Light M', 'Lámpara Quirúrgica LED AInno Light M', 'AInno Light M LED Operating Lamp', 'lamparas', CIRUGIA, tipos.lamparas, 'AInno Light M_LED-Operation-Lamp_SaikangMedical.pdf'],
  ['AInno Light10', 'Lámpara Quirúrgica LED AInno Light10', 'AInno Light10 LED Operating Lamp', 'lamparas', CIRUGIA, tipos.lamparas, 'AInno Light10_LED-Operation-Lamp_SaikangMedical.pdf'],
  ['AInno Light20', 'Lámpara Quirúrgica LED AInno Light20', 'AInno Light20 LED Operating Lamp', 'lamparas', CIRUGIA, tipos.lamparas, 'AInno Light20_LED-Operation-Lamp_SaikangMedical.pdf'],
  ['AInno X22', 'Columna de Techo de Doble Brazo AInno X22', 'AInno X22 Double-Arm Pendant', 'quirofano', CIRUGIA, tipos.quirofano, 'AInno X22_Double-arm-Pendant_SaikangMedical.pdf'],
  ['AInno X71', 'Puente Médico UCI AInno X71', 'AInno X71 ICU Medical Bridge Ceiling Pendant', 'quirofano', CIRUGIA, tipos.quirofano, 'AInno X71_ICU-Medical-Bridge-Ceiling-Pendant_SaikangMedical.pdf'],
  ['D8d-CPR', 'Cama UCI Eléctrica D8d-CPR', 'D8d-CPR Electric ICU Bed', 'camas', MOBILIARIO, tipos.camas, 'D8d-CPR_Electric-ICU-Bed_SaikangMedical_高配.pdf'],
  ['SKB041-3 Backrest X-ray', 'Camilla de Traslado con Radiografía de Respaldo SKB041-3', 'SKB041-3 Patient Transportation Trolley with Backrest X-ray', 'camillas', TRASLADO, tipos.camillas, 'SKB041-3_Patient-Transportation-Trolley(Backrest-X-ray_SaikangMedical.pdf'],
  ['SKB041-3 Whole Body X-ray', 'Camilla de Traslado con Radiografía de Cuerpo Completo SKB041-3', 'SKB041-3 Patient Transportation Trolley with Whole-Body X-ray', 'camillas', TRASLADO, tipos.camillas, 'SKB041-3_Patient-Transportation-Trolley(Whole-Body-X-ray)_SaikangMedical.pdf'],
  ['SKB041-7 Backrest X-ray', 'Camilla de Traslado con Radiografía de Respaldo SKB041-7', 'SKB041-7 Patient Transportation Trolley with Backrest X-ray', 'camillas', TRASLADO, tipos.camillas, 'SKB041-7_Patient-Transportation-Trolley(Backrest-X-ray)_SaikangMedical.pdf'],
  ['SKB041-7 Whole Body X-ray', 'Camilla de Traslado con Radiografía de Cuerpo Completo SKB041-7', 'SKB041-7 Patient Transportation Trolley with Whole-Body X-ray', 'camillas', TRASLADO, tipos.camillas, 'SKB041-7_Patient-Transportation-Trolley(Whole-Body-X-ray)_SaikangMedical.pdf'],
  // La taxonomía remota aún no tiene tipo "sillas-y-sillones-clinicos". Se conserva familia
  // y se deja tipo nulo hasta crear dicha taxonomía, evitando romper la integridad referencial.
  ['SKE-136', 'Sillón Eléctrico de Diálisis SKE-136', 'SKE-136 Electric Dialysis Chair', 'sillas', MOBILIARIO, null, 'SKE-136_Electric-Dialysis-Chair_SaikangMedical.pdf'],
  ['SKE091', 'Sillón para Donación de Sangre SKE091', 'SKE091 Blood Donation Chair', 'sillas', MOBILIARIO, null, 'SKE091_Blood-Donation-Chair_SaikangMedical.pdf'],
  ['SKH004', 'Carro de Instrumental SKH004', 'SKH004 Instrument Trolley', 'carros', MOBILIARIO, tipos.carros, 'SKH004_Instrument-Trolley_SaikangMedical.pdf', 'skm-b-skh004'],
  ['SKH006', 'Carro de Instrumental SKH006', 'SKH006 Instrument Trolley', 'carros', MOBILIARIO, tipos.carros, 'SKH006_Instrument-Trolley_SaikangMedical.pdf', 'skm-b-skh006-1'],
  ['SKH046-11', 'Mesa de Sobrecama SKH046-11', 'SKH046-11 Overbed Table', 'mesas', MOBILIARIO, tipos.mesas, 'SKH046-11_Overbed-Table_SaikangMedical.pdf', 'skh046-11'],
  ['SKH046-14', 'Mesa de Sobrecama SKH046-14', 'SKH046-14 Overbed Table', 'mesas', MOBILIARIO, tipos.mesas, 'SKH046-14_Overbed-Table_SaikangMedical.pdf'],
  ['SKH046-26', 'Mesa de Sobrecama SKH046-26', 'SKH046-26 Overbed Table', 'mesas', MOBILIARIO, tipos.mesas, 'SKH046-26_Overbed-Table_SaikangMedical.pdf'],
  ['SKR054-AT', 'Carro de Anestesia SKR054-AT', 'SKR054-AT Anesthesia Trolley', 'carros', MOBILIARIO, tipos.carros, 'SKR054-AT_Anesthesia-Trolley_SaikangMedical.pdf', 'skm-b-skr054-at'],
  ['SKR054-MT', 'Carro de Medicamentos SKR054-MT', 'SKR054-MT Medicine Trolley', 'carros', MOBILIARIO, tipos.carros, 'SKR054-MT_Medicine-Trolley_SaikangMedical.pdf', 'skm-b-skr054-mt'],
  ['SKS02-W', 'Mesa de Noche Hospitalaria ABS SKS02-W', 'SKS02-W ABS Bedside Table', 'mesas', MOBILIARIO, tipos.mesas, 'SKS02-W_ABS-Bedside-Table_SaikangMedical.pdf'],
  ['SKS025', 'Mesa de Noche Hospitalaria en Resina Fenólica SKS025', 'SKS025 Phenolic Resin Bedside Table', 'mesas', MOBILIARIO, tipos.mesas, 'SKS025_Phenolic-Resin-Bedside-Table_SaikangMedical.pdf', 'sks025'],
  ['SKS03-W', 'Mesa de Noche Hospitalaria ABS SKS03-W', 'SKS03-W ABS Bedside Table', 'mesas', MOBILIARIO, tipos.mesas, 'SKS03-W_ABS-Bedside-Table_SaikangMedical.pdf'],
  ['V6k', 'Cama Eléctrica Hospitalaria V6k', 'V6k Electric Hospital Bed', 'camas', MOBILIARIO, tipos.camas, 'V6k_Electric-Bed_SaikangMedical.pdf'],
  ['V8v', 'Cama UCI Eléctrica V8v', 'V8v Electric ICU Bed', 'camas', MOBILIARIO, tipos.camas, 'V8v_Electric-ICU-Bed_SaikangMedical_All in.pdf'],
  ['X09', 'Mesa de Examen X09', 'X09 Examination Table', 'mesas', MOBILIARIO, tipos.mesas, 'X09_Examination-Table_SaikangMedical.pdf'],
  ['X14', 'Mesa de Examen Hidráulica X14', 'X14 Hydraulic Examination Table', 'mesas', MOBILIARIO, tipos.mesas, 'X14_Hydraulic-Examination-Table_SaikangMedical.pdf'],
  ['Y8t', 'Cama UCI Eléctrica Y8t', 'Y8t Electric ICU Bed', 'camas', MOBILIARIO, tipos.camas, 'Y8t_Electric-ICU-Bed_SaikangMedical.pdf'],
];

function slugify(value) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function copyFor(kind, locale) {
  const es = locale === 'es';
  const names = {
    camas: es ? 'cama hospitalaria' : 'hospital bed', camillas: es ? 'camilla de traslado' : 'patient transport trolley',
    quirofano: es ? 'equipo para quirófano' : 'operating-room equipment', lamparas: es ? 'lámpara quirúrgica' : 'operating lamp',
    gineco: es ? 'equipo de ginecología y obstetricia' : 'gynecology and obstetrics equipment', sillas: es ? 'sillón clínico' : 'clinical chair',
    carros: es ? 'carro clínico' : 'clinical trolley', mesas: es ? 'mesa clínica' : 'clinical table',
  };
  const noun = names[kind] ?? (es ? 'equipo clínico' : 'clinical equipment');
  const context = {
    camas: es
      ? 'la postura del paciente, la continuidad del cuidado y las exigencias de cada unidad'
      : 'patient positioning, continuity of care, and each unit\'s workflow requirements',
    camillas: es
      ? 'el traslado intrahospitalario y la coordinación con los servicios de diagnóstico'
      : 'intra-hospital transport and coordination with diagnostic services',
    quirofano: es
      ? 'la organización del entorno de procedimiento y el acceso del equipo asistencial'
      : 'procedure-room organization and care-team access',
    lamparas: es
      ? 'la visibilidad del campo de trabajo durante procedimientos'
      : 'visibility of the working field during procedures',
    gineco: es
      ? 'la preparación del área de examen, procedimiento o atención obstétrica'
      : 'preparing the examination, procedure, or obstetric care area',
    sillas: es
      ? 'la comodidad y el soporte operativo en sesiones clínicas prolongadas'
      : 'comfort and operational support during extended clinical sessions',
    carros: es
      ? 'la organización de insumos y la continuidad del flujo asistencial'
      : 'supply organization and continuity of clinical workflow',
    mesas: es
      ? 'el acceso funcional a superficies de apoyo en la atención clínica'
      : 'functional access to support surfaces in clinical care',
  }[kind] ?? (es ? 'el flujo asistencial' : 'clinical workflow');
  const comparison = es
    ? 'Frente a alternativas de otras marcas o modelos similares, la comparación responsable debe contrastar configuración exacta, dimensiones, capacidad cuando aplique, accesorios, instalación, soporte y ficha técnica vigente; no asumir equivalencias por nombre o fotografía.'
    : 'Against alternatives from other brands or similar models, a responsible comparison should verify the exact configuration, dimensions, capacity where applicable, accessories, installation, support, and current datasheet; equivalence must not be assumed from a name or photograph.';
  return {
    corta: es
      ? `${noun} Saikang ${'{model}'} para instituciones que buscan resolver ${context} con evaluación técnica trazable.`
      : `Saikang ${noun} ${'{model}'} for institutions addressing ${context} through a traceable technical evaluation.`,
    larga: es
      ? `El modelo ${'{model}'} de Saikang está orientado a instituciones que necesitan abordar ${context}. Su pertinencia depende del flujo real del servicio, la configuración requerida y las condiciones de instalación definidas por la institución.\n\nEsta landing convierte la ficha técnica original del fabricante en una ruta de evaluación: identifica el modelo, reúne parámetros publicados, enumera aplicaciones institucionales y conserva acceso directo a la documentación. Así, compras, ingeniería clínica y responsables asistenciales pueden partir de la misma información verificable.\n\n${comparison} I-ME puede validar con la institución la configuración disponible, alcance de suministro y condiciones comerciales antes de cotizar.`
      : `Saikang model ${'{model}'} is intended for institutions that need to address ${context}. Its fit depends on the service's actual workflow, required configuration, and installation conditions defined by the institution.\n\nThis page turns the manufacturer's original datasheet into an evaluation path: it identifies the model, brings together published parameters, lists institutional applications, and keeps direct access to documentation. Procurement, clinical engineering, and care leaders can therefore work from the same verifiable information.\n\n${comparison} I-ME can validate the available configuration, scope of supply, and commercial conditions with the institution before quotation.`,
    beneficios: es ? [
      `Problema que ayuda a evaluar: ${context}.`,
      `Modelo ${'{model}'} identificado con ficha técnica original del fabricante.`,
      'Criterios comparables en una sola landing: aplicación, especificaciones publicadas y documentación.',
      'Evita decidir por apariencia: confirme configuración, accesorios, instalación y soporte antes de comparar ofertas.',
      'Cotización institucional para validar disponibilidad y condiciones comerciales de la configuración requerida.',
    ] : [
      `Evaluation problem addressed: ${context}.`,
      `Model ${'{model}'} identified with the original manufacturer datasheet.`,
      'Comparable criteria in one page: applications, published specifications, and documentation.',
      'Avoid appearance-led decisions: confirm configuration, accessories, installation, and support before comparing offers.',
      'Institutional quotation to validate availability and commercial terms for the required configuration.',
    ],
    valor: es
      ? `Ventaja práctica frente a alternativas poco documentadas: I-ME centraliza la ficha técnica original y el canal de validación comercial para evaluar ${'{model}'} con criterios trazables. La decisión debe basarse en ajuste al proceso, configuración confirmada y soporte requerido, no en afirmaciones genéricas de superioridad.`
      : `A practical advantage over poorly documented alternatives: I-ME centralizes the original datasheet and commercial validation channel to assess ${'{model}'} using traceable criteria. The decision should be based on workflow fit, confirmed configuration, and required support—not generic claims of superiority.`,
  };
}

function faqFor(model, kind, locale) {
  const es = locale === 'es';
  const subject = {
    camas: es ? 'una cama hospitalaria o UCI' : 'a hospital or ICU bed',
    camillas: es ? 'una camilla de traslado' : 'a patient transport trolley',
    quirofano: es ? 'este equipo de quirófano' : 'this operating-room equipment',
    lamparas: es ? 'una lámpara quirúrgica' : 'an operating lamp',
    gineco: es ? 'este equipo de ginecología u obstetricia' : 'this gynecology or obstetrics equipment',
    sillas: es ? 'este sillón clínico' : 'this clinical chair',
    carros: es ? 'este carro clínico' : 'this clinical trolley',
    mesas: es ? 'esta mesa clínica' : 'this clinical table',
  }[kind] ?? (es ? 'este equipo' : 'this equipment');
  return es ? [
    { q: `¿Qué problema institucional ayuda a evaluar ${model}?`, a: `La evaluación de ${model} parte de su encaje con ${subject}: flujo del servicio, área de uso, configuración requerida y condiciones de instalación. La ficha técnica publicada permite iniciar esa revisión sin asumir prestaciones no documentadas.` },
    { q: `¿Cómo comparar ${model} con productos similares u otras marcas?`, a: 'Compare la configuración exacta, especificaciones publicadas, dimensiones, capacidad cuando aplique, accesorios incluidos, requisitos de instalación, disponibilidad, soporte y documentación vigente. Una comparación por fotografía, nombre comercial o precio aislado no confirma equivalencia técnica.' },
    { q: `¿Qué información valida I-ME antes de cotizar ${model}?`, a: 'I-ME revisa con la institución la configuración requerida, disponibilidad, alcance de suministro y condiciones comerciales. Para parámetros técnicos, accesorios, instalación o compatibilidad no publicados, se debe confirmar la información con la ficha vigente y la propuesta correspondiente.' },
  ] : [
    { q: `What institutional problem does ${model} help evaluate?`, a: `Assessment of ${model} starts with its fit for ${subject}: service workflow, use area, required configuration, and installation conditions. The published datasheet supports that review without assuming undocumented capabilities.` },
    { q: `How should ${model} be compared with similar products or other brands?`, a: 'Compare the exact configuration, published specifications, dimensions, capacity where applicable, included accessories, installation requirements, availability, support, and current documentation. A photograph, commercial name, or price alone does not establish technical equivalence.' },
    { q: `What information does I-ME validate before quoting ${model}?`, a: 'I-ME reviews the required configuration, availability, scope of supply, and commercial terms with the institution. For technical parameters, accessories, installation, or compatibility not published, confirmation should come from the current datasheet and the corresponding proposal.' },
  ];
}

function seoKeywords(model, nombre, kind, locale) {
  const es = locale === 'es';
  const category = {
    camas: es ? 'cama hospitalaria' : 'hospital bed', camillas: es ? 'camilla de traslado' : 'patient transport trolley',
    quirofano: es ? 'equipo de quirófano' : 'operating room equipment', lamparas: es ? 'lámpara quirúrgica LED' : 'LED operating lamp',
    gineco: es ? 'equipo de ginecología y obstetricia' : 'gynecology and obstetrics equipment', sillas: es ? 'sillón clínico' : 'clinical chair',
    carros: es ? 'carro clínico' : 'clinical trolley', mesas: es ? 'mesa clínica hospitalaria' : 'hospital clinical table',
  }[kind] ?? (es ? 'equipo biomédico' : 'biomedical equipment');
  return es
    ? [nombre, `${model} Saikang`, `${category} Saikang`, `${category} Colombia`, `${category} para hospitales`, `${category} para clínicas`, `ficha técnica ${model}`, `cotizar ${model}`, `comparar ${category}`, `proveedor de ${category} Colombia`, 'mobiliario hospitalario Saikang']
    : [nombre, `${model} Saikang`, `Saikang ${category}`, `${category} Colombia`, `${category} for hospitals`, `${category} for clinics`, `${model} datasheet`, `request a quote for ${model}`, `compare ${category}`, `${category} supplier Colombia`, 'Saikang hospital furniture'];
}
function applications(kind, locale) {
  const es = locale === 'es';
  const map = {
    camas: es ? ['Hospitalización', 'Unidades de cuidado intensivo', 'Servicios clínicos institucionales'] : ['Inpatient care', 'Intensive care units', 'Institutional clinical services'],
    camillas: es ? ['Traslado intrahospitalario', 'Urgencias', 'Servicios de diagnóstico'] : ['Intra-hospital transport', 'Emergency departments', 'Diagnostic services'],
    quirofano: es ? ['Quirófanos', 'Áreas de procedimiento', 'Servicios quirúrgicos'] : ['Operating rooms', 'Procedure areas', 'Surgical services'],
    lamparas: es ? ['Quirófanos', 'Procedimientos clínicos', 'Áreas quirúrgicas'] : ['Operating rooms', 'Clinical procedures', 'Surgical areas'],
    gineco: es ? ['Ginecología y obstetricia', 'Salas de parto', 'Áreas de examen'] : ['Gynecology and obstetrics', 'Delivery rooms', 'Examination areas'],
    sillas: es ? ['Servicios ambulatorios', 'Unidades especializadas', 'Áreas de tratamiento'] : ['Outpatient services', 'Specialized units', 'Treatment areas'],
    carros: es ? ['Hospitalización', 'Áreas de procedimiento', 'Logística clínica'] : ['Inpatient care', 'Procedure areas', 'Clinical logistics'],
    mesas: es ? ['Hospitalización', 'Consultorios', 'Áreas clínicas'] : ['Inpatient care', 'Consulting rooms', 'Clinical areas'],
  };
  return map[kind] ?? map.mesas;
}
async function renderFirstPage(pdfPath, pngPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.25 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  await writeFile(pngPath, canvas.toBuffer('image/png'));
}
async function extractTechnicalFacts(pdfPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    text += ` ${(await page.getTextContent()).items.map(item => item.str).join(' ')}`;
  }
  const normalized = text.replace(/\s+/g, ' ');
  const patterns = [
    /(?:external size|bedside cabinet dimensions|cart dimensions|length\/width|size)\s*[^▪]{3,110}(?=▪|technical configuration|features|product data sheet|$)/ig,
    /(?:safe working load|carrying capacity|load capacity)\s*[^▪]{3,90}(?=▪|technical configuration|features|product data sheet|$)/ig,
    /(?:height adjustment|height elevating\/lowering)\s*[^▪]{3,90}(?=▪|technical configuration|features|product data sheet|$)/ig,
    /(?:back-?rest adjustment|illumination|color temperature)\s*[^▪]{3,90}(?=▪|technical configuration|features|product data sheet|$)/ig,
  ];
  const facts = [];
  for (const pattern of patterns) {
    const match = pattern.exec(normalized)?.[0]?.replace(/[•▪]+/g, '').trim();
    if (match && !facts.some(fact => fact.toLowerCase() === match.toLowerCase())) facts.push(match);
  }
  return facts.slice(0, 4);
}
function detectedSpecs(model, productType, technicalFacts) {
  return [
    { clave: 'Modelo', grupo: 'Identificación', valor: model },
    { clave: 'Tipo de equipo', grupo: 'Identificación', valor: productType },
    { clave: 'Fabricante', grupo: 'Fabricante', valor: 'Jiangsu Saikang Medical Equipment Co., Ltd.' },
    { clave: 'Documentación', grupo: 'Documentación', valor: 'Ficha técnica del fabricante disponible para descarga' },
    ...technicalFacts.map((valor, index) => ({ clave: `Parámetro técnico ${index + 1}`, grupo: 'Ficha técnica', valor })),
  ];
}

const products = JSON.parse(await readFile(productsPath, 'utf8'));
let created = 0; let updated = 0;
for (const [model, nombreEs, nombreEn, kind, familiaId, tipoId, pdfName, existingSlug] of LANDINGS) {
  const slug = existingSlug ?? `saikang-${slugify(model)}`;
  const pdfPath = path.join(inputDir, pdfName);
  const targetDir = path.join(assetRoot, slug);
  const pdfFile = 'ficha-tecnica-saikang.pdf';
  const imageFile = 'imagen-principal-ficha-tecnica.png';
  const assetPdf = `/assets/productos/importados/${slug}/${pdfFile}`;
  const assetImage = `/assets/productos/importados/${slug}/${imageFile}`;
  const technicalFacts = await extractTechnicalFacts(pdfPath);
  if (!dryRun) {
    await mkdir(targetDir, { recursive: true });
    await copyFile(pdfPath, path.join(targetDir, pdfFile));
    await renderFirstPage(pdfPath, path.join(targetDir, imageFile));
  }
  const es = copyFor(kind, 'es'); const en = copyFor(kind, 'en');
  const fill = value => value.replaceAll('{model}', model);
  const current = products.find(product => product.slug === slug);
  const base = current ?? { id: randomUUID(), slug, orden: products.length + 1, destacado: false };
  const record = {
    ...base, familia_id: familiaId, familia_slug: familiaId === CIRUGIA ? 'sala-cirugia' : familiaId === GINECO ? 'neonatologia' : familiaId === TRASLADO ? 'emergencias-traslado-inmovilizacion' : 'mobiliario', tipo_id: tipoId,
    nombre_es: nombreEs, nombre_en: nombreEn, descripcion_corta_es: fill(es.corta), descripcion_corta_en: fill(en.corta), descripcion_larga_es: fill(es.larga), descripcion_larga_en: fill(en.larga),
    especificaciones: detectedSpecs(model, nombreEs, technicalFacts), imagen_principal: current?.imagen_principal ?? assetImage, galeria: current?.galeria?.length ? current.galeria : [assetImage], ficha_pdf: assetPdf,
    tipo_comercial: 'equipo', fulfillment_mode: 'cotizacion', precio: null, moneda: 'COP', stock: null, disponible: true, nuevo: true, activo: true,
    aplicaciones_es: applications(kind, 'es'), aplicaciones_en: applications(kind, 'en'), beneficios_es: es.beneficios.map(fill), beneficios_en: en.beneficios.map(fill), valor_es: fill(es.valor), valor_en: fill(en.valor),
    preguntas_frecuentes_es: faqFor(model, kind, 'es'), preguntas_frecuentes_en: faqFor(model, kind, 'en'), marca: 'Saikang Medical',
    seo_keywords_es: seoKeywords(model, nombreEs, kind, 'es'), seo_keywords_en: seoKeywords(model, nombreEn, kind, 'en'),
  };
  if (current) { Object.assign(current, record); updated += 1; } else { products.push(record); created += 1; }
}
if (!dryRun) await writeFile(productsPath, `${JSON.stringify(products, null, 2)}\n`);
console.log(`${dryRun ? 'Validación' : 'Importación'} Saikang: ${created} creados, ${updated} actualizados, ${LANDINGS.length} fichas procesadas.`);
