export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  badge: string;
  pageTitle: string;
  heading: string;
  description: string;
  summary: string;
  updatedAt: string;
  notice: string;
  sections: LegalSection[];
}

export const legalEs = {
  privacidad: {
    badge: 'Política validada',
    pageTitle: 'Política de privacidad y tratamiento de datos personales',
    heading: 'Política de privacidad y tratamiento de datos personales',
    description:
      'Política completa de privacidad y tratamiento de datos personales de I-ME para formularios, cotizaciones, pedidos, pagos, soporte y comunicaciones comerciales.',
    summary:
      'Política aplicable al tratamiento de datos personales recolectados por I-ME a través del sitio web, formularios, cotizaciones, pedidos, soporte y comunicaciones comerciales.',
    updatedAt: 'Última actualización: 2026-06-12',
    notice:
      'este documento hace parte de las políticas publicadas y vigentes de I-ME International Medical Enterprise.',
    sections: [
      {
        title: 'Identificación del responsable',
        paragraphs: [
          'El responsable del tratamiento es INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., identificada comercialmente como I-ME International Medical Enterprise.',
          'Datos de contacto informados: NIT 901871720-1, domicilio principal en CL 28 SUR 29 83, Envigado, Antioquia, Colombia, correo inmedicalime@gmail.com y canal de contacto comercial por WhatsApp o teléfono.',
        ],
      },
      {
        title: 'Marco normativo y alcance',
        paragraphs: [
          'La política se interpreta conforme al artículo 15 de la Constitución Política de Colombia, la Ley 1581 de 2012 y su reglamentación aplicable, así como las demás normas colombianas que regulen protección de datos, comercio electrónico y relaciones de consumo.',
          'Aplica al tratamiento de datos recolectados a través de formularios del sitio, solicitudes de cotización, pedidos, pagos, soporte técnico, mantenimiento, garantías, comunicaciones comerciales y registros técnicos de seguridad o trazabilidad.',
        ],
      },
      {
        title: 'Datos que pueden ser tratados',
        paragraphs: [
          'I-ME podrá tratar datos de identificación y contacto, datos institucionales o comerciales, información transaccional necesaria para pedidos o pagos, y registros técnicos mínimos para seguridad, prevención de fraude, auditoría y funcionamiento del sitio.',
          'El sitio no solicita historias clínicas ni información sensible de pacientes. Si un usuario remite datos sensibles sin ser requeridos, I-ME deberá abstenerse de usarlos fuera del marco legal y operativo autorizado.',
        ],
      },
      {
        title: 'Finalidades del tratamiento',
        paragraphs: [
          'Los datos podrán utilizarse para responder solicitudes, elaborar cotizaciones, coordinar pedidos, entregas, instalación, soporte, garantías, facturación, pagos, seguimiento comercial y atención posventa.',
          'También podrán emplearse para prevención de fraude, cumplimiento legal, trazabilidad operativa y envío de comunicaciones comerciales o informativas cuando exista autorización o base legal suficiente.',
        ],
      },
      {
        title: 'Derechos del titular',
        paragraphs: [
          'El titular podrá conocer, actualizar, rectificar y suprimir sus datos; solicitar prueba de la autorización; revocar el consentimiento cuando proceda; y presentar consultas o reclamos ante I-ME y, de ser necesario, ante la Superintendencia de Industria y Comercio.',
          'Las solicitudes relacionadas con habeas data podrán tramitarse a través del canal informado por la empresa para atención de datos personales.',
        ],
      },
      {
        title: 'Seguridad, conservación y terceros',
        paragraphs: [
          'I-ME adoptará medidas razonables de seguridad administrativa, técnica y organizacional acordes con la naturaleza de la información tratada y con los servicios tecnológicos utilizados.',
          'Cuando sea necesario, la empresa podrá compartir información con fabricantes, proveedores logísticos, pasarelas de pago, plataformas tecnológicas y aliados operativos estrictamente necesarios para atender la solicitud o cumplir obligaciones contractuales o legales.',
        ],
      },
    ],
  },
  terminos: {
    badge: 'Términos validados',
    pageTitle: 'Términos y condiciones de uso, catálogo, cotizaciones y servicios',
    heading: 'Términos y condiciones de uso, catálogo, cotizaciones y servicios',
    description:
      'Términos y condiciones de uso del sitio, catálogo, cotizaciones, comercio electrónico, servicios, garantías y financiación orientativa de I-ME.',
    summary:
      'Condiciones de uso del sitio y reglas aplicables a catálogo, cotizaciones, servicios, pagos, entregas, garantías, financiación y contenidos informativos publicados por I-ME.',
    updatedAt: 'Última actualización: 2026-06-15',
    notice:
      'este documento regula el uso del sitio, las solicitudes comerciales y las interacciones asociadas con productos y servicios de I-ME.',
    sections: [
      {
        title: 'Identificación del operador',
        paragraphs: [
          'El sitio https://i-me.com.co opera bajo la marca I-ME International Medical Enterprise y corresponde a INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., sociedad colombiana del sector de tecnología biomédica.',
          'La empresa informa como datos de referencia NIT 901871720-1, matrícula mercantil 277293, domicilio principal en Envigado, Antioquia, Colombia, y correo corporativo de contacto.',
        ],
      },
      {
        title: 'Naturaleza del sitio',
        paragraphs: [
          'El sitio publica información comercial y técnica sobre equipos biomédicos, consumibles, servicios de soporte, mantenimiento, instalación, capacitación y financiación orientativa.',
          'La información del sitio no constituye diagnóstico médico, asesoría clínica, oferta irrevocable ni concepto legal o financiero, salvo que una propuesta formal emitida por I-ME lo indique de manera expresa.',
        ],
      },
      {
        title: 'Cotizaciones, precios y disponibilidad',
        paragraphs: [
          'Las solicitudes realizadas por formularios, correo, WhatsApp o cualquier canal del sitio no implican aceptación automática de venta. Toda cotización está sujeta a disponibilidad, validación técnica, condiciones comerciales, inventario, impuestos, transporte y aprobación interna cuando aplique.',
          'Los precios, plazos, garantías y condiciones finales se confirman en cada propuesta formal. Si no se indica otra vigencia, la cotización podrá manejar una referencia operativa limitada y sujeta a cambios de mercado, fabricante o importación.',
        ],
      },
      {
        title: 'Pagos y comercio electrónico',
        paragraphs: [
          'Cuando existan pagos en línea habilitados, el precio, el stock, la moneda, los impuestos y las condiciones de la orden deberán validarse del lado del servidor antes de redirigir al usuario a la pasarela correspondiente.',
          'Una transacción sólo se considerará aprobada cuando exista confirmación técnica válida por parte de la pasarela y de los sistemas de I-ME. Un intento de pago o una captura de pantalla no equivalen a aprobación definitiva.',
        ],
      },
      {
        title: 'Entregas, instalación, garantías y soporte',
        paragraphs: [
          'Las condiciones de entrega, instalación, puesta en marcha, capacitación, mantenimiento y soporte se definen según el tipo de producto, ciudad, complejidad técnica y alcance contratado en la propuesta o factura.',
          'Las garantías se rigen por la propuesta formal, la documentación del fabricante y la normativa aplicable. No cubren uso indebido, intervención no autorizada, accidentes, desgaste natural de consumibles o incumplimiento de condiciones técnicas de operación.',
        ],
      },
      {
        title: 'Financiación y uso del contenido',
        paragraphs: [
          'La financiación publicada en el sitio es orientativa y está sujeta a evaluación, políticas vigentes, documentación y aprobación de la operación. No constituye promesa de crédito automática.',
          'Todos los contenidos del sitio son propiedad de I-ME o de sus titulares legítimos y no podrán reproducirse, distribuirse o explotarse sin autorización, salvo los usos permitidos por la ley.',
        ],
      },
    ],
  },
  habeasData: {
    badge: 'Autorización validada',
    pageTitle: 'Autorización para el tratamiento de datos personales',
    heading: 'Autorización para el tratamiento de datos personales',
    description:
      'Autorización para el tratamiento de datos personales en solicitudes comerciales, cotizaciones, pedidos, soporte y comunicaciones de I-ME.',
    summary:
      'Texto de autorización aplicable a formularios y canales comerciales mediante los cuales el usuario autoriza a I-ME el tratamiento de sus datos personales.',
    updatedAt: 'Última actualización: 2026-06-12',
    notice:
      'este texto respalda la evidencia de consentimiento utilizada por I-ME en formularios, solicitudes comerciales y canales de atención.',
    sections: [
      {
        title: 'Responsable del tratamiento',
        paragraphs: [
          'La autorización se otorga a INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., identificada comercialmente como I-ME International Medical Enterprise, para recolectar y tratar los datos personales suministrados por el titular.',
          'El tratamiento se sujetará a la Ley 1581 de 2012, su reglamentación y la política de privacidad vigente publicada por la empresa.',
        ],
      },
      {
        title: 'Datos autorizados',
        paragraphs: [
          'La autorización comprende los datos entregados voluntariamente mediante formularios, correo, llamadas, WhatsApp, cotizaciones, pedidos, garantías y solicitudes de soporte, incluyendo información de contacto, institución, cargo y necesidades comerciales u operativas.',
          'También podrá incluir datos necesarios para facturación, pagos, entrega, soporte, cumplimiento contractual, trazabilidad y seguridad del sistema.',
        ],
      },
      {
        title: 'Finalidades autorizadas',
        paragraphs: [
          'El titular autoriza el tratamiento para gestionar solicitudes de contacto, cotizaciones, pedidos, instalación, soporte, garantías, seguimiento comercial, posventa y obligaciones legales, contables o tributarias.',
          'Cuando exista autorización adicional o base legal suficiente, I-ME podrá remitir comunicaciones informativas, comerciales o promocionales relacionadas con sus productos y servicios.',
        ],
      },
      {
        title: 'Derechos y revocatoria',
        paragraphs: [
          'El titular conserva los derechos de conocer, actualizar, rectificar y suprimir sus datos, solicitar prueba de la autorización y revocar el consentimiento cuando legalmente proceda.',
          'La revocatoria de autorizaciones comerciales no impide la atención de solicitudes estrictamente necesarias para cotización, cumplimiento contractual, garantías o soporte.',
        ],
      },
      {
        title: 'Registro del consentimiento',
        paragraphs: [
          'I-ME podrá conservar evidencia del consentimiento, incluyendo texto aceptado, fecha y hora, canal de captura, versión de la política, finalidad autorizada e identificadores técnicos razonables cuando corresponda.',
          'La evidencia de consentimiento se utilizará para trazabilidad, cumplimiento normativo y atención de consultas o reclamos relacionados con habeas data.',
        ],
      },
    ],
  },
} satisfies Record<string, LegalDocument>;

