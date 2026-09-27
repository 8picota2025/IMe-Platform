/**
 * Checklist de recepción e instalación de monitores de paciente (Fase 3, herramienta D1).
 *
 * Fuente única para la herramienta web y el PDF descargable. El texto es el del artículo
 * `checklist-recepcion-instalacion-monitor-hospitalario`, validado por ingeniería
 * biomédica de I-ME (Ing. Andrés F. Rojas M., 2026-09-24): no reescribir sin volver a
 * validarlo.
 */

export type LocaleTexto = { es: string; en: string };

export interface ChecklistItem {
  id: string;
  texto: LocaleTexto;
}

export interface ChecklistSeccion {
  id: string;
  titulo: LocaleTexto;
  /** Texto que el artículo pone después de los puntos de la sección. */
  nota?: LocaleTexto;
  items: ChecklistItem[];
}

export const CHECKLIST_RECEPCION_MONITOR_ID = 'checklist-recepcion-monitor';

/** Artículo del que sale el texto; la herramienta enlaza a él. */
export const CHECKLIST_ARTICULO_SLUG = 'checklist-recepcion-instalacion-monitor-hospitalario';

export const CHECKLIST_VALIDACION: LocaleTexto = {
  es: 'Validado por el equipo de ingeniería biomédica de I-ME (24 de septiembre de 2026). Los requisitos exactos de cada modelo están en su manual y ficha técnica; ante cualquier diferencia, prevalece el manual del fabricante.',
  en: "Validated by I-ME's clinical engineering team (September 24, 2026). Each model's exact requirements are in its manual and data sheet; where they differ, the manufacturer's manual prevails.",
};

