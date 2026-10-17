/**
 * PDFs de revisión (no son ofertas enviables).
 * - COP nacional: solo castellano, cuenta Bancolombia, enlace Wompi.
 * - USD: reproduce la estructura de IME-Q-2026-000042 con el correo y el
 *   teléfono de I-ME en la entrada. El PDF debe mostrar «-» en el cliente
 *   y los datos de I-ME solo en el emisor y el pie. Etiquetas en ES/EN.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { renderQuotePdf } from '../src/lib/render-quote-pdf.ts';

const logo = readFileSync('./public/assets/img/logo-ime-pdf.png');
const fontR = readFileSync('./public/fonts/Poppins-Regular.ttf');
const fontB = readFileSync('./public/fonts/Poppins-Bold.ttf');
const base = {
  logoBytes: logo,
  fontRegularBytes: fontR,
  fontBoldBytes: fontB,
  nombreComercial: 'Comercial Uno',
};

const cop = await renderQuotePdf({
  ...base,
  numero: 'IME-Q-2026-000041',
  clienteNombre: 'Ana Pérez',
  empresa: 'Clínica Ejemplo S.A.S.',
  email: 'compras@clinica-ejemplo.co',
  telefono: '+57 604 444 1000',
  nitCliente: '900123456-1',
  direccionCliente: 'Calle 10 # 20-30',
  ciudadCliente: 'Medellín',
  paisCliente: 'Colombia',
  condiciones:
    'Entrega sujeta a confirmación de existencias. Esta hoja es un ejemplo de revisión, no una oferta comercial.',
  validezHasta: '2026-11-16',
  moneda: 'COP',
  total: 150000,
  locale: 'es',
  idioma: 'es',
  condicionPago: 'Contado',
  impuestosIncluidos: false,
  wompiUrl: 'https://checkout.wompi.co/l/ejemplo',
  bancoLineas: ['Transferencia bancaria:', '61400006521', 'Bancolombia/Ahorros'],
  lineas: [
    {
      slug: 'linea-ejemplo',
      nombre: 'Línea de ejemplo nacional',
      cantidad: 1,
      precio_unitario: 150000,
      subtotal: 150000,
      moneda: 'COP',
      tratamiento_iva: 'excluido',
    },
  ],
});

const usd = await renderQuotePdf({
  ...base,
  numero: 'IME-Q-2026-000042',
  clienteNombre: 'Essam Yaseen',
  empresa: '2M Trading, Contracting & Facility Management W.L.L.',
  email: 'pendiente-2mtrading@i-me.com.co',
  telefono: '+573137247353',
  nitCliente: '',
  direccionCliente: '',
  ciudadCliente: 'Doha',
  paisCliente: 'Qatar',
  condiciones: `BORRADOR INTERNO - PRECIOS ESTIMADOS SIN OFERTA DE PROVEEDOR - NO ENVIAR
Incoterm: DDP Doha (Catar). Precios en dólares estadounidenses (USD). Flete, seguro y arancel en destino se presentan como líneas propias.
Tratamiento fiscal: operación de exportación; no se aplica IVA de Colombia. Tratamiento fiscal por confirmar (IVA/impuestos en Catar y en Colombia).
Condición de pago: 50 % de anticipo con la orden de compra y 50 % antes del embarque, mediante transferencia bancaria internacional en USD a la cuenta indicada.
Plazo de fabricación y entrega: por confirmar con el fabricante.
Garantía: 2 años sobre equipos y servicios asociados, desde la instalación.
Validez de la oferta: 30 días calendario.`,
  validezHasta: '2026-11-16',
  moneda: 'USD',
  total: 2365162.46,
  locale: 'es',
  idioma: 'es-en',
  condicionPago: '50 % anticipo OC / 50 % antes de embarque',
  impuestosIncluidos: true,
  wompiUrl: 'https://checkout.wompi.co/l/no-debe-salir',
  bancoLineas: [
    'Transferencia bancaria:',
    '0550108900697583',
    'Davivienda S.A.',
    'SWIFT: CAFECOBBXXX',
    'International Medical Enterprise IME S.A.S.',
  ],
  lineas: [
    {
      slug: 'integracion-quirofano',
      nombre: 'Sistema de integración de quirófano (por sala)',
      notas: '3 salas. Instalación, puesta en marcha, formación y garantía 2 años.',
      cantidad: 3,
      precio_unitario: 312253.43,
      subtotal: 936760.29,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
    {
      slug: 'torre-laparoscopia',
      nombre: 'Torre de laparoscopia 4K completa',
      notas: 'Cámara 4K, CCU, luz LED, insuflador, monitor, grabador, carro y accesorios.',
      cantidad: 3,
      precio_unitario: 416722.52,
      subtotal: 1250167.56,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
    {
      slug: 'flete',
      nombre: 'Flete internacional y seguro hasta Doha',
      notas: 'Transporte internacional y seguro de la carga hasta Doha (Catar).',
      cantidad: 1,
      precio_unitario: 65607.83,
      subtotal: 65607.83,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
    {
      slug: 'arancel',
      nombre: 'Arancel de importación en Catar (DDP)',
      notas: 'Derechos de importación para entrega DDP; sujeto a partida.',
      cantidad: 1,
      precio_unitario: 112626.78,
      subtotal: 112626.78,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
  ],
});

writeFileSync('/opt/cursor/artifacts/cotizacion-cop-es.pdf', cop);
writeFileSync('/opt/cursor/artifacts/cotizacion-usd-es-en.pdf', usd);
console.log('cop', cop.byteLength, 'usd', usd.byteLength);