export const legalEn = {
  privacy: {
    badge: 'Validated policy',
    pageTitle: 'Privacy policy and personal data processing',
    heading: 'Privacy policy and personal data processing',
    description:
      'Privacy and personal data processing policy for I-ME website forms, quotations, orders, payments, support and commercial communications.',
    summary:
      'Policy governing personal data collected by I-ME through the website, forms, quotations, orders, support and commercial communications.',
    updatedAt: 'Last updated: 2026-06-12',
    notice:
      'this document is part of the published and current legal policies of I-ME International Medical Enterprise.',
    sections: [
      {
        title: 'Controller identification',
        paragraphs: [
          'The data controller is INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., commercially identified as I-ME International Medical Enterprise.',
          'Public contact details include tax ID 901871720-1, registered address in Envigado, Antioquia, Colombia, and the official contact email for privacy-related matters.',
        ],
      },
      {
        title: 'Legal basis and scope',
        paragraphs: [
          'This policy is interpreted under Colombian data protection rules, especially Law 1581 of 2012 and the related regulatory framework, together with any applicable consumer and e-commerce rules.',
          'It applies to personal data collected through website forms, quotation requests, orders, payments, technical support, maintenance, warranties, commercial communications and technical security logs.',
        ],
      },
      {
        title: 'Personal data processed',
        paragraphs: [
          'I-ME may process identification and contact data, institutional or commercial information, transactional information required for orders or payments, and technical records necessary for security, fraud prevention, auditing and website operation.',
          'The website is not intended to collect patient records or other sensitive health data. If such information is provided voluntarily, it must be handled only within the legal and operational framework that applies.',
        ],
      },
      {
        title: 'Processing purposes',
        paragraphs: [
          'Personal data may be used to answer requests, prepare quotations, coordinate orders, deliveries, installation, support, warranties, billing, payments, commercial follow-up and after-sales service.',
          'Data may also be used for fraud prevention, legal compliance, operational traceability and commercial or informational communications whenever there is a valid authorization or legal basis.',
        ],
      },
      {
        title: 'Data subject rights',
        paragraphs: [
          'Data subjects may access, update, rectify or delete their data, request evidence of authorization, revoke consent when applicable and file inquiries or claims with I-ME and the competent Colombian authority if needed.',
          'Requests related to privacy and data rights may be submitted through the official channel informed by the company.',
        ],
      },
    ],
  },
  terms: {
    badge: 'Validated terms',
    pageTitle: 'Terms and conditions for website use, catalog, quotations and services',
    heading: 'Terms and conditions for website use, catalog, quotations and services',
    description:
      'Terms and conditions for website use, catalog, quotations, e-commerce, services, warranties and indicative financing published by I-ME.',
    summary:
      'Rules governing the use of the website and the business flows related to catalog browsing, quotation requests, services, payments, deliveries, warranties and financing.',
    updatedAt: 'Last updated: 2026-06-15',
    notice:
      'this document governs the use of the website and the commercial interactions associated with I-ME products and services.',
    sections: [
      {
        title: 'Operator identification',
        paragraphs: [
          'The website https://i-me.com.co operates under the I-ME International Medical Enterprise brand and corresponds to INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., a Colombian biomedical technology company.',
          'The company publishes its legal and commercial identification details, including tax ID, registration data, principal address and corporate contact channels.',
        ],
      },
      {
        title: 'Website nature',
        paragraphs: [
          'The website publishes commercial and technical information about biomedical equipment, consumables, support services, maintenance, installation, training and indicative financing.',
          'Website information does not constitute medical advice, clinical diagnosis, irrevocable offer, or legal or financial advice unless a formal written proposal expressly states otherwise.',
        ],
      },
      {
        title: 'Quotations, pricing and availability',
        paragraphs: [
          'Requests submitted through forms, email, WhatsApp or any website channel do not amount to automatic acceptance of a sale. Every quotation is subject to availability, technical review, pricing conditions, taxes, logistics and internal approval when required.',
          'Final prices, lead times, warranties and conditions are confirmed in each formal proposal and may vary according to market conditions, supplier changes, imports or technical requirements.',
        ],
      },
      {
        title: 'Payments and e-commerce',
        paragraphs: [
          'If online payments are enabled, price, stock, currency, taxes and final order terms must be validated server-side before redirecting the customer to the selected payment gateway.',
          'A transaction is deemed approved only after valid technical confirmation from the payment gateway and I-ME systems. A payment attempt or screenshot is not final proof of approval.',
        ],
      },
      {
        title: 'Deliveries, installation, warranties and support',
        paragraphs: [
          'Delivery, installation, commissioning, training, maintenance and support conditions depend on the type of product, city, technical complexity and the scope agreed in the formal proposal or invoice.',
          'Warranties are governed by the proposal, manufacturer documentation and applicable law, and do not cover misuse, unauthorized intervention, accidents, normal consumable wear or operating conditions outside specification.',
        ],
      },
    ],
  },
  dataAuthorization: {
    badge: 'Validated authorization',
    pageTitle: 'Authorization for personal data processing',
    heading: 'Authorization for personal data processing',
    description:
      'Authorization text for personal data processing in commercial requests, quotations, orders, support and communications with I-ME.',
    summary:
      'Authorization text used in forms and commercial channels through which the user authorizes I-ME to process personal data.',
    updatedAt: 'Last updated: 2026-06-12',
    notice:
      'this text supports the consent evidence used by I-ME across forms, commercial requests and service channels.',
    sections: [
      {
        title: 'Controller and applicable rules',
        paragraphs: [
          'The authorization is granted to INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., commercially identified as I-ME International Medical Enterprise, for the processing of the personal data voluntarily supplied by the data subject.',
          'Processing is subject to Colombian personal data protection law and to the current privacy policy published by the company.',
        ],
      },
      {
        title: 'Authorized data',
        paragraphs: [
          'The authorization covers data supplied through forms, email, phone calls, WhatsApp, quotations, orders, warranties and support requests, including contact details, institution, role and business needs.',
          'It may also cover information required for billing, payments, delivery, support, contractual compliance, traceability and system security.',
        ],
      },
      {
        title: 'Authorized purposes',
        paragraphs: [
          'The data subject authorizes the processing of data to handle contact requests, quotations, orders, installation, support, warranties, after-sales follow-up and legal, accounting or tax obligations.',
          'Whenever there is additional authorization or another valid legal basis, I-ME may also send informational, commercial or promotional communications related to its products and services.',
        ],
      },
      {
        title: 'Rights and consent withdrawal',
        paragraphs: [
          'The data subject keeps the rights to access, update, rectify and delete personal data, request proof of consent and withdraw authorization whenever legally applicable.',
          'Withdrawal of commercial authorization does not prevent the handling of requests that are strictly necessary for quotations, contractual performance, warranties or support.',
        ],
      },
      {
        title: 'Consent evidence',
        paragraphs: [
          'I-ME may retain evidence of consent, including the accepted text, date and time, capture channel, policy version, authorized purpose and reasonable technical identifiers whenever applicable.',
          'This evidence is kept for traceability, compliance and the handling of privacy-related inquiries or claims.',
        ],
      },
    ],
  },
} satisfies Record<string, LegalDocument>;
