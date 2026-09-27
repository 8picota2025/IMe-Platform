-- Fase 2 (Knowledge Hub): publica los artículos del cluster INVIMA /
-- regulación revisados en el preview local (sin contenido de clases de
-- riesgo, decisión del 2026-09-23). Generado desde
-- src/data/conocimiento-borradores/*.md; cada afirmación cita su norma.
--
-- ON CONFLICT (slug) DO NOTHING: si el slug ya existe (p. ej. creado desde el
-- CMS), no se pisa. Tras aplicar, regenerar embeddings del asesor:
-- npm run reindex:voyage:articles.

INSERT INTO articulos (slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, publicado, autor_tipo, cluster_id, tags)
SELECT nuevo.slug, nuevo.titulo_es, nuevo.titulo_en, nuevo.cuerpo_es, nuevo.cuerpo_en, true, 'ime', tc.id, nuevo.tags
FROM (
  VALUES
  ($ime_art$checklist-invima-compra-equipos-medicos$ime_art$, $ime_art$Checklist INVIMA antes de comprar un equipo médico en Colombia$ime_art$, $ime_art$INVIMA checklist before buying medical equipment in Colombia$ime_art$,
   $ime_art$# Para qué sirve este checklist

Es la versión de bolsillo de la [guía sobre el registro sanitario INVIMA](/es/conocimiento/registro-sanitario-invima-equipos-biomedicos): lo que compras o ingeniería biomédica deben pedir y comprobar en cada etapa de la compra de un equipo biomédico, con la norma que lo respalda.

> Orientación para el comprador; no reemplaza una asesoría regulatoria. Normas revisadas en septiembre de 2026.

## Al pedir la cotización

- [ ] **Número de registro sanitario o de permiso de comercialización de cada modelo**, por escrito. Lo exige el Decreto 4725 de 2005 (artículo 16) para importar y comercializar el equipo.
- [ ] **Nombre del titular del registro y del importador.** El registro es una autorización a nombre de una empresa (artículo 2).
- [ ] **Si el proveedor importa el equipo, su Certificado de Capacidad de Almacenamiento y Acondicionamiento (CCAA).** Lo expide el INVIMA a los importadores y comercializadores que almacenan y/o acondicionan dispositivos médicos (Resolución 4002 de 2007) y tiene una vigencia de 5 años (Decreto 4725, artículo 15). Un comercializador que no importa y solo almacena y distribuye no lo requiere.

## Al comparar ofertas

- [ ] **Registro verificado en la [consulta pública del INVIMA](https://www.invima.gov.co/consulta-registros-sanitarios)** (Consulta avanzada): estado, vigencia, titular, importador y fabricante coinciden con la oferta.
- [ ] **El modelo o la referencia cotizada aparece amparada** en ese registro. Un registro puede cubrir varios modelos del mismo titular y fabricante (artículo 28), pero no cualquier modelo de la marca.
- [ ] **Fecha de vencimiento del registro.** La vigencia es de 10 años (artículo 31). Si vence durante el contrato, pregunte si la renovación está radicada: debe presentarse tres meses antes y conserva el número con el sufijo R1, R2… (artículo 32).
- [ ] **Equipo nuevo, usado o repotenciado, por escrito.** Los usados y repotenciados se amparan con permiso de comercialización y tienen reglas propias en el Decreto 4725 (artículo 37).

## Al recibir el equipo

- [ ] **Etiqueta en castellano** con el nombre del producto, el lote o la serie, la fecha de expiración cuando aplique, **el número de registro sanitario o permiso** y el fabricante y/o importador con su domicilio (artículo 54). En equipos importados, también el nombre y la dirección del importador o del representante del fabricante (artículo 55).
- [ ] **Manuales de operación y mantenimiento en castellano.** El titular o importador se compromete ante el INVIMA a entregarlos al momento de la adquisición (artículo 18, literal h).
- [ ] **Número de serie anotado** junto con la fecha de adquisición y el proveedor. Son datos que el importador o comercializador también debe conservar para la trazabilidad (artículo 63).

## Después de la compra

- [ ] **Equipo incluido en el programa institucional de tecnovigilancia**, con su responsable. Lo exige la Resolución 4816 de 2008 (artículos 9 y 10) a los prestadores de servicios de salud.
- [ ] **Canal de reporte claro.** Los eventos e incidentes adversos serios se reportan al INVIMA dentro de las 72 horas siguientes (artículo 15) y los no serios, en reportes trimestrales consolidados (artículo 16).
- [ ] **Plan para cuando venza el registro.** Según las preguntas frecuentes del INVIMA, si el equipo se vendió antes del vencimiento de su registro o permiso, quien lo adquirió puede seguir usándolo siempre que garantice servicios como la verificación de calibración y el mantenimiento. Déjelo previsto en el contrato de soporte.

## ¿Algo no coincide?

Pida la explicación por escrito antes de firmar. Si quiere que revisemos la documentación de un equipo con usted, [hable con un asesor de I-ME](/es/contacto).

## Fuentes

- Decreto 4725 de 2005 (modificado por el Decreto 582 de 2017) — [texto en el INVIMA](https://www.invima.gov.co/biblioteca/decreto-4725-2005-registros-sanitarios-dispositivos-medicos).
- Resolución 4002 de 2007, capacidad de almacenamiento y acondicionamiento — [compilación del INVIMA](https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_4002_2007.htm).
- Resolución 4816 de 2008, Programa Nacional de Tecnovigilancia — [compilación del INVIMA](https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_4816_2008.htm).
- INVIMA, [preguntas frecuentes sobre dispositivos médicos](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/preguntas-frecuentes-dispositivos).$ime_art$,
   $ime_art$# What this checklist is for

It is the pocket version of the [guide to INVIMA sanitary registration](/en/knowledge/registro-sanitario-invima-equipos-biomedicos): what procurement or clinical engineering should ask for and check at each stage of buying biomedical equipment, with the regulation behind each item.

> Guidance for buyers; it does not replace regulatory advice. Regulations reviewed in September 2026.

## When requesting the quote

- [ ] **Sanitary registration or marketing permit number for each model**, in writing. Decree 4725 of 2005 (Article 16) requires it to import and sell the equipment.
- [ ] **Names of the registration holder and the importer.** The registration is an authorization in a company's name (Article 2).
- [ ] **If the supplier imports the equipment, its Storage and Conditioning Capacity Certificate (CCAA).** INVIMA issues it to importers and distributors that store and/or condition medical devices (Resolution 4002 of 2007), and it is valid for 5 years (Decree 4725, Article 15). A distributor that does not import and only stores and distributes does not need it.

## When comparing offers

- [ ] **Registration checked in [INVIMA's public database](https://www.invima.gov.co/consulta-registros-sanitarios)** (Consulta avanzada): status, validity, holder, importer and manufacturer match the offer.
- [ ] **The quoted model or reference is listed** under that registration. One registration can cover several models from the same holder and manufacturer (Article 28), but not every model of the brand.
- [ ] **Registration expiry date.** Validity is 10 years (Article 31). If it expires during the contract, ask whether the renewal has been filed: it must be filed three months before expiry and keeps the number with the suffix R1, R2… (Article 32).
- [ ] **New, used or refurbished equipment, stated in writing.** Used and refurbished equipment is covered by a marketing permit and has its own rules in Decree 4725 (Article 37).

## When receiving the equipment

- [ ] **Spanish label** with the product name, lot or serial number, expiry date where applicable, **the registration or permit number** and the manufacturer and/or importer with their address (Article 54). For imported equipment, also the name and address of the importer or the manufacturer's representative (Article 55).
- [ ] **Operating and maintenance manuals in Spanish.** The holder or importer commits to INVIMA to deliver them at the time of purchase (Article 18, item h).
- [ ] **Serial number recorded** together with the purchase date and supplier. The importer or distributor must also keep these data for traceability (Article 63).

## After the purchase

- [ ] **Equipment added to the institutional technovigilance program**, with its designated lead. Resolution 4816 of 2008 (Articles 9 and 10) requires it of healthcare providers.
- [ ] **A clear reporting channel.** Serious adverse events and incidents are reported to INVIMA within 72 hours (Article 15); non-serious ones, in consolidated quarterly reports (Article 16).
- [ ] **A plan for when the registration expires.** According to INVIMA's FAQ, if the equipment was sold before its registration or permit expired, the buyer may keep using it provided services such as calibration verification and maintenance are guaranteed. Build this into the support contract.

## Something doesn't match?

Ask for a written explanation before signing. If you would like us to review a device's documentation with you, [talk to an I-ME advisor](/en/contact).

## Sources

- Decree 4725 of 2005 (amended by Decree 582 of 2017) — [text on INVIMA's site](https://www.invima.gov.co/biblioteca/decreto-4725-2005-registros-sanitarios-dispositivos-medicos).
- Resolution 4002 of 2007, storage and conditioning capacity — [INVIMA compilation](https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_4002_2007.htm).
- Resolution 4816 of 2008, National Technovigilance Program — [INVIMA compilation](https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_4816_2008.htm).
- INVIMA, [medical devices FAQ](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/preguntas-frecuentes-dispositivos).$ime_art$,
   $ime_art$invima-regulacion$ime_art$, ARRAY['checklist', 'registro-sanitario']::text[]),
  ($ime_art$registro-sanitario-invima-equipos-biomedicos$ime_art$, $ime_art$Registro sanitario INVIMA de equipos biomédicos: qué es y cómo verificarlo antes de comprar$ime_art$, $ime_art$INVIMA sanitary registration for biomedical equipment: what it is and how to verify it before buying$ime_art$,
   $ime_art$# Por qué importa antes de firmar

En Colombia, un equipo biomédico no se puede importar ni vender legalmente sin la autorización sanitaria que expide el **INVIMA** (Instituto Nacional de Vigilancia de Medicamentos y Alimentos). Para quien compra, esa autorización es el primer filtro: si no existe, está vencida o no cubre el modelo que le cotizan, el resto de la evaluación técnica sobra.

Esta guía explica qué es el registro sanitario, cuánto dura y cómo comprobarlo usted mismo en la consulta pública del INVIMA. Cita la norma en cada punto para que su equipo de compras o de ingeniería biomédica pueda verificarla.

> Esta guía orienta al comprador y no reemplaza una asesoría regulatoria. Normas revisadas en septiembre de 2026; confirme siempre la información vigente en el INVIMA.

## 1. Qué es el registro sanitario

El marco general es el **Decreto 4725 de 2005** del Ministerio de la Protección Social, modificado por el Decreto 582 de 2017. Su artículo 2 define el registro sanitario como el documento público que expide el INVIMA, tras verificar los requisitos técnico-legales y sanitarios, y que **faculta a una persona natural o jurídica para producir, comercializar, importar, exportar, envasar, procesar, expender y/o almacenar un dispositivo médico**.

Dos consecuencias prácticas:

- **El registro tiene un titular.** Es una autorización a nombre de una empresa, no una cualidad del equipo. Compruebe quién es el titular y quién el importador.
- **Un registro puede amparar varios modelos.** El artículo 28 permite agrupar bajo un mismo registro dispositivos del mismo titular y fabricante con diferencias menores o que funcionan como un sistema. Por eso no basta con que la marca "tenga INVIMA": el modelo o la referencia que le cotizan debe aparecer amparado.

## 2. Quién lo necesita

Según el artículo 16 del Decreto 4725, los dispositivos médicos y equipos biomédicos requieren registro sanitario para su producción, importación, exportación, almacenamiento, expendio y comercialización.

Algunos equipos que el decreto llama **"de tecnología controlada"** (entre otros, los equipos usados o repotenciados) se amparan con un **permiso de comercialización** en lugar de registro sanitario. También lo expide el INVIMA y se verifica de la misma forma.

## 3. Cuánto dura y cómo se renueva

- **Vigencia:** 10 años desde su expedición (artículo 31 del Decreto 4725; el INVIMA lo confirma en sus preguntas frecuentes).
- **Renovación:** conserva el mismo número seguido de la letra **R** y un consecutivo (R1, R2…). La solicitud debe radicarse **tres meses antes** del vencimiento; si se presenta tarde, se tramita como solicitud nueva (artículo 32).

Si ve un número con sufijo R, el registro fue renovado al menos una vez. Si la fecha de vencimiento cae dentro del plazo de su contrato, pregunte al proveedor si la renovación ya está radicada.

## 4. Cómo verificarlo en la consulta del INVIMA

1. Pida al proveedor **el número de registro sanitario o de permiso de comercialización de cada modelo** cotizado, por escrito.
2. Entre a la consulta pública del INVIMA: [invima.gov.co/consulta-registros-sanitarios](https://www.invima.gov.co/consulta-registros-sanitarios) y use la **Consulta avanzada**.
3. Busque por número de registro o por nombre del producto.
4. Compare con la cotización el **estado y la vigencia** del registro, el **titular** y el **importador**, el **fabricante** y los **modelos o referencias amparados**: el modelo cotizado debe estar en la lista.

Si algo no coincide, pida la explicación por escrito antes de avanzar.

## 5. Qué debe traer el equipo

**En la etiqueta.** El artículo 54 exige que la etiqueta lleve, como mínimo y **en castellano**: nombre del producto, número de lote o serie, fecha de expiración cuando aplique, **número del registro sanitario o permiso de comercialización**, y fabricante y/o importador con su domicilio. Para dispositivos importados, el artículo 55 pide además el nombre y la dirección del importador o del representante autorizado del fabricante.

**Los manuales.** Para equipos biomédicos, el titular o importador debe declarar ante el INVIMA que tiene manuales de operación y mantenimiento **en castellano** y comprometerse a **entregarlos al momento de la adquisición** (artículo 18, literal h). Exíjalos en la entrega.

## 6. Después de la compra: trazabilidad y tecnovigilancia

- **Trazabilidad.** Quien importa o comercializa dispositivos médicos debe conservar, como mínimo, el nombre comercial, el modelo, la serie o el lote, la fecha de adquisición, la fecha de envío y la identificación del primer cliente (artículo 63). Registre esos mismos datos en su inventario.
- **Tecnovigilancia.** La **Resolución 4816 de 2008** reglamenta el Programa Nacional de Tecnovigilancia. Los prestadores de servicios de salud deben tener un **programa institucional de tecnovigilancia** con un profesional responsable (artículos 9 y 10). Los **eventos e incidentes adversos serios** se reportan al INVIMA dentro de las **72 horas** siguientes (artículo 15) y los no serios, en reportes trimestrales consolidados (artículo 16). Incluya cada equipo nuevo en ese programa desde el primer día.

## Resumen para compras

| Verifique                                           | Dónde                       | Norma                 |
| --------------------------------------------------- | --------------------------- | --------------------- |
| Número de registro o permiso por modelo             | Cotización del proveedor    | Decreto 4725, art. 16 |
| Vigencia y modelo amparado                          | Consulta pública del INVIMA | Arts. 28 y 31         |
| Titular, importador y fabricante                    | Consulta pública del INVIMA | Art. 2                |
| Etiqueta en castellano con número de registro       | Equipo recibido             | Arts. 54 y 55         |
| Manuales de operación y mantenimiento en castellano | Entrega del equipo          | Art. 18, lit. h       |
| Inclusión en el programa de tecnovigilancia         | Institución                 | Res. 4816 de 2008     |

Para seguir, revise el [checklist INVIMA antes de comprar un equipo médico](/es/conocimiento/checklist-invima-compra-equipos-medicos). Si necesita apoyo para verificar la documentación de un equipo antes de comprarlo, [hable con un asesor de I-ME](/es/contacto).

## Fuentes

- Decreto 4725 de 2005, Ministerio de la Protección Social — [texto en el INVIMA](https://www.invima.gov.co/biblioteca/decreto-4725-2005-registros-sanitarios-dispositivos-medicos).
- Decreto 582 de 2017 (modifica los artículos 21 y 30 del Decreto 4725) — [texto en el INVIMA](https://www.invima.gov.co/invima_website/static/attachments/dispositivos_dispositivos_medicos_equipos_biomedicos/decreto_0582_2017.pdf).
- Resolución 4816 de 2008, Programa Nacional de Tecnovigilancia — [compilación del INVIMA](https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_4816_2008.htm).
- INVIMA, [preguntas frecuentes sobre dispositivos médicos](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/preguntas-frecuentes-dispositivos).
- INVIMA, [consulta de registros sanitarios](https://www.invima.gov.co/consulta-registros-sanitarios).$ime_art$,
   $ime_art$# Why it matters before you sign

In Colombia, biomedical equipment cannot be legally imported or sold without the sanitary authorization issued by **INVIMA**, the national food and drug regulator. For a buyer, that authorization is the first filter: if it does not exist, has expired or does not cover the model being quoted, the rest of the technical evaluation is moot.

This guide explains what a sanitary registration is, how long it lasts and how to check it yourself in INVIMA's public database. It cites the regulation at every step so your procurement or clinical engineering team can verify it.

> This guide is for buyers and does not replace regulatory advice. Regulations reviewed in September 2026; always confirm current information with INVIMA.

## 1. What a sanitary registration is

The general framework is **Decree 4725 of 2005** of the Ministry of Social Protection, amended by Decree 582 of 2017. Article 2 defines the sanitary registration as the public document issued by INVIMA, after verifying technical, legal and sanitary requirements, that **authorizes a person or company to produce, market, import, export, package, process, sell and/or store a medical device**.

Two practical consequences:

- **The registration has a holder.** It is an authorization in a company's name, not a property of the equipment. Check who the holder is and who the importer is.
- **One registration can cover several models.** Article 28 allows devices from the same holder and manufacturer with minor differences, or that work together as a system, to be covered by a single registration. So it is not enough for the brand to "have INVIMA": the model or reference you are quoted must be listed.

## 2. Who needs it

Under Article 16 of Decree 4725, medical devices and biomedical equipment require a sanitary registration to be produced, imported, exported, stored, sold and marketed.

Some equipment the decree calls **"controlled technology"** (including used or refurbished equipment) is covered by a **marketing permit** instead of a sanitary registration. INVIMA issues it too, and you verify it the same way.

## 3. How long it lasts and how it is renewed

- **Validity:** 10 years from issue (Article 31 of Decree 4725; INVIMA confirms it in its FAQ).
- **Renewal:** it keeps the same number followed by the letter **R** and a sequence number (R1, R2…). The renewal must be filed **three months before** expiry; if filed late, it is processed as a new application (Article 32).

A number ending in R means the registration has been renewed at least once. If the expiry date falls within your contract period, ask the supplier whether the renewal has already been filed.

## 4. How to verify it in INVIMA's database

1. Ask the supplier, in writing, for **the sanitary registration or marketing permit number of each quoted model**.
2. Go to INVIMA's public search: [invima.gov.co/consulta-registros-sanitarios](https://www.invima.gov.co/consulta-registros-sanitarios) and use **Consulta avanzada** (advanced search).
3. Search by registration number or product name.
4. Compare the quote against the registration's **status and validity**, its **holder** and **importer**, the **manufacturer** and the **covered models or references**: the quoted model must be listed.

If anything does not match, ask for a written explanation before moving forward.

## 5. What the equipment must come with

**On the label.** Article 54 requires the label to show, at a minimum and **in Spanish**: product name, lot or serial number, expiry date where applicable, **the sanitary registration or marketing permit number**, and the manufacturer and/or importer with their address. For imported devices, Article 55 also requires the name and address of the importer or the manufacturer's authorized representative.

**The manuals.** For biomedical equipment, the holder or importer must declare to INVIMA that it has operating and maintenance manuals **in Spanish** and commit to **delivering them when the equipment is purchased** (Article 18, item h). Require them at delivery.

## 6. After the purchase: traceability and technovigilance

- **Traceability.** Whoever imports or sells medical devices must keep, at a minimum, the trade name, model, serial or lot number, purchase date, shipping date and the identity of the first customer (Article 63). Record the same data in your inventory.
- **Technovigilance.** **Resolution 4816 of 2008** regulates Colombia's National Technovigilance Program (the monitoring of adverse events involving medical devices). Healthcare providers must run an **institutional technovigilance program** with a designated professional (Articles 9 and 10). **Serious adverse events and incidents** must be reported to INVIMA within **72 hours** (Article 15); non-serious ones, in consolidated quarterly reports (Article 16). Add every new piece of equipment to that program from day one.

## Summary for procurement

| Check                                        | Where                  | Regulation           |
| -------------------------------------------- | ---------------------- | -------------------- |
| Registration or permit number per model      | Supplier's quote       | Decree 4725, Art. 16 |
| Validity and covered model                   | INVIMA public database | Arts. 28 and 31      |
| Holder, importer and manufacturer            | INVIMA public database | Art. 2               |
| Spanish label with registration number       | Equipment on arrival   | Arts. 54 and 55      |
| Operating and maintenance manuals in Spanish | Equipment delivery     | Art. 18, item h      |
| Inclusion in the technovigilance program     | Your institution       | Res. 4816 of 2008    |

Next, see the [INVIMA checklist before buying medical equipment](/en/knowledge/checklist-invima-compra-equipos-medicos). If you need help checking a device's documentation before buying it, [talk to an I-ME advisor](/en/contact).

## Sources

- Decree 4725 of 2005, Ministry of Social Protection — [text on INVIMA's site](https://www.invima.gov.co/biblioteca/decreto-4725-2005-registros-sanitarios-dispositivos-medicos).
- Decree 582 of 2017 (amends Articles 21 and 30 of Decree 4725) — [text on INVIMA's site](https://www.invima.gov.co/invima_website/static/attachments/dispositivos_dispositivos_medicos_equipos_biomedicos/decreto_0582_2017.pdf).
- Resolution 4816 of 2008, National Technovigilance Program — [INVIMA compilation](https://normograma.invima.gov.co/compilacion/docs/resolucion_minproteccion_4816_2008.htm).
- INVIMA, [medical devices FAQ](https://www.invima.gov.co/productos-vigilados/dispositivos-medicos/preguntas-frecuentes-dispositivos).
- INVIMA, [sanitary registration search](https://www.invima.gov.co/consulta-registros-sanitarios).$ime_art$,
   $ime_art$invima-regulacion$ime_art$, ARRAY['pilar', 'registro-sanitario']::text[])
) AS nuevo(slug, titulo_es, titulo_en, cuerpo_es, cuerpo_en, tema_slug, tags)
JOIN topic_clusters tc ON tc.slug = nuevo.tema_slug
ON CONFLICT (slug) DO NOTHING;
