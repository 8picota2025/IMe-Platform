import { readFileSync, writeFileSync } from 'fs';
import { renderQuotePdf } from '../src/lib/render-quote-pdf.ts';

const logo = readFileSync('./public/assets/img/logo-ime-pdf.png');
const fontR = readFileSync('./public/fonts/Poppins-Regular.ttf');
const fontB = readFileSync('./public/fonts/Poppins-Bold.ttf');
let img = null;
try { img = readFileSync('./public/assets/img/sala-cirugia-robotica.jpg'); } catch {}
const bytes = await renderQuotePdf({
  numero: '1030',
  clienteNombre: 'Javier Ortiz',
  empresa: 'IPS Demo S.A.S.',
  email: 'cliente@demo.co',
  telefono: '+57 3001234567',
  nitCliente: '91424187-1',
  condiciones: 'Entrega 15 dias habiles. Garantia 12 meses. Instalacion incluida.',
  validezHasta: '2026-08-31',
  moneda: 'COP',
  total: 324939020,
  lineas: [
    { slug: 'yh-680-4g', nombre: 'Auto CPAP inteligente 4G', cantidad: 40, precio_unitario: 1912335, subtotal: 76493400, moneda: 'COP' },
    { slug: 'yh-550-4g', nombre: 'Auto CPAP 4G', cantidad: 40, precio_unitario: 1407600, subtotal: 56304000, moneda: 'COP' },
  ],
  locale: 'es',
  nombreComercial: 'Equipo comercial',
  logoBytes: logo,
  fontRegularBytes: fontR,
  fontBoldBytes: fontB,
  bancoLineas: ['Transferencia bancaria:', '61400006521', 'Bancolombia/Ahorros'],
  annexes: [{
    slug: 'yh-680-4g',
    nombre: 'Sistema de presion positiva inteligente BreathCare III REF. YH-680',
    sku: 'YH-680',
    resumen: 'Dispositivo de ultima generacion.',
    descripcion: 'Dispositivo de ultima generacion que redefine la terapia respiratoria a traves de la automatizacion inteligente. Disenado bajo un concepto de cuidado sin esfuerzo.',
    caracteristicas: [
      'Autogestion 4G (Inalambrica): modulo 4G integrado que transmite datos a la nube.',
      'Ajustes Todo Automatico: algoritmo avanzado con rampa automatica.',
      'Interaccion Tactil Simplificada: pantalla tactil de gran formato.',
    ],
    imageBytes: img,
  }],
});
writeFileSync('/tmp/ime-quote-sample.pdf', bytes);
console.log('wrote', bytes.byteLength);
