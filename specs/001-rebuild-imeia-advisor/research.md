# Research: Reconstrucción del asesor IMEIA

## Decisión 1 — La plataforma gobierna; el modelo propone

**Decision**: El modelo externo devuelve una propuesta estructurada de respuesta, señales de intención, cambios de perfil, productos citados y siguiente pregunta. La Edge Function valida y normaliza esa propuesta, resuelve productos contra el catálogo activo y decide si una llamada a la acción es admisible.

**Rationale**: El texto libre actual obliga a inferir tarjetas y handoff con expresiones regulares. Un contrato explícito permite probar el comportamiento, rechazar productos inexistentes y mantener la conversión bajo reglas comerciales.

**Alternatives considered**:

- Estado y decisiones enteramente en el modelo: descartado por repetición, deriva de personalidad y falta de trazabilidad.
- Asesor solo con reglas: descartado porque degrada el diálogo natural y la resolución de preguntas abiertas.
- Dos llamadas de modelo por turno: reservada como evolución si una llamada estructurada no alcanza calidad suficiente.

## Decisión 2 — Una única personalidad canónica

**Decision**: Definir una sola política de sistema compartida para producción, modo directo y desarrollo local. IMEIA se presenta como ingeniera biomédica senior de I-ME con perfil comercial consultivo: responde primero, pregunta solo lo decisivo, diferencia hechos de orientación, evita diagnóstico y propone contacto únicamente por intención real.

**Rationale**: Cuatro prompts divergentes producen respuestas inconsistentes y hacen imposible evaluar la identidad.

**Alternatives considered**:

- Conservar una personalidad por transporte: descartado porque el cliente no debe notar la infraestructura.
- Delegar toda identidad al SOUL externo: descartado porque la plataforma debe hacer cumplir los límites comerciales y clínicos.

## Decisión 3 — Estado de descubrimiento explícito y provisional

**Decision**: Mantener en `sessionStorage` un perfil estructurado con institución/tipo, ubicación, rol, servicio, necesidad, volumen, plazo y productos. Cada turno devuelve un parche limitado que se aplica con política "última corrección explícita gana". No se persiste el transcript anónimo en servidor.

**Rationale**: El perfil evita repetir preguntas, permite un diálogo progresivo y respeta la frontera de privacidad antes de la conversión.

**Alternatives considered**:

- Guardar conversaciones anónimas en base de datos: descartado en esta fase por minimización de datos.
- Usar solo el transcript como memoria: descartado porque no permite saber de manera fiable qué ya está respondido.
- Estado firmado por servidor: compatible como endurecimiento futuro; no es necesario para el perfil asesor no autoritativo porque todas las escrituras CRM se vuelven a validar.

## Decisión 4 — Política de una pregunta principal

**Decision**: La respuesta estructurada admite una sola pregunta siguiente. Se elimina si repite un valor conocido o si la consulta ya puede resolverse. El prompt obliga a responder antes de preguntar.

**Rationale**: Una pregunta por turno conserva cercanía y evita convertir el diálogo en formulario. Los datos de contacto se solicitan en una tarjeta explícita, no mezclados en prosa.

**Alternatives considered**:

- Hasta tres preguntas por respuesta: descartado por fricción y porque hoy favorece respuestas enlatadas.
- Formulario de cualificación desde el primer turno: descartado por ser prematuro.

## Decisión 5 — Grounding por allowlist de catálogo

**Decision**: Los slugs devueltos por el modelo se intersectan con productos recuperados para el mensaje, producto canónico de la página y comparables autorizados. Las tarjetas se construyen con una consulta servidor a productos activos. Slugs fuera de ese conjunto se ignoran.

**Rationale**: Validar solo que un slug exista no demuestra que sea relevante; una allowlist por turno evita familias mezcladas y alucinaciones.

**Alternatives considered**:

- Extraer productos desde enlaces del texto: descartado por depender de la redacción.
- Confiar en el RAG externo: descartado como única autoridad porque no expone procedencia verificable a la plataforma.
- Renderizar hechos a nivel de campo: dirección recomendada para IMErvis; esta entrega valida identidad y datos de tarjeta, y prohíbe afirmar campos no presentes.

## Decisión 6 — CTA determinista y no agresiva

**Decision**: La Edge Function acepta handoff únicamente si el mensaje o historial reciente expresa compra, presupuesto, precio, disponibilidad, financiación, garantía, documentación, plazo o contacto humano. Una propuesta comercial sin señal se elimina. El resumen usa necesidades expresadas por el usuario, no texto inventado por el modelo.

**Rationale**: El CTA actual depende de que aparezca "WhatsApp" o "cotización" en el texto, incluso en respuestas informativas.

**Alternatives considered**:

- Handoff elegido solo por el modelo: descartado por inconsistencia.
- CTA permanente: descartado por presión comercial prematura.

## Decisión 7 — Captura de lead en una frontera separada

**Decision**: Mostrar una tarjeta opcional de contacto cuando la respuesta autoriza handoff. La tarjeta exige nombre, institución opcional, email o teléfono, canal preferido y consentimiento explícito. Una Edge Function separada valida, limita frecuencia y hace upsert idempotente por sesión.

**Rationale**: El modelo no debe escribir PII ni decidir consentimiento. Separar el endpoint reduce privilegios y permite que la conversación siga siendo anónima.

**Alternatives considered**:

- Extraer contacto automáticamente de los mensajes: descartado porque recibir PII no equivale a consentimiento CRM.
- Derivar siempre al formulario: descartado porque obliga a repetir información y pierde conversiones.
- Crear lead al detectar intención: descartado porque una intención no autoriza persistir datos personales.

## Decisión 8 — Transferencia sin datos en URL

**Decision**: El resumen y los productos para el formulario se guardan temporalmente en `sessionStorage`; las URLs de contacto no incluyen conversación ni PII. WhatsApp usa un mensaje genérico.

**Rationale**: Los parámetros terminan en historial, analítica, logs y servicios externos.

**Alternatives considered**:

- Mantener `asesor_resumen` y productos en query string: descartado por exposición innecesaria.
- Token servidor de un solo uso: adecuado cuando se requiera continuidad entre dispositivos; innecesario para la transferencia en la misma pestaña.

## Decisión 9 — Degradación honesta

**Decision**: Si IMEIA falla, mostrar coincidencias verificadas del índice como "resultados de catálogo", con una pregunta neutral; si no hay coincidencias, informar indisponibilidad y ofrecer reintento/contacto. No usar párrafos biomédicos prefabricados como recomendación experta.

**Rationale**: Un fallback especializado escrito de antemano parece inteligente pero no está razonando con el caso.

**Alternatives considered**:

- Mantener respuestas biomédicas por expresiones regulares: descartado por tono enlatado y falsa personalización.
- Fallar siempre sin contenido: descartado porque el catálogo estático puede seguir aportando valor verificable.

## Decisión 10 — Privacidad y seguridad operativa

**Decision**: Solo service role escribe leads; RLS niega acceso público directo y permite lectura comercial autorizada. No se registra transcript, contacto ni URLs completas en métricas. El consentimiento conserva versión, idioma, propósito y marca temporal del servidor.

**Rationale**: Un UUID de sesión retenido con navegación o conversación es seudónimo, no verdaderamente anónimo. La minimización y separación de propósitos reducen riesgo legal.

**Alternatives considered**:

- Política pública de INSERT: descartada porque permite eludir validación y consentimiento de la Edge Function.
- Consentimiento booleano sin versión: se conserva solo por compatibilidad en cotizaciones, no como evidencia canónica del nuevo lead.
