/**
 * PDFs de revisión (no son ofertas enviables).
 * - COP nacional: solo castellano, cuenta Bancolombia, enlace Wompi.
 * - USD: reproduce IME-Q-2026-000042 (ES/EN). NIT y dirección vacíos
 *   se imprimen como «—». Los datos de I-ME solo van en el emisor y el pie.
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
  email: 'bdm@2mqatar.com',
  telefono: '+97466007385',
  nitCliente: '',
  direccionCliente: '',
  ciudadCliente: 'Doha',
  paisCliente: 'Catar / Qatar',
  condiciones: `BORRADOR INTERNO - PRECIOS ESTIMADOS SIN OFERTA DE PROVEEDOR - NO ENVIAR
INCOTERM
DDP Doha (Catar). Precios en dólares estadounidenses (USD). Flete, seguro y arancel en destino se presentan como líneas propias.
TRATAMIENTO FISCAL
Operación de exportación; no se aplica IVA de Colombia. Tratamiento fiscal por confirmar (impuestos en Catar y en Colombia).
CONDICIÓN DE PAGO
50 % de anticipo con la orden de compra y 50 % antes del embarque, por transferencia bancaria internacional en USD a la cuenta indicada. Gastos bancarios del ordenante a su cargo. Cambios de datos bancarios solo con confirmación escrita y telefónica (+57 313 724 7353).
PLAZO DE ENTREGA
Fabricación y entrega por confirmar con el fabricante.
GARANTÍA Y FORMACIÓN
2 años sobre equipos y servicios asociados desde la instalación. Excluye consumibles, elementos de desgaste y daños por mal uso. Incluye instalación, pruebas, puesta en marcha, verificación de seguridad eléctrica y formación operativa (usuarios) y técnica (ingenieros biomédicos) en sitio.
COTIZADO APARTE / POR CONFIRMAR (no incluido en el precio)
- Despacho de aduanas, agente y entrega en la dirección final en Doha.
- Mantenimiento preventivo y correctivo tras la garantía, hasta 7 años desde la instalación.
- Repuestos y accesorios recomendados con precio individual.
- Consumibles con precio fijo durante 3 años.
- Formación de servicio en fábrica para ingenieros biomédicos del cliente.
- Soporte técnico local e ingenieros de servicio en Catar.
PENDIENTES
- Carta de autorización del fabricante (MAL) a favor de 2M Trading, Contracting & Facility Management W.L.L.
- Registro de los equipos ante el MoPH de Catar.
- Integración con sistemas del hospital (Cerner) y documentación MDS2, según especificaciones bajo NDA.
- Fabricante, modelos, país de origen, catálogos, FDA/CE, Declaración de Conformidad, manuales y referencias en Catar/GCC: con la propuesta técnica.
VALIDEZ
30 días calendario.`,
  condicionesEn: `INTERNAL DRAFT - ESTIMATED PRICES WITHOUT SUPPLIER QUOTE - DO NOT SEND
INCOTERM
DDP Doha (Qatar). Prices in US dollars (USD). Freight, insurance and destination duty are shown as separate lines.
TAX TREATMENT
Export sale; Colombian VAT does not apply. Tax treatment to be confirmed (Qatar and Colombia).
PAYMENT TERMS
50% advance with the purchase order and 50% before shipment, by international wire transfer in USD to the account shown. Remitter's bank charges for the buyer's account. Bank detail changes only with written and phone confirmation (+57 313 724 7353).
LEAD TIME
Manufacturing and delivery lead time to be confirmed by the manufacturer.
WARRANTY AND TRAINING
2 years on equipment and associated services from installation. Excludes consumables, wear parts and damage from misuse. Includes installation, testing, commissioning, on-site electrical safety checks, and on-site end-user and biomedical engineer training.
QUOTED SEPARATELY / TO BE CONFIRMED (not included in the price)
- Customs clearance, agent and delivery to the final site in Doha.
- Preventive and corrective maintenance after warranty, up to 7 years from installation.
- Recommended spare parts and accessories, individually priced.
- Consumables at fixed prices for 3 years.
- Service training at the manufacturer's facility for the client's biomedical engineers.
- Local technical support and service engineers in Qatar.
PENDING CONDITIONS
- Manufacturer Authorization Letter (MAL) in favor of 2M Trading, Contracting & Facility Management W.L.L.
- Equipment registration with the Qatar MoPH.
- Integration with hospital systems (Cerner) and MDS2 documentation, per specifications under NDA.
- Manufacturer, models, country of origin, catalogues, FDA/CE, Declaration of Conformity, manuals and Qatar/GCC references: with the technical proposal.
VALIDITY
30 calendar days.`,
  validezHasta: '2026-11-16',
  moneda: 'USD',
  total: 2365162.46,
  locale: 'es',
  idioma: 'es-en',
  condicionPago: '50 % anticipo con OC / 50 % antes de embarque',
  condicionPagoEn: '50% advance with PO / 50% before shipment',
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
      slug: '',
      nombre: 'Sistema de integración de quirófano (por sala)',
      nombre_en: 'OR Integration System (per room)',
      notas: '3 salas; instalación, puesta en marcha y formación.',
      notas_en: '3 rooms; installation, commissioning and training.',
      cantidad: 3,
      precio_unitario: 312253.43,
      subtotal: 936760.29,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
    {
      slug: '',
      nombre: 'Torre de laparoscopia 4K completa',
      nombre_en: 'Complete 4K Laparoscopy Tower',
      notas: 'Cámara 4K, CCU, luz LED, insuflador, monitor, grabador, carro.',
      notas_en: '4K camera, CCU, LED light, insufflator, monitor, recorder, cart.',
      cantidad: 3,
      precio_unitario: 416722.52,
      subtotal: 1250167.56,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
    {
      slug: '',
      nombre: 'Flete internacional y seguro hasta Doha',
      nombre_en: 'International freight and insurance to Doha',
      notas: 'Transporte y seguro de la carga hasta Doha (Catar).',
      notas_en: 'Transport and cargo insurance to Doha (Qatar).',
      cantidad: 1,
      precio_unitario: 65607.83,
      subtotal: 65607.83,
      moneda: 'USD',
      tratamiento_iva: 'excluido',
    },
    {
      slug: '',
      nombre: 'Arancel de importación en Catar (DDP)',
      nombre_en: 'Qatar import duty (DDP)',
      notas: 'Derechos para entrega DDP; sujeto a partida arancelaria.',
      notas_en: 'Duties for DDP delivery; subject to HS code.',
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
