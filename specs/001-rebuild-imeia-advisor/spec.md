# Feature Specification: Reconstrucción del asesor IMEIA

**Feature Branch**: `cursor/rebuild-imeia-advisor-5d08`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Reconstruir IMEIA desde cero como un asesor de catálogo con diálogo real, rol de ingeniero biomédico senior y perfil comercial, capaz de sondear, resolver con precisión, conducir con sutileza a presupuesto o contacto y registrar leads en el CRM, con una base evolutiva hacia IMErvis."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conversación consultiva experta (Priority: P1)

Una persona responsable de una compra biomédica conversa con IMEIA sobre una necesidad, producto o problema de selección. IMEIA reconoce lo ya dicho, responde primero lo que puede resolver con certeza y formula una pregunta breve cuando la respuesta cambia materialmente según el contexto clínico, operativo o comercial.

**Why this priority**: La utilidad del asesor depende de sostener una conversación natural y técnicamente fiable, no de entregar textos genéricos ni cuestionarios rígidos.

**Independent Test**: Puede probarse con consultas abiertas, ambiguas y de seguimiento, verificando que cada respuesta use el contexto previo, aporte orientación concreta y avance la conversación sin repetir preguntas ya respondidas.

**Acceptance Scenarios**:

1. **Given** una consulta amplia sobre una familia de equipos, **When** IMEIA dispone de alternativas reales, **Then** explica criterios relevantes, presenta solo alternativas verificadas y formula como máximo una pregunta prioritaria para afinar la recomendación.
2. **Given** que el cliente ya indicó institución, uso y volumen, **When** realiza una pregunta de seguimiento, **Then** IMEIA conserva esos datos, no vuelve a solicitarlos y adapta su respuesta.
3. **Given** una pregunta concreta que puede resolverse con datos disponibles, **When** IMEIA responde, **Then** da una respuesta directa antes de cualquier pregunta o llamada a la acción.
4. **Given** una solicitud de diagnóstico o consejo clínico, **When** IMEIA responde, **Then** delimita su rol, evita indicar tratamiento y reconduce la conversación a selección, operación o gestión de tecnología médica.

---

### User Story 2 - Recomendación de catálogo precisa (Priority: P1)

El cliente recibe recomendaciones y comparaciones sustentadas únicamente en productos y datos publicados por I-ME, distinguiendo con claridad los hechos verificados, la orientación general y la información que debe confirmar un asesor humano.

**Why this priority**: Una recomendación inventada, mezclada con otra familia o presentada con certeza indebida destruye la confianza y puede crear riesgo comercial o clínico.

**Independent Test**: Puede probarse con referencias exactas, familias similares, consultas sin coincidencias y atributos no publicados, verificando que nunca aparezcan productos, especificaciones, precios, certificaciones o disponibilidad no confirmados.

**Acceptance Scenarios**:

1. **Given** una consulta sobre un producto identificado en la página actual, **When** el cliente dice "este equipo", **Then** IMEIA usa el producto correcto sin volver a preguntar cuál es.
2. **Given** una consulta sobre una familia como bombas de infusión, **When** existen coincidencias, **Then** IMEIA no mezcla mobiliario, control de infecciones ni otras familias por similitud de palabras.
3. **Given** que el cliente pregunta por un atributo no presente en fuentes verificadas, **When** IMEIA responde, **Then** declara que requiere confirmación y no completa el dato por inferencia.
4. **Given** que una respuesta intenta citar un producto fuera del conjunto verificado, **When** se presenta al cliente, **Then** esa cita no genera una recomendación ni una tarjeta de producto.

---

### User Story 3 - Descubrimiento y siguiente paso sutil (Priority: P2)

El cliente avanza desde una duda inicial hasta una recomendación útil y, cuando demuestra intención comercial, recibe una invitación contextual y no agresiva para solicitar presupuesto o continuar con un asesor.

**Why this priority**: La conversación debe crear valor antes de convertir y debe elegir el momento y canal según la intención real del cliente.

