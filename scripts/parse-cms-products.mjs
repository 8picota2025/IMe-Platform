/**
 * F0 — Parseo de DEFAULT_PRODUCTS desde cms.js
 * Fuente de verdad: i-me.com.co/77/js/cms.js
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASE_URL = 'https://i-me.com.co/77'

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Datos extraídos directamente de cms.js (DEFAULT_PRODUCTS)
const DEFAULT_PRODUCTS = [
  { id: 1,  name: 'Monitor Multiparamétrico UCI Avanzado',       cat: 'monitores',     img: 'assets/img/portfolio/Img11.jpg', desc: 'Monitor táctil 15" para UCI. SpO2, NIBP, ECG 5 deriv., temperatura, capnografía. Alarmas inteligentes, conectividad DICOM.' },
  { id: 2,  name: 'Monitor Multiparamétrico Básico',             cat: 'monitores',     img: 'assets/img/portfolio/Img1.jpg',  desc: 'Monitor de signos vitales para hospitalización general. SpO2, NIBP, ECG 3 derivaciones, temperatura. Pantalla 10".' },
  { id: 3,  name: 'Monitor de Transporte Prehospitalario',       cat: 'monitores',     img: 'assets/img/portfolio/Img19.jpg', desc: 'Monitor compacto para ambulancias y traslados. Batería 4 horas, resistente a golpes, todas las variables vitales.' },
  { id: 4,  name: 'Monitor Central UCI Multicama',               cat: 'monitores',     img: 'assets/img/portfolio/Img18.jpg', desc: 'Estación central de monitoreo para gestión de camas en UCI. Hasta 32 monitores por central, alertas inteligentes.' },
  { id: 5,  name: 'Electrocardiógrafo 12 Derivaciones Digital',  cat: 'cardiologia',   img: 'assets/img/portfolio/Img6.jpg',  desc: 'ECG de 12 derivaciones con interpretación automática. Impresión térmica integrada, conectividad USB y red.' },
  { id: 6,  name: 'Desfibrilador Bifásico con Monitor',          cat: 'cardiologia',   img: 'assets/img/portfolio/Img6.jpg',  desc: 'Desfibrilador bifásico con monitoreo ECG, marcapasos externo y capnografía. Carga en menos de 7 segundos.' },
  { id: 7,  name: 'Holter 24 Horas Ritmo Cardíaco',              cat: 'cardiologia',   img: 'assets/img/portfolio/Img21.jpg', desc: 'Sistema Holter ambulatorio de 24 horas. Análisis automático de arritmias, taquicardias y bloqueos cardíacos.' },
  { id: 8,  name: 'Mesa Quirúrgica Motorizada Multiposición',    cat: 'sala-cirugia',  img: 'assets/img/portfolio/Img4.jpg',  desc: 'Mesa quirúrgica eléctrica con 6 posiciones motorizadas. Control por pedal y mando remoto. Altura ajustable 650–950mm.' },
  { id: 9,  name: 'Lámpara Cialítica LED Doble para Quirófano',  cat: 'sala-cirugia',  img: 'assets/img/portfolio/Img22.jpg', desc: 'Doble lámpara LED de 120.000 lux para quirófano. Sin sombras, temperatura de color 4500K, brazo de montaje en techo.' },
  { id: 10, name: 'Máquina de Anestesia con Ventilador',         cat: 'anestesia',     img: 'assets/img/portfolio/Img4.jpg',  desc: 'Máquina de anestesia con ventilador integrado. Vaporizadores intercambiables para sevoflurano e isoflurano. Monitor de agente.' },
  { id: 11, name: 'Incubadora Neonatal de Transporte',           cat: 'neonatologia',  img: 'assets/img/portfolio/Img25.jpg', desc: 'Incubadora neonatal de transporte con servo-temperatura, SpO2 integrado y batería de larga duración para traslados UCI.' },
  { id: 12, name: 'Cuna de Calor Radiante Neonatal Servo',       cat: 'neonatologia',  img: 'assets/img/portfolio/Img14.jpg', desc: 'Cuna de calor radiante con control servo-temperatura, fototerapia integrada y monitoreo de temperatura cutánea continuo.' },
  { id: 13, name: 'Ecógrafo Color Doppler Diagnóstico Vascular', cat: 'ultrasonido',   img: 'assets/img/portfolio/Img27.jpg', desc: 'Ecógrafo con Color Doppler y Power Doppler. Sondas multifrecuencia para aplicaciones abdominales, obstétricas y vasculares. DICOM WiFi.' },
  { id: 14, name: 'Ecógrafo Portátil con WiFi y DICOM',          cat: 'ultrasonido',   img: 'assets/img/portfolio/Img26.jpg', desc: 'Ecógrafo portátil inalámbrico con conectividad WiFi y soporte DICOM. Ideal para urgencias y uso en consultorio.' },
  { id: 15, name: 'Ultrasonido Point-of-Care Pocket',            cat: 'ultrasonido',   img: 'assets/img/portfolio/Img28.jpg', desc: 'Ecógrafo de bolsillo para smartphone. Sonda lineal y convexa, conectividad WiFi, batería 1 hora de uso continuo.' },
  { id: 16, name: 'Bomba de Infusión Volumétrica UCI',           cat: 'soluciones-iv', img: 'assets/img/portfolio/Img2.jpg',  desc: 'Bomba de infusión volumétrica de alta precisión. Control 0.1–1200 ml/h, alarmas de oclusión y aire, antibolus. Sets universales.' },
  { id: 17, name: 'Bomba de Jeringa Precisión Microdosis',       cat: 'soluciones-iv', img: 'assets/img/portfolio/Img2.jpg',  desc: 'Bomba de jeringa para microdosis en UCI. Exactitud ±2%, rango 0.1–1500 ml/h, compatible jeringas 10–60 ml.' },
  { id: 18, name: 'Camilla Hospitalaria Eléctrica Articulable',  cat: 'mobiliario',    img: 'assets/img/portfolio/Img7.jpg',  desc: 'Camilla hospitalaria eléctrica de 4 secciones. Control por botonera, barandas abatibles, capacidad 250 kg.' },
  { id: 19, name: 'Carro de Paro para Reanimación',              cat: 'mobiliario',    img: 'assets/img/portfolio/Img7.jpg',  desc: 'Carro de paro con candado central, bandeja de desfibrilador, cajones numerados y porta-monitor. Acero inoxidable.' },
  { id: 20, name: 'Monitor Fetal CTG con Impresora',             cat: 'neonatologia',  img: 'assets/img/portfolio/Img14.jpg', desc: 'Monitor de bienestar fetal con cardiotocografía. Pantalla táctil a color, impresión térmica integrada, STAN opcional.' },
  { id: 21, name: 'Electrocardiógrafo Inalámbrico Portátil',     cat: 'cardiologia',   img: 'assets/img/portfolio/Img21.jpg', desc: 'ECG de 12 derivaciones inalámbrico con transmisión a tablet o PC. Interpretación automática, almacenamiento de 100 ECGs.' },
  { id: 22, name: 'Sistema CPAP Neonatal para UCI',              cat: 'neonatologia',  img: 'assets/img/portfolio/Img25.jpg', desc: 'Sistema CPAP neonatal de flujo variable con generador de burbujas. Presión ajustable 2–10 cmH2O. Circuito desechable.' },
  { id: 23, name: 'Mesa Quirúrgica Ortopédica Radiolúcida',      cat: 'sala-cirugia',  img: 'assets/img/portfolio/Img22.jpg', desc: 'Mesa quirúrgica ortopédica con accesorios para cirugía de cadera y columna. Radiolúcida, superficie de carbono.' },
  { id: 24, name: 'Ventilador Mecánico UCI Adulto-Pediátrico',   cat: 'anestesia',     img: 'assets/img/portfolio/Img4.jpg',  desc: 'Ventilador mecánico para UCI adultos y pediatría. Modos AC, SIMV, CPAP, APRV, NAVA. Módulo de monitoreo integrado.' },
]

const CATEGORIES = {
  'monitores':     'Monitores de Signos Vitales',
  'cardiologia':   'Cardiología',
  'sala-cirugia':  'Sala de Cirugía',
  'neonatologia':  'Neonatología',
  'ultrasonido':   'Ultrasonido',
  'soluciones-iv': 'Soluciones IV',
  'mobiliario':    'Mobiliario Hospitalario',
  'anestesia':     'Anestesia y Ventilación',
}

// Productos destacados según la Home (los que aparecen en el carrusel)
const DESTACADOS_HOME = [1, 13, 11, 16, 6, 10, 23, 23]  // ids que aparecen en home carousel

const familias = Object.entries(CATEGORIES).map(([slug, nombre]) => ({
  slug,
  nombre,
  descripcion: '',
  url_origen: `${BASE_URL}/catalogo.html?cat=${slug}`,
}))

const productos = DEFAULT_PRODUCTS.map(p => ({
  id_origen: p.id,
  slug: slugify(p.name),
  slug_generado: true,
  nombre: p.name,
  familia: p.cat,
  tipo: null,
  descripcion_corta: p.desc,
  descripcion_larga: '',
  especificaciones: [],
  specs_raw: '',
  imagen_principal: `${BASE_URL}/${p.img}`,
  imagen_local: `public/assets/extraccion/img/${p.img.split('/').pop()}`,
  galeria: [],
  ficha_pdf: null,
  badges: DESTACADOS_HOME.includes(p.id) ? ['destacado'] : [],
  destacado: DESTACADOS_HOME.includes(p.id),
  nuevo: false,
  url_origen: `${BASE_URL}/catalogo.html?cat=${p.cat}`,
  notas_extraccion: 'Extraído de DEFAULT_PRODUCTS en cms.js (localStorage CMS)',
}))

const resultado = {
  fuente: `${BASE_URL}/`,
  fuente_datos: `${BASE_URL}/js/cms.js → DEFAULT_PRODUCTS`,
  fecha_extraccion: new Date().toISOString(),
  metodo_extraccion: 'datos-js',
  familias,
  productos,
  conteo: { familias: familias.length, productos: productos.length },
}

writeFileSync(
  join(ROOT, 'src', 'data', 'extraccion_ime.json'),
  JSON.stringify(resultado, null, 2),
  'utf8'
)

console.log('✓ extraccion_ime.json actualizado')
console.log(`  Familias: ${familias.length}`)
console.log(`  Productos: ${productos.length}`)
console.log(`  Destacados: ${productos.filter(p => p.destacado).length}`)
console.log('\nProductos por familia:')
for (const [cat, nombre] of Object.entries(CATEGORIES)) {
  const count = productos.filter(p => p.familia === cat).length
  console.log(`  ${nombre}: ${count}`)
}
