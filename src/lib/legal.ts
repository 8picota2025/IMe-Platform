import type { Locale } from '../i18n/utils'

export type LegalKind = 'privacidad' | 'habeas-data' | 'cookies' | 'terminos' | 'copyright'

export interface LegalSection {
  heading: string
  body: string[]
}

export interface LegalPage {
  kind: LegalKind
  slug: string
  title: string
  description: string
  badge: string
  updated: string
  sections: LegalSection[]
}

const updated = '2026-06-12'

const esPages: LegalPage[] = [
  {
    kind: 'privacidad',
    slug: 'privacidad',
    title: 'Política de privacidad y tratamiento de datos',
    description:
      'Borrador de política de privacidad y tratamiento de datos personales para formularios, cotizaciones, pedidos y asesoría comercial de I-ME.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Estado del documento',
        body: [
          'Este documento es un borrador operativo para revisión del cliente y de asesor jurídico. No constituye asesoría legal ni debe publicarse como texto definitivo sin aprobación formal.',
          'TODO_CLIENTE: confirmar razón social, NIT, domicilio, responsable interno de datos, canal legal de atención y jurisdicción contractual aplicable.',
        ],
      },
      {
        heading: 'Responsable del tratamiento',
        body: [
          'El responsable previsto del tratamiento es I-ME International Medical Enterprise, con datos societarios pendientes de confirmación por el cliente.',
          'Canales actuales de contacto comercial: info@i-me.com.co y +57 313 867 4059. TODO_CLIENTE: confirmar si estos canales también serán válidos para solicitudes de datos personales.',
        ],
      },
      {
        heading: 'Datos tratados',
        body: [
          'Podemos recibir datos de identificación y contacto, institución, interés comercial, mensajes enviados en formularios, productos solicitados, información de pedidos, referencias de pago y registros técnicos mínimos para seguridad y auditoría.',
          'No se solicitan datos clínicos ni historias médicas. Si el usuario envía información sensible de manera voluntaria, I-ME deberá definir con asesor legal el tratamiento aplicable antes de operar.',
        ],
      },
      {
        heading: 'Finalidades',
        body: [
          'Atender solicitudes de contacto, cotizaciones, pedidos de consumibles, coordinación de proveedores dropship, seguimiento comercial, soporte pre y posventa, prevención de fraude y cumplimiento de obligaciones legales aplicables.',
          'El asesor virtual se limita a orientación comercial sobre productos. No emite diagnósticos, recomendaciones clínicas ni precios vinculantes.',
        ],
      },
      {
        heading: 'Derechos del titular',
        body: [
          'Como referencia general para Colombia, la Ley 1581 de 2012 reconoce derechos de acceso, actualización, rectificación, supresión y revocatoria de autorización, entre otros. BLOQUEANTE_LEGAL: validar redacción final con abogado.',
          'TODO_CLIENTE: definir procedimiento, tiempos internos y canal oficial para ejercer derechos de habeas data.',
        ],
      },
      {
        heading: 'Conservación y seguridad',
        body: [
          'Los datos se conservarán durante el tiempo necesario para atender la finalidad informada, obligaciones contractuales, soporte, auditoría y requisitos legales aplicables.',
          'Las claves privadas, credenciales privilegiadas, pasarelas de pago y proveedores LLM deben permanecer exclusivamente en Supabase Edge Functions o secretos de CI/CD, nunca en cliente ni en dist/.',
        ],
      },
    ],
  },
  {
    kind: 'habeas-data',
    slug: 'habeas-data',
    title: 'Autorización para tratamiento de datos personales',
    description:
      'Borrador de autorización de tratamiento de datos personales y habeas data para formularios, cotizaciones, pedidos y comunicaciones comerciales.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Autorización',
        body: [
          'Al marcar las casillas de consentimiento en formularios, cotizaciones o checkout, el titular autoriza el tratamiento de sus datos personales para gestionar su solicitud comercial.',
          'Esta autorización debe revisarse y aprobarse jurídicamente antes de operar en producción.',
        ],
      },
      {
        heading: 'Alcance',
        body: [
          'La autorización cubre contacto comercial, elaboración de cotizaciones, gestión de pedidos, coordinación con proveedores, soporte, seguimiento y comunicaciones relacionadas con equipos biomédicos.',
          'No cubre finalidades ajenas al servicio ni venta de bases de datos. Cualquier finalidad adicional requiere revisión y, si aplica, autorización independiente.',
        ],
      },
      {
        heading: 'Registro de consentimiento',
        body: [
          'El sistema guarda consentimiento_datos y consentimiento_timestamp en solicitudes y pedidos cuando la integración con Supabase está activa.',
          'NO_EJECUTADO_ENTORNO: validar persistencia real contra Supabase con proyecto, RLS y Edge Functions desplegadas.',
        ],
      },
    ],
  },
  {
    kind: 'cookies',
    slug: 'cookies',
    title: 'Política de cookies',
    description: 'Borrador de política de cookies y tecnologías similares para el sitio de I-ME.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Uso actual',
        body: [
          'El sitio puede usar almacenamiento local o de sesión para preferencias de tema, carrito, lista de cotización y funcionamiento de la experiencia de usuario.',
          'TODO_CLIENTE: confirmar si se instalarán herramientas de analítica, píxeles publicitarios, chat externo u otras cookies de terceros.',
        ],
      },
      {
        heading: 'Cookies necesarias',
        body: [
          'Las tecnologías necesarias permiten navegación, seguridad, preferencia de tema, carrito y solicitudes de cotización. Sin ellas algunas funciones pueden no operar correctamente.',
        ],
      },
      {
        heading: 'Analítica y terceros',
        body: [
          'No se declara analítica definitiva en este borrador. Si se agrega Google Analytics, Meta Pixel, Hotjar, CRM externo u otra herramienta, debe actualizarse esta política y evaluar consentimiento previo.',
        ],
      },
    ],
  },
  {
    kind: 'terminos',
    slug: 'terminos',
    title: 'Términos y condiciones',
    description:
      'Borrador de términos y condiciones para catálogo, cotizaciones, pedidos de consumibles, equipos por cotización y financiación orientativa.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Naturaleza del sitio',
        body: [
          'El sitio presenta información comercial sobre equipos biomédicos, consumibles, servicios, financiación orientativa y canales de contacto.',
          'La información no sustituye asesoría clínica, técnica regulatoria, jurídica o financiera especializada.',
        ],
      },
      {
        heading: 'Productos y cotizaciones',
        body: [
          'Los equipos biomédicos se gestionan principalmente mediante cotización y validación comercial. Las especificaciones, disponibilidad, tiempos de entrega y condiciones finales se confirman por propuesta formal.',
          'Los consumibles pueden iniciar pago online cuando tengan precio, stock y proveedor válido, pero el servidor recalcula siempre el total antes de enviar al usuario a la pasarela.',
        ],
      },
      {
        heading: 'Pagos y proveedores',
        body: [
          'Los pagos se procesan por Wompi para Colombia y Stripe para mercado internacional, detrás de una capa de pasarela intercambiable.',
          'El cliente nunca decide que un pago está aprobado. La confirmación depende de verificación server-side y webhooks firmados.',
        ],
      },
      {
        heading: 'Financiación',
        body: [
          'Toda simulación de financiación es orientativa y no constituye oferta vinculante. Tasas, plazos, requisitos y aprobación dependen de revisión documental y condiciones aprobadas.',
          'BLOQUEANTE_LEGAL: validar texto final de financiación antes de publicar condiciones comerciales.',
        ],
      },
      {
        heading: 'Limitación de responsabilidad',
        body: [
          'I-ME deberá validar con asesor jurídico el alcance de garantías, soporte, instalación, responsabilidad por proveedores dropship, fuerza mayor, devoluciones y reclamaciones.',
          'TODO_CLIENTE: aportar políticas comerciales reales de garantía, cambios, devoluciones, tiempos de entrega y soporte posventa.',
        ],
      },
    ],
  },
  {
    kind: 'copyright',
    slug: 'copyright',
    title: 'Aviso de copyright',
    description: 'Borrador de aviso de propiedad intelectual y uso de contenidos del sitio I-ME.',
    badge: 'COPY_CLIENTE_REVISAR',
    updated,
    sections: [
      {
        heading: 'Titularidad',
        body: [
          'Salvo indicación contraria, textos, estructura, selección de contenidos, diseño y elementos de marca del sitio se reservan a I-ME International Medical Enterprise o sus licenciantes.',
          'TODO_CLIENTE: confirmar titularidad de fotografías, videos, logos, fichas técnicas, marcas de fabricantes y material heredado del sitio anterior.',
        ],
      },
      {
        heading: 'Uso permitido',
        body: [
          'El contenido puede consultarse para evaluación comercial de productos y servicios de I-ME. Cualquier reproducción, distribución o uso comercial requiere autorización previa.',
        ],
      },
    ],
  },
]