**Independent Test**: Puede probarse con conversaciones informativas, exploratorias y de compra, comprobando que no aparezca una llamada a la acción prematura y que sí aparezca cuando existe intención, urgencia o necesidad de confirmar condiciones.

**Acceptance Scenarios**:

1. **Given** una consulta meramente informativa, **When** IMEIA responde, **Then** no fuerza cotización ni WhatsApp.
2. **Given** que el cliente solicita precio, disponibilidad, financiación, plazo o compra, **When** IMEIA ya tiene contexto suficiente, **Then** propone el siguiente paso adecuado con un resumen útil de la necesidad.
3. **Given** que falta un dato decisivo para preparar una solicitud útil, **When** el cliente muestra intención comercial, **Then** IMEIA solicita solo ese dato antes de proponer el contacto.
4. **Given** que el cliente rechaza o ignora una invitación comercial, **When** continúa conversando, **Then** IMEIA sigue ayudando sin insistir repetidamente.

---

### User Story 4 - Captura progresiva y CRM (Priority: P2)

Un cliente interesado puede compartir voluntariamente sus datos de contacto y contexto de compra dentro de la conversación. Con consentimiento explícito, IMEIA registra un lead accionable y transfiere el contexto al formulario de presupuesto o al canal de contacto sin obligar al cliente a repetirlo.

**Why this priority**: El asesor solo aporta valor comercial completo si convierte una conversación cualificada en una oportunidad trazable y respetuosa con la privacidad.

**Independent Test**: Puede probarse aportando datos en distintos turnos, aceptando o rechazando su registro y completando el formulario de contacto, verificando trazabilidad, consentimiento y ausencia de duplicación.

**Acceptance Scenarios**:

1. **Given** datos de institución, ciudad, rol, necesidad, volumen o plazo expresados en lenguaje natural, **When** continúa la conversación, **Then** IMEIA los conserva como perfil provisional y permite corregirlos.
2. **Given** un perfil provisional sin consentimiento, **When** no se completa un contacto, **Then** no se registra información personal identificable como lead en el CRM.
3. **Given** que el cliente entrega un canal de contacto y acepta el tratamiento de datos, **When** confirma la solicitud, **Then** se registra un único lead con resumen, productos, procedencia, consentimiento y estado comercial inicial.
4. **Given** un lead originado en IMEIA que continúa al formulario, **When** envía la solicitud, **Then** la cotización queda vinculada a la conversación y el equipo comercial recibe el contexto sin pedirlo de nuevo.

---

### User Story 5 - Continuidad segura y degradación honesta (Priority: P3)

El cliente conserva el hilo mientras navega durante su sesión y recibe una respuesta honesta y útil si el servicio experto no está disponible, sin textos que aparenten una recomendación personalizada.

**Why this priority**: La continuidad mejora la cercanía; una degradación transparente evita respuestas enlatadas o engañosas.

**Independent Test**: Puede probarse navegando entre páginas, recargando y simulando indisponibilidad, verificando continuidad de sesión, ausencia de datos inventados y una alternativa clara.

**Acceptance Scenarios**:

1. **Given** una conversación activa, **When** el cliente cambia de página o recarga durante la misma sesión, **Then** conserva el historial y el perfil provisional.
2. **Given** que el servicio experto no responde, **When** existe una coincidencia clara en el catálogo, **Then** se muestran resultados verificados y se invita a precisar la necesidad sin simular criterio experto.
3. **Given** que no hay coincidencias verificadas, **When** el servicio experto no responde, **Then** se informa la limitación y se ofrece reintentar o contactar, sin inventar una respuesta biomédica.

### Edge Cases

