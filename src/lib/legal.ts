import type { Locale } from '../i18n/utils';

export type LegalKind = 'privacidad' | 'habeas-data' | 'cookies' | 'terminos' | 'copyright';

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalPage {
  kind: LegalKind;
  slug: string;
  title: string;
  description: string;
  badge: string;
  updated: string;
  sections: LegalSection[];
}

const esPages: LegalPage[] = [
  {
    kind: 'privacidad',
    slug: 'privacidad',
    title: 'Política de privacidad y tratamiento de datos personales',
    description:
      'Política completa de privacidad y tratamiento de datos personales de I-ME para formularios, cotizaciones, pedidos, pagos, soporte y comunicaciones comerciales.',
    badge: 'POLÍTICA VALIDADA',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Identificación del responsable del tratamiento',
        body: [
          'Para efectos de esta política, el responsable previsto del tratamiento de datos personales es I-ME International Medical Enterprise.',
          'Datos de identificación y contacto disponibles públicamente en el sitio web:',
          'Nombre comercial: I-ME International Medical Enterprise.',
          'Actividad informada: distribución, instalación, soporte técnico, mantenimiento y asesoría comercial de equipos biomédicos para hospitales, clínicas, centros de salud, consultorios e instituciones del sector salud en Colombia.',
          'Correo electrónico de contacto: inmedicalime@gmail.com.',
          'WhatsApp / teléfono comercial: +57 300 717 2757.',
          'País de operación informado: Colombia.',
          'Razón social completa: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'NIT: 901871720-1.',
          'Domicilio principal: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Dirección física para notificaciones judiciales o administrativas: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Cámara de comercio competente: Cámara de Comercio Aburrá Sur.',
          'Representante legal: ADRIANA MARIA PATIÑO GOMEZ, C.C. No. 43.034.287.',
          'Canal oficial para solicitudes de habeas data: inmedicalime@gmail.com.',
        ],
      },
      {
        heading: 'Marco normativo colombiano aplicable',
        body: [
          'Esta política se interpreta conforme a la Constitución Política de Colombia, artículo 15, y a la normativa colombiana sobre protección de datos personales, en especial:',
          'Ley Estatutaria 1581 de 2012, por la cual se dictan disposiciones generales para la protección de datos personales.',
          'Decreto 1377 de 2013, reglamentario parcial de la Ley 1581 de 2012, en lo que resulte aplicable y compilado en el Decreto Único Reglamentario 1074 de 2015.',
          'Decreto 886 de 2014, relacionado con el Registro Nacional de Bases de Datos, compilado en el Decreto 1074 de 2015, cuando resulte exigible.',
          'Ley 1266 de 2008, únicamente si se llegaren a tratar datos financieros, crediticios, comerciales o de servicios en bases de datos sometidas a dicho régimen especial.',
          'Ley 2300 de 2023, en cuanto resulte aplicable a contactos comerciales, publicitarios o de cobranza.',
          'Ley 1480 de 2011, Estatuto del Consumidor, cuando el titular actúe como consumidor o usuario en comercio electrónico o relaciones de consumo.',
        ],
      },
      {
        heading: 'Alcance',
        body: [
          'Esta política aplica al tratamiento de datos personales recolectados a través de:',
          'Formularios de contacto del sitio web.',
          'Solicitudes de cotización.',
          'Listas de productos para cotizar.',
          'Pedidos de consumibles o productos disponibles para compra en línea, si dicha funcionalidad se encuentra activa.',
          'Comunicaciones por correo electrónico, WhatsApp, teléfono, formularios, CRM, chat o canales comerciales autorizados.',
          'Procesos de soporte, instalación, mantenimiento, capacitación y posventa.',
          'Registros técnicos mínimos asociados a seguridad, prevención de fraude, auditoría, trazabilidad y funcionamiento del sitio.',
          'Esta política no convierte a I-ME International Medical Enterprise en prestador de servicios médicos, IPS, entidad aseguradora, laboratorio clínico ni emisor de conceptos clínicos. La información del sitio y de sus asesores se limita a fines comerciales, técnicos y de orientación sobre equipos biomédicos.',
        ],
      },
      {
        heading: 'Datos personales que pueden ser tratados',
        body: [
          'Según la interacción del titular con el sitio o con los canales comerciales, se podrán tratar los siguientes datos:',
          'Datos de identificación y contacto.',
          'Nombre y apellidos.',
          'Cargo o rol dentro de la institución.',
          'Tipo y número de documento, cuando sea necesario para cotizaciones, facturación, pagos, garantías o cumplimiento contractual.',
          'Correo electrónico.',
          'Número telefónico o WhatsApp.',
          'Ciudad, departamento y país.',
          'Dirección de entrega, facturación o instalación, cuando aplique.',
          'Datos institucionales o comerciales.',
          'Nombre de la institución, clínica, hospital, consultorio, centro médico, universidad, distribuidor, proveedor o empresa.',
          'Área clínica o técnica de interés.',
          'Productos o servicios solicitados.',
          'Presupuesto, necesidad comercial, condiciones de entrega, instalación o soporte.',
          'Historial de cotizaciones, órdenes, pedidos, comunicaciones y seguimiento comercial.',
          'Datos transaccionales y de pago.',
          'Cuando se habiliten pagos en línea, podrán tratarse referencias de pago, estado de transacción, número de orden, valor, moneda, medio de pago utilizado y confirmaciones emitidas por la pasarela correspondiente. I-ME International Medical Enterprise no debe almacenar datos completos de tarjetas de crédito o credenciales financieras sensibles, salvo que una pasarela autorizada o proveedor certificado lo gestione bajo sus propios estándares de seguridad.',
          'Datos técnicos.',
          'Dirección IP.',
          'Identificadores de sesión.',
          'Fecha y hora de interacción.',
          'Registros de consentimiento.',
          'Navegador, dispositivo, sistema operativo y parámetros técnicos necesarios para seguridad, auditoría, prevención de fraude y funcionamiento del sitio.',
          'Datos sensibles.',
          'El sitio no solicita historias clínicas, diagnósticos, imágenes médicas, información de salud de pacientes ni otros datos sensibles. Si un usuario entrega voluntariamente datos sensibles, I-ME International Medical Enterprise deberá abstenerse de usarlos para finalidades no autorizadas y definir su tratamiento con asesoría jurídica, técnica y de seguridad antes de almacenarlos, transferirlos o compartirlos.',
        ],
      },
      {
        heading: 'Finalidades del tratamiento',
        body: [
          'Los datos personales podrán ser tratados para las siguientes finalidades:',
          'Recibir, registrar y responder solicitudes de contacto.',
          'Elaborar, enviar y hacer seguimiento de cotizaciones.',
          'Validar disponibilidad, especificaciones, condiciones técnicas, precio, logística, garantía, instalación y soporte de equipos biomédicos.',
          'Gestionar pedidos, órdenes, pagos, confirmaciones, entregas, garantías y soporte posventa.',
          'Coordinar actividades con fabricantes, distribuidores, proveedores logísticos, técnicos, pasarelas de pago, plataformas tecnológicas y aliados estrictamente necesarios para atender la solicitud.',
          'Prestar asesoría comercial y técnica sobre productos biomédicos, sin sustituir criterios clínicos, regulatorios o profesionales especializados.',
          'Enviar comunicaciones comerciales, promocionales o informativas cuando exista autorización previa, expresa e informada o una base jurídica aplicable.',
          'Gestionar solicitudes de habeas data: consulta, actualización, rectificación, supresión, revocatoria de autorización y reclamos.',
          'Cumplir obligaciones legales, contables, tributarias, contractuales, administrativas, sanitarias, de protección al consumidor, de comercio electrónico y de prevención de fraude.',
          'Mantener la seguridad, integridad, trazabilidad y auditoría del sitio y de las operaciones.',
          'Defender los intereses jurídicos de I-ME International Medical Enterprise ante reclamaciones, controversias, auditorías, requerimientos administrativos o procesos judiciales.',
        ],
      },
      {
        heading: 'Tratamiento de datos de niños, niñas y adolescentes',
        body: [
          'El sitio no está dirigido a niños, niñas o adolescentes. No obstante, si llegaren a suministrarse datos de menores, su tratamiento deberá respetar el interés superior del menor, sus derechos fundamentales y las reglas especiales aplicables en Colombia. En tal evento, I-ME International Medical Enterprise deberá verificar autorización del representante legal y limitar el tratamiento a lo estrictamente necesario.',
        ],
      },
      {
        heading: 'Derechos de los titulares',
        body: [
          'Conforme a la Ley 1581 de 2012, los titulares podrán ejercer, entre otros, los siguientes derechos:',
          'Conocer, actualizar y rectificar sus datos personales.',
          'Solicitar prueba de la autorización otorgada, salvo cuando la ley exceptúe tal requisito.',
          'Ser informados sobre el uso dado a sus datos personales.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones al régimen de protección de datos personales.',
          'Revocar la autorización y/o solicitar la supresión del dato cuando no exista deber legal o contractual de conservarlo.',
          'Acceder gratuitamente a sus datos personales objeto de tratamiento, en los términos legales.',
        ],
      },
      {
        heading: 'Procedimiento para consultas y reclamos',
        body: [
          'El titular podrá presentar consultas o reclamos por el canal oficial de habeas data que defina I-ME International Medical Enterprise.',
          'Canal oficial definitivo: inmedicalime@gmail.com.',
          'Canal provisional sugerido: inmedicalime@gmail.com.',
          'Información mínima de la solicitud: nombre completo, documento de identidad cuando aplique, datos de contacto, descripción clara de la solicitud, documentos de soporte y calidad en la que actúa si obra como representante o apoderado.',
          'Las consultas y reclamos serán atendidos dentro de los términos previstos en la Ley 1581 de 2012 y normas reglamentarias. I-ME adopta el siguiente procedimiento interno mínimo:',
          'Radicación. La solicitud se recibirá por el canal oficial de habeas data, correo electrónico, formulario web o medio físico habilitado. Se asignará fecha, hora, canal, identificación del solicitante y tipo de solicitud.',
          'Validación de identidad y legitimación. Antes de entregar, corregir o suprimir información, I-ME podrá solicitar documento de identidad, soporte de representación o poder cuando actúe un tercero.',
          'Clasificación. La solicitud se clasificará como consulta, reclamo, actualización, rectificación, supresión, revocatoria, prueba de autorización, oposición a contacto comercial o incidente de seguridad.',
          'Traslado interno. El responsable operativo del canal remitirá la solicitud al área comercial, administrativa, técnica, contable o jurídica que administre la base de datos correspondiente.',
          'Respuesta. Las consultas se responderán dentro del término legal aplicable. Los reclamos se tramitarán conforme a Ley 1581 de 2012, dejando constancia de “reclamo en trámite” cuando proceda.',
          'Ejecución. Cuando la solicitud sea procedente, se actualizarán, rectificarán, suprimirán o bloquearán los datos en las bases activas, CRM, formularios, listas comerciales y repositorios razonablemente disponibles.',
          'Cierre y trazabilidad. Se conservará evidencia de la solicitud, análisis, decisión, fecha de respuesta y medidas adoptadas, sin retener más datos de los necesarios.',
          'Escalamiento. Las solicitudes que involucren datos sensibles, menores de edad, autoridades, incidentes de seguridad, transferencias internacionales, reclamaciones complejas o litigios deberán escalarse a revisión jurídica.',
        ],
      },
      {
        heading: 'Autorización',
        body: [
          'El tratamiento de datos personales se realizará con autorización previa, expresa e informada del titular cuando sea exigible. La autorización podrá obtenerse mediante casillas de aceptación, formularios, registros electrónicos, correos, mensajes, contratos, cotizaciones, órdenes, documentos físicos o cualquier mecanismo que permita consulta posterior.',
          'La autorización deberá conservarse con trazabilidad suficiente, incluyendo fecha, hora, canal, texto aceptado y finalidad autorizada cuando ello sea técnicamente posible.',
        ],
      },
      {
        heading: 'Transferencia y transmisión de datos',
        body: [
          'Los datos podrán ser compartidos con encargados o terceros cuando sea necesario para atender las finalidades autorizadas, tales como proveedores tecnológicos, hosting, CRM, pasarelas de pago, logística, soporte técnico, fabricantes, distribuidores, aliados comerciales, asesores jurídicos, contables, tributarios o autoridades competentes.',
          'Cuando exista transferencia o transmisión internacional de datos, I-ME International Medical Enterprise deberá verificar el cumplimiento de las reglas de la Ley 1581 de 2012 y normas reglamentarias, incluyendo contratos de transmisión, garantías adecuadas o autorizaciones cuando correspondan.',
        ],
      },
      {
        heading: 'Seguridad de la información',
        body: [
          'I-ME International Medical Enterprise adoptará medidas administrativas, técnicas y organizativas razonables para proteger los datos personales contra pérdida, acceso no autorizado, uso indebido, alteración, divulgación o destrucción no autorizada.',
          'Las claves privadas, tokens, credenciales privilegiadas, secretos de pasarelas de pago, claves de proveedores LLM, claves de Supabase y variables sensibles no deberán exponerse en el cliente, repositorios públicos ni carpeta dist/. Deben mantenerse en entornos seguros, como secretos de CI/CD, funciones de servidor o Supabase Edge Functions, según la arquitectura técnica aplicable.',
        ],
      },
      {
        heading: 'Conservación',
        body: [
          'Los datos se conservarán durante el tiempo necesario para cumplir las finalidades autorizadas y las obligaciones legales, contractuales, contables, tributarias, administrativas, sanitarias, de protección al consumidor, auditoría, soporte, garantía y defensa jurídica.',
          'I-ME adopta la siguiente tabla interna inicial de conservación, sujeta a validación contable, tributaria, sanitaria, contractual y técnica:',
          'Tipo de dato o base: Contactos comerciales simples sin negocio activo · Plazo operativo sugerido: Hasta 2 años desde la última interacción · Criterio de conservación: Seguimiento comercial razonable y trazabilidad de consentimiento · Medida al cierre del plazo: Supresión, anonimización o conservación solo si existe autorización vigente.',
          'Tipo de dato o base: Solicitudes de cotización y propuestas no aceptadas · Plazo operativo sugerido: Hasta 3 años · Criterio de conservación: Defensa de intereses, historial comercial y auditoría precontractual · Medida al cierre del plazo: Archivo restringido o eliminación segura.',
          'Tipo de dato o base: Clientes, órdenes, facturas, pagos y soportes contables · Plazo operativo sugerido: Mínimo el término legal contable, tributario y comercial aplicable · Criterio de conservación: Cumplimiento legal, fiscal, contable y contractual · Medida al cierre del plazo: Conservación legal restringida y posterior eliminación segura.',
          'Tipo de dato o base: Garantías, instalación, mantenimiento, soporte y posventa · Plazo operativo sugerido: Plazo de garantía más hasta 5 años o el término legal aplicable · Criterio de conservación: Atención de garantía, tecnovigilancia, reclamaciones y defensa jurídica · Medida al cierre del plazo: Archivo restringido o anonimización técnica.',
          'Tipo de dato o base: Consentimientos de datos y comunicaciones comerciales · Plazo operativo sugerido: Mientras esté vigente la autorización y hasta 5 años después de su revocatoria o última interacción relevante · Criterio de conservación: Prueba de autorización y responsabilidad demostrada · Medida al cierre del plazo: Conservación probatoria mínima o eliminación segura.',
          'Tipo de dato o base: Logs técnicos y seguridad · Plazo operativo sugerido: Entre 6 y 24 meses, salvo incidente o requerimiento legal · Criterio de conservación: Seguridad, auditoría, fraude, disponibilidad y diagnóstico · Medida al cierre del plazo: Rotación, anonimización o eliminación segura.',
          'Tipo de dato o base: Proveedores, fabricantes, aliados y contratistas · Plazo operativo sugerido: Vigencia contractual más término legal aplicable · Criterio de conservación: Ejecución contractual, auditoría, cumplimiento y defensa jurídica · Medida al cierre del plazo: Archivo restringido o eliminación segura.',
          'Tipo de dato o base: Candidatos o colaboradores, si se tratan datos laborales · Plazo operativo sugerido: Según política laboral interna y normas aplicables · Criterio de conservación: Gestión humana, seguridad social, selección y obligaciones laborales · Medida al cierre del plazo: Separar de bases comerciales y aplicar acceso restringido.',
          'Tipo de dato o base: Datos sensibles recibidos sin solicitud · Plazo operativo sugerido: El menor tiempo posible · Criterio de conservación: Minimización, supresión preventiva y análisis jurídico · Medida al cierre del plazo: Supresión segura, salvo obligación legal o autorización específica.',
          'La conservación debe aplicar principios de minimización, acceso restringido, confidencialidad, necesidad y responsabilidad demostrada.',
        ],
      },
      {
        heading: 'Comunicaciones comerciales',
        body: [
          'I-ME International Medical Enterprise solo enviará comunicaciones comerciales por los canales autorizados por el titular o permitidos por la ley. Deberán respetarse las reglas aplicables sobre autorización, canales, horarios, periodicidad, revocatoria y oposición al contacto comercial, en especial cuando resulte aplicable la Ley 2300 de 2023.',
        ],
      },
      {
        heading: 'Cookies y tecnologías similares',
        body: [
          'El uso de cookies, almacenamiento local, almacenamiento de sesión, píxeles, analítica o herramientas de terceros se rige por la Política de Cookies del sitio. La instalación de herramientas de analítica, publicidad comportamental, chat externo, CRM externo o tecnologías equivalentes exige revisión previa de consentimiento y actualización documental.',
        ],
      },
      {
        heading: 'Cambios en esta política',
        body: [
          'I-ME International Medical Enterprise podrá modificar esta política para reflejar cambios normativos, técnicos, comerciales u operativos. Las modificaciones relevantes deberán publicarse en el sitio web y, cuando la ley lo exija, comunicarse a los titulares o requerir nueva autorización.',
        ],
      },
      {
        heading: 'Advertencia legal de publicación',
        body: [
          'Este documento queda jurídicamente estructurado para revisión final, pero requiere validación del responsable, asesor jurídico colombiano y equipo técnico antes de producción. No debe publicarse sin confirmar como mínimo: razón social, NIT, domicilio, representante legal, canal oficial de habeas data, procedimiento interno, terceros encargados, transferencias internacionales, cookies reales, pasarelas activas, bases de datos y obligaciones ante el Registro Nacional de Bases de Datos cuando aplique.',
        ],
      },
    ],
  },
  {
    kind: 'habeas-data',
    slug: 'habeas-data',
    title: 'Autorización para el tratamiento de datos personales',
    description:
      'Autorización para el tratamiento de datos personales en solicitudes comerciales, cotizaciones, pedidos, soporte y comunicaciones de I-ME.',
    badge: 'AUTORIZACIÓN VALIDADA',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Responsable del tratamiento',
        body: [
          'Autorizo a I-ME International Medical Enterprise, identificado así:',
          'Razón social: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'NIT: 901871720-1.',
          'Domicilio: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Correo de contacto: inmedicalime@gmail.com.',
          'WhatsApp / teléfono comercial: +57 300 717 2757.',
          'Canal oficial de habeas data: inmedicalime@gmail.com.',
          'para recolectar, almacenar, usar, circular, transmitir, transferir, actualizar, suprimir y, en general, tratar mis datos personales conforme a la Ley 1581 de 2012, sus decretos reglamentarios y la Política de Privacidad y Tratamiento de Datos Personales publicada por la empresa.',
        ],
      },
      {
        heading: 'Datos que autorizo tratar',
        body: [
          'La autorización comprende los datos que entregue voluntariamente a través de formularios, WhatsApp, correo electrónico, llamadas, cotizaciones, pedidos, solicitudes de soporte o comunicaciones comerciales, incluyendo:',
          'Nombre, apellidos, cargo, institución y datos de contacto.',
          'Correo electrónico, teléfono, WhatsApp, ciudad, departamento y país.',
          'Información comercial relacionada con productos, equipos, consumibles, servicios, cotizaciones, pedidos, instalación, soporte, garantía y financiación orientativa.',
          'Datos necesarios para facturación, pago, entrega, soporte, garantía, cumplimiento contractual y atención posventa.',
          'Registros técnicos mínimos de seguridad, trazabilidad, auditoría y consentimiento.',
          'Declaro que no debo enviar historias clínicas, diagnósticos, imágenes médicas, datos de pacientes ni información sensible no solicitada. Si entrego información sensible de manera voluntaria, entiendo que su tratamiento deberá evaluarse bajo reglas especiales y podrá requerir autorización específica.',
        ],
      },
      {
        heading: 'Finalidades autorizadas',
        body: [
          'Autorizo el tratamiento de mis datos para:',
          'Gestionar mi solicitud de contacto, cotización, pedido, asesoría, instalación, soporte o garantía.',
          'Elaborar y enviar propuestas comerciales sobre equipos biomédicos, consumibles, servicios, soporte técnico, mantenimiento y financiación orientativa.',
          'Verificar disponibilidad, especificaciones, precio, tiempos de entrega, condiciones técnicas, garantías y requisitos de instalación.',
          'Coordinar con fabricantes, distribuidores, proveedores logísticos, técnicos, pasarelas de pago, plataformas tecnológicas o aliados necesarios para atender mi solicitud.',
          'Realizar seguimiento comercial, posventa, soporte, encuestas de satisfacción, comunicaciones de servicio y actualización de información.',
          'Enviar información comercial, promocional o publicitaria relacionada con productos y servicios de I-ME International Medical Enterprise, siempre que el canal haya sido autorizado o exista base legal aplicable.',
          'Cumplir obligaciones legales, tributarias, contables, contractuales, administrativas, sanitarias, de protección al consumidor y de comercio electrónico.',
          'Prevenir fraude, proteger la seguridad del sitio, mantener trazabilidad y defender intereses jurídicos.',
        ],
      },
      {
        heading: 'Comunicaciones comerciales y canales autorizados',
        body: [
          'Al marcar la casilla correspondiente, autorizo que I-ME International Medical Enterprise me contacte por los canales que seleccione o entregue voluntariamente, tales como correo electrónico, llamada telefónica, WhatsApp, SMS u otros medios digitales.',
          'I-ME International Medical Enterprise deberá respetar los canales autorizados, la revocatoria de autorización y las reglas legales aplicables sobre horarios, periodicidad y derecho a no recibir comunicaciones comerciales no deseadas.',
        ],
      },
      {
        heading: 'Derechos del titular',
        body: [
          'Como titular de datos personales tengo derecho a conocer, actualizar, rectificar, solicitar prueba de la autorización, ser informado sobre el uso dado a mis datos, presentar quejas ante la Superintendencia de Industria y Comercio, revocar la autorización y solicitar la supresión del dato cuando no exista deber legal o contractual de conservarlo.',
        ],
      },
      {
        heading: 'Manifestación de autorización',
        body: [
          'Declaro que he leído y acepto la Política de Privacidad y Tratamiento de Datos Personales de I-ME International Medical Enterprise y autorizo el tratamiento de mis datos personales para las finalidades informadas.',
          'Texto sugerido para checkbox:',
          'He leído y acepto la Política de Privacidad y autorizo a I-ME International Medical Enterprise para tratar mis datos personales con el fin de gestionar mi solicitud comercial, cotización, pedido, soporte y comunicaciones relacionadas, conforme a la Ley 1581 de 2012.',
          'Texto sugerido para comunicaciones comerciales opcionales:',
          'Autorizo recibir comunicaciones comerciales, promocionales e informativas de I-ME International Medical Enterprise por los canales de contacto suministrados. Entiendo que puedo revocar esta autorización en cualquier momento.',
        ],
      },
      {
        heading: 'Registro de consentimiento',
        body: [
          'El sistema deberá conservar evidencia del consentimiento, incluyendo como mínimo:',
          'Texto aceptado.',
          'Fecha y hora.',
          'Canal o formulario.',
          'IP o identificador técnico cuando sea razonable.',
          'Finalidad autorizada.',
          'Versión de la política aceptada.',
          'La integración técnica debe conservar, como mínimo, los siguientes campos de trazabilidad: consentimiento_datos, consentimiento_comercial, consentimiento_cookies, consentimiento_timestamp, version_politica, fuente_consentimiento, ip_hash o identificador técnico razonable, canal de captura, texto aceptado y finalidad autorizada. La negativa o retiro del consentimiento comercial no debe impedir la atención de solicitudes estrictamente necesarias, cotizaciones, garantías o cumplimiento contractual.',
        ],
      },
    ],
  },
  {
    kind: 'cookies',
    slug: 'cookies',
    title: 'Política de cookies y tecnologías similares',
    description:
      'Política de cookies y tecnologías similares del sitio de I-ME, incluyendo almacenamiento local, seguridad, analítica, pasarelas e integraciones de terceros.',
    badge: 'POLÍTICA VALIDADA',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Responsable',
        body: [
          'El responsable previsto del sitio es I-ME International Medical Enterprise.',
          'Correo: inmedicalime@gmail.com.',
          'WhatsApp / teléfono: +57 300 717 2757.',
          'Razón social: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'NIT: 901871720-1.',
          'Domicilio: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Canal oficial de privacidad: inmedicalime@gmail.com.',
        ],
      },
      {
        heading: 'Qué son las cookies y tecnologías similares',
        body: [
          'Las cookies son pequeños archivos o identificadores que pueden almacenarse en el navegador o dispositivo del usuario para permitir el funcionamiento del sitio, recordar preferencias, mejorar la experiencia, medir uso, reforzar seguridad o habilitar integraciones de terceros.',
          'También pueden utilizarse tecnologías similares, como almacenamiento local, almacenamiento de sesión, píxeles, SDK, etiquetas, identificadores de dispositivo, registros de servidor y herramientas de analítica.',
        ],
      },
      {
        heading: 'Marco legal colombiano',
        body: [
          'En Colombia no existe una ley autónoma y específica de cookies equivalente al modelo europeo. Sin embargo, cuando las cookies o tecnologías similares permiten identificar o hacer identificable a una persona natural, su uso debe ajustarse a la Ley 1581 de 2012, sus principios de finalidad, libertad, transparencia, seguridad, circulación restringida y acceso, así como a las reglas sobre autorización y derechos del titular.',
        ],
      },
      {
        heading: 'Tecnologías utilizadas actualmente',
        body: [
          'Con base en la información técnica disponible del sitio, el sitio puede utilizar:',
          'Almacenamiento local o de sesión: para preferencia de tema, navegación, carrito, lista de cotización y funcionamiento de la experiencia de usuario.',
          'Registros técnicos de seguridad: para prevenir abuso, errores, fraude, accesos no autorizados y mantener trazabilidad.',
          'Cookies o identificadores necesarios: para permitir navegación, seguridad, formularios, cotizaciones, checkout y funcionalidades esenciales cuando se activen.',
          'Inventario técnico operativo previsto.',
          'Con base en la arquitectura actualmente proyectada para el sitio, y tomando como referencia prácticas públicas observadas en comercios colombianos de equipos médicos que combinan catálogo, formulario de contacto, WhatsApp, garantías, analítica y pasarelas, I-ME adopta el siguiente inventario técnico inicial. Este inventario debe verificarse en producción cada vez que se despliegue una nueva versión del sitio:',
          'Tecnología / identificador: ime_theme o equivalente · Categoría: Preferencias · Finalidad: Recordar tema visual, idioma o configuración básica de experiencia. · Proveedor o responsable: I-ME / sitio web · Duración estimada: Persistente hasta que el usuario borre la preferencia · Base de tratamiento: Funcionalidad solicitada por el usuario · Observaciones: No debe usarse para perfilamiento.',
          'Tecnología / identificador: ime_quote_cart o equivalente · Categoría: Estrictamente necesaria · Finalidad: Conservar temporalmente productos agregados a cotización, carrito o lista de interés. · Proveedor o responsable: I-ME / sitio web · Duración estimada: Sesión o persistencia limitada · Base de tratamiento: Ejecución de solicitud precontractual · Observaciones: Debe minimizarse y no incluir datos sensibles.',
          'Tecnología / identificador: ime_consent o equivalente · Categoría: Estrictamente necesaria · Finalidad: Guardar preferencias de consentimiento de cookies y tratamiento de datos. · Proveedor o responsable: I-ME / sitio web · Duración estimada: Hasta 12 meses o hasta cambio relevante de política · Base de tratamiento: Cumplimiento legal y responsabilidad demostrada · Observaciones: Debe registrar versión de política aceptada.',
          'Tecnología / identificador: Registros de servidor / hosting · Categoría: Seguridad · Finalidad: Seguridad, disponibilidad, diagnóstico de errores, prevención de abuso y trazabilidad. · Proveedor o responsable: Hosting / CDN / proveedor tecnológico · Duración estimada: Según política de seguridad y logs · Base de tratamiento: Interés legítimo y seguridad del servicio · Observaciones: Deben limitarse a lo necesario.',
          'Tecnología / identificador: WhatsApp link / API / widget, si se activa · Categoría: Integración de tercero · Finalidad: Permitir contacto comercial voluntario por WhatsApp. · Proveedor o responsable: Meta / WhatsApp y/o proveedor de widget · Duración estimada: Según políticas del tercero · Base de tratamiento: Solicitud del usuario y autorización del canal · Observaciones: Al hacer clic, el usuario puede quedar sujeto a políticas del tercero.',
          'Tecnología / identificador: Pasarela Wompi, si se activa · Categoría: Pago · Finalidad: Procesar pagos en Colombia, conciliación, antifraude y confirmación de transacción. · Proveedor o responsable: Wompi / Bancolombia o proveedor aplicable · Duración estimada: Según política del proveedor · Base de tratamiento: Ejecución contractual y obligación legal · Observaciones: I-ME no debe almacenar datos completos de tarjetas.',
          'Tecnología / identificador: Pasarela Stripe, si se activa · Categoría: Pago internacional · Finalidad: Procesar pagos internacionales, conciliación, antifraude y confirmación de transacción. · Proveedor o responsable: Stripe o proveedor aplicable · Duración estimada: Según política del proveedor · Base de tratamiento: Ejecución contractual y obligación legal · Observaciones: Activar solo si existe cuenta, contrato y países habilitados.',
          'Tecnología / identificador: Supabase Auth / Storage / Database, si se activa · Categoría: Funcional / seguridad · Finalidad: Autenticación administrativa, almacenamiento de productos, solicitudes y trazabilidad. · Proveedor o responsable: Supabase / I-ME · Duración estimada: Según configuración interna · Base de tratamiento: Ejecución precontractual, contractual y seguridad · Observaciones: Revisar transferencias internacionales y RLS.',
          'Tecnología / identificador: Google Analytics 4, Matomo, Microsoft Clarity u otra analítica, si se activa · Categoría: Analítica no esencial · Finalidad: Medir tráfico, rendimiento, navegación agregada y errores. · Proveedor o responsable: Proveedor analítico · Duración estimada: Según configuración · Base de tratamiento: Consentimiento previo cuando no sea estrictamente necesario · Observaciones: Debe permanecer desactivada hasta aceptación si implica identificación o perfilamiento.',
          'Tecnología / identificador: Meta Pixel, Google Ads, LinkedIn Insight Tag u otros píxeles, si se activan · Categoría: Publicidad / remarketing · Finalidad: Medición de campañas, audiencias, conversiones y remarketing. · Proveedor o responsable: Proveedor publicitario · Duración estimada: Según configuración · Base de tratamiento: Consentimiento previo, expreso e informado · Observaciones: No debe activarse sin banner/CMP y actualización de esta política.',
          'Tecnología / identificador: Fuentes, mapas, videos, CDN o scripts externos · Categoría: Integración de tercero · Finalidad: Cargar recursos visuales, mapas, videos, librerías o rendimiento. · Proveedor o responsable: Proveedor correspondiente · Duración estimada: Según proveedor · Base de tratamiento: Necesidad técnica o consentimiento según el caso · Observaciones: Preferir recursos locales cuando sea posible.',
          'Este inventario no autoriza por sí solo la instalación de herramientas no esenciales. Toda herramienta de analítica avanzada, publicidad, remarketing, perfilamiento, mapas, chat externo o CRM externo deberá pasar por revisión técnica, jurídica y de seguridad antes de producción.',
        ],
      },
      {
        heading: 'Categorías',
        body: [
          'Cookies o tecnologías estrictamente necesarias.',
          'Permiten la navegación, seguridad, conservación temporal de preferencias, carrito, lista de cotización, formularios y procesos esenciales. Algunas funciones pueden no operar correctamente sin ellas.',
          'Preferencias.',
          'Permiten recordar opciones del usuario, como idioma, tema visual, región, productos agregados a cotización o configuración de experiencia.',
          'Analítica.',
          'Permiten medir visitas, páginas consultadas, rendimiento, errores y comportamiento agregado del sitio. Actualmente no se confirma una herramienta definitiva.',
          'Como regla interna, no se activará analítica no esencial hasta que exista inventario técnico, finalidad documentada, configuración de minimización de datos y mecanismo de consentimiento cuando sea exigible. Las herramientas admisibles podrán incluir Google Analytics 4, Matomo, Microsoft Clarity u otra equivalente, previa aprobación técnica y jurídica.',
          'Publicidad, remarketing y píxeles.',
          'Permiten medir campañas, crear audiencias, hacer remarketing o personalizar publicidad. Actualmente no se confirma instalación de píxeles publicitarios.',
          'I-ME no debe activar tecnologías de publicidad, remarketing o perfilamiento sin aprobación previa, banner/CMP operativo, registro del consentimiento y actualización expresa de esta política. Podrán incluir Meta Pixel, Google Ads, LinkedIn Insight Tag u otros píxeles solo si existe necesidad comercial documentada y base jurídica válida.',
          'Integraciones de terceros.',
          'Pueden incluir WhatsApp, pasarelas de pago, mapas, CRM, chat, formularios, CDN, videos, fuentes, hosting, Supabase, Wompi, Stripe u otros proveedores.',
          'Los proveedores reales deberán documentarse en el inventario técnico antes del despliegue. Como mínimo se revisarán WhatsApp, hosting/CDN, pasarelas de pago, CRM, formularios, Supabase, herramientas de analítica, scripts externos, fuentes, mapas y reproductores de video.',
        ],
      },
      {
        heading: 'Consentimiento',
        body: [
          'Las tecnologías estrictamente necesarias pueden operar sin consentimiento adicional cuando sean indispensables para prestar el servicio solicitado por el usuario. Las cookies de analítica no esencial, publicidad, remarketing, perfilamiento o terceros no necesarios deberán activarse únicamente cuando exista una base jurídica válida y, cuando corresponda, autorización previa, expresa e informada.',
        ],
      },
      {
        heading: 'Gestión y retiro del consentimiento',
        body: [
          'El usuario podrá gestionar o retirar su consentimiento mediante:',
          'Panel de preferencias de cookies: banner o panel propio del sitio cuando se activen cookies no necesarias; hasta entonces, configuración del navegador y solicitud al canal de privacidad.',
          'Configuración del navegador.',
          'Solicitud al canal de privacidad: inmedicalime@gmail.com.',
          'Correo provisional: inmedicalime@gmail.com.',
          'I-ME implementará banner o CMP antes de activar cookies no necesarias, analítica avanzada, publicidad, remarketing o perfilamiento. El panel deberá permitir aceptar, rechazar y modificar preferencias, conservar prueba del consentimiento y no bloquear la navegación esencial cuando el usuario rechace cookies no necesarias.',
        ],
      },
      {
        heading: 'Terceros',
        body: [
          'Los terceros que instalen cookies o tecnologías similares podrán tratar datos conforme a sus propias políticas. I-ME International Medical Enterprise deberá verificar contractualmente que dichos proveedores cumplan estándares adecuados de protección de datos, seguridad y confidencialidad.',
        ],
      },
      {
        heading: 'Actualización',
        body: [
          'Esta política debe actualizarse cada vez que se incorporen, retiren o modifiquen cookies, píxeles, herramientas de analítica, CRM, chat externo, pasarelas de pago, scripts de terceros o tecnologías equivalentes.',
        ],
      },
    ],
  },
  {
    kind: 'terminos',
    slug: 'terminos',
    title: 'Términos y condiciones de uso, catálogo, cotizaciones y servicios',
    description:
      'Términos y condiciones de uso del sitio, catálogo, cotizaciones, comercio electrónico, servicios, garantías y financiación orientativa de I-ME.',
    badge: 'TÉRMINOS VALIDADOS',
    updated: '2026-06-15',
    sections: [
      {
        heading: 'Identificación del sitio y del operador',
        body: [
          'El sitio web https://i-me.com.co es operado bajo la marca I-ME International Medical Enterprise, por INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S., sociedad colombiana dedicada comercialmente a la venta, distribución, importación, exportación, instalación, soporte técnico, mantenimiento, asesoría e implementación de equipos, dispositivos e implementos médicos para el sector salud en Colombia y otros mercados cuando resulte aplicable.',
          'Datos disponibles:',
          'Nombre comercial: I-ME International Medical Enterprise.',
          'Razón social: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'NIT: 901871720-1.',
          'Matrícula mercantil: 277293.',
          'Cámara de comercio competente: Cámara de Comercio Aburrá Sur.',
          'Domicilio principal: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Dirección de notificaciones: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Correo electrónico: inmedicalime@gmail.com.',
          'Teléfono / WhatsApp comercial: +57 300 717 2757.',
          'Representante legal: Adriana Maria Patiño Gomez, C.C. No. 43.034.287.',
        ],
      },
      {
        heading: 'Naturaleza del sitio',
        body: [
          'El sitio presenta información comercial sobre equipos biomédicos, dispositivos médicos, consumibles, servicios técnicos, asesoría, instalación, mantenimiento, capacitación, soporte, financiación orientativa y canales de contacto. La información publicada no constituye consejo clínico, diagnóstico médico, recomendación terapéutica, dictamen regulatorio definitivo, asesoría legal, asesoría financiera ni oferta vinculante, salvo que una propuesta formal emitida por I-ME indique expresamente lo contrario.',
        ],
      },
      {
        heading: 'Usuarios',
        body: [
          'El sitio podrá ser utilizado por mayores de edad, instituciones prestadoras de salud, hospitales, clínicas, consultorios, centros médicos, universidades, distribuidores, compradores corporativos, profesionales de la salud, áreas biomédicas, áreas administrativas y usuarios interesados en los productos o servicios ofrecidos por I-ME. El usuario declara que la información suministrada es veraz, completa y actualizada, y que cuenta con autorización suficiente cuando actúa en nombre de una institución o tercero.',
        ],
      },
      {
        heading: 'Productos y servicios',
        body: [
          'I-ME informa que ofrece o puede ofrecer, entre otros: monitores multiparámetro, equipos de cardiología, ECG, Holter, desfibriladores, equipos de quirófano, mesas, lámparas, electrocirugía, neonatología, incubadoras, calentadores, CPAP, ecografía, diagnóstico por imágenes, bombas de infusión, mobiliario médico, máquinas de anestesia, ventiladores, radiología, instalación, puesta en marcha, mantenimiento, calibración, soporte, repuestos, capacitación y asesoría biomédica. Las especificaciones, marcas, modelos, certificaciones, registros sanitarios, disponibilidad, tiempos, garantías, condiciones de importación, instalación y soporte se confirman caso por caso mediante cotización o propuesta formal.',
        ],
      },
      {
        heading: 'Cotizaciones',
        body: [
          'Las solicitudes realizadas a través del sitio, WhatsApp, correo, formulario o asesor no constituyen aceptación automática de venta. Toda cotización está sujeta a validación de producto, disponibilidad, proveedor, especificaciones técnicas, registros, certificaciones, precio, moneda, impuestos, descuentos, transporte, instalación, garantía, soporte, vigencia de la oferta, aprobación comercial interna, condiciones de pago y aceptación formal cuando aplique.',
          'Cada cotización formal indicará su propia vigencia. Si no se expresa un término diferente, I-ME aplicará una vigencia orientativa de quince (15) días calendario, sujeta a inventario, tasa de cambio, condiciones de fabricante, costos de importación y disponibilidad regulatoria. Los precios se expresarán en pesos colombianos salvo indicación expresa de otra moneda. IVA, retenciones, transporte, seguro, instalación, puesta en marcha, capacitación, calibración, adecuaciones civiles/eléctricas, consumibles, repuestos y logística especial solo estarán incluidos cuando la cotización lo indique expresamente.',
        ],
      },
      {
        heading: 'Comercio electrónico y pagos',
        body: [
          'Cuando el sitio permita iniciar pagos en línea para consumibles u otros productos, el precio, disponibilidad, stock, proveedor, impuestos, descuentos, envío y condiciones finales deberán recalcularse o validarse del lado del servidor antes de redirigir al usuario a la pasarela de pago.',
          'Las pasarelas contempladas técnicamente pueden incluir Wompi para Colombia y Stripe para mercados internacionales. Estas pasarelas solo deberán activarse cuando I-ME cuente con cuenta de comercio válida, aprobación contractual, validación de webhooks, proceso de conciliación, revisión de privacidad y configuración de seguridad. Hasta que la activación esté confirmada, los pagos deberán tratarse como operaciones manuales o asistidas por los canales expresamente indicados en la cotización o factura.',
          'Una transacción solo se considerará aprobada cuando exista confirmación del servidor, webhook firmado, conciliación o validación equivalente. Capturas de pantalla, correos automáticos o simples intentos de pago no constituyen confirmación definitiva si el servidor o la pasarela reportan rechazo, error, reversión, fraude o inconsistencia.',
        ],
      },
      {
        heading: 'Entregas, instalación y puesta en marcha',
        body: [
          'Salvo que la cotización formal indique otra cosa, las condiciones de entrega se definirán caso por caso según tipo de producto, ciudad, inventario, importación, transporte, seguro, complejidad de instalación y preparación del sitio. El comprador deberá verificar empaque y condición externa al recibir y reportar daños visibles de inmediato con fotografías, observación en guía de transporte y aviso escrito. Instalación, puesta en marcha, pruebas funcionales, inducción, calibración, mantenimiento preventivo o capacitación solo estarán incluidos cuando la propuesta lo establezca expresamente. Para equipos biomédicos instalados, I-ME podrá exigir acta de entrega, lista de preparación del sitio y constancia de aceptación.',
        ],
      },
      {
        heading: 'Garantías, cambios, devoluciones y soporte',
        body: [
          'Las garantías serán las indicadas en la cotización formal, factura, documentación del fabricante o ley colombiana aplicable. Como política operativa de referencia, los equipos biomédicos tendrán la garantía del fabricante informada al momento de la venta y, si no se especifica un término, se aplicará la regla legal correspondiente del Estatuto del Consumidor. Consumibles, accesorios, repuestos, baterías, sensores, sondas, electrodos, cables y productos perecederos o de un solo uso podrán tener términos especiales según fabricante, condición sanitaria y naturaleza del producto.',
          'La garantía no cubre uso indebido, intervención no autorizada, instalación por terceros no autorizados, fallas eléctricas, accidentes, desgaste de consumibles, limpieza inadecuada, uso fuera de especificaciones, alteración de seriales o falta de mantenimiento requerido. Las solicitudes deberán incluir factura, número de pedido o cotización, producto, marca, modelo, serial cuando aplique, descripción de falla, fotografías/videos y datos de contacto.',
          'Las devoluciones o cambios voluntarios deberán solicitarse prontamente tras la recepción, con empaque original, accesorios completos y sin uso incompatible con la simple inspección, salvo cuando la ley colombiana conceda un derecho obligatorio. Productos importados o adquiridos bajo pedido especial, equipos personalizados, productos estériles abiertos, consumibles y bienes con riesgo sanitario podrán excluirse de devolución voluntaria, sin perjuicio de los derechos irrenunciables de garantía.',
        ],
      },
      {
        heading: 'Equipos biomédicos, INVIMA y responsabilidad regulatoria',
        body: [
          'La comercialización de dispositivos médicos y equipos biomédicos en Colombia puede estar sujeta a requisitos sanitarios, registros, permisos, certificaciones, trazabilidad, tecnovigilancia, mantenimiento, calibración y condiciones especiales según el tipo de producto. I-ME deberá asegurar que cada producto ofrecido como certificado, registrado o autorizado cuente con soporte vigente y verificable. El usuario institucional deberá validar que el equipo sea apto para su uso previsto, habilitación del servicio, infraestructura, protocolos internos y obligaciones sanitarias.',
        ],
      },
      {
        heading: 'Financiación orientativa',
        body: [
          'Cualquier simulación de financiación publicada en el sitio es meramente informativa y no constituye aprobación, oferta irrevocable, promesa de crédito ni compromiso financiero. Salvo documento formal en contrario, cualquier referencia a financiación dependerá de aliados financieros externos, leasing, bancos, fintech o acuerdos comerciales. I-ME no se considerará entidad financiera vigilada por el solo hecho de mostrar simulaciones o facilitar contacto con canales de financiación.',
        ],
      },
      {
        heading: 'Asesor virtual, automatización e inteligencia artificial',
        body: [
          'Si el sitio incorpora asesor virtual, chat automatizado o herramientas de inteligencia artificial, sus respuestas serán únicamente comerciales y orientativas. No sustituyen decisiones clínicas, biomédicas, regulatorias, financieras, legales o profesionales del usuario institucional. Precios, especificaciones, disponibilidad, garantías y condiciones finales solo serán vinculantes cuando consten en propuesta formal emitida por I-ME.',
        ],
      },
      {
        heading: 'Propiedad intelectual',
        body: [
          'El contenido del sitio se rige por el Aviso de Copyright y Propiedad Intelectual. El usuario no podrá copiar, reproducir, extraer, modificar, redistribuir, explotar comercialmente ni usar marcas, imágenes, fichas, textos, bases de datos o contenidos del sitio sin autorización previa y escrita.',
        ],
      },
      {
        heading: 'Protección de datos personales',
        body: [
          'El tratamiento de datos personales se rige por la Política de Privacidad y Tratamiento de Datos Personales y la Autorización para el Tratamiento de Datos Personales. El usuario debe abstenerse de enviar historias clínicas, datos de pacientes o información sensible no solicitada.',
        ],
      },
      {
        heading: 'Conductas prohibidas',
        body: [
          'El usuario se obliga a no usar el sitio con fines ilícitos, fraudulentos o no autorizados; no suplantar terceros; no suministrar información falsa; no afectar seguridad, disponibilidad o integridad del sitio; no extraer datos mediante scraping, bots o automatización no autorizada; no transmitir malware o spam; y no interpretar información comercial como recomendación clínica o autorización regulatoria definitiva.',
        ],
      },
      {
        heading: 'Limitación de responsabilidad',
        body: [
          'En la medida permitida por la ley colombiana, I-ME no será responsable por daños derivados del uso indebido del sitio, decisiones clínicas o técnicas tomadas sin validación profesional, fallas de terceros, indisponibilidad temporal, errores de conectividad, información suministrada por fabricantes o proveedores, fuerza mayor, caso fortuito o hechos fuera de su control razonable. Esta cláusula no excluye derechos irrenunciables del consumidor, garantías legales, responsabilidad por dolo o culpa grave ni obligaciones imperativas aplicables.',
        ],
      },
      {
        heading: 'Ley aplicable y jurisdicción',
        body: [
          'Estos términos se rigen por las leyes de la República de Colombia. El domicilio contractual sugerido será Envigado, Antioquia, Colombia, salvo pacto diferente en la propuesta o contrato. Las controversias serán conocidas por los jueces competentes de Colombia, salvo que las partes acuerden por escrito conciliación, arbitraje u otro mecanismo lícito de solución de controversias.',
        ],
      },
      {
        heading: 'Modificaciones',
        body: [
          'I-ME podrá modificar estos términos para reflejar cambios legales, comerciales, técnicos, operativos o regulatorios. La versión publicada en el sitio regirá nuevas interacciones, sin perjuicio de condiciones expresamente pactadas en propuestas o contratos anteriores.',
        ],
      },
      {
        heading: 'Advertencia de revisión profesional',
        body: [
          'Estos términos requieren revisión final por abogado colombiano, validación técnica, revisión sanitaria/regulatoria cuando aplique, revisión de consumidor/comercio electrónico, confirmación tributaria y validación de políticas reales de garantías, devoluciones, pagos, soporte, proveedores, financiación y tratamiento de datos antes de publicación.',
        ],
      },
    ],
  },
  {
    kind: 'copyright',
    slug: 'copyright',
    title: 'Aviso de copyright, propiedad intelectual y uso de contenidos',
    description:
      'Aviso de copyright, propiedad intelectual, marcas, contenidos técnicos, activos de fabricantes y uso permitido del sitio I-ME.',
    badge: 'AVISO VALIDADO',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Titularidad general',
        body: [
          'Salvo indicación expresa en contrario, los textos, estructura, selección de contenidos, diseño, identidad visual, recursos gráficos, interfaces, componentes, bases de datos, fotografías, videos, animaciones, fichas, textos comerciales y demás contenidos del sitio https://i-me.com.co están reservados a I-ME International Medical Enterprise o a sus respectivos titulares, licenciantes, fabricantes, proveedores o aliados.',
          'Razón social titular o licenciataria: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'NIT: 901871720-1.',
          'Domicilio: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Correo de contacto para propiedad intelectual: inmedicalime@gmail.com.',
        ],
      },
      {
        heading: 'Marcas y signos distintivos',
        body: [
          'Las marcas, nombres comerciales, logos, signos distintivos y referencias a fabricantes o productos que aparezcan en el sitio pertenecen a sus respectivos titulares. La mención de marcas de terceros no implica cesión, licencia, representación exclusiva, autorización de uso marcario ni relación comercial distinta de la informada expresamente.',
          'I-ME deberá conservar evidencia de titularidad, cesión, licencia o autorización suficiente sobre el logo, nombre comercial, imágenes, fotografías, videos, fichas técnicas, modelos 3D y material heredado del sitio anterior. Hasta tanto no exista soporte documental, el activo no deberá publicarse o deberá reemplazarse por contenido propio/licenciado.',
        ],
      },
      {
        heading: 'Uso permitido',
        body: [
          'El usuario puede consultar el contenido del sitio únicamente para evaluación comercial de productos y servicios de I-ME International Medical Enterprise, solicitud de cotizaciones, análisis técnico preliminar, contacto comercial y navegación ordinaria.',
          'No se autoriza, salvo permiso previo y escrito:',
          'Reproducir, copiar, distribuir, comunicar públicamente, transformar o explotar comercialmente el contenido.',
          'Usar fotografías, videos, fichas técnicas, logos o textos en catálogos, marketplaces, campañas o sitios de terceros.',
          'Extraer bases de datos, listados de productos o contenido mediante scraping no autorizado.',
          'Usar marcas, signos distintivos o contenido de fabricantes de manera que induzca a error sobre autorización, distribución, garantía o representación.',
          'Modificar fichas técnicas, especificaciones, certificaciones, registros, garantías o condiciones comerciales.',
        ],
      },
      {
        heading: 'Contenido de fabricantes y terceros',
        body: [
          'Las imágenes, fichas técnicas, certificaciones, manuales, marcas, modelos, nombres de producto, videos o especificaciones de fabricantes pueden estar sujetos a derechos de terceros. Su publicación debe contar con licencia, autorización, relación comercial válida o fundamento contractual suficiente.',
          'Matriz mínima de titularidad y licencias.',
          'I-ME adopta la siguiente matriz de control documental para prevenir usos no autorizados de contenidos, marcas, fichas técnicas, fotografías, videos, modelos 3D, documentos regulatorios y material heredado del sitio anterior. La publicación de cada activo debe quedar soportada en licencia, autorización, titularidad propia, relación comercial válida o fuente de uso permitido.',
          'Activo o contenido: Logo, nombre comercial e identidad visual I-ME · Titular esperado: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S. o titular que corresponda · Base permitida de uso: Titularidad propia, cesión o licencia · Evidencia mínima antes de publicar: Archivo fuente, contrato de diseño, cesión patrimonial o autorización escrita · Restricciones operativas: No sublicenciar ni permitir usos de terceros sin autorización.',
          'Activo o contenido: Textos corporativos, estructura del sitio y copy comercial propio · Titular esperado: I-ME o proveedor contratado · Base permitida de uso: Obra propia, encargo por prestación de servicios o cesión · Evidencia mínima antes de publicar: Contrato, aceptación de entregable o registro interno · Restricciones operativas: Evitar copia sustancial de textos de competidores.',
          'Activo o contenido: Fotografías institucionales propias · Titular esperado: I-ME, fotógrafo o banco autorizado · Base permitida de uso: Titularidad, licencia o autorización de uso · Evidencia mínima antes de publicar: Contrato, factura, licencia, release de imagen cuando aplique · Restricciones operativas: Verificar derechos de imagen de personas identificables.',
          'Activo o contenido: Fotografías de bancos de imagen · Titular esperado: Banco de imagen / licenciante · Base permitida de uso: Licencia comercial vigente · Evidencia mínima antes de publicar: URL, factura, licencia, términos de uso y fecha de descarga · Restricciones operativas: Cumplir límites de uso, atribución y prohibición de reventa.',
          'Activo o contenido: Fotografías, renders, videos y manuales de fabricantes · Titular esperado: Fabricante, distribuidor o licenciante · Base permitida de uso: Relación comercial, autorización de marketing o licencia documental · Evidencia mínima antes de publicar: Carta, contrato, autorización de distribuidor, portal autorizado o términos de marca · Restricciones operativas: No alterar especificaciones, certificaciones ni marcas.',
          'Activo o contenido: Fichas técnicas, manuales, catálogos y certificados · Titular esperado: Fabricante o autoridad emisora · Base permitida de uso: Distribución autorizada para fines comerciales o soporte técnico · Evidencia mínima antes de publicar: Documento oficial vigente, enlace del fabricante, permiso o contrato · Restricciones operativas: Indicar que la versión oficial prevalece sobre cualquier resumen web.',
          'Activo o contenido: Marcas de fabricantes y referencias de producto · Titular esperado: Titular marcario correspondiente · Base permitida de uso: Uso nominativo descriptivo o autorización comercial · Evidencia mínima antes de publicar: Relación comercial, autorización o justificación de uso nominativo · Restricciones operativas: No insinuar representación exclusiva si no existe.',
          'Activo o contenido: Modelos 3D, animaciones, renders y mockups · Titular esperado: Creador, fabricante o licenciante · Base permitida de uso: Licencia comercial, encargo o autorización · Evidencia mínima antes de publicar: Archivo fuente, contrato, licencia o confirmación escrita · Restricciones operativas: No usar modelos extraídos de terceros sin permiso.',
          'Activo o contenido: Testimonios, casos de éxito y logos de clientes · Titular esperado: Cliente o institución correspondiente · Base permitida de uso: Autorización previa y específica · Evidencia mínima antes de publicar: Consentimiento escrito, alcance, plazo y canal autorizado · Restricciones operativas: No publicar datos clínicos, sensibles o confidenciales.',
          'Activo o contenido: Documentos INVIMA, CE, FDA o equivalentes · Titular esperado: Autoridad, fabricante o titular del registro · Base permitida de uso: Uso informativo con soporte vigente · Evidencia mínima antes de publicar: Copia verificable, número de registro, fecha y producto aplicable · Restricciones operativas: No usar certificaciones genéricas para productos no cubiertos.',
          'La ausencia de evidencia suficiente impide la publicación del activo o exige sustituirlo por contenido propio, contenido licenciado o contenido genérico sin afectación de terceros.',
        ],
      },
      {
        heading: 'Información técnica y certificaciones',
        body: [
          'La información técnica publicada en el sitio tiene finalidad comercial e informativa. Las especificaciones, disponibilidad, certificaciones CE, FDA, registros INVIMA, manuales, garantía, instalación y compatibilidad deberán confirmarse en la propuesta formal, ficha técnica oficial del fabricante y documentación regulatoria aplicable.',
          'El uso de expresiones como “certificado”, “registro INVIMA”, “CE”, “FDA” o equivalentes deberá corresponder a documentación vigente, verificable y aplicable a cada producto concreto.',
        ],
      },
      {
        heading: 'Reporte de infracciones',
        body: [
          'Quien considere que algún contenido del sitio vulnera derechos de propiedad intelectual, derechos de autor, marcas, imagen, datos personales o derechos de terceros podrá reportarlo al correo inmedicalime@gmail.com o al canal legal definitivo.',
          'Canal legal definitivo: inmedicalime@gmail.com.',
          'Información mínima del reporte: identificación del reclamante, derecho presuntamente vulnerado, ubicación exacta del contenido, prueba de titularidad o representación, solicitud concreta y datos de contacto.',
        ],
      },
      {
        heading: 'Reserva de derechos',
        body: [
          'I-ME International Medical Enterprise se reserva todos los derechos no otorgados expresamente. El uso no autorizado del contenido podrá dar lugar a reclamaciones civiles, comerciales, administrativas o penales conforme a la legislación colombiana aplicable.',
        ],
      },
    ],
  },
];

