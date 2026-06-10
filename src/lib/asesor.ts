/**
 * Asesor comercial — MOCK para F1.
 * La lógica RAG real llega en Fase Asesor (después de F3).
 *
 * PENDIENTE: Fase Asesor — integrar Edge Function asesor/ con RAG real.
 * Regla: Asesor comercial puro. Prohibido diagnóstico, consejo clínico, precio comprometido.
 */

export interface MensajeAsesor {
  rol: 'usuario' | 'asesor'
  contenido: string
  timestamp: Date
}

const RESPUESTAS_MOCK: Record<string, string> = {
  default:
    'Gracias por tu consulta. En I-ME contamos con más de 24 categorías de equipos biomédicos certificados INVIMA. Para darte la mejor asesoría, cuéntame: ¿qué especialidad médica necesitas equipar y cuál es tu institución?',
  monitor:
    'Tenemos monitores multiparamétricos para UCI, hospitalización general y transporte prehospitalario, todos con certificación internacional. ¿Para qué área clínica lo necesitas: UCI, hospitalización o emergencias?',
  cardiologia:
    'En cardiología contamos con electrocardiógrafs, desfibriladores bifásicos y sistemas Holter. ¿Qué tipo de equipo requiere tu institución?',
  ultrasonido:
    'Disponemos de ecógrafos con Color Doppler, equipos portátiles con WiFi y DICOM, y soluciones point-of-care. ¿Cuál es la principal aplicación: abdominal, obstétrica, vascular o urgencias?',
  neonatologia:
    'Para neonatología tenemos incubadoras de transporte, cunas de calor radiante y sistemas CPAP neonatal. ¿Cuál es la necesidad específica de tu unidad?',
  precio:
    'Los precios se entregan vía cotización personalizada según especificaciones y volumen. Para recibir tu cotización formal, completa el formulario de contacto o escríbenos por WhatsApp al +57 313 867 4059.',
  cotizar:
    'Con gusto te ayudo con una cotización. Por favor, ve a la sección de Contacto o escríbenos directamente al +57 313 867 4059 para que un asesor especializado te atienda.',
  financiacion:
    'Contamos con planes de financiamiento para instituciones de salud. Los detalles específicos los gestiona directamente tu asesor comercial. ¿Quieres que te pongamos en contacto?',
}

function detectarTema(mensaje: string): string {
  const m = mensaje.toLowerCase()
  if (m.includes('monitor') || m.includes('signos vitales') || m.includes('uci')) return 'monitor'
  if (
    m.includes('cardio') ||
    m.includes('ecg') ||
    m.includes('desfibrilador') ||
    m.includes('holter')
  )
    return 'cardiologia'
  if (m.includes('ultrasonido') || m.includes('ecógrafo') || m.includes('doppler'))
    return 'ultrasonido'
  if (
    m.includes('neonatolog') ||
    m.includes('incubadora') ||
    m.includes('neonatal') ||
    m.includes('cuna')
  )
    return 'neonatologia'
  if (m.includes('precio') || m.includes('costo') || m.includes('valor') || m.includes('cuánto'))
    return 'precio'
  if (m.includes('cotiz')) return 'cotizar'
  if (m.includes('financ')) return 'financiacion'
  return 'default'
}

/**
 * Responde un mensaje del usuario con una respuesta mock.
 * Simula latencia mínima para UX realista.
 */
export async function responderAsesor(
  mensaje: string,
  _historial: MensajeAsesor[] = []
): Promise<string> {
  // Simula pequeña latencia
  await new Promise((r) => setTimeout(r, 600))
  const tema = detectarTema(mensaje)
  return RESPUESTAS_MOCK[tema] ?? RESPUESTAS_MOCK['default']!
}