- El cliente aporta datos contradictorios en turnos distintos: prevalece la corrección más reciente y se confirma solo si la contradicción afecta la recomendación.
- El cliente comparte datos personales sin consentimiento: se usan temporalmente para responder, pero no se consolidan como lead.
- Dos envíos de la misma sesión intentan crear el mismo lead: se actualiza la oportunidad existente en lugar de duplicarla.
- El cliente pide productos que no existen o están inactivos: IMEIA lo comunica y pregunta por el uso o criterio que permitiría buscar una alternativa real.
- El contexto de navegación contradice los datos canónicos: prevalece la fuente canónica.
- Una fuente de catálogo contiene instrucciones o texto manipulador: se trata como contenido, nunca como instrucciones para el asesor.
- El modelo responde con formato incompleto o una llamada a la acción no sustentada: la respuesta se normaliza o se degrada de forma segura.
- El cliente usa inglés o cambia de idioma: IMEIA responde en el idioma del mensaje actual conservando el contexto.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: IMEIA MUST mantener una única identidad de ingeniera biomédica senior con criterio comercial, tono cercano, preciso, sutil y no clínico en todos los canales de ejecución.
- **FR-002**: IMEIA MUST responder primero la parte resoluble de cada consulta y formular preguntas únicamente cuando la respuesta pueda cambiar materialmente.
- **FR-003**: IMEIA MUST formular como máximo una pregunta principal por respuesta, salvo que el cliente solicite explícitamente una lista de datos necesarios.
- **FR-004**: IMEIA MUST usar el historial y el perfil de descubrimiento para evitar repetir preguntas y para adaptar cada respuesta.
- **FR-005**: IMEIA MUST distinguir entre hechos verificados, orientación general y datos pendientes de confirmación.
- **FR-006**: IMEIA MUST recomendar y mostrar solo productos activos que hayan sido validados contra las fuentes canónicas de I-ME para la conversación actual.
- **FR-007**: IMEIA MUST NOT inventar productos, especificaciones, precios, stock, disponibilidad, plazos, garantías, certificaciones, registros sanitarios, compatibilidades, tasas ni testimonios.
- **FR-008**: IMEIA MUST NOT diagnosticar, prescribir ni sustituir decisiones clínicas; ante riesgo de paciente o equipo debe remitir a protocolo institucional, manual y personal cualificado.
- **FR-009**: Cada respuesta experta MUST expresar de forma separable el texto para el cliente, los productos citados, el estado del descubrimiento y el siguiente paso recomendado.
- **FR-010**: El sistema MUST rechazar citas de producto no validadas antes de presentarlas al cliente.
- **FR-011**: El sistema MUST inferir y actualizar progresivamente, cuando el cliente los comparta, institución, ciudad o país, rol, servicio clínico, necesidad, volumen, plazo, presupuesto orientativo no comprometido y productos de interés.
- **FR-012**: El cliente MUST poder corregir los datos inferidos y continuar sin entregar información personal.
- **FR-013**: IMEIA MUST detectar intención comercial y seleccionar entre continuar el descubrimiento, mostrar productos, proponer presupuesto, proponer contacto o no mostrar llamada a la acción.
- **FR-014**: IMEIA MUST evitar repetir una llamada a la acción rechazada o ignorada durante la misma etapa de conversación.
- **FR-015**: Antes de registrar información personal en el CRM, el sistema MUST obtener consentimiento explícito de tratamiento de datos y un canal de contacto válido.
- **FR-016**: Un lead registrado MUST incluir identificador de conversación, origen, idioma, datos de contacto consentidos, perfil de descubrimiento, resumen comercial, productos verificados, tipo de siguiente paso y marca temporal del consentimiento.
- **FR-017**: El sistema MUST actualizar de forma idempotente el lead de una misma conversación para evitar duplicados.
- **FR-018**: Una solicitud de cotización originada en IMEIA MUST quedar vinculada al lead y conversación correspondientes.
- **FR-019**: La transferencia a formulario o WhatsApp MUST incluir un resumen comercial breve y productos verificados, sin incluir datos sensibles innecesarios en direcciones visibles.
- **FR-020**: El sistema MUST conservar historial y perfil provisional solo durante la sesión del navegador hasta que exista consentimiento y confirmación de registro.
- **FR-021**: Si el servicio experto falla, el sistema MUST distinguir claramente los resultados básicos de catálogo de una recomendación experta y no usar respuestas biomédicas prefabricadas como sustituto.
- **FR-022**: El sistema MUST registrar métricas sin contenido personal para medir turnos, respuestas útiles, productos mostrados, avance de descubrimiento, invitaciones comerciales y conversiones.
- **FR-023**: El diseño MUST admitir la evolución futura hacia IMErvis mediante capacidades y estados explícitos sin cambiar los límites actuales de asesoría comercial y biomédica.
- **FR-024**: Todas las capacidades MUST funcionar en español e inglés con equivalencia de seguridad, precisión y conversión.