export const CHECKLIST_SECCIONES: ChecklistSeccion[] = [
  {
    id: 'preparacion',
    titulo: {
      es: 'Antes de la entrega: lo que prepara la institución',
      en: 'Before delivery: what the institution prepares',
    },
    items: [
      {
        id: 'preparacion-toma',
        texto: {
          es: 'Toma eléctrica regulada (110/220 V según el equipo) con polo a tierra verificado y certificado, según la NTC 2050 o la norma local aplicable.',
          en: "A regulated power outlet (110/220 V as specified) with a verified and certified ground, per NTC 2050 (Colombia's electrical code) or the applicable local standard.",
        },
      },
      {
        id: 'preparacion-red',
        texto: {
          es: 'Punto de red Ethernet (RJ45) activo y configurado, si el monitor se integrará a una central de monitoreo multicama.',
          en: 'An active, configured Ethernet (RJ45) port, if the monitor will join a multi-bed central monitoring station.',
        },
      },
      {
        id: 'preparacion-montaje',
        texto: {
          es: 'Espacio y sistema de montaje definidos (soporte de pared, techo o pedestal) según el layout de la sala.',
          en: 'Space and mounting system defined (wall, ceiling or pole mount) according to the room layout.',
        },
      },
      {
        id: 'preparacion-biomedica',
        texto: {
          es: 'Personal de ingeniería biomédica disponible para acompañar la recepción.',
          en: 'Clinical engineering staff available to attend the receiving.',
        },
      },
      {
        id: 'preparacion-ambiente',
        texto: {
          es: 'Condiciones ambientales (temperatura, humedad) dentro del rango del manual del fabricante.',
          en: "Environmental conditions (temperature, humidity) within the range in the manufacturer's manual.",
        },
      },
    ],
  },
  {
    id: 'recepcion',
    titulo: { es: 'En la recepción física', en: 'At physical receiving' },
    nota: {
      es: 'Cualquier no conformidad se anota en el acta y se resuelve con el proveedor antes de continuar.',
      en: 'Any non-conformity is recorded in the handover record and resolved with the supplier before continuing.',
    },
    items: [
      {
        id: 'recepcion-embalaje',
        texto: {
          es: 'Embalaje íntegro: sin golpes, humedad ni señales de apertura previa.',
          en: 'Packaging intact: no dents, moisture or signs of prior opening.',
        },
      },
      {
        id: 'recepcion-serie',
        texto: {
          es: 'Modelo, referencia y número de serie coinciden exactamente con la orden de compra y la remisión.',
          en: 'Model, reference and serial number match the purchase order and delivery note exactly.',
        },
      },
      {
        id: 'recepcion-accesorios',
        texto: {
          es: 'Inventario completo de accesorios y sensores: cables de ECG, sensores de SpO₂, brazaletes de NIBP de los distintos tamaños, módulos opcionales y batería.',
          en: 'Complete inventory of accessories and sensors: ECG cables, SpO₂ sensors, NIBP cuffs in the different sizes, optional modules and battery.',
        },
      },
      {
        id: 'recepcion-danos',
        texto: {
          es: 'Sin daños visibles en pantalla, carcasa, conectores, ruedas o soportes.',
          en: 'No visible damage to the screen, housing, connectors, casters or mounts.',
        },
      },
      {
        id: 'recepcion-documentos',
        texto: {
          es: 'Documentos completos (ver la sección siguiente).',
          en: 'All documents present (see the next section).',
        },
      },
    ],
  },
  {
    id: 'documentos',
    titulo: {
      es: 'Los documentos que deben venir con el equipo',
      en: 'Documents that must come with the equipment',
    },
    nota: {
      es: 'Bajo solicitud o según contrato: ficha técnica detallada y protocolos de mantenimiento, certificados de conformidad adicionales (por ejemplo, IEC 60601) y software de configuración o actualizaciones.',
      en: 'On request or per contract: detailed data sheet and maintenance protocols, additional conformity certificates (for example, IEC 60601) and configuration software or updates.',
    },
    items: [
      {
        id: 'documentos-manual',
        texto: {
          es: 'Manual de usuario en español (impreso o digital).',
          en: 'User manual in Spanish (printed or digital).',
        },
      },
      {
        id: 'documentos-garantia',
        texto: {
          es: 'Certificado de garantía del fabricante y del proveedor.',
          en: "Manufacturer's and supplier's warranty certificate.",
        },
      },
      {
        id: 'documentos-calibracion',
        texto: {
          es: 'Certificado de pruebas de fábrica o de calibración inicial.',
          en: 'Factory test or initial calibration certificate.',
        },
      },
      {
        id: 'documentos-invima',
        texto: {
          es: 'Copia del registro sanitario INVIMA vigente.',
          en: 'Copy of the current INVIMA sanitary registration.',
        },
      },
      {
        id: 'documentos-inventario',
        texto: {
          es: 'Inventario de accesorios y sensores entregados.',
          en: 'Inventory of the accessories and sensors delivered.',
        },
      },
    ],
  },
  {
    id: 'instalacion',
    titulo: { es: 'Instalación y puesta en marcha', en: 'Installation and commissioning' },
    items: [
      {
        id: 'instalacion-montaje',
        texto: {
          es: 'Montaje físico del monitor y sus accesorios en el puesto asignado.',
          en: 'Physical mounting of the monitor and its accessories at the assigned station.',
        },
      },
      {
        id: 'instalacion-tierra',
        texto: {
          es: 'Conexión eléctrica y verificación de tierra.',
          en: 'Power connection and ground verification.',
        },
      },
      {
        id: 'instalacion-red',
        texto: {
          es: 'Conexión a la red y registro en la central de monitoreo, si aplica.',
          en: 'Network connection and registration on the central monitoring station, if applicable.',
        },
      },
      {
        id: 'instalacion-configuracion',
        texto: {
          es: 'Configuración inicial: perfiles de paciente (adulto, pediátrico, neonatal), límites de alarma según el protocolo del servicio, idioma, fecha y hora.',
          en: "Initial setup: patient profiles (adult, pediatric, neonatal), alarm limits per the unit's protocol, language, date and time.",
        },
      },
      {
        id: 'instalacion-central',
        texto: {
          es: 'Prueba de comunicación con la central multicama.',
          en: 'Communication test with the multi-bed central station.',
        },
      },
      {
        id: 'instalacion-credenciales',
        texto: {
          es: 'Entrega de credenciales de administrador y capacitación básica a ingeniería biomédica.',
          en: 'Handover of administrator credentials and basic training for clinical engineering.',
        },
      },
    ],
  },
  {
    id: 'pruebas',
    titulo: { es: 'Pruebas antes de usarlo con pacientes', en: 'Tests before use on patients' },
    nota: {
      es: 'El equipo no se libera para uso clínico hasta completar estas pruebas, y el resultado queda en un registro firmado por el técnico del proveedor y por el responsable de ingeniería biomédica de la institución.',
      en: "The equipment is not released for clinical use until these tests are complete, and the results are recorded and signed by the supplier's technician and the institution's clinical engineering lead.",
    },
    items: [
      {
        id: 'pruebas-autodiagnostico',
        texto: {
          es: 'Autodiagnóstico (self-test) al encender.',
          en: 'Self-test at power-on.',
        },
      },
      {
        id: 'pruebas-simulador',
        texto: {
          es: 'Verificación con simulador de paciente certificado: ECG (ritmo y amplitud), SpO₂, NIBP, temperatura y, si están instalados, los módulos invasivos (IBP, EtCO₂).',
          en: 'Verification with a certified patient simulator: ECG (rhythm and amplitude), SpO₂, NIBP, temperature and, if installed, the invasive modules (IBP, EtCO₂).',
        },
      },
      {
        id: 'pruebas-alarmas',
        texto: {
          es: 'Alarmas visuales y sonoras y su priorización.',
          en: 'Visual and audible alarms and their prioritization.',
        },
      },
      {
        id: 'pruebas-bateria',
        texto: {
          es: 'Autonomía de la batería (carga mínima).',
          en: 'Battery autonomy (minimum charge).',
        },
      },
      {
        id: 'pruebas-central',
        texto: {
          es: 'Conectividad con la central, si aplica.',
          en: 'Connectivity with the central station, if applicable.',
        },
      },
    ],
  },
  {
    id: 'capacitacion',
    titulo: { es: 'Capacitación', en: 'Training' },
    nota: {
      es: 'Las duraciones son aproximadas y se ajustan al tamaño del parque de equipos y al número de turnos.',
      en: 'Durations are approximate and adjusted to the size of the equipment fleet and the number of shifts.',
    },
    items: [
      {
        id: 'capacitacion-asistencial',
        texto: {
          es: 'Personal asistencial (enfermería y médicos del servicio): de 2 a 4 horas teórico-prácticas por grupo o turno, sobre operación básica, reconocimiento de alarmas, cambio de sensores, solución de problemas de primer nivel y perfiles de paciente.',
          en: 'Clinical staff (nurses and physicians of the unit): 2 to 4 hours of theory and practice per group or shift, covering basic operation, alarm recognition, sensor changes, first-level troubleshooting and patient profiles.',
        },
      },
      {
        id: 'capacitacion-biomedica',
        texto: {
          es: 'Ingeniería biomédica: de 4 a 8 horas sobre configuración avanzada, mantenimiento de primer nivel, calibración básica, gestión de usuarios, actualización de software y manejo de la central.',
          en: 'Clinical engineering: 4 to 8 hours on advanced configuration, first-level maintenance, basic calibration, user management, software updates and central station management.',
        },
      },
      {
        id: 'capacitacion-soporte',
        texto: {
          es: 'Soporte de primer nivel designado en la institución, con una línea de soporte técnico del proveedor.',
          en: "First-level support designated within the institution, with the supplier's technical support line.",
        },
      },
    ],
  },
  {
    id: 'acta',
    titulo: {
      es: 'El acta de entrega e instalación',
      en: 'The delivery and installation record',
    },
    nota: {
      es: 'El original queda en la institución.',
      en: 'The original stays with the institution.',
    },
    items: [
      {
        id: 'acta-institucion',
        texto: {
          es: 'Datos de la institución y del servicio.',
          en: 'Institution and unit details.',
        },
      },
      {
        id: 'acta-equipo',
        texto: {
          es: 'Marca, modelo, número de serie y registro INVIMA del equipo.',
          en: 'Brand, model, serial number and INVIMA registration of the equipment.',
        },
      },
      {
        id: 'acta-inventario',
        texto: {
          es: 'Inventario detallado de accesorios y consumibles entregados.',
          en: 'Detailed inventory of accessories and consumables delivered.',
        },
      },
      {
        id: 'acta-pruebas',
        texto: {
          es: 'Resultado de las pruebas de funcionamiento.',
          en: 'Results of the functional tests.',
        },
      },
      {
        id: 'acta-capacitados',
        texto: {
          es: 'Personal capacitado (nombres y cargos).',
          en: 'Staff trained (names and roles).',
        },
      },
      {
        id: 'acta-observaciones',
        texto: {
          es: 'Observaciones y pendientes.',
          en: 'Observations and open items.',
        },
      },
      {
        id: 'acta-firmas',
        texto: {
          es: 'Firmas del técnico del proveedor, del responsable de ingeniería biomédica y, cuando aplique, de la jefatura del servicio o la coordinación de UCI.',
          en: "Signatures of the supplier's technician, the clinical engineering lead and, where applicable, the head of the unit or ICU coordinator.",
        },
      },
    ],
  },
];

export function totalItemsChecklist(): number {
  return CHECKLIST_SECCIONES.reduce((total, seccion) => total + seccion.items.length, 0);
}
