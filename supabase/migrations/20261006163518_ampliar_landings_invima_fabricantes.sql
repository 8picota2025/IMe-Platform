-- Amplía las landings INVIMA para fabricantes nacionales y extranjeros (ES/EN).
-- Fuente: src/data/conocimiento-borradores/{registro-sanitario-invima-equipos-biomedicos,checklist-invima-compra-equipos-medicos}.md
-- Revisión de fuentes oficiales: 2026-10-06. Sin tarifas ni plazos universales.
-- Conserva IDs, imágenes y created_at de los artículos existentes.
-- Tras aplicar: regenerar embeddings de artículos y reconstruir producción SIN PREVIEW_DRAFTS.
BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.topic_clusters WHERE slug = 'invima-regulacion') THEN
    RAISE EXCEPTION 'Falta el tema invima-regulacion; aplicar primero las migraciones del Centro de Conocimiento';
  END IF;
END;
$guard$;

INSERT INTO public.articulos AS actual
  (slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, publicado, autor_tipo, cluster_id, tags)
SELECT nuevo.slug, nuevo.titulo_es, nuevo.titulo_en, nuevo.cuerpo_es, nuevo.cuerpo_en,
       true, 'ime', tema.id, nuevo.tags
FROM (VALUES
  ($ime_invima$registro-sanitario-invima-equipos-biomedicos$ime_invima$, $ime_invima$Registro INVIMA para fabricantes de equipos biomédicos: requisitos, costos y tiempos$ime_invima$, $ime_invima$INVIMA Registration for Medical Device Manufacturers: Requirements, Costs and Timelines$ime_invima$, $ime_invima$# Registro INVIMA para fabricantes de equipos biomédicos: requisitos, costos y tiempos

Si fabrica dispositivos médicos o equipos biomédicos y busca comercializarlos en Colombia, la ruta ante el Instituto Nacional de Vigilancia de Medicamentos y Alimentos (INVIMA) debe definirse antes de fijar una fecha de lanzamiento. La clasificación del producto, su finalidad prevista, la tecnología que incorpora y el papel de cada empresa determinan qué autorización aplica y qué documentos debe preparar. Un expediente ordenado ayuda a anticipar el trabajo; no reemplaza la evaluación de la autoridad ni garantiza una decisión favorable.

Esta guía está dirigida a fabricantes nacionales e internacionales, titulares de producto, importadores y equipos que preparan una entrada al mercado colombiano. El punto de partida es validar el caso concreto bajo el [marco de dispositivos médicos y equipos biomédicos del INVIMA](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos) y el [Decreto 4725 de 2005](https://normograma.invima.gov.co/compilacion/docs/decreto_4725_2005.htm).

## Primero: determine qué autorización corresponde

La clasificación por riesgo se basa en la finalidad prevista y en factores como la duración y el tipo de contacto con el cuerpo, el grado de invasividad y el impacto potencial de una falla. El fabricante debe justificarla aplicando las reglas vigentes. En términos generales, las clases I y IIa siguen una ruta de registro sanitario automático, sujeta a que la solicitud cumpla los requisitos documentales. Para las clases IIb y III se requiere evaluación técnica y legal por parte del INVIMA.

Hay una distinción adicional para ciertos equipos biomédicos de tecnología controlada: pueden requerir permiso de comercialización, en vez de tratarse como un registro ordinario. Por eso, la clase de riesgo por sí sola no resuelve el trámite. Hay que revisar las características del producto, su uso previsto y si encaja en una categoría de tecnología controlada o en un régimen especial.

La modalidad también depende de la actividad que se realizará en Colombia. Fabricar, importar, comercializar o actuar como titular son funciones distintas y deben reflejarse de forma coherente en la solicitud. Si el producto se fabrica fuera del país, el fabricante internacional aporta la evidencia del producto y de su sistema de calidad; el titular y el importador deben estar identificados, y la operación en Colombia debe contar con las condiciones que le correspondan. La estructura concreta debe confirmarse antes de preparar poderes, contratos o etiquetas.

## Titular, fabricante e importador: responsabilidades claras

El fabricante responde por la evidencia técnica del dispositivo, el proceso de fabricación, la calidad, la seguridad, el desempeño y la información de uso. El titular es la persona natural o jurídica a cuyo nombre se solicita y queda asociado el registro; asume responsabilidades regulatorias en Colombia según el alcance autorizado. El importador habilita la entrada del producto al país y debe estar correctamente identificado en los documentos y en el etiquetado cuando aplique. Una misma compañía puede reunir más de un rol, pero no conviene asumirlo sin verificar los requisitos.

Antes de avanzar, acuerde con el fabricante quién será titular, quién importará, quién conservará los documentos maestros y quién gestionará cambios, quejas y alertas. Revise además las condiciones de almacenamiento y acondicionamiento aplicables al importador. Cuando la operación lo exige, el certificado de capacidad de almacenamiento y acondicionamiento (CCAA) y la información del establecimiento deben alinearse con el expediente. Los fabricantes nacionales, por su parte, deben revisar los requisitos sanitarios que correspondan a su establecimiento y actividad.

## Qué preparar en el dossier técnico y legal

El contenido exacto depende del dispositivo y de la ruta, pero normalmente conviene reunir desde el inicio:

- Identificación del fabricante, del titular y, si corresponde, del importador; existencia legal, representación y autorizaciones para actuar.
- Descripción, finalidad prevista, modelos, referencias y configuraciones incluidas; clasificación de riesgo razonada y modalidad solicitada.
- Información del sistema de calidad y de las condiciones del establecimiento fabricante, junto con la evidencia que corresponda al caso.
- Declaración del fabricante, especificaciones, funcionamiento, proceso productivo y comprobaciones analíticas o estudios técnicos disponibles.
- Gestión de riesgos, normas aplicadas y evidencia de seguridad y desempeño. La necesidad de evidencia clínica u otros estudios depende de la clase, la finalidad y las características del producto.
- Etiquetas, insertos y manuales consistentes con el producto. La información para Colombia debe contemplar el castellano y, para equipos biomédicos, los manuales de operación y mantenimiento en ese idioma cuando corresponda.
- Documentos de comercialización en otros países, vida útil, esterilización, disposición final y trazabilidad cuando sean aplicables.

La documentación del fabricante suele llegar en otro idioma. Identifique pronto qué documentos requieren traducción al castellano y si deben cumplir formalidades de autenticación, legalización o apostilla. Mantenga iguales el nombre comercial, los modelos, la finalidad, el fabricante y las presentaciones en certificados, formularios, etiquetas y contratos. Una diferencia pequeña puede originar una solicitud de aclaración o exigir reorganizar el expediente.

El marcado CE, una autorización FDA o un certificado de venta libre pueden ser antecedentes útiles para sustentar información, pero no sustituyen por sí solos el trámite colombiano. El INVIMA aplica el marco nacional y revisa los soportes que correspondan a la solicitud. Tampoco dé por hecho que un documento internacional evita requisitos locales sobre titularidad, importación, idioma o condiciones sanitarias.

## Costos: separe tasas oficiales de los demás recursos

El presupuesto debe distinguir conceptos que suelen mezclarse. Las tasas oficiales del INVIMA corresponden al trámite aplicable y deben consultarse en el [manual tarifario vigente](https://www.invima.gov.co/tramites-y-servicios/tarifas); el Instituto publicó actualizaciones para 2026, incluida una modificación en septiembre. Verifique la tarifa y el código vigentes cuando vaya a radicar, porque pueden cambiar.

Aparte de la tasa, considere traducciones, autenticaciones o legalizaciones, preparación y revisión legal, adaptación de etiquetas y manuales, gestión documental del fabricante, ensayos o análisis adicionales si la autoridad los solicita o el dossier los necesita, y preparación de muestras cuando aplique. Incluya también las horas de los equipos regulatorios, técnicos, de calidad, legales y comerciales. Ese tiempo interno afecta el costo real aunque no aparezca como una factura externa.

## Tiempos: del expediente al lanzamiento

El calendario del proyecto tiene varias partes: recopilación y armonización de documentos, traducción y formalización, preparación de la solicitud, radicación y evaluación, respuesta a requerimientos si los hay, y actividades de importación y preparación comercial. Cada etapa depende de la disponibilidad y calidad de la información, de la ruta regulatoria y de las respuestas necesarias. La evaluación de la autoridad y los tiempos de importación son factores externos; no es responsable fijar una fecha garantizada sin revisar el expediente y la operación completa.

## Errores que suelen encarecer o retrasar la ruta

Los problemas frecuentes incluyen clasificar el dispositivo sin documentar la finalidad prevista; elegir una ruta sin revisar si se trata de tecnología controlada; presentar modelos o nombres distintos entre documentos; dejar para el final las traducciones; usar certificados vencidos o que no corresponden al fabricante o producto; y definir tarde quién será titular o importador. También genera retrabajo asumir que CE o FDA cubren automáticamente todos los requisitos colombianos, o empezar importaciones comerciales antes de confirmar la autorización y las condiciones aplicables.

Un plan práctico empieza con una lista maestra de documentos y responsables, una matriz que vincule cada modelo con sus soportes, una revisión cruzada de nombres y usos, y un calendario con margen para resolver faltantes. Si la autoridad formula un requerimiento, coordine una única respuesta coherente con el fabricante, el titular y los especialistas involucrados.

## Cómo puede acompañar I-ME

En I-ME tenemos experiencia acompañando rutas regulatorias y de acceso al mercado para equipos biomédicos. Esa experiencia ayuda a detectar faltantes antes de radicar y a evitar reprocesos: el camino más corto empieza por preparar bien cada etapa. El trabajo comienza con un diagnóstico documental y comercial: revisamos marca y modelo, país de fabricación, uso previsto, certificados disponibles, rol de la empresa en Colombia y objetivo de lanzamiento. Con esa información podemos señalar brechas por resolver y organizar una ruta de trabajo adecuada al caso.

El acompañamiento puede incluir revisión de los soportes disponibles, coordinación de preguntas con el fabricante, identificación de documentos faltantes y una propuesta comercial con alcance definido. Cada dispositivo requiere análisis propio. La decisión y los tiempos de evaluación corresponden al INVIMA.

Para solicitar una evaluación inicial, [contacte al equipo de I-ME](/es/contacto) e incluya marca y modelo, país de fabricación, uso previsto, certificados disponibles y objetivo de lanzamiento en Colombia. Cuanto más concreta sea la información, más útil será la primera revisión.

## Si usted es comprador: verifique antes de adquirir

Si su organización compra el equipo, confirme que el registro o permiso corresponda al fabricante, modelo, titular, importador y uso ofrecidos. Revise el estado y vigencia en los canales oficiales del INVIMA, y compruebe que los accesorios, configuraciones y presentaciones estén cubiertos cuando aplique. Solicite manuales en castellano, documentos de soporte técnico, garantía, instalación, capacitación y disponibilidad de repuestos. Un certificado internacional no acredita por sí mismo la autorización para comercializar el equipo en Colombia.

Use también el [checklist INVIMA para fabricantes y compradores de equipos médicos](/es/conocimiento/checklist-invima-compra-equipos-medicos/) para ordenar la revisión documental y las preguntas al proveedor.

## Preguntas frecuentes

### ¿Un fabricante extranjero puede solicitar el registro directamente?

La solicitud debe identificar al titular y los participantes con sus responsabilidades en Colombia. El fabricante internacional aporta la documentación técnica y legal de su establecimiento y del dispositivo. La configuración del titular, del importador y de sus poderes depende del caso; debe definirse antes de radicar.

### ¿Las clases I y IIa siempre quedan aprobadas automáticamente?

La ruta se denomina registro sanitario automático, pero requiere presentar la documentación exigida y cumplir las condiciones aplicables. Automático no significa exento de requisitos ni aprobación asegurada.

### ¿El marcado CE o FDA reemplaza el registro INVIMA?

No. Puede formar parte de los antecedentes del dossier, pero no reemplaza la autorización exigida en Colombia ni las obligaciones locales.

### ¿Cuánto cuesta y cuánto tarda?

La tasa depende del trámite y de la tarifa vigente. Traducciones, formalizaciones, estudios y trabajo interno agregan costos variables. El tiempo depende de la preparación, la ruta, la evaluación, los requerimientos y la importación; se estima después de revisar el caso, sin garantía de fecha.

### ¿Qué información compartir para pedir ayuda?

Envíe marca y modelo, país de fabricación, uso previsto, certificados disponibles y objetivo de lanzamiento. I-ME puede revisar la información y presentar una propuesta de acompañamiento con alcance comercial definido.$ime_invima$, $ime_invima$# INVIMA Registration for Medical Device Manufacturers: Requirements, Costs and Timelines

If you manufacture medical devices or biomedical equipment and want to sell them in Colombia, define the INVIMA route before setting a launch date. Product classification, intended purpose, technology, and each company’s role determine which authorization applies and which documents you need to prepare. An organized dossier helps you anticipate the work; it does not replace the authority’s review or guarantee a favorable decision.

This guide is for domestic and international manufacturers, product holders, importers, and teams preparing to enter the Colombian market. Start by checking your case against INVIMA’s [medical devices and biomedical equipment guidance](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos) and [Decree 4725 of 2005](https://normograma.invima.gov.co/compilacion/docs/decreto_4725_2005.htm).

## First, determine which authorization applies

Risk classification depends on the intended purpose and factors such as the duration and type of body contact, degree of invasiveness, and potential impact of a failure. The manufacturer must support the classification by applying the current rules. In general, Class I and IIa devices follow an automatic sanitary registration route, provided the application meets the documentary requirements. Class IIb and III devices require technical and legal evaluation by INVIMA.

Some biomedical equipment classified as controlled technology may require a commercialization permit instead of an ordinary registration. Risk class alone therefore does not settle the route. Review the product’s features, intended use, and whether it falls within a controlled-technology category or a special regime.

The registration modality also depends on the activity carried out in Colombia. Manufacturing, importing, marketing, and acting as the product holder are distinct functions and should be reflected consistently in the application. If the product is made abroad, the international manufacturer supplies product and quality-system evidence; the holder and importer must be identified, and the Colombian operation must meet the conditions applicable to each role. Confirm the specific arrangement before preparing powers of attorney, contracts, or labels.

## Clarify the roles of holder, manufacturer, and importer

The manufacturer is responsible for the device’s technical evidence, manufacturing process, quality, safety, performance, and instructions for use. The product holder is the natural or legal person in whose name the application is filed and who is associated with the registration; it assumes regulatory responsibilities in Colombia within the authorized scope. The importer enables the product’s entry into the country and must be correctly identified in documents and labeling where applicable. One company may perform more than one role, but do not assume that without checking the requirements.

Before moving ahead, agree with the manufacturer on who will be the holder, who will import, who will retain the master documents, and who will manage changes, complaints, and alerts. Also review the storage and conditioning requirements that apply to the importer. Where required, the importer’s storage and conditioning capacity certificate (CCAA) and establishment information must align with the dossier. Domestic manufacturers should review the sanitary requirements applicable to their facility and activity.

## What to prepare for the technical and legal dossier

The exact content depends on the device and route, but it is useful to gather the following from the start:

- Identification of the manufacturer, holder, and, where applicable, importer; legal existence, representation, and authorizations to act.
- Device description, intended purpose, models, references, and configurations; supported risk classification and requested modality.
- Quality-system information and evidence of the manufacturing facility’s conditions, as applicable.
- Manufacturer’s declaration, specifications, performance, production process, and available analytical checks or technical studies.
- Risk management, applicable standards, and safety and performance evidence. The need for clinical evidence or other studies depends on the class, intended purpose, and product features.
- Labels, inserts, and manuals that are consistent with the device. Information for Colombia should account for Spanish; for biomedical equipment, confirm whether Spanish operation and maintenance manuals are required.
- Marketing history in other countries, useful life, sterilization, final disposal, and traceability documents where applicable.

Manufacturer documents often arrive in another language. Identify early which documents need translation into Spanish and whether authentication, legalization, or apostille formalities apply. Keep the trade name, models, intended purpose, manufacturer, and presentations consistent across certificates, forms, labels, and contracts. A small discrepancy can lead to a request for clarification or force the dossier to be reorganized.

CE marking, FDA authorization, or a free-sale certificate may be useful supporting evidence, but none by itself replaces the Colombian process. INVIMA applies the national framework and reviews the evidence required for the application. Do not assume an international document removes local requirements for holder status, importing, language, or sanitary conditions.

## Costs: separate official fees from other resources

The budget should distinguish expenses that are often grouped together. Official INVIMA fees correspond to the applicable procedure and should be checked in the current [official fee schedule](https://www.invima.gov.co/tramites-y-servicios/tarifas). The Institute published 2026 updates, including a change in September. Confirm the current fee and code when you file, since they may change.

In addition to the official fee, consider translation, authentication or legalization, legal preparation and review, label and manual updates, document management with the manufacturer, and additional testing or analyses if requested by the authority or needed for the dossier. Include sample preparation where applicable. Account for the time of regulatory, technical, quality, legal, and commercial teams as well. Internal staff time affects the real project cost even when it does not appear on an external invoice.

## Timelines: from dossier preparation to launch

The project calendar has several parts: collecting and harmonizing documents, translation and formalization, application preparation, filing and evaluation, responding to any requests, and import and commercial-readiness activities. Each stage depends on information availability and quality, the regulatory route, and any required responses. Authority review and import timing are external factors; it would be irresponsible to promise a date without reviewing the full dossier and operation.

## Common mistakes that add cost or delay

Frequent issues include classifying the device without documenting its intended purpose; selecting a route without checking whether controlled technology rules apply; using different models or names across documents; leaving translations until the end; relying on expired certificates or certificates that do not match the manufacturer or product; and deciding late who will be the holder or importer. Rework also follows from assuming CE or FDA automatically covers Colombian requirements, or beginning commercial imports before confirming the authorization and applicable conditions.

A practical plan starts with a master document list and named owners, a matrix linking each model to its supporting evidence, a cross-check of names and intended uses, and a schedule with room to resolve gaps. If the authority issues a request, coordinate one consistent response with the manufacturer, holder, and specialists involved.

## How I-ME can support your project

I-ME has experience supporting regulatory and market-access routes for biomedical equipment. That experience helps identify gaps before filing and avoid rework: the shortest path starts with preparing each stage properly. The work begins with a document and commercial assessment: we review the brand and model, country of manufacture, intended use, available certificates, the company’s role in Colombia, and the launch objective. With that information, we can identify gaps to address and organize a work route suited to the case.

Support may include reviewing available evidence, coordinating questions with the manufacturer, identifying missing documents, and providing a commercial proposal with a defined scope. Each device requires its own analysis. INVIMA remains responsible for the decision and review times.

To request an initial assessment, [contact the I-ME team](/en/contact) and include the brand and model, country of manufacture, intended use, available certificates, and launch objective in Colombia. More specific information makes the first review more useful.

## For buyers: verify before purchasing

If your organization is buying the equipment, confirm that the registration or permit matches the manufacturer, model, holder, importer, and intended use being offered. Check its status and validity through INVIMA’s official channels, and confirm that accessories, configurations, and presentations are covered where applicable. Request Spanish manuals, technical-support documents, warranty, installation, training, and spare-parts availability. An international certificate alone does not establish authorization to market equipment in Colombia.

Use the [INVIMA checklist for medical equipment manufacturers and buyers](/en/knowledge/checklist-invima-compra-equipos-medicos/) to organize your document review and questions for the supplier.

## Frequently asked questions

### Can a foreign manufacturer apply for registration directly?

The application must identify the holder and participants along with their responsibilities in Colombia. The international manufacturer provides technical and legal documents about its facility and device. The holder, importer, and authorization structure depend on the case and should be defined before filing.

### Are Class I and IIa devices always automatically approved?

The route is called automatic sanitary registration, but applicants must submit the required documents and meet applicable conditions. “Automatic” does not mean requirements are waived or approval is assured.

### Does CE marking or FDA authorization replace INVIMA registration?

No. It may form part of the dossier’s supporting evidence, but it does not replace the authorization required in Colombia or local obligations.

### How much does it cost and how long does it take?

The official fee depends on the procedure and current schedule. Translation, formalization, studies, and internal work add variable costs. Timing depends on preparation, route, review, requests, and importation; it can be estimated after reviewing the case, without a guaranteed date.

### What should I share to request support?

Send the brand and model, country of manufacture, intended use, available certificates, and launch objective. I-ME can review the information and provide a support proposal with a defined commercial scope.$ime_invima$, ARRAY[$ime_invima$pilar$ime_invima$, $ime_invima$registro-sanitario$ime_invima$, $ime_invima$fabricantes$ime_invima$, $ime_invima$equipos-biomedicos$ime_invima$]::text[]),
  ($ime_invima$checklist-invima-compra-equipos-medicos$ime_invima$, $ime_invima$Checklist INVIMA para fabricantes de equipos médicos: documentos, costos y tiempos para Colombia$ime_invima$, $ime_invima$INVIMA checklist for medical equipment manufacturers: documents, costs and timelines for Colombia$ime_invima$, $ime_invima$# Checklist INVIMA para fabricantes de equipos médicos que quieren entrar a Colombia

Preparar un equipo médico para Colombia exige definir la autorización aplicable, reunir evidencia técnica y legal, y coordinar al fabricante con el titular o importador local. La ruta depende del producto, su riesgo, tecnología y actividad; esta lista es orientativa y no sustituye una evaluación regulatoria.

## Antes de iniciar: delimite el producto y la ruta

- [ ] **Uso previsto:** describa finalidad, usuarios, población, entorno, contraindicaciones y advertencias. Alinee etiquetas, manuales, evidencia y materiales comerciales.
- [ ] **Referencias y configuración:** cierre modelos, códigos, accesorios y componentes. Para familias, kits o sistemas, documente cómo se relacionan y qué variantes pretende incluir.
- [ ] **Clasificación y actividad:** determine la clase de riesgo y aclare si planea fabricar, importar, comercializar, almacenar o acondicionar. Los dispositivos I y IIa pueden tener registro automático cuando aplique; los IIb y III requieren la evaluación prevista. Algunos equipos de tecnología controlada, incluidos ciertos usados o repotenciados, pueden requerir permiso de comercialización. Confirme la ruta con INVIMA. Un marcado CE o una autorización FDA pueden servir de soporte, pero no sustituyen la autorización colombiana que corresponda.

## Expediente técnico y legal que conviene preparar

- [ ] **Descripción del producto:** reúna fichas consistentes sobre uso, componentes, funcionamiento, fabricación, empaque, almacenamiento, vida útil y disposición final, según aplique. Identifique fabricante legal, planta y maquiladores.
- [ ] **Seguridad y desempeño:** organice estudios técnicos, ensayos, normas, análisis de riesgos y evidencia científica. Biocompatibilidad, esterilización, estabilidad y estudios clínicos aplican según diseño, materiales, uso y clase.
- [ ] **Calidad y fabricación:** reúna controles de producción, liberación y calidad, junto con la certificación o concepto sanitario aplicable a cada fabricante y proceso. Revise requisitos si hay esterilización tercerizada o acondicionamiento en otras sedes.
- [ ] **Soportes de origen:** para productos importados, confirme el certificado de venta libre u otro soporte exigido y que liste nombres y referencias. Prepare la autorización del fabricante al importador o titular colombiano y los documentos legales correspondientes. Un certificado de exportación no necesariamente reemplaza uno de venta libre.
- [ ] **Idioma y formalidades:** prepare versiones en castellano y confirme qué documentos requieren traducción oficial, apostilla o legalización según su tipo y origen.
- [ ] **Etiquetas y manuales:** prepare artes e instrucciones en castellano con los datos exigibles. Para equipos biomédicos, tenga manuales de operación y mantenimiento en castellano y la declaración correspondiente. Compruebe que nombres y modelos coincidan en el expediente.

## Roles locales, presupuesto y calendario

- [ ] **Defina roles locales:** acuerde solicitante o titular, importador y responsable de obligaciones posteriores. Si el importador almacena o acondiciona, revise si necesita Certificado de Capacidad de Almacenamiento y Acondicionamiento (CCAA). El fabricante debe verificar la certificación o concepto sanitario aplicable.
- [ ] **Presupueste el proceso:** consulte el manual tarifario vigente del INVIMA y añada estudios, traducciones, formalidades, apoyo regulatorio, ajustes de etiquetas y manuales, certificaciones y horas internas. La tarifa oficial no cubre por sí sola todo el costo de preparación.
- [ ] **Construya un calendario por hitos:** incluya clasificación y roles, documentos, ensayos, traducciones, preparación, radicación y respuestas a requerimientos. Los términos oficiales no incluyen necesariamente la preparación ni garantizan una fecha de autorización. Confirme términos y tarifas al presentar.
- [ ] **Revise consistencia antes de radicar:** compare nombre, referencias, fabricante, uso previsto y titular en formularios, certificados, ensayos, etiquetas y manuales. Asigne un responsable, registre versiones y deje identificados documentos pendientes y supuestos del presupuesto.

## Checklist breve para quien compra

Antes de comprar, pida el número de registro o permiso por modelo y verifique en la [consulta pública del INVIMA](https://www.invima.gov.co/consulta-registros-sanitarios) su estado, vigencia, titular, fabricante, importador y referencias. Confirme que la oferta coincide con el modelo autorizado y solicite etiquetas y manuales en castellano. Aclare si el equipo es nuevo, usado o repotenciado. Si algo difiere, pida una explicación antes de firmar. Consulte la [guía sobre registro sanitario INVIMA de equipos biomédicos](/es/conocimiento/registro-sanitario-invima-equipos-biomedicos).

## ¿Qué información ayuda a estimar el proyecto?

Con la experiencia de I-ME, podemos buscar el camino más corto evitando reprocesos y sin saltarnos requisitos, y preparar una propuesta de alcance, presupuesto y cronograma. Comparta marca, modelos, país de fabricación, uso previsto, clase de riesgo si está definida, actividad en Colombia, documentos disponibles y objetivo comercial. [Hable con el equipo de I-ME](/es/contacto).

## Preguntas frecuentes

### ¿Un fabricante extranjero puede ser titular del registro en Colombia?

Depende de la modalidad y los documentos del caso. Defina estos roles con el socio colombiano y confirme requisitos antes de preparar autorizaciones.

### ¿Las clases I y IIa siempre se resuelven automáticamente?

INVIMA contempla esa ruta para productos I y IIa que cumplan las condiciones aplicables. Tecnología controlada, actividad y requisitos documentales pueden cambiarla; verifique el caso concreto.

### ¿Cuánto cuestan y cuánto tardan el registro y la preparación?

No hay una cifra o duración única. Consulte el manual tarifario y calcule aparte documentos, estudios, traducciones, formalidades, certificaciones y coordinación local. El tiempo de evaluación no necesariamente incluye esas tareas ni garantiza una fecha de decisión.

## Fuentes oficiales

- INVIMA, [Dispositivos médicos y equipos biomédicos](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos).
- INVIMA, [Tarifas y manual tarifario](https://www.invima.gov.co/tramites-y-servicios/tarifas).
- Decreto 4725 de 2005, [compilación jurídica del INVIMA](https://normograma.invima.gov.co/compilacion/docs/decreto_4725_2005.htm).$ime_invima$, $ime_invima$# INVIMA checklist for medical equipment manufacturers entering Colombia

Preparing medical equipment for Colombia means identifying the applicable authorization, assembling technical and legal evidence, and coordinating the manufacturer with the local holder or importer. This checklist helps identify gaps before applying for a sanitary registration or marketing permit. The route depends on the product, its risk classification, technology and intended activity. This is general information and does not replace a regulatory assessment of a specific case.

## Before you start: define the product and route

- [ ] **Intended use and indications:** describe what the product was designed to do, its users, population, setting, contraindications and warnings. Align this definition across labels, manuals, evidence and promotional materials.
- [ ] **References and configuration:** finalize the list of models, references, codes, accessories and components. If items will be marketed as a family, kit or system, document how they relate and which variants are intended to be covered.
- [ ] **Classification and activity:** determine the risk class and clarify whether you plan to manufacture, import, market, store or condition the device. Class I and IIa devices may follow an automatic registration route where applicable; class IIb and III devices require the prescribed evaluation. Some controlled-technology equipment, including certain used or refurbished equipment, may require a marketing permit. Confirm the route with INVIMA. A CE mark or FDA authorization may support the file, but does not replace the applicable Colombian authorization.

## Technical and legal file to prepare

- [ ] **Controlled product description:** gather technical specifications and descriptions consistent with intended use, components, operating principle, manufacturing, packaging, storage, useful life and final disposal, as applicable. Identify the legal manufacturer, manufacturing site and any other manufacturers or contract manufacturers involved.
- [ ] **Safety and performance:** organize technical studies, analytical checks, tests and standards supporting the product. Include risk analysis and scientific evidence; biocompatibility, sterilization, stability or clinical studies apply depending on design, materials, use and class. Do not treat a test that does not apply to the product as universally required.
- [ ] **Quality and manufacturing:** make production, release and quality control records available, along with the certification or sanitary assessment applicable to each manufacturer and process. Check specific requirements if sterilization is outsourced or conditioning or other operations take place at another site.
- [ ] **Country-of-origin documents:** for imported products, confirm which free-sale certificate or other evidence is required for the specific route and ensure it lists the names and references to be included in the application. Prepare the manufacturer's authorization for the Colombian importer or holder and the applicable corporate existence and representation documents. An export certificate does not necessarily replace a free-sale certificate.
- [ ] **Language and formalities:** keep the manufacturer's source documents and Spanish versions. Check whether each document needs an official translation, apostille or legalization; this depends on the document type and origin. Confirm the applicable list before starting translations or authentications.
- [ ] **Labels and manuals:** prepare label artwork, inserts and instructions in Spanish, with product identification and the information required for the requested presentation. For biomedical equipment, prepare Spanish operating and maintenance manuals and the relevant declaration. Check that model names and references match throughout the file.

## Local roles, budget and timeline

- [ ] **Define who does what in Colombia:** agree on the applicant and holder, importer and party responsible for post-market obligations. If the importer will store or condition devices, check whether it needs a Storage and Conditioning Capacity Certificate (CCAA); requirements depend on activities and establishments. Manufacturers should also verify the sanitary certification or assessment applicable to them.
- [ ] **Budget the full process:** consult INVIMA's current fee manual for the application fee. Separately account for translations, apostilles or legalizations where required, outstanding tests or studies, regulatory support, label and manual updates, establishment certifications and internal staff time. The official fee alone does not represent the full cost of preparing the file.
- [ ] **Build a milestone-based calendar:** include classification and roles, documents, tests, translations, preparation, filing and responses to requests. Official terms may not include preparation or guarantee an authorization date. Confirm terms and fees when filing.
- [ ] **Check consistency before filing:** compare product name, references, manufacturer, intended use and holder across forms, certificates, tests, labels and manuals. Assign an owner, track versions and list outstanding documents and budget assumptions.

## Short checklist for buyers

Before approving a purchase, request the registration or permit number for each model and check its status, validity, holder, manufacturer, importer and covered references in the [INVIMA public database](https://www.invima.gov.co/consulta-registros-sanitarios). Confirm the offer matches the authorized model and request Spanish labels and manuals. Clarify whether equipment is new, used or refurbished. If anything differs, request an explanation before signing. See the [guide to INVIMA sanitary registration for biomedical equipment](/en/knowledge/registro-sanitario-invima-equipos-biomedicos).

## What information helps estimate the project?

With I-ME's experience, we can find the shortest path while avoiding rework and meeting all requirements, then prepare a proposal covering scope, budget and schedule. Share the brand, models, country of manufacture, intended use, risk class if known, planned activity in Colombia, available documents and commercial objective. [Contact the I-ME team](/en/contact).

## Frequently asked questions

### Can a foreign manufacturer hold the registration in Colombia?

The holder, applicant and authorization of a local importer depend on the route and the documents in the case. Define these roles with your Colombian partner and confirm the applicable requirements before preparing powers of attorney or authorizations.

### Are class I and IIa applications always automatic?

INVIMA provides an automatic registration route for class I and IIa products that meet the applicable conditions. Class alone does not answer every question: controlled technology, activity, product type and documentary requirements may change the route. Verify the specific case.

### How much do registration and preparation cost, and how long do they take?

There is no single cost or duration for every product. Check the current fee manual and separately estimate document preparation, studies, translations, formalities, certifications and local coordination. Review time does not necessarily include these activities or guarantee a decision by a specific date.

## Official sources

- INVIMA, [Medical devices and biomedical equipment](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/dispositivos-medicos-equipos-biomedicos).
- INVIMA, [Fees and fee manual](https://www.invima.gov.co/tramites-y-servicios/tarifas).
- Decree 4725 of 2005, [INVIMA legal compilation](https://normograma.invima.gov.co/compilacion/docs/decreto_4725_2005.htm).$ime_invima$, ARRAY[$ime_invima$checklist$ime_invima$, $ime_invima$registro-sanitario$ime_invima$, $ime_invima$fabricantes$ime_invima$]::text[])
) AS nuevo(slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, tags)
JOIN public.topic_clusters tema ON tema.slug = 'invima-regulacion'
ON CONFLICT (slug) DO UPDATE SET
  titulo_es = EXCLUDED.titulo_es,
  titulo_en = EXCLUDED.titulo_en,
  cuerpo_es = EXCLUDED.cuerpo_es,
  cuerpo_en = EXCLUDED.cuerpo_en,
  publicado = EXCLUDED.publicado,
  cluster_id = EXCLUDED.cluster_id,
  tags = ARRAY(SELECT DISTINCT tag FROM unnest(COALESCE(actual.tags, ARRAY[]::text[]) || EXCLUDED.tags) AS tag ORDER BY tag),
  embedding = NULL,
  updated_at = now()
WHERE (actual.titulo_es, actual.titulo_en, actual.cuerpo_es, actual.cuerpo_en, actual.publicado, actual.cluster_id)
  IS DISTINCT FROM
      (EXCLUDED.titulo_es, EXCLUDED.titulo_en, EXCLUDED.cuerpo_es, EXCLUDED.cuerpo_en, EXCLUDED.publicado, EXCLUDED.cluster_id)
   OR NOT (COALESCE(actual.tags, ARRAY[]::text[]) @> EXCLUDED.tags);

COMMIT;