### Key Entities

- **Conversación de asesoría**: Sesión de diálogo identificable; contiene idioma, historial reciente, contexto de navegación, estado de descubrimiento y etapa comercial.
- **Perfil de descubrimiento**: Datos no necesariamente personales que califican la necesidad: institución, ubicación, rol, servicio, caso de uso, volumen, plazo y productos.
- **Lead IMEIA**: Oportunidad comercial consentida vinculada a una conversación; contiene contacto, resumen, perfil, productos, origen, estado y trazabilidad del consentimiento.
- **Producto verificado**: Producto activo recuperado de una fuente canónica y autorizado para ser citado en la respuesta actual.
- **Siguiente paso**: Decisión contextual entre continuar diálogo, solicitar un dato, mostrar alternativas, presupuesto, WhatsApp o contacto.
- **Solicitud de cotización**: Registro comercial formal vinculado opcionalmente al lead y a la conversación que lo originaron.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: En pruebas de conversación, al menos 90% de las respuestas resuelven primero la pregunta planteada o explican con precisión qué dato falta.
- **SC-002**: En el 100% de las pruebas con productos citados, cada producto corresponde a un registro activo y verificado del catálogo.
- **SC-003**: En el 100% de las pruebas con atributos ausentes, IMEIA evita inventarlos y los identifica como pendientes de confirmación.
- **SC-004**: En conversaciones de cinco turnos, IMEIA no repite ningún dato de descubrimiento ya aportado en al menos 95% de los casos.
- **SC-005**: En pruebas con consultas informativas, al menos 90% finaliza sin una llamada comercial prematura.
- **SC-006**: En pruebas con intención explícita de compra, precio o disponibilidad, al menos 90% ofrece un siguiente paso útil después de recopilar el contexto mínimo.
- **SC-007**: El 100% de los leads con datos personales tiene consentimiento trazable y canal de contacto válido.
- **SC-008**: El 100% de las cotizaciones originadas en IMEIA conserva vínculo con su conversación y resumen comercial.
- **SC-009**: Ninguna prueba de indisponibilidad presenta texto biomédico prefabricado como si fuera una recomendación experta.
- **SC-010**: Las tareas principales —resolver una duda, afinar una recomendación y solicitar presupuesto— pueden completarse en móvil y escritorio sin abandonar el diálogo antes del paso elegido.

## Assumptions

- IMEIA seguirá siendo el nombre visible en esta fase; IMErvis es una dirección evolutiva, no un cambio de marca inmediato.
- El catálogo publicado y los datos canónicos actuales son la única fuente autorizada para afirmar datos de producto.
- El servicio experto externo seguirá disponible como motor de lenguaje, pero la plataforma I-ME controlará contexto, validación, estado conversacional y registro comercial.
- El CRM inicial es el backoffice comercial existente y sus solicitudes de cotización; no se presupone una integración con un CRM externo.
- La captura de contacto será opcional, progresiva y basada en consentimiento explícito.
- No se almacenará el texto completo de conversaciones anónimas como dato personal; se conservarán métricas no personales y, al confirmar un lead, un resumen comercial limitado.
- Las pruebas con credenciales y servicios reales pueden permanecer bloqueadas por configuración externa; el comportamiento contractual y de degradación debe poder validarse localmente.
