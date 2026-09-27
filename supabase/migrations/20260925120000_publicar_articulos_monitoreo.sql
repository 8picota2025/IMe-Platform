-- Fase 2 (Knowledge Hub): publica el cluster Monitoreo / UCI revisado en el
-- preview local. Contenido técnico tomado de la validación de ingeniería
-- biomédica de I-ME (Ing. Andrés F. Rojas M., 24 de septiembre de 2026).
-- Excluida a propósito, pendiente de confirmar: la respuesta B4 daba la
-- presión arterial como "más alta" en pediatría; sólo se publican FC y FR.
-- Generado desde src/data/conocimiento-borradores/*.md.
--
-- ON CONFLICT (slug) DO NOTHING: no pisa un slug ya creado desde el CMS.
-- Tras aplicar, regenerar embeddings de artículos (mxbai-embed-large).

INSERT INTO articulos (slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, publicado, autor_tipo, cluster_id, tags)
SELECT nuevo.slug, nuevo.titulo_es, nuevo.titulo_en, nuevo.cuerpo_es, nuevo.cuerpo_en, true, 'ime', tc.id, nuevo.tags
FROM (
  VALUES
  ($ime_art$central-monitoreo-multicama-o-monitores-independientes$ime_art$, $ime_art$Central de monitoreo multicama o monitores independientes: cuándo conviene cada opción$ime_art$, $ime_art$Multi-bed central monitoring station or standalone monitors: when each option makes sense$ime_art$,
   $ime_art$# La pregunta

Cada monitor de cabecera funciona solo. Una central de monitoreo multicama reúne en una estación los datos de varios monitores de cama para supervisarlos a la vez. Esta guía ayuda a decidir cuándo esa inversión se justifica y qué exige.

> Criterios validados por el equipo de ingeniería biomédica de I-ME (24 de septiembre de 2026).

## Qué hace una central (y qué no)

Una central **no mide parámetros**: recibe y muestra los datos de los monitores de cama e incluye la revisión de alarmas, tendencias y reportes. El [Monitor Central UCI Multicama](/es/productos/monitor-central-uci-multicama/) del catálogo, por ejemplo, gestiona de 8 a 16 camas según la configuración.

## Cuándo se justifica

Una central multicama suele justificarse cuando se cumple alguno de estos criterios:

- El servicio tiene **4 o más camas de monitoreo continuo**.
- **Enfermería necesita supervisión centralizada**, sobre todo si cada enfermera atiende varios pacientes.
- Hace falta **trazabilidad**: revisar alarmas históricas y generar reportes para auditorías o comités.
- Se busca **integración con la historia clínica electrónica** (HIS/EMR).
- **El layout de la sala** impide ver directamente todos los monitores de cama.

En servicios pequeños, de 1 a 3 camas, los monitores independientes suelen ser suficientes y más económicos.

## Qué exige

- **Red de datos dedicada o VLAN** y un switch de calidad.
- **Direcciones IP o VLAN validadas** antes de conectar los monitores: conectar sin validar provoca pérdida de datos o interferencias.
- **Personal capacitado en la central**: la capacitación de ingeniería biomédica debería incluir su manejo.
- **Monitores de cama compatibles** con la central y registrados en ella durante la instalación.

## Resumen

| Situación                                                 | Opción razonable         |
| --------------------------------------------------------- | ------------------------ |
| 1 a 3 camas, visión directa de todos los monitores        | Monitores independientes |
| 4 o más camas de monitoreo continuo                       | Central multicama        |
| Varias camas por enfermera o sala sin visión directa      | Central multicama        |
| Auditorías, comités o integración con la historia clínica | Central multicama        |

## Siga leyendo

- [Guía completa de monitores multiparamétricos hospitalarios](/es/conocimiento/guia-monitores-multiparametricos-hospitalarios-colombia)
- [Checklist de recepción e instalación de un monitor hospitalario](/es/conocimiento/checklist-recepcion-instalacion-monitor-hospitalario)

Si está dimensionando un servicio, [hable con un asesor de I-ME](/es/contacto) con el número de camas y el tipo de paciente.$ime_art$,
   $ime_art$# The question

Each bedside monitor works on its own. A multi-bed central monitoring station brings the data from several bedside monitors together at one station so they can be watched at once. This guide helps decide when that investment pays off and what it requires.

> Criteria validated by I-ME's clinical engineering team (September 24, 2026).

## What a central station does (and doesn't)

A central station **measures no parameters**: it receives and displays data from the bedside monitors and adds alarm review, trends and reports. The catalog's [Multi-Bed ICU Central Monitor](/en/products/monitor-central-uci-multicama/), for example, handles 8 to 16 beds depending on configuration.

## When it pays off

A multi-bed central station usually makes sense when any of these apply:

- The unit has **4 or more continuously monitored beds**.
- **Nurses need centralized supervision**, especially when each nurse covers several patients.
- **Traceability** is needed: reviewing past alarms and producing reports for audits or committees.
- **Integration with the electronic health record** (HIS/EMR) is a goal.
- **The room layout** prevents a direct view of every bedside monitor.

In small units of 1 to 3 beds, standalone monitors are usually enough and cheaper.

## What it requires

- **A dedicated data network or VLAN** and a good-quality switch.
- **Validated IP addresses or VLANs** before connecting the monitors: connecting without validating causes data loss or interference.
- **Staff trained on the central station**: clinical engineering training should include it.
- **Bedside monitors compatible** with the central station and registered on it during installation.

## Summary

| Situation                                         | Sensible option           |
| ------------------------------------------------- | ------------------------- |
| 1 to 3 beds, direct view of every monitor         | Standalone monitors       |
| 4 or more continuously monitored beds             | Multi-bed central station |
| Several beds per nurse or no direct line of sight | Multi-bed central station |
| Audits, committees or EHR integration             | Multi-bed central station |

## Keep reading

- [Complete guide to hospital multiparameter monitors](/en/knowledge/guia-monitores-multiparametricos-hospitalarios-colombia)
- [Checklist for receiving and installing a hospital patient monitor](/en/knowledge/checklist-recepcion-instalacion-monitor-hospitalario)

If you are sizing a unit, [talk to an I-ME advisor](/en/contact) with the number of beds and the patient type.$ime_art$,
   $ime_art$monitoreo-uci$ime_art$, ARRAY['monitores', 'central']::text[]),
  ($ime_art$checklist-recepcion-instalacion-monitor-hospitalario$ime_art$, $ime_art$Checklist de recepción e instalación de un monitor hospitalario$ime_art$, $ime_art$Checklist for receiving and installing a hospital patient monitor$ime_art$,
   $ime_art$# Para qué sirve este checklist

Un monitor bien elegido puede fallar en su primera semana si llega a una toma sin polo a tierra, a una red que la central no reconoce o a un servicio que solo capacitó a un turno. Este checklist recoge lo que conviene preparar, verificar y dejar firmado desde que se confirma la compra hasta que el equipo se usa con pacientes.

> Validado por el equipo de ingeniería biomédica de I-ME (24 de septiembre de 2026). Los requisitos exactos de cada modelo están en su manual y ficha técnica; ante cualquier diferencia, prevalece el manual del fabricante.

## Antes de la entrega: lo que prepara la institución

- [ ] **Toma eléctrica regulada** (110/220 V según el equipo) **con polo a tierra verificado y certificado**, según la NTC 2050 o la norma local aplicable.
- [ ] **Punto de red Ethernet (RJ45) activo y configurado**, si el monitor se integrará a una central de monitoreo multicama.
- [ ] **Espacio y sistema de montaje definidos** (soporte de pared, techo o pedestal) según el layout de la sala.
- [ ] **Personal de ingeniería biomédica disponible** para acompañar la recepción.
- [ ] **Condiciones ambientales** (temperatura, humedad) dentro del rango del manual del fabricante.

## En la recepción física

- [ ] **Embalaje íntegro**: sin golpes, humedad ni señales de apertura previa.
- [ ] **Modelo, referencia y número de serie** coinciden exactamente con la orden de compra y la remisión.
- [ ] **Inventario completo de accesorios y sensores**: cables de ECG, sensores de SpO₂, brazaletes de NIBP de los distintos tamaños, módulos opcionales y batería.
- [ ] **Sin daños visibles** en pantalla, carcasa, conectores, ruedas o soportes.
- [ ] **Documentos completos** (ver la sección siguiente).

Cualquier no conformidad se anota en el acta y se resuelve con el proveedor antes de continuar.

## Los documentos que deben venir con el equipo

Siempre:

- [ ] Manual de usuario en español (impreso o digital).
- [ ] Certificado de garantía del fabricante y del proveedor.
- [ ] Certificado de pruebas de fábrica o de calibración inicial.
- [ ] Copia del registro sanitario INVIMA vigente (cómo verificarlo: [guía del registro sanitario INVIMA](/es/conocimiento/registro-sanitario-invima-equipos-biomedicos)).
- [ ] Inventario de accesorios y sensores entregados.

Bajo solicitud o según contrato: ficha técnica detallada y protocolos de mantenimiento, certificados de conformidad adicionales (por ejemplo, IEC 60601) y software de configuración o actualizaciones.

## Instalación y puesta en marcha

En I-ME la realiza personal técnico autorizado (ingenieros biomédicos o técnicos de campo). Verifique que incluya:

- [ ] Montaje físico del monitor y sus accesorios en el puesto asignado.
- [ ] Conexión eléctrica y **verificación de tierra**.
- [ ] Conexión a la red y **registro en la central de monitoreo**, si aplica.
- [ ] Configuración inicial: **perfiles de paciente** (adulto, pediátrico, neonatal), **límites de alarma según el protocolo del servicio**, idioma, fecha y hora.
- [ ] Prueba de comunicación con la central multicama.
- [ ] Entrega de credenciales de administrador y capacitación básica a ingeniería biomédica.

## Pruebas antes de usarlo con pacientes

- [ ] **Autodiagnóstico** (self-test) al encender.
- [ ] **Verificación con simulador de paciente certificado**: ECG (ritmo y amplitud), SpO₂, NIBP, temperatura y, si están instalados, los módulos invasivos (IBP, EtCO₂).
- [ ] **Alarmas visuales y sonoras** y su priorización.
- [ ] **Autonomía de la batería** (carga mínima).
- [ ] **Conectividad con la central**, si aplica.

El equipo no se libera para uso clínico hasta completar estas pruebas, y el resultado queda en un registro firmado por el técnico del proveedor y por el responsable de ingeniería biomédica de la institución.

## Capacitación

- [ ] **Personal asistencial** (enfermería y médicos del servicio): de 2 a 4 horas teórico-prácticas **por grupo o turno**, sobre operación básica, reconocimiento de alarmas, cambio de sensores, solución de problemas de primer nivel y perfiles de paciente.
- [ ] **Ingeniería biomédica**: de 4 a 8 horas sobre configuración avanzada, mantenimiento de primer nivel, calibración básica, gestión de usuarios, actualización de software y manejo de la central.
- [ ] **Soporte de primer nivel** designado en la institución, con una línea de soporte técnico del proveedor.

Las duraciones son aproximadas y se ajustan al tamaño del parque de equipos y al número de turnos.

## El acta de entrega e instalación

Debe firmarse un acta con, como mínimo:

- [ ] Datos de la institución y del servicio.
- [ ] Marca, modelo, número de serie y registro INVIMA del equipo.
- [ ] Inventario detallado de accesorios y consumibles entregados.
- [ ] Resultado de las pruebas de funcionamiento.
- [ ] Personal capacitado (nombres y cargos).
- [ ] Observaciones y pendientes.
- [ ] Firmas del técnico del proveedor, del responsable de ingeniería biomédica y, cuando aplique, de la jefatura del servicio o la coordinación de UCI.

El original queda en la institución.

## Errores frecuentes que conviene evitar

- **No verificar el polo a tierra ni usar tomas reguladas**: fallos intermitentes y riesgos de seguridad eléctrica.
- **Recibir sin inventario exhaustivo**: los faltantes aparecen semanas después.
- **Dejar las alarmas con los valores de fábrica** en lugar de ajustarlas al protocolo del servicio.
- **Capacitar solo a un turno** o a personal que no opera el equipo: uso incorrecto en noches y fines de semana.
- **Subestimar el espacio y el orden de los cables**: puestos desordenados y riesgo de tropiezos.
- **Conectar a la central sin validar direcciones IP o VLAN**: pérdida de datos o interferencias.
- **No registrar el equipo** en el sistema de gestión de activos biomédicos de la institución.

## Siga leyendo

- [Guía completa de monitores multiparamétricos hospitalarios](/es/conocimiento/guia-monitores-multiparametricos-hospitalarios-colombia)
- [Central de monitoreo multicama o monitores independientes](/es/conocimiento/central-monitoreo-multicama-o-monitores-independientes)

Si prepara la llegada de monitores a un servicio, [hable con un asesor de I-ME](/es/contacto) para coordinar la instalación y la capacitación.$ime_art$,
   $ime_art$# What this checklist is for

A well-chosen monitor can still fail in its first week if it arrives at an ungrounded outlet, on a network the central station does not recognize, or in a unit where only one shift was trained. This checklist covers what to prepare, check and sign off from the moment the purchase is confirmed until the equipment is used on patients.

> Validated by I-ME's clinical engineering team (September 24, 2026). Each model's exact requirements are in its manual and data sheet; where they differ, the manufacturer's manual prevails.

## Before delivery: what the institution prepares

- [ ] **A regulated power outlet** (110/220 V as specified) **with a verified and certified ground**, per NTC 2050 (Colombia's electrical code) or the applicable local standard.
- [ ] **An active, configured Ethernet (RJ45) port**, if the monitor will join a multi-bed central monitoring station.
- [ ] **Space and mounting system defined** (wall, ceiling or pole mount) according to the room layout.
- [ ] **Clinical engineering staff available** to attend the receiving.
- [ ] **Environmental conditions** (temperature, humidity) within the range in the manufacturer's manual.

## At physical receiving

- [ ] **Packaging intact**: no dents, moisture or signs of prior opening.
- [ ] **Model, reference and serial number** match the purchase order and delivery note exactly.
- [ ] **Complete inventory of accessories and sensors**: ECG cables, SpO₂ sensors, NIBP cuffs in the different sizes, optional modules and battery.
- [ ] **No visible damage** to the screen, housing, connectors, casters or mounts.
- [ ] **All documents present** (see the next section).

Any non-conformity is recorded in the handover record and resolved with the supplier before continuing.

## Documents that must come with the equipment

Always:

- [ ] User manual in Spanish (printed or digital).
- [ ] Manufacturer's and supplier's warranty certificate.
- [ ] Factory test or initial calibration certificate.
- [ ] Copy of the current INVIMA sanitary registration (how to check it: [INVIMA sanitary registration guide](/en/knowledge/registro-sanitario-invima-equipos-biomedicos)).
- [ ] Inventory of the accessories and sensors delivered.

On request or per contract: detailed data sheet and maintenance protocols, additional conformity certificates (for example, IEC 60601) and configuration software or updates.

## Installation and commissioning

At I-ME this is done by authorized technical staff (clinical engineers or field technicians). Make sure it includes:

- [ ] Physical mounting of the monitor and its accessories at the assigned station.
- [ ] Power connection and **ground verification**.
- [ ] Network connection and **registration on the central monitoring station**, if applicable.
- [ ] Initial setup: **patient profiles** (adult, pediatric, neonatal), **alarm limits per the unit's protocol**, language, date and time.
- [ ] Communication test with the multi-bed central station.
- [ ] Handover of administrator credentials and basic training for clinical engineering.

## Tests before use on patients

- [ ] **Self-test** at power-on.
- [ ] **Verification with a certified patient simulator**: ECG (rhythm and amplitude), SpO₂, NIBP, temperature and, if installed, the invasive modules (IBP, EtCO₂).
- [ ] **Visual and audible alarms** and their prioritization.
- [ ] **Battery autonomy** (minimum charge).
- [ ] **Connectivity with the central station**, if applicable.

The equipment is not released for clinical use until these tests are complete, and the results are recorded and signed by the supplier's technician and the institution's clinical engineering lead.

## Training

- [ ] **Clinical staff** (nurses and physicians of the unit): 2 to 4 hours of theory and practice **per group or shift**, covering basic operation, alarm recognition, sensor changes, first-level troubleshooting and patient profiles.
- [ ] **Clinical engineering**: 4 to 8 hours on advanced configuration, first-level maintenance, basic calibration, user management, software updates and central station management.
- [ ] **First-level support** designated within the institution, with the supplier's technical support line.

Durations are approximate and adjusted to the size of the equipment fleet and the number of shifts.

## The delivery and installation record

A record should be signed with, at a minimum:

- [ ] Institution and unit details.
- [ ] Brand, model, serial number and INVIMA registration of the equipment.
- [ ] Detailed inventory of accessories and consumables delivered.
- [ ] Results of the functional tests.
- [ ] Staff trained (names and roles).
- [ ] Observations and open items.
- [ ] Signatures of the supplier's technician, the clinical engineering lead and, where applicable, the head of the unit or ICU coordinator.

The original stays with the institution.

## Common mistakes to avoid

- **Not checking the ground or using unregulated outlets**: intermittent faults and electrical safety risks.
- **Receiving without a thorough inventory**: missing items surface weeks later.
- **Leaving alarms at factory defaults** instead of adjusting them to the unit's protocol.
- **Training only one shift**, or staff who do not operate the equipment: incorrect use at night and on weekends.
- **Underestimating space and cable management**: cluttered stations and trip hazards.
- **Connecting to the central station without validating IP addresses or VLANs**: data loss or interference.
- **Not registering the equipment** in the institution's biomedical asset management system.

## Keep reading

- [Complete guide to hospital multiparameter monitors](/en/knowledge/guia-monitores-multiparametricos-hospitalarios-colombia)
- [Multi-bed central monitoring station or standalone monitors](/en/knowledge/central-monitoreo-multicama-o-monitores-independientes)

If you are preparing monitors for a unit, [talk to an I-ME advisor](/en/contact) to coordinate installation and training.$ime_art$,
   $ime_art$monitoreo-uci$ime_art$, ARRAY['checklist', 'instalacion']::text[]),
  ($ime_art$guia-monitores-multiparametricos-hospitalarios-colombia$ime_art$, $ime_art$Guía completa de monitores multiparamétricos hospitalarios en Colombia$ime_art$, $ime_art$Complete guide to hospital multiparameter monitors in Colombia$ime_art$,
   $ime_art$# Qué encontrará en esta guía

Esta es la guía de referencia de I-ME sobre monitores de paciente: qué mide cada tipo, cómo elegir entre un monitor básico y uno de UCI avanzado, qué cambia según el paciente, cuándo conviene una central de monitoreo y qué cuesta mantenerlo en el tiempo. Reúne los artículos del tema en un solo punto de partida.

> Contenido técnico validado por el equipo de ingeniería biomédica de I-ME (24 de septiembre de 2026). La configuración exacta de cada equipo depende de la orden de compra: verifique siempre la ficha técnica del modelo y del lote.

## 1. Empiece por el caso de uso, no por la lista de parámetros

Antes de comparar modelos, defina por escrito el tipo de paciente, si las camas son fijas o hay transporte, si necesita central, qué parámetros exige su protocolo y quién operará el equipo en cada turno. La [guía práctica de monitores multiparamétricos en UCI](/es/conocimiento/guia-monitores-multiparametricos-uci) desarrolla ese análisis previo y los criterios de evaluación técnica.

A esos criterios, ingeniería biomédica añade dos que conviene exigir en cualquier compra: **cumplimiento de las normas de seguridad eléctrica IEC 60601** y **registro sanitario INVIMA vigente** para el modelo cotizado ([cómo verificarlo](/es/conocimiento/registro-sanitario-invima-equipos-biomedicos)).

## 2. Qué mide cada modelo del catálogo

| Modelo                                                                                                 | De serie                                                                                                                                                      | Opcional                                                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Monitor Multiparamétrico Básico](/es/productos/monitor-multiparametrico-basico/)                      | ECG (3/5 derivaciones), SpO₂, NIBP, temperatura                                                                                                               | IBP (1 canal), EtCO₂, impresora                                                  |
| [Monitor Multiparamétrico UCI Avanzado](/es/productos/monitor-multiparametrico-uci-avanzado/)          | ECG (3/5/12), SpO₂, NIBP, IBP (2 canales), temperatura, EtCO₂                                                                                                 | IBP adicional, gasto cardíaco, BIS, gases anestésicos                            |
| [Biolight M12](/es/productos/monitor-de-paciente-ref-m12-biolight/)                                    | ECG, SpO₂, NIBP, temperatura                                                                                                                                  | IBP, EtCO₂, según la configuración de la serie M                                 |
| [Biolight P15 (Serie P, modular)](/es/productos/monitor-de-paciente-modular-serie-p-ref-p15-biolight/) | ECG, SpO₂, NIBP, temperatura                                                                                                                                  | Módulos intercambiables: IBP multicanal, EtCO₂, gasto cardíaco, BIS, entre otros |
| [Monitor Central UCI Multicama](/es/productos/monitor-central-uci-multicama/)                          | No mide parámetros: recibe y muestra los datos de los monitores de cama (de 8 a 16 camas según configuración), con revisión de alarmas, tendencias y reportes | —                                                                                |

Siglas: **ECG** electrocardiograma; **SpO₂** saturación de oxígeno; **NIBP** presión arterial no invasiva; **IBP** presión arterial invasiva; **EtCO₂** dióxido de carbono al final de la espiración; **BIS** índice biespectral.

## 3. ¿Básico o UCI avanzado?

**Monitor básico.** Indicado para áreas de menor complejidad: urgencias, hospitalización general, posoperatorio simple. Menos parámetros invasivos, interfaz más sencilla y menor costo de adquisición y de consumibles.

**Monitor de UCI avanzado.** Diseñado para UCI y cuidados intermedios: soporte nativo de parámetros invasivos (IBP múltiple, EtCO₂, gasto cardíaco), algoritmos avanzados de detección de arritmias, más capacidad de almacenamiento de tendencias, mejor integración con centrales y con la historia clínica electrónica, y posibilidad de ampliarlo por módulos.

**Criterio de decisión:** si el servicio requiere monitoreo invasivo de rutina, atiende pacientes en ventilación mecánica o de alto riesgo, elija UCI avanzado. Si el volumen es alto y la complejidad baja, un monitor básico o intermedio suele ser suficiente.

## 4. Adulto, pediátrico o neonatal

Un mismo equipo puede servir a los tres grupos si dispone de los accesorios adecuados y se configuran bien los perfiles de paciente, pero los sensores, los brazaletes y los rangos de alarma cambian. Lo detallamos en [monitores para UCI adulto, pediátrica y neonatal](/es/conocimiento/monitores-uci-adulto-pediatrica-neonatal).

## 5. ¿Central de monitoreo o monitores independientes?

A partir de unas 4 camas de monitoreo continuo, o cuando enfermería necesita supervisar varias camas a la vez, una central multicama empieza a justificarse. Los criterios y los requisitos de red están en [central de monitoreo multicama o monitores independientes](/es/conocimiento/central-monitoreo-multicama-o-monitores-independientes).

## 6. Mantenimiento y calibración

- **Frecuencia:** los fabricantes (Biolight y equivalentes) recomiendan en general verificar la precisión o calibrar **al menos una vez al año**, o según las horas de uso y la política del hospital. Con uso intensivo, parámetros como NIBP y SpO₂ pueden necesitar chequeos más frecuentes. La frecuencia exacta está en el manual de servicio de cada modelo: no hay una cifra única para todos.
- **Quién lo hace:** personal técnico del proveedor o ingeniería biomédica de la institución capacitada y con equipos de referencia calibrados.
- **Qué incluye el mantenimiento preventivo de I-ME:** inspección visual, limpieza, verificación de precisión con simuladores, actualización de firmware, prueba de batería e informe técnico.

## 7. Consumibles y costo total de propiedad

Los consumibles de mayor rotación, según la experiencia de I-ME y la documentación de los fabricantes:

- Electrodos de ECG desechables (a diario o por paciente).
- Sensores de SpO₂ (vida útil limitada; reutilizables o desechables según el tipo).
- Brazaletes de NIBP (se desgastan con el uso; hay varios tamaños).
- Filtros y líneas de muestreo de EtCO₂, si aplica.
- Papel térmico, si el monitor tiene impresora.
- Baterías internas: reemplazo cada 2 a 4 años según los ciclos de carga.

**En la mayoría de los servicios, los sensores de SpO₂ y los electrodos son el mayor gasto recurrente.** Por eso la cotización debería incluir también **el plan de capacitación y un stock inicial de consumibles**, además del contrato de mantenimiento y la reposición programada.

## 8. Antes de la entrega

Muchos problemas de la primera semana no son del monitor sino de la infraestructura: **verifique la instalación eléctrica y la red antes de la instalación**. El [checklist de recepción e instalación](/es/conocimiento/checklist-recepcion-instalacion-monitor-hospitalario) recorre la preparación, las pruebas antes del uso clínico, la capacitación y el acta de entrega.

## Siguiente paso

Revise los [monitores del catálogo](/es/familias/monitores/) o [hable con un asesor de I-ME](/es/contacto) con su caso de uso: número de camas, tipo de paciente, parámetros de su protocolo y si necesita central.$ime_art$,
   $ime_art$# What you will find in this guide

This is I-ME's reference guide to patient monitors: what each type measures, how to choose between a basic and an advanced ICU monitor, what changes by patient group, when a central monitoring station makes sense and what it costs to run over time. It brings the topic's articles together in one starting point.

> Technical content validated by I-ME's clinical engineering team (September 24, 2026). Each unit's exact configuration depends on the purchase order: always check the data sheet for the model and batch.

## 1. Start with the use case, not the parameter list

Before comparing models, write down the patient type, whether beds are fixed or there is transport, whether you need a central station, which parameters your protocol requires and who will operate the equipment on each shift. The [practical guide to multiparameter monitors in the ICU](/en/knowledge/guia-monitores-multiparametricos-uci) covers that groundwork and the technical evaluation criteria.

Clinical engineering adds two criteria worth requiring in any purchase: **compliance with the IEC 60601 electrical safety standards** and a **current INVIMA sanitary registration** for the quoted model ([how to check it](/en/knowledge/registro-sanitario-invima-equipos-biomedicos)).

## 2. What each catalog model measures

| Model                                                                                                  | Standard                                                                                                                                                  | Optional                                                                             |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Basic Multiparameter Monitor](/en/products/monitor-multiparametrico-basico/)                          | ECG (3/5 leads), SpO₂, NIBP, temperature                                                                                                                  | IBP (1 channel), EtCO₂, printer                                                      |
| [Advanced ICU Multiparameter Monitor](/en/products/monitor-multiparametrico-uci-avanzado/)             | ECG (3/5/12), SpO₂, NIBP, IBP (2 channels), temperature, EtCO₂                                                                                            | Additional IBP, cardiac output, BIS, anesthetic gases                                |
| [Biolight M12](/en/products/monitor-de-paciente-ref-m12-biolight/)                                     | ECG, SpO₂, NIBP, temperature                                                                                                                              | IBP, EtCO₂, depending on the M series configuration                                  |
| [Biolight P15 (P Series, modular)](/en/products/monitor-de-paciente-modular-serie-p-ref-p15-biolight/) | ECG, SpO₂, NIBP, temperature                                                                                                                              | Interchangeable modules: multi-channel IBP, EtCO₂, cardiac output, BIS, among others |
| [Multi-Bed ICU Central Monitor](/en/products/monitor-central-uci-multicama/)                           | Measures no parameters: receives and displays data from bedside monitors (8 to 16 beds depending on configuration), with alarm review, trends and reports | —                                                                                    |

Abbreviations: **ECG** electrocardiogram; **SpO₂** oxygen saturation; **NIBP** non-invasive blood pressure; **IBP** invasive blood pressure; **EtCO₂** end-tidal carbon dioxide; **BIS** bispectral index.

## 3. Basic or advanced ICU?

**Basic monitor.** Suited to lower-acuity areas: emergency, general wards, simple post-op. Fewer invasive parameters, a simpler interface and lower purchase and consumables cost.

**Advanced ICU monitor.** Designed for ICUs and step-down units: native support for invasive parameters (multiple IBP, EtCO₂, cardiac output), advanced arrhythmia detection, more trend storage, better integration with central stations and electronic health records, and modular expansion.

**Decision rule:** if the unit needs routine invasive monitoring or treats ventilated or high-risk patients, choose advanced ICU. If volume is high and acuity low, a basic or mid-range monitor is usually enough.

## 4. Adult, pediatric or neonatal

One unit can serve all three groups with the right accessories and correctly configured patient profiles, but sensors, cuffs and alarm ranges differ. See [monitors for adult, pediatric and neonatal ICUs](/en/knowledge/monitores-uci-adulto-pediatrica-neonatal).

## 5. Central station or standalone monitors?

From around 4 continuously monitored beds, or when nurses need to watch several beds at once, a multi-bed central station starts to pay off. Criteria and network requirements are in [multi-bed central monitoring station or standalone monitors](/en/knowledge/central-monitoreo-multicama-o-monitores-independientes).

## 6. Maintenance and calibration

- **Frequency:** manufacturers (Biolight and equivalents) generally recommend verifying accuracy or calibrating **at least once a year**, or according to hours of use and hospital policy. Under heavy use, parameters such as NIBP and SpO₂ may need more frequent checks. The exact interval is in each model's service manual: there is no single figure for all equipment.
- **Who does it:** the supplier's technical staff, or the institution's clinical engineering team if trained and equipped with calibrated reference instruments.
- **What I-ME's preventive maintenance includes:** visual inspection, cleaning, accuracy verification with simulators, firmware updates, battery testing and a technical report.

## 7. Consumables and total cost of ownership

The highest-turnover consumables, based on I-ME's experience and manufacturer documentation:

- Disposable ECG electrodes (daily or per patient).
- SpO₂ sensors (limited lifespan; reusable or disposable depending on type).
- NIBP cuffs (wear with use; several sizes).
- EtCO₂ filters and sampling lines, where applicable.
- Thermal paper, if the monitor has a printer.
- Internal batteries: replaced every 2 to 4 years depending on charge cycles.

**In most units, SpO₂ sensors and electrodes are the largest recurring cost.** That is why the quote should also cover **the training plan and an initial stock of consumables**, alongside the maintenance contract and scheduled replenishment.

## 8. Before delivery

Many first-week problems come from the infrastructure, not the monitor: **check the electrical installation and the network before installation**. The [receiving and installation checklist](/en/knowledge/checklist-recepcion-instalacion-monitor-hospitalario) walks through preparation, pre-clinical tests, training and the handover record.

## Next step

Browse the [monitors in the catalog](/en/families/monitores/) or [talk to an I-ME advisor](/en/contact) about your use case: number of beds, patient type, the parameters in your protocol and whether you need a central station.$ime_art$,
   $ime_art$monitoreo-uci$ime_art$, ARRAY['pilar', 'monitores']::text[]),
  ($ime_art$monitores-uci-adulto-pediatrica-neonatal$ime_art$, $ime_art$Monitores para UCI adulto, pediátrica y neonatal: qué cambia al elegir$ime_art$, $ime_art$Monitors for adult, pediatric and neonatal ICUs: what changes when choosing$ime_art$,
   $ime_art$# Un mismo monitor, tres tipos de paciente

Muchos monitores multiparamétricos pueden atender a adultos, niños y neonatos. Lo que cambia son los accesorios, los rangos de alarma y la configuración. Si esas diferencias no se prevén en la compra, el equipo llega sin los sensores adecuados o con alarmas pensadas para otro paciente.

> Contenido validado por el equipo de ingeniería biomédica de I-ME (24 de septiembre de 2026). No reemplaza los protocolos clínicos de su institución: los valores de alarma los define el servicio.

## UCI de adultos

- Sensores de SpO₂ y brazaletes de NIBP de tamaño adulto.
- Rangos de alarma típicos de adultos.
- Módulos de uso general para presión invasiva (IBP) y EtCO₂.

## UCI pediátrica

- Brazaletes de NIBP y sensores de SpO₂ de **tamaño pediátrico**.
- **Rangos de alarma ajustados** a los valores de referencia pediátricos; por ejemplo, frecuencias cardíaca y respiratoria más altas que en adultos.
- Algoritmos de arritmia y de SpO₂ optimizados para niños, cuando el equipo los incluye.

## UCI neonatal

- Sensores de SpO₂ **neonatales de alta sensibilidad**.
- Brazaletes de NIBP de tamaño neonatal o micro, y **electrodos de ECG de tamaño reducido**.
- **Rangos de alarma específicos**: saturación con márgenes más estrechos y frecuencia cardíaca más elevada.
- En muchos equipos, **módulos o modos "Neo"** que limitan la energía de la medición de NIBP y optimizan el filtrado de la señal.

## Lo que no cambia: la configuración importa tanto como el hardware

Un mismo equipo puede servir a los tres grupos si se dispone de los accesorios y se configuran bien los **perfiles de paciente** preconfigurados. Por eso conviene:

- Incluir en la cotización **los accesorios de cada tamaño** que el servicio necesita, no solo los de adulto.
- Configurar los perfiles y **los límites de alarma según el protocolo del servicio** durante la instalación, en lugar de dejar los valores de fábrica.
- Prever **accesorios específicos** (cunas, soportes) y una **capacitación diferenciada** para el personal de cada unidad.

## Siga leyendo

- [Guía completa de monitores multiparamétricos hospitalarios](/es/conocimiento/guia-monitores-multiparametricos-hospitalarios-colombia)
- [Checklist de recepción e instalación de un monitor hospitalario](/es/conocimiento/checklist-recepcion-instalacion-monitor-hospitalario)

Si equipa una unidad pediátrica o neonatal, [hable con un asesor de I-ME](/es/contacto) para definir los accesorios desde la cotización.$ime_art$,
   $ime_art$# One monitor, three patient types

Many multiparameter monitors can serve adults, children and neonates. What changes are the accessories, the alarm ranges and the configuration. If those differences are not planned at purchase, the equipment arrives without the right sensors or with alarms set for a different patient.

> Content validated by I-ME's clinical engineering team (September 24, 2026). It does not replace your institution's clinical protocols: alarm values are set by the unit.

## Adult ICU

- Adult-size SpO₂ sensors and NIBP cuffs.
- Typical adult alarm ranges.
- General-purpose invasive pressure (IBP) and EtCO₂ modules.

## Pediatric ICU

- **Pediatric-size** NIBP cuffs and SpO₂ sensors.
- **Alarm ranges adjusted** to pediatric reference values; for example, higher heart and respiratory rates than in adults.
- Arrhythmia and SpO₂ algorithms optimized for children, where the equipment includes them.

## Neonatal ICU

- **High-sensitivity neonatal** SpO₂ sensors.
- Neonatal or micro-size NIBP cuffs, and **smaller ECG electrodes**.
- **Specific alarm ranges**: tighter saturation margins and a higher heart rate.
- On many units, **"Neo" modules or modes** that limit NIBP measurement energy and optimize signal filtering.

## What doesn't change: configuration matters as much as hardware

One unit can serve all three groups if the accessories are available and the preset **patient profiles** are configured correctly. So it pays to:

- Include **the accessories in each size** the unit needs in the quote, not just adult ones.
- Configure the profiles and **alarm limits per the unit's protocol** during installation, instead of leaving factory defaults.
- Plan for **specific accessories** (cribs, mounts) and **differentiated training** for each unit's staff.

## Keep reading

- [Complete guide to hospital multiparameter monitors](/en/knowledge/guia-monitores-multiparametricos-hospitalarios-colombia)
- [Checklist for receiving and installing a hospital patient monitor](/en/knowledge/checklist-recepcion-instalacion-monitor-hospitalario)

If you are equipping a pediatric or neonatal unit, [talk to an I-ME advisor](/en/contact) to define the accessories from the quote stage.$ime_art$,
   $ime_art$monitoreo-uci$ime_art$, ARRAY['monitores', 'uci']::text[])
) AS nuevo(slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, tema_slug, tags)
JOIN topic_clusters tc ON tc.slug = nuevo.tema_slug
ON CONFLICT (slug) DO NOTHING;