const enPages: LegalPage[] = [
  {
    kind: 'privacidad',
    slug: 'privacy',
    title: 'Privacy and personal data processing policy',
    description:
      'Draft privacy and personal data processing policy for I-ME forms, quotes, orders and commercial advisory.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Document status',
        body: [
          'This is an operational draft for client and legal review. It is not legal advice and must not be treated as final until formally approved.',
          'TODO_CLIENTE: confirm legal name, tax ID, registered address, data controller contact, official legal channel and applicable jurisdiction.',
        ],
      },
      {
        heading: 'Controller',
        body: [
          'The intended controller is I-ME International Medical Enterprise, with corporate details pending client confirmation.',
          'Current commercial channels: info@i-me.com.co and +57 313 867 4059. TODO_CLIENTE: confirm whether these channels also apply to data subject requests.',
        ],
      },
      {
        heading: 'Data processed',
        body: [
          'We may receive identification and contact data, institution, commercial interest, form messages, requested products, order information, payment references and minimum technical records for security and audit.',
          'The site does not request clinical records or medical histories. If a user voluntarily sends sensitive information, I-ME must define the applicable handling with legal counsel before operating.',
        ],
      },
      {
        heading: 'Purposes',
        body: [
          'Managing contact requests, quotes, consumable orders, dropship provider coordination, commercial follow-up, support, fraud prevention and applicable legal obligations.',
          'The virtual advisor is limited to commercial product guidance. It does not provide diagnosis, clinical recommendations or binding prices.',
        ],
      },
      {
        heading: 'Data subject rights',
        body: [
          'As a general Colombian reference, Law 1581 of 2012 recognizes rights of access, update, rectification, deletion and withdrawal of authorization, among others. BLOQUEANTE_LEGAL: validate final wording with counsel.',
          'TODO_CLIENTE: define the official process, internal response times and legal channel for habeas data requests.',
        ],
      },
    ],
  },
  {
    kind: 'habeas-data',
    slug: 'data-authorization',
    title: 'Authorization for personal data processing',
    description:
      'Draft personal data processing authorization for forms, quotes, orders and commercial communications.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Authorization',
        body: [
          'By checking consent boxes in forms, quote lists or checkout, the data subject authorizes processing of personal data to manage the commercial request.',
          'This authorization must be legally reviewed and approved before production use.',
        ],
      },
      {
        heading: 'Scope',
        body: [
          'The authorization covers commercial contact, quotes, order management, provider coordination, support, follow-up and communications related to biomedical equipment.',
          'It does not cover unrelated purposes or sale of databases. Any additional purpose requires review and, where applicable, separate authorization.',
        ],
      },
      {
        heading: 'Consent record',
        body: [
          'The system stores consentimiento_datos and consentimiento_timestamp in requests and orders when Supabase integration is active.',
          'NO_EJECUTADO_ENTORNO: validate real persistence against Supabase with project, RLS and Edge Functions deployed.',
        ],
      },
    ],
  },
  {
    kind: 'cookies',
    slug: 'cookies',
    title: 'Cookie policy',
    description: 'Draft cookie and similar technologies policy for the I-ME website.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Current use',
        body: [
          'The site may use local or session storage for theme preference, cart, quote list and user experience functionality.',
          'TODO_CLIENTE: confirm whether analytics, advertising pixels, external chat or other third-party cookies will be installed.',
        ],
      },
      {
        heading: 'Necessary technologies',
        body: [
          'Necessary technologies support navigation, security, theme preference, cart and quote requests. Some functions may not work correctly without them.',
        ],
      },
      {
        heading: 'Analytics and third parties',
        body: [
          'No definitive analytics setup is declared in this draft. If Google Analytics, Meta Pixel, Hotjar, an external CRM or another tool is added, this policy must be updated and consent requirements reviewed.',
        ],
      },
    ],
  },
  {
    kind: 'terminos',
    slug: 'terms',
    title: 'Terms and conditions',
    description:
      'Draft terms and conditions for catalog, quotes, consumable orders, equipment quote workflows and indicative financing.',
    badge: 'COPY_CLIENTE_REVISAR · BLOQUEANTE_LEGAL',
    updated,
    sections: [
      {
        heading: 'Site nature',
        body: [
          'The site presents commercial information about biomedical equipment, consumables, services, indicative financing and contact channels.',
          'The information does not replace clinical, technical regulatory, legal or financial advice.',
        ],
      },
      {
        heading: 'Products and quotes',
        body: [
          'Biomedical equipment is mainly handled through quotes and commercial validation. Specifications, availability, lead times and final conditions are confirmed by formal proposal.',
          'Consumables may start online payment when price, stock and provider are valid, but the server always recalculates the total before sending the user to the gateway.',
        ],
      },
      {
        heading: 'Payments and providers',
        body: [
          'Payments are processed through Wompi for Colombia and Stripe for international markets, behind an interchangeable payment gateway layer.',
          'The client never decides that a payment is approved. Confirmation depends on server-side verification and signed webhooks.',
        ],
      },
      {
        heading: 'Financing',
        body: [
          'Any financing simulation is indicative and not a binding offer. Rates, terms, requirements and approval depend on documentation review and approved conditions.',
          'BLOQUEANTE_LEGAL: validate final financing wording before publishing commercial conditions.',
        ],
      },
    ],
  },
  {
    kind: 'copyright',
    slug: 'copyright',
    title: 'Copyright notice',
    description: 'Draft intellectual property and content use notice for the I-ME website.',
    badge: 'COPY_CLIENTE_REVISAR',
    updated,
    sections: [
      {
        heading: 'Ownership',
        body: [
          'Unless otherwise stated, texts, structure, content selection, design and brand elements are reserved to I-ME International Medical Enterprise or its licensors.',
          'TODO_CLIENTE: confirm ownership of photos, videos, logos, technical sheets, manufacturer brands and inherited material from the previous website.',
        ],
      },
      {
        heading: 'Permitted use',
        body: [
          'Content may be consulted for commercial evaluation of I-ME products and services. Reproduction, distribution or commercial use requires prior authorization.',
        ],
      },
    ],
  },
]

const pagesByLocale: Record<Locale, LegalPage[]> = { es: esPages, en: enPages }

export function getLegalPages(locale: Locale): LegalPage[] {
  return pagesByLocale[locale]
}

export function getLegalPage(locale: Locale, slug: string): LegalPage | undefined {
  return pagesByLocale[locale].find((page) => page.slug === slug)
}

export function getLegalSlug(kind: LegalKind, locale: Locale): string {
  return pagesByLocale[locale].find((page) => page.kind === kind)?.slug ?? kind
}