const enPages: LegalPage[] = [
  {
    kind: 'privacidad',
    slug: 'privacy',
    title: 'Privacy and personal data processing policy',
    description:
      'Complete privacy and personal data processing policy for I-ME forms, quotes, orders, payments, support and commercial communications.',
    badge: 'VALIDATED POLICY',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Identification of the data controller',
        body: [
          'For purposes of this policy, the intended data controller is I-ME International Medical Enterprise.',
          'Publicly available identification and contact details from the website:',
          'Trade name: I-ME International Medical Enterprise.',
          'Reported business activity: distribution, installation, technical support, maintenance and commercial advisory for biomedical equipment for hospitals, clinics, healthcare centers, medical offices and healthcare institutions in Colombia.',
          'Contact email: inmedicalime@gmail.com.',
          'WhatsApp / commercial phone: +57 300 717 2757.',
          'Reported country of operation: Colombia.',
          'Full legal name: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'Tax ID / NIT: 901871720-1.',
          'Registered address: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Physical address for legal or administrative notices: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Competent Chamber of Commerce: Cámara de Comercio Aburrá Sur.',
          'Legal representative: Adriana Maria Patiño Gomez, C.C. No. 43.034.287.',
          'Official channel for data subject requests: inmedicalime@gmail.com.',
        ],
      },
      {
        heading: 'Applicable Colombian legal framework',
        body: [
          'This policy is interpreted under Article 15 of the Colombian Constitution and Colombian personal data protection regulations, especially:',
          'Statutory Law 1581 of 2012, which sets general provisions for personal data protection.',
          'Decree 1377 of 2013, partially regulating Law 1581 of 2012, as applicable and as compiled in Decree 1074 of 2015.',
          'Decree 886 of 2014, on the National Database Registry, compiled in Decree 1074 of 2015, where applicable.',
          'Law 1266 of 2008, only if financial, credit, commercial or service data subject to that special regime are processed.',
          'Law 2300 of 2023, where applicable to commercial, advertising or collection contacts.',
          'Law 1480 of 2011, the Colombian Consumer Protection Statute, where the data subject acts as a consumer or user in e-commerce or consumer relationships.',
        ],
      },
      {
        heading: 'Scope',
        body: [
          'This policy applies to personal data collected through:',
          'Website contact forms.',
          'Quote requests.',
          'Product quote lists.',
          'Orders for consumables or products available for online purchase, if such functionality is active.',
          'Email, WhatsApp, phone, forms, CRM, chat or authorized commercial channels.',
          'Support, installation, maintenance, training and after-sales processes.',
          'Minimum technical records related to security, fraud prevention, auditability, traceability and website operation.',
          'This policy does not make I-ME International Medical Enterprise a healthcare provider, clinic, laboratory, insurer or issuer of clinical opinions. Website and advisor information is limited to commercial, technical and product-guidance purposes regarding biomedical equipment.',
        ],
      },
      {
        heading: 'Personal data that may be processed',
        body: [
          "Depending on the data subject's interaction with the website or commercial channels, the following data may be processed:",
          'Identification and contact data.',
          'Name and surname.',
          'Position or role within the institution.',
          'Identification type and number, when necessary for quotes, invoicing, payments, warranties or contractual compliance.',
          'Email address.',
          'Phone or WhatsApp number.',
          'City, department/state and country.',
          'Delivery, billing or installation address, where applicable.',
          'Institutional or commercial data.',
          'Name of the institution, clinic, hospital, medical office, healthcare center, university, distributor, supplier or company.',
          'Clinical or technical area of interest.',
          'Requested products or services.',
          'Budget, commercial need, delivery, installation or support conditions.',
          'Quote, order, communication and commercial follow-up history.',
          'Transaction and payment data.',
          'Where online payments are enabled, payment references, transaction status, order number, amount, currency, payment method and confirmations issued by the relevant payment gateway may be processed. I-ME International Medical Enterprise must not store full credit card data or sensitive financial credentials, unless an authorized gateway or certified provider handles them under its own security standards.',
          'Technical data.',
          'IP address.',
          'Session identifiers.',
          'Date and time of interaction.',
          'Consent records.',
          'Browser, device, operating system and technical parameters required for security, auditability, fraud prevention and website operation.',
          'Sensitive data.',
          'The website does not request medical records, diagnoses, medical images, patient health information or other sensitive data. If a user voluntarily provides sensitive data, I-ME International Medical Enterprise must refrain from using it for unauthorized purposes and must define its processing with legal, technical and security advice before storing, transferring or sharing it.',
        ],
      },
      {
        heading: 'Purposes of processing',
        body: [
          'Personal data may be processed for the following purposes:',
          'Receiving, recording and responding to contact requests.',
          'Preparing, sending and following up on quotes.',
          'Validating availability, specifications, technical conditions, price, logistics, warranty, installation and support for biomedical equipment.',
          'Managing orders, payments, confirmations, deliveries, warranties and after-sales support.',
          'Coordinating with manufacturers, distributors, logistics providers, technicians, payment gateways, technology platforms and partners strictly necessary to fulfill the request.',
          'Providing commercial and technical advisory on products, without replacing clinical, regulatory or specialized professional criteria.',
          'Sending commercial, promotional or informational communications where there is prior, express and informed authorization or another applicable lawful basis.',
          'Managing data subject requests: access, update, rectification, deletion, withdrawal of authorization and claims.',
          'Complying with legal, accounting, tax, contractual, administrative, healthcare regulatory, consumer protection, e-commerce and fraud prevention obligations.',
          'Maintaining website and operation security, integrity, traceability and auditability.',
          "Defending I-ME International Medical Enterprise's legal interests in claims, disputes, audits, administrative requests or judicial proceedings.",
        ],
      },
      {
        heading: 'Children and adolescents',
        body: [
          'The website is not directed to children or adolescents. If data of minors are provided, processing must respect the best interests of the child, fundamental rights and special Colombian rules. In such cases, I-ME International Medical Enterprise must verify authorization from the legal representative and limit processing to what is strictly necessary.',
        ],
      },
      {
        heading: 'Data subject rights',
        body: [
          'Under Law 1581 of 2012, data subjects may exercise, among others, the following rights:',
          'Know, update and rectify their personal data.',
          'Request proof of authorization, except when the law exempts such requirement.',
          'Be informed about the use given to their personal data.',
          'File complaints before the Superintendence of Industry and Commerce for violations of personal data protection rules.',
          'Withdraw authorization and/or request deletion where there is no legal or contractual duty to retain the data.',
          'Access their processed personal data free of charge under legal terms.',
        ],
      },
      {
        heading: 'Procedure for inquiries and claims',
        body: [
          'The data subject may submit inquiries or claims through the official data protection channel defined by I-ME International Medical Enterprise.',
          'Final official channel: inmedicalime@gmail.com.',
          'Suggested provisional channel: inmedicalime@gmail.com.',
          'Minimum request information: full name, ID document where applicable, contact details, clear description of the request, supporting documents and capacity in which the person acts if acting as representative or attorney-in-fact.',
          'Inquiries and claims will be handled within the terms set forth in Law 1581 of 2012 and its regulations. I-ME adopts the following minimum internal procedure:',
          'Filing. The request will be received through the official data protection channel, email, website form or authorized physical channel. Date, time, channel, requester identification and request type will be recorded.',
          'Identity and standing validation. Before disclosing, correcting or deleting information, I-ME may request identity document, representation support or power of attorney where a third party acts.',
          'Classification. The request will be classified as inquiry, claim, update, rectification, deletion, withdrawal, proof of authorization, objection to commercial contact or security incident.',
          'Internal routing. The channel owner will route the request to the commercial, administrative, technical, accounting or legal area that manages the relevant database.',
          'Response. Inquiries will be answered within the applicable legal term. Claims will be processed under Law 1581 of 2012, recording “claim in process” where applicable.',
          'Execution. Where the request is valid, data will be updated, rectified, deleted or blocked in active databases, CRM, forms, commercial lists and reasonably available repositories.',
          'Closure and traceability. Evidence of request, analysis, decision, response date and measures adopted will be retained without keeping more data than necessary.',
          'Escalation. Requests involving sensitive data, minors, authorities, security incidents, international transfers, complex claims or litigation must be escalated for legal review.',
        ],
      },
      {
        heading: 'Authorization',
        body: [
          'Personal data processing will be carried out with prior, express and informed authorization of the data subject where required. Authorization may be obtained through checkboxes, forms, electronic records, emails, messages, contracts, quotes, orders, physical documents or any mechanism that enables later consultation.',
          'Authorization must be retained with sufficient traceability, including date, time, channel, accepted text and authorized purpose whenever technically possible.',
        ],
      },
      {
        heading: 'Data transfers and transmissions',
        body: [
          'Data may be shared with processors or third parties when necessary to fulfill authorized purposes, such as technology providers, hosting, CRM, payment gateways, logistics, technical support, manufacturers, distributors, commercial partners, legal, accounting or tax advisors, or competent authorities.',
          'Where international data transfer or transmission exists, I-ME International Medical Enterprise must verify compliance with Law 1581 of 2012 and regulations, including data processing agreements, adequate safeguards or authorizations where applicable.',
        ],
      },
      {
        heading: 'Information security',
        body: [
          'I-ME International Medical Enterprise will adopt reasonable administrative, technical and organizational measures to protect personal data against loss, unauthorized access, misuse, alteration, disclosure or unauthorized destruction.',
          'Private keys, tokens, privileged credentials, payment gateway secrets, LLM provider keys, Supabase keys and sensitive variables must not be exposed in the client, public repositories or dist/ folder. They must remain in secure environments, such as CI/CD secrets, server functions or Supabase Edge Functions, according to the applicable technical architecture.',
        ],
      },
      {
        heading: 'Retention',
        body: [
          'Data will be retained for the time necessary to fulfill authorized purposes and legal, contractual, accounting, tax, administrative, healthcare regulatory, consumer protection, audit, support, warranty and legal defense obligations.',
          'I-ME adopts the following initial internal retention table, subject to accounting, tax, healthcare-regulatory, contractual and technical validation:',
          'Data type or database: Simple commercial contacts without active business · Suggested operational period: Up to 2 years from last interaction · Retention criterion: Reasonable commercial follow-up and consent traceability · Action at end of period: Deletion, anonymization or retention only with current authorization.',
          'Data type or database: Quote requests and non-accepted proposals · Suggested operational period: Up to 3 years · Retention criterion: Legal defense, commercial history and pre-contractual audit · Action at end of period: Restricted archive or secure deletion.',
          'Data type or database: Customers, orders, invoices, payments and accounting records · Suggested operational period: At least the applicable legal accounting, tax and commercial term · Retention criterion: Legal, tax, accounting and contractual compliance · Action at end of period: Restricted legal retention and later secure deletion.',
          'Data type or database: Warranties, installation, maintenance, support and after-sales · Suggested operational period: Warranty term plus up to 5 years or applicable legal term · Retention criterion: Warranty service, technovigilance, claims and legal defense · Action at end of period: Restricted archive or technical anonymization.',
          'Data type or database: Data and commercial communication consents · Suggested operational period: While authorization is valid and up to 5 years after withdrawal or last relevant interaction · Retention criterion: Proof of authorization and accountability · Action at end of period: Minimum evidentiary retention or secure deletion.',
          'Data type or database: Technical and security logs · Suggested operational period: Between 6 and 24 months, unless incident or legal request exists · Retention criterion: Security, audit, fraud, availability and diagnosis · Action at end of period: Rotation, anonymization or secure deletion.',
          'Data type or database: Suppliers, manufacturers, partners and contractors · Suggested operational period: Contract term plus applicable legal term · Retention criterion: Contract performance, audit, compliance and legal defense · Action at end of period: Restricted archive or secure deletion.',
          'Data type or database: Candidates or collaborators, if employment data are processed · Suggested operational period: According to internal labor policy and applicable rules · Retention criterion: HR, social security, selection and employment obligations · Action at end of period: Separate from commercial databases and apply restricted access.',
          'Data type or database: Sensitive data received without request · Suggested operational period: The shortest possible time · Retention criterion: Minimization, preventive deletion and legal analysis · Action at end of period: Secure deletion unless legal obligation or specific authorization exists.',
          'Retention must apply minimization, restricted access, confidentiality, necessity and accountability principles.',
        ],
      },
      {
        heading: 'Commercial communications',
        body: [
          'I-ME International Medical Enterprise will only send commercial communications through channels authorized by the data subject or permitted by law. Rules on authorization, channels, schedules, frequency, withdrawal and objection must be respected, especially where Law 2300 of 2023 applies.',
        ],
      },
      {
        heading: 'Cookies and similar technologies',
        body: [
          'The use of cookies, local storage, session storage, pixels, analytics or third-party tools is governed by the website Cookie Policy. The installation of analytics, behavioral advertising, external chat, external CRM or equivalent technologies requires prior consent review and document updates.',
        ],
      },
      {
        heading: 'Changes to this policy',
        body: [
          'I-ME International Medical Enterprise may amend this policy to reflect legal, technical, commercial or operational changes. Relevant amendments must be published on the website and, where required by law, communicated to data subjects or subject to renewed authorization.',
        ],
      },
      {
        heading: 'Publication warning',
        body: [
          'This document is legally structured for final review, but requires validation by the controller, Colombian legal counsel and technical team before production. It should not be published without confirming at least: full legal name, NIT, registered address, legal representative, official data protection channel, internal procedure, processors, international transfers, actual cookies, active payment gateways, databases and National Database Registry obligations where applicable.',
        ],
      },
    ],
  },
  {
    kind: 'habeas-data',
    slug: 'data-authorization',
    title: 'Authorization for personal data processing',
    description:
      'Authorization for personal data processing in I-ME commercial requests, quotes, orders, support and communications.',
    badge: 'VALIDATED AUTHORIZATION',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Data controller',
        body: [
          'I authorize I-ME International Medical Enterprise, identified as follows:',
          'Legal name: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'Tax ID / NIT: 901871720-1.',
          'Registered address: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Contact email: inmedicalime@gmail.com.',
          'WhatsApp / commercial phone: +57 300 717 2757.',
          'Official data subject request channel: inmedicalime@gmail.com.',
          'to collect, store, use, disclose, transmit, transfer, update, delete and generally process my personal data under Colombian Law 1581 of 2012, its regulatory decrees and the Privacy and Personal Data Processing Policy published by the company.',
        ],
      },
      {
        heading: 'Data I authorize to be processed',
        body: [
          'This authorization covers data voluntarily provided through forms, WhatsApp, email, phone calls, quote requests, orders, support requests or commercial communications, including:',
          'Name, surname, position, institution and contact details.',
          'Email, phone, WhatsApp, city, department/state and country.',
          'Commercial information related to products, equipment, consumables, services, quotes, orders, installation, support, warranty and indicative financing.',
          'Data required for invoicing, payment, delivery, support, warranty, contractual performance and after-sales service.',
          'Minimum technical records for security, traceability, auditability and consent.',
          'I declare that I should not send medical records, diagnoses, medical images, patient data or unsolicited sensitive information. If I voluntarily provide sensitive information, I understand its processing must be assessed under special rules and may require specific authorization.',
        ],
      },
      {
        heading: 'Authorized purposes',
        body: [
          'I authorize the processing of my data to:',
          'Manage my contact request, quote, order, advisory request, installation, support or warranty.',
          'Prepare and send commercial proposals for biomedical equipment, consumables, services, technical support, maintenance and indicative financing.',
          'Verify availability, specifications, price, delivery times, technical conditions, warranties and installation requirements.',
          'Coordinate with manufacturers, distributors, logistics providers, technicians, payment gateways, technology platforms or partners necessary to fulfill my request.',
          'Carry out commercial follow-up, after-sales service, support, satisfaction surveys, service communications and information updates.',
          'Send commercial, promotional or informational communications related to I-ME International Medical Enterprise products and services, provided the channel has been authorized or there is an applicable legal basis.',
          'Comply with legal, tax, accounting, contractual, administrative, healthcare regulatory, consumer protection and e-commerce obligations.',
          'Prevent fraud, protect website security, maintain traceability and defend legal interests.',
        ],
      },
      {
        heading: 'Commercial communications and authorized channels',
        body: [
          'By checking the corresponding box, I authorize I-ME International Medical Enterprise to contact me through the channels I select or voluntarily provide, such as email, phone call, WhatsApp, SMS or other digital media.',
          'I-ME International Medical Enterprise must respect authorized channels, withdrawal of authorization and legal rules on schedules, frequency and the right not to receive unwanted commercial communications.',
        ],
      },
      {
        heading: 'Data subject rights',
        body: [
          'As a data subject, I have the right to know, update, rectify, request proof of authorization, be informed of the use given to my data, file complaints before the Superintendence of Industry and Commerce, withdraw authorization and request deletion where there is no legal or contractual duty to retain the data.',
        ],
      },
      {
        heading: 'Authorization statement',
        body: [
          'I declare that I have read and accept the Privacy and Personal Data Processing Policy of I-ME International Medical Enterprise and authorize the processing of my personal data for the informed purposes.',
          'Suggested checkbox text:',
          'I have read and accept the Privacy Policy and authorize I-ME International Medical Enterprise to process my personal data to manage my commercial request, quote, order, support and related communications under Colombian Law 1581 of 2012.',
          'Suggested optional commercial communications text:',
          'I authorize receiving commercial, promotional and informational communications from I-ME International Medical Enterprise through the contact channels provided. I understand that I may withdraw this authorization at any time.',
        ],
      },
      {
        heading: 'Consent record',
        body: [
          'The system must retain evidence of consent, including at least:',
          'Accepted text.',
          'Date and time.',
          'Channel or form.',
          'IP or technical identifier where reasonable.',
          'Authorized purpose.',
          'Version of the accepted policy.',
          'The technical integration must retain, at minimum, the following traceability fields: consentimiento_datos, consentimiento_comercial, consentimiento_cookies, consentimiento_timestamp, version_politica, fuente_consentimiento, ip_hash or reasonable technical identifier, capture channel, accepted text and authorized purpose. Refusal or withdrawal of commercial consent must not prevent the handling of strictly necessary requests, quotes, warranties or contractual compliance.',
        ],
      },
    ],
  },
  {
    kind: 'cookies',
    slug: 'cookies',
    title: 'Cookie and similar technologies policy',
    description:
      'Cookie and similar technologies policy for the I-ME website, including local storage, security, analytics, gateways and third-party integrations.',
    badge: 'VALIDATED POLICY',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Controller',
        body: [
          'The intended website controller is I-ME International Medical Enterprise.',
          'Email: inmedicalime@gmail.com.',
          'WhatsApp / phone: +57 300 717 2757.',
          'Legal name: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S..',
          'Tax ID / NIT: 901871720-1.',
          'Registered address: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Official privacy channel: inmedicalime@gmail.com.',
        ],
      },
      {
        heading: 'What cookies and similar technologies are',
        body: [
          "Cookies are small files or identifiers that may be stored in the user's browser or device to enable website operation, remember preferences, improve experience, measure usage, strengthen security or enable third-party integrations.",
          'Similar technologies may also be used, such as local storage, session storage, pixels, SDKs, tags, device identifiers, server logs and analytics tools.',
        ],
      },
      {
        heading: 'Colombian legal framework',
        body: [
          'Colombia does not have an autonomous cookie law equivalent to the European model. However, where cookies or similar technologies identify or make a natural person identifiable, their use must comply with Law 1581 of 2012, including the principles of purpose limitation, freedom, transparency, security, restricted circulation and access, as well as authorization and data subject rights rules.',
        ],
      },
      {
        heading: 'Technologies currently used',
        body: [
          'Based on the technical information available for the website, the site may use:',
          'Local or session storage: for theme preference, navigation, cart, quote list and user experience operation.',
          'Technical security logs: to prevent abuse, errors, fraud, unauthorized access and maintain traceability.',
          'Necessary cookies or identifiers: to enable navigation, security, forms, quotes, checkout and essential functions when active.',
          'Initial technical operating inventory.',
          'Based on the currently projected website architecture, and using public practices observed in Colombian medical-equipment commerce sites that combine catalog, contact forms, WhatsApp, warranty flows, analytics and payment gateways, I-ME adopts the following initial technical inventory. This inventory must be verified in production whenever a new website version is deployed:',
          'Technology / identifier: ime_theme or equivalent · Category: Preferences · Purpose: Remember visual theme, language or basic user-experience settings. · Provider or responsible party: I-ME / website · Estimated duration: Persistent until deleted by the user · Processing basis: Functionality requested by the user · Notes: Must not be used for profiling.',
          'Technology / identifier: ime_quote_cart or equivalent · Category: Strictly necessary · Purpose: Temporarily keep products added to quote, cart or interest list. · Provider or responsible party: I-ME / website · Estimated duration: Session or limited persistence · Processing basis: Pre-contractual request · Notes: Must be minimized and must not include sensitive data.',
          'Technology / identifier: ime_consent or equivalent · Category: Strictly necessary · Purpose: Store cookie and data-processing consent preferences. · Provider or responsible party: I-ME / website · Estimated duration: Up to 12 months or until a relevant policy change · Processing basis: Legal compliance and accountability · Notes: Must record accepted policy version.',
          'Technology / identifier: Server / hosting logs · Category: Security · Purpose: Security, availability, error diagnosis, abuse prevention and traceability. · Provider or responsible party: Hosting / CDN / technology provider · Estimated duration: According to security and log policy · Processing basis: Legitimate security interest · Notes: Must be limited to what is necessary.',
          'Technology / identifier: WhatsApp link / API / widget, if activated · Category: Third-party integration · Purpose: Enable voluntary commercial contact via WhatsApp. · Provider or responsible party: Meta / WhatsApp and/or widget provider · Estimated duration: According to third-party policies · Processing basis: User request and channel authorization · Notes: When clicked, the user may be subject to third-party policies.',
          'Technology / identifier: Wompi gateway, if activated · Category: Payment · Purpose: Process Colombian payments, reconciliation, anti-fraud and transaction confirmation. · Provider or responsible party: Wompi / Bancolombia or applicable provider · Estimated duration: According to provider policy · Processing basis: Contractual performance and legal obligation · Notes: I-ME must not store full card data.',
          'Technology / identifier: Stripe gateway, if activated · Category: International payment · Purpose: Process international payments, reconciliation, anti-fraud and transaction confirmation. · Provider or responsible party: Stripe or applicable provider · Estimated duration: According to provider policy · Processing basis: Contractual performance and legal obligation · Notes: Activate only with account, contract and enabled countries.',
          'Technology / identifier: Supabase Auth / Storage / Database, if activated · Category: Functional / security · Purpose: Admin authentication, product storage, requests and traceability. · Provider or responsible party: Supabase / I-ME · Estimated duration: According to internal configuration · Processing basis: Pre-contractual/contractual execution and security · Notes: Review international transfers and RLS.',
          'Technology / identifier: Google Analytics 4, Matomo, Microsoft Clarity or other analytics, if activated · Category: Non-essential analytics · Purpose: Measure traffic, performance, aggregate navigation and errors. · Provider or responsible party: Analytics provider · Estimated duration: According to configuration · Processing basis: Prior consent where not strictly necessary · Notes: Must remain disabled until acceptance if identification or profiling is involved.',
          'Technology / identifier: Meta Pixel, Google Ads, LinkedIn Insight Tag or other pixels, if activated · Category: Advertising / remarketing · Purpose: Campaign measurement, audiences, conversions and remarketing. · Provider or responsible party: Advertising provider · Estimated duration: According to configuration · Processing basis: Prior, express and informed consent · Notes: Must not be activated without banner/CMP and policy update.',
          'Technology / identifier: Fonts, maps, videos, CDN or external scripts · Category: Third-party integration · Purpose: Load visual resources, maps, videos, libraries or performance tools. · Provider or responsible party: Relevant provider · Estimated duration: According to provider · Processing basis: Technical necessity or consent depending on case · Notes: Prefer local resources where possible.',
          'This inventory does not by itself authorize installation of non-essential tools. Any advanced analytics, advertising, remarketing, profiling, maps, external chat or external CRM tool must undergo technical, legal and security review before production.',
        ],
      },
      {
        heading: 'Categories',
        body: [
          'Strictly necessary cookies or technologies.',
          'These enable navigation, security, temporary preference storage, cart, quote list, forms and essential processes. Some functions may not operate properly without them.',
          'Preferences.',
          'These remember user choices such as language, visual theme, region, products added to quotes or experience settings.',
          'Analytics.',
          'These measure visits, pages viewed, performance, errors and aggregated website behavior. No definitive tool is currently confirmed.',
          'As an internal rule, non-essential analytics will not be activated until a technical inventory, documented purpose, data-minimization configuration and consent mechanism, where required, exist. Admissible tools may include Google Analytics 4, Matomo, Microsoft Clarity or an equivalent tool, subject to technical and legal approval.',
          'Advertising, remarketing and pixels.',
          'These measure campaigns, create audiences, perform remarketing or personalize advertising. No advertising pixel installation is currently confirmed.',
          'I-ME must not activate advertising, remarketing or profiling technologies without prior approval, operating banner/CMP, consent record and express update of this policy. These tools may include Meta Pixel, Google Ads, LinkedIn Insight Tag or other pixels only where a documented commercial need and valid legal basis exist.',
          'Third-party integrations.',
          'These may include WhatsApp, payment gateways, maps, CRM, chat, forms, CDN, videos, fonts, hosting, Supabase, Wompi, Stripe or other providers.',
          'Actual providers must be documented in the technical inventory before deployment. At minimum, WhatsApp, hosting/CDN, payment gateways, CRM, forms, Supabase, analytics tools, external scripts, fonts, maps and video players will be reviewed.',
        ],
      },
      {
        heading: 'Consent',
        body: [
          'Strictly necessary technologies may operate without additional consent when indispensable to provide the service requested by the user. Non-essential analytics, advertising, remarketing, profiling or third-party cookies must be activated only where there is a valid legal basis and, where applicable, prior, express and informed authorization.',
        ],
      },
      {
        heading: 'Managing and withdrawing consent',
        body: [
          'Users may manage or withdraw consent through:',
          'Cookie preference panel: website banner or preference panel when non-necessary cookies are activated; until then, browser settings and privacy request channel.',
          'Browser settings.',
          'Privacy request channel: inmedicalime@gmail.com.',
          'Provisional email: inmedicalime@gmail.com.',
          'I-ME will implement a banner or CMP before activating non-essential cookies, advanced analytics, advertising, remarketing or profiling. The panel must allow users to accept, reject and modify preferences, preserve proof of consent and avoid blocking essential browsing when users reject non-necessary cookies.',
        ],
      },
      {
        heading: 'Third parties',
        body: [
          'Third parties that install cookies or similar technologies may process data under their own policies. I-ME International Medical Enterprise must contractually verify that such providers comply with appropriate data protection, security and confidentiality standards.',
        ],
      },
      {
        heading: 'Updates',
        body: [
          'This policy must be updated whenever cookies, pixels, analytics tools, CRM, external chat, payment gateways, third-party scripts or equivalent technologies are added, removed or modified.',
        ],
      },
    ],
  },
  {
    kind: 'terminos',
    slug: 'terms',
    title: 'Terms and conditions of use, catalog, quotes and services',
    description:
      'Terms and conditions for website use, catalog, quotes, e-commerce, services, warranties and indicative financing by I-ME.',
    badge: 'VALIDATED TERMS',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'Website and operator identification',
        body: [
          'The website https://i-me.com.co is operated under the brand I-ME International Medical Enterprise, a Colombian business commercially dedicated to distribution, installation, technical support, maintenance, advisory and implementation support for biomedical equipment for the healthcare sector in Colombia.',
          'Available data:',
          'Trade name: I-ME International Medical Enterprise.',
          'Email: inmedicalime@gmail.com.',
          'WhatsApp / phone: +57 300 717 2757.',
          'Country of operation: Colombia.',
          'Legal name: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S.',
          'Tax ID / NIT: 901871720-1.',
          'Registered address: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Legal representative: Adriana Maria Patiño Gomez, C.C. No. 43.034.287.',
          'Notice address: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Commercial registration number: 277293.',
          'Competent Chamber of Commerce: Cámara de Comercio Aburrá Sur.',
        ],
      },
      {
        heading: 'Nature of the website',
        body: [
          'The website presents commercial information on biomedical equipment, consumables, technical services, advisory, installation, maintenance, training, support, indicative financing and contact channels.',
          'Published information does not constitute clinical advice, medical diagnosis, therapeutic recommendation, final regulatory technical opinion, legal advice, financial advice or binding offer, unless a formal proposal issued by I-ME International Medical Enterprise expressly states otherwise.',
        ],
      },
      {
        heading: 'Users',
        body: [
          'The website may be used by adults, healthcare institutions, hospitals, clinics, medical offices, healthcare centers, universities, distributors, corporate buyers, healthcare professionals, biomedical engineering departments, administrative areas and users interested in products or services offered by I-ME International Medical Enterprise.',
          'The user declares that the information provided is true, complete and up to date, and that they have sufficient authorization when acting on behalf of an institution or third party.',
        ],
      },
      {
        heading: 'Products and services',
        body: [
          'I-ME International Medical Enterprise reports that it offers or may offer, among others:',
          'Multiparameter monitors.',
          'Cardiology equipment, ECG, Holter and defibrillators.',
          'Operating room equipment, tables, lamps and electrosurgery.',
          'Neonatology, incubators, warmers and CPAP.',
          'Ultrasound and diagnostic imaging.',
          'Infusion pumps and IV solutions.',
          'Medical furniture.',
          'Anesthesia machines and ventilators.',
          'Radiology systems and diagnostic equipment.',
          'Installation, commissioning, maintenance, calibration, support, spare parts, training and biomedical advisory.',
          'Specifications, brands, models, certifications, sanitary registrations, availability, times, warranties, import conditions, installation and support are confirmed case by case through a quote or formal proposal.',
        ],
      },
      {
        heading: 'Quotes',
        body: [
          'Requests made through the website, WhatsApp, email, form or advisor do not constitute automatic acceptance of sale. Every quote is subject to:',
          'Product, availability and supplier validation.',
          'Technical specification confirmation.',
          'Verification of registrations, certifications and applicable regulatory requirements.',
          'Confirmation of price, currency, taxes, discounts, transport, installation, warranty and support.',
          'Offer validity period.',
          'Internal commercial approval.',
          'Payment and delivery conditions.',
          'Signature or formal acceptance where applicable.',
          'Each formal quote will indicate its own validity period. If the quote does not expressly state a different term, I-ME will apply an indicative validity of fifteen (15) calendar days, subject to stock, exchange rate, manufacturer conditions, import costs and regulatory availability. Prices will be stated in Colombian pesos unless another currency is expressly indicated. VAT, withholding taxes, transport, insurance, installation, commissioning, training, calibration, civil/electrical adaptations, consumables, spare parts and special logistics will only be included when expressly stated in the quote.',
        ],
      },
      {
        heading: 'E-commerce and payments',
        body: [
          'Where the website allows online payment initiation for consumables or other products, price, availability, stock, supplier, taxes, discounts, shipping and final conditions must be recalculated or validated server-side before redirecting the user to the payment gateway.',
          'The payment gateways contemplated in the technical architecture are Wompi for Colombia and Stripe for international markets, behind an interchangeable payment layer. These gateways will only be activated when I-ME has a valid merchant account, contractual approval, webhook validation, reconciliation process, privacy review and security configuration. Until activation is confirmed, payments must be treated as manual or assisted transactions through the channels expressly indicated in the formal quote or invoice.',
          'The user understands that a transaction will only be considered approved when there is server-side confirmation, signed webhook, reconciliation or equivalent validation. User screenshots, automatic emails or payment initiation do not constitute final confirmation if the server or gateway reports rejection, error, reversal, fraud or inconsistency.',
        ],
      },
      {
        heading: 'Deliveries, installation and commissioning',
        body: [
          'Delivery, transport, installation, training, commissioning, electrical, site, environmental, technical, biomedical, regulatory and infrastructure requirements must be confirmed in the formal proposal.',
          'Unless the formal quote states otherwise, delivery terms will be defined case by case according to product type, city, stock, import condition, transport availability, insurance, installation complexity and institutional site readiness. The buyer must verify packaging and external condition upon receipt and report visible damage immediately with photographs, transport guide observations and written notice. Installation, commissioning, functional testing, induction, calibration, preventive maintenance or training will only be included when expressly stated in the proposal. For installed biomedical equipment, I-ME may require a delivery certificate, site readiness checklist and acceptance record.',
        ],
      },
      {
        heading: 'Warranties, returns, exchanges and support',
        body: [
          'Warranties depend on product, manufacturer, supplier, use conditions, installation, maintenance, consumables, spare parts and formal proposal. Statutory warranty and consumer rights will apply where applicable under Colombian Law 1480 of 2011 and related provisions.',
          'Warranty conditions will be those stated in the formal quote, invoice, manufacturer documentation or applicable Colombian law. As a reference operational policy, biomedical equipment will have the manufacturer warranty informed at sale and, where no specific term is indicated, the statutory rule under Colombian consumer law will apply. Consumables, accessories, spare parts, batteries, sensors, probes, electrodes, cables and perishable or single-use items may have special terms according to manufacturer, sanitary condition and product nature. Warranty does not cover misuse, unauthorized intervention, improper installation by third parties, electrical failures, accidents, consumable wear, inadequate cleaning, use outside specifications, alteration of serial numbers or lack of required maintenance. Requests must include invoice, order or quote number, product, brand, model, serial number where applicable, description of failure, photographs/videos and contact details. Returns or exchanges must be requested promptly after receipt, with original packaging, complete accessories and no use inconsistent with inspection, except where Colombian law grants a mandatory right. Products imported or acquired on special order, customized equipment, opened sterile products, consumables and items with sanitary risk may be excluded from voluntary return, without prejudice to mandatory warranty rights.',
        ],
      },
      {
        heading: 'Biomedical equipment, INVIMA and regulatory responsibility',
        body: [
          'Commercialization of medical devices and biomedical equipment in Colombia may be subject to sanitary requirements, registrations, permits, certifications, traceability, technovigilance, maintenance, calibration and special conditions according to product type.',
          'I-ME International Medical Enterprise must ensure that each product offered as certified, registered or authorized has current and verifiable supporting documentation. The institutional user must validate that the equipment is suitable for its intended use, licensing, clinical service, infrastructure, internal protocols and sanitary obligations.',
        ],
      },
      {
        heading: 'Indicative financing',
        body: [
          'Any financing simulation published on the website is merely informational and does not constitute approval, irrevocable offer, credit promise or financial commitment. Rates, terms, installments, requirements, co-signers, guarantees, documents, approval and disbursement will depend on the review performed by the relevant entity, partner or financing mechanism.',
          'I-ME does not present website simulations as credit approval or financial advice. Unless a formal document states otherwise, any financing reference will be merely indicative and may depend on external financial partners, leasing entities, banks, fintech providers or commercial agreements. I-ME will not be deemed a supervised financial institution by merely displaying simulations or facilitating contact with financing channels.',
        ],
      },
      {
        heading: 'Virtual advisor, automation and artificial intelligence',
        body: [
          'If the website includes a virtual advisor, automated chat or artificial intelligence tools, responses are only commercial and orientational. They do not replace clinical, biomedical, regulatory, financial, legal or professional decisions of the institutional user.',
          'Prices, specifications, availability, warranties and final conditions will only be binding when included in a formal proposal issued by I-ME International Medical Enterprise.',
        ],
      },
      {
        heading: 'Intellectual property',
        body: [
          'Website content is governed by the Copyright and Intellectual Property Notice. Users may not copy, reproduce, extract, modify, redistribute, commercially exploit or use website trademarks, images, sheets, texts, databases or content without prior written authorization.',
        ],
      },
      {
        heading: 'Personal data protection',
        body: [
          'Personal data processing is governed by the Privacy and Personal Data Processing Policy and the Personal Data Processing Authorization. Users must refrain from sending medical records, clinical histories or unsolicited sensitive information.',
        ],
      },
      {
        heading: 'Prohibited conduct',
        body: [
          'The user agrees not to:',
          'Use the website for unlawful, fraudulent or unauthorized purposes.',
          'Impersonate third parties or institutions.',
          'Submit false, misleading or unauthorized information.',
          'Interfere with website security, availability, integrity or operation.',
          'Extract data through unauthorized scraping, bots or automation.',
          'Use the website to transmit malware, spam or harmful content.',
          'Interpret commercial information as clinical recommendation or final regulatory authorization.',
        ],
      },
      {
        heading: 'Limitation of liability',
        body: [
          'To the extent permitted by Colombian law, I-ME International Medical Enterprise will not be liable for damages arising from misuse of the website, clinical or technical decisions made without professional validation, third-party failures, temporary unavailability, connectivity errors, information provided by manufacturers or suppliers, force majeure, acts of God or events beyond its reasonable control.',
          'This clause does not exclude non-waivable consumer rights, statutory warranties, liability for willful misconduct or gross negligence, or mandatory applicable obligations.',
        ],
      },
      {
        heading: 'Governing law and jurisdiction',
        body: [
          'These terms are governed by the laws of the Republic of Colombia. Jurisdiction, contractual domicile and dispute resolution mechanism must be confirmed in the corresponding commercial or contractual documents.',
          'Suggested contractual domicile: Envigado, Antioquia, Colombia.',
          'Jurisdiction or arbitration clause: ordinary competent courts of Colombia, unless the parties agree in writing to conciliation, arbitration or another lawful dispute-resolution mechanism in the formal contract.',
          'PQR / complaint mechanism: inmedicalime@gmail.com and CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
        ],
      },
      {
        heading: 'Amendments',
        body: [
          'I-ME International Medical Enterprise may amend these terms to reflect legal, commercial, technical, operational or regulatory changes. The version published on the website will govern new interactions, without prejudice to conditions expressly agreed in previous proposals or contracts.',
        ],
      },
      {
        heading: 'Professional review warning',
        body: [
          'These terms require final review by Colombian counsel, technical validation, healthcare regulatory review where applicable, consumer/e-commerce review, tax confirmation and validation of actual policies for warranties, returns, payments, support, suppliers, financing and data processing before publication.',
        ],
      },
    ],
  },
  {
    kind: 'copyright',
    slug: 'copyright',
    title: 'Copyright, intellectual property and content use notice',
    description:
      'Copyright, intellectual property, trademarks, technical content, manufacturer assets and permitted use notice for the I-ME website.',
    badge: 'VALIDATED NOTICE',
    updated: '2026-06-12',
    sections: [
      {
        heading: 'General ownership',
        body: [
          'Unless expressly stated otherwise, texts, structure, content selection, design, visual identity, graphic resources, interfaces, components, databases, photographs, videos, animations, product sheets, commercial texts and other content of https://i-me.com.co are reserved to I-ME International Medical Enterprise or their respective owners, licensors, manufacturers, suppliers or partners.',
          'Legal owner or licensee name: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S..',
          'Tax ID / NIT: 901871720-1.',
          'Registered address: CL 28 SUR 29 83, Envigado, Antioquia, Colombia.',
          'Intellectual property contact email: inmedicalime@gmail.com.',
        ],
      },
      {
        heading: 'Trademarks and distinctive signs',
        body: [
          'Trademarks, trade names, logos, distinctive signs and references to manufacturers or products appearing on the website belong to their respective owners. Mention of third-party brands does not imply assignment, license, exclusive representation, trademark authorization or commercial relationship other than the one expressly stated.',
          'I-ME must retain evidence of sufficient ownership, assignment, license or authorization over the logo, trade name, images, photographs, videos, technical sheets, 3D models and inherited material from the previous website. Until documentary support exists, the asset should not be published or should be replaced with own/licensed content.',
        ],
      },
      {
        heading: 'Permitted use',
        body: [
          'Users may consult website content only for commercial evaluation of I-ME International Medical Enterprise products and services, quote requests, preliminary technical analysis, commercial contact and ordinary browsing.',
          'Unless prior written permission is granted, users may not:',
          'Reproduce, copy, distribute, publicly communicate, transform or commercially exploit the content.',
          'Use photographs, videos, technical sheets, logos or texts in catalogs, marketplaces, campaigns or third-party websites.',
          'Extract databases, product listings or content through unauthorized scraping.',
          "Use manufacturers' trademarks, distinctive signs or content in a way that misleads about authorization, distribution, warranty or representation.",
          'Modify technical sheets, specifications, certifications, registrations, warranties or commercial conditions.',
        ],
      },
      {
        heading: 'Manufacturer and third-party content',
        body: [
          'Images, technical sheets, certifications, manuals, trademarks, models, product names, videos or manufacturer specifications may be subject to third-party rights. Their publication must be supported by a license, authorization, valid commercial relationship or sufficient contractual basis.',
          'Minimum ownership and license matrix.',
          'I-ME adopts the following document-control matrix to prevent unauthorized use of content, trademarks, technical sheets, photographs, videos, 3D models, regulatory documents and inherited material from the previous website. Publication of each asset must be supported by license, authorization, ownership, valid commercial relationship or permitted-use source.',
          'Asset or content: I-ME logo, trade name and visual identity · Expected right holder: INTERNATIONAL MEDICAL ENTERPRISE. IME. S.A.S. or applicable holder · Permitted use basis: Ownership, assignment or license · Minimum evidence before publication: Source file, design contract, assignment or written authorization · Operational restrictions: Do not sublicense or permit third-party uses without authorization.',
          'Asset or content: Corporate texts, website structure and own commercial copy · Expected right holder: I-ME or contracted provider · Permitted use basis: Own work, commissioned work or assignment · Minimum evidence before publication: Contract, deliverable acceptance or internal record · Operational restrictions: Avoid substantial copying from competitors.',
          'Asset or content: Own institutional photographs · Expected right holder: I-ME, photographer or authorized image bank · Permitted use basis: Ownership, license or use authorization · Minimum evidence before publication: Contract, invoice, license, image release where applicable · Operational restrictions: Verify image rights of identifiable persons.',
          'Asset or content: Stock photographs · Expected right holder: Image bank / licensor · Permitted use basis: Current commercial license · Minimum evidence before publication: URL, invoice, license, terms of use and download date · Operational restrictions: Respect use limits, attribution and resale restrictions.',
          'Asset or content: Manufacturer photographs, renders, videos and manuals · Expected right holder: Manufacturer, distributor or licensor · Permitted use basis: Commercial relationship, marketing authorization or document license · Minimum evidence before publication: Letter, contract, distributor authorization, authorized portal or brand terms · Operational restrictions: Do not alter specifications, certifications or marks.',
          'Asset or content: Technical sheets, manuals, catalogs and certificates · Expected right holder: Manufacturer or issuing authority · Permitted use basis: Authorized distribution for commercial or support purposes · Minimum evidence before publication: Current official document, manufacturer link, permission or contract · Operational restrictions: State that the official version prevails over any website summary.',
          'Asset or content: Manufacturer marks and product references · Expected right holder: Relevant trademark owner · Permitted use basis: Descriptive nominative use or commercial authorization · Minimum evidence before publication: Commercial relationship, authorization or nominative-use rationale · Operational restrictions: Do not suggest exclusive representation if it does not exist.',
          'Asset or content: 3D models, animations, renders and mockups · Expected right holder: Creator, manufacturer or licensor · Permitted use basis: Commercial license, commissioned work or authorization · Minimum evidence before publication: Source file, contract, license or written confirmation · Operational restrictions: Do not use models extracted from third parties without permission.',
          'Asset or content: Testimonials, success cases and customer logos · Expected right holder: Corresponding client or institution · Permitted use basis: Prior and specific authorization · Minimum evidence before publication: Written consent, scope, term and authorized channel · Operational restrictions: Do not publish clinical, sensitive or confidential data.',
          'Asset or content: INVIMA, CE, FDA or equivalent documents · Expected right holder: Authority, manufacturer or registration holder · Permitted use basis: Informational use with current support · Minimum evidence before publication: Verifiable copy, registration number, date and applicable product · Operational restrictions: Do not use generic certifications for uncovered products.',
          'Absence of sufficient evidence prevents publication of the asset or requires replacement with own content, licensed content or generic content that does not affect third-party rights.',
        ],
      },
      {
        heading: 'Technical information and certifications',
        body: [
          'Technical information published on the website is commercial and informational. Specifications, availability, CE/FDA certifications, INVIMA registrations, manuals, warranty, installation and compatibility must be confirmed in the formal proposal, official manufacturer technical sheet and applicable regulatory documentation.',
          'Terms such as “certified”, “INVIMA registration”, “CE”, “FDA” or equivalents must correspond to current, verifiable documentation applicable to each specific product.',
        ],
      },
      {
        heading: 'Reporting infringements',
        body: [
          'Anyone who considers that website content infringes intellectual property rights, copyright, trademarks, image rights, personal data or third-party rights may report it to inmedicalime@gmail.com or to the final legal channel.',
          'Final legal channel: inmedicalime@gmail.com.',
          'Minimum report information: claimant identification, allegedly infringed right, exact content location, proof of ownership or representation, specific request and contact details.',
        ],
      },
      {
        heading: 'Reservation of rights',
        body: [
          'I-ME International Medical Enterprise reserves all rights not expressly granted. Unauthorized use of content may give rise to civil, commercial, administrative or criminal claims under applicable Colombian law.',
        ],
      },
    ],
  },
];

const pagesByLocale: Record<Locale, LegalPage[]> = { es: esPages, en: enPages };

export function getLegalPages(locale: Locale): LegalPage[] {
  return pagesByLocale[locale];
}

export function getLegalPage(locale: Locale, slug: string): LegalPage | undefined {
  return pagesByLocale[locale].find(page => page.slug === slug);
}

export function getLegalSlug(kind: LegalKind, locale: Locale): string {
  return pagesByLocale[locale].find(page => page.kind === kind)?.slug ?? kind;
}
