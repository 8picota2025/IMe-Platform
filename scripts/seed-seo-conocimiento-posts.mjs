#!/usr/bin/env node
/**
 * Seed Phase-4 conocimiento posts (ES+EN) into articulos.
 * Upsert by slug. Requires SUPABASE_SERVICE_ROLE_KEY + PUBLIC_SUPABASE_URL.
 *
 * Usage: node scripts/seed-seo-conocimiento-posts.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    })
);

const url = env.PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key);

const posts = [
  {
    slug: 'guia-monitores-multiparametricos-uci',
    titulo_es: 'Guía práctica: monitores multiparamétricos en UCI',
    titulo_en: 'Practical guide: multiparameter monitors in the ICU',
    cuerpo_es: `# Para qué sirve esta guía

Compras, ingeniería biomédica y liderazgo clínico suelen comparar monitores por lista de parámetros. En UCI el riesgo real es otro: **elegir un equipo que no encaja con el flujo de sala, la central, la capacitación ni el soporte documental**.

Esta guía orienta la decisión institucional sin inventar claims clínicos. Complementa la landing de [monitores](/es/familias/monitores/) y la ficha del [monitor multiparamétrico UCI avanzado](/es/productos/monitor-multiparametrico-uci-avanzado).

## 1. Defina el caso de uso antes del brochure

Responda por escrito:

1. ¿Adulto, pediátrico, neonatal o mixto?
2. ¿Camas fijas, transporte intra-hospitalario o ambos?
3. ¿Necesita integración a central / estación de enfermería?
4. ¿Qué parámetros son obligatorios en su protocolo (ECG, SpO₂, NIBP, IBP, EtCO₂, etc.)?
5. ¿Quién opera el equipo en cada turno y con qué capacitación?

> Sin caso de uso, la compra se reduce a marketing de catálogo.

## 2. Qué revisar en la evaluación técnica

| Criterio | Por qué importa |
| --- | --- |
| Parámetros y módulos reales | Evita pagar por capacidades que nadie usará |
| Alarmas y usabilidad en turno | Reduce fatiga y errores de configuración |
| Conectividad / central | Impacta flujo de enfermería y supervisión |
| Consumibles y sensores | Pesa en coste total de propiedad |
| Documentación y registro aplicable | Trazabilidad para compras e ingeniería |
| Instalación y soporte local | Continuidad del servicio tras la compra |

Compare alternativas publicadas en catálogo (p. ej. [monitor multiparamétrico básico](/es/productos/monitor-multiparametrico-basico) vs UCI avanzado) con el mismo checklist.

## 3. Errores frecuentes en instituciones

- Comprar “el más completo” sin plan de adopción.
- Ignorar layout de sala, cableado y puestos de trabajo.
- Subestimar capacitación y recambio de sensores.
- No alinear compra con mantenimiento preventivo.

## 4. Cómo proceder con I-ME

1. Aclare el cuello de botella de monitoreo (no la marca favorita).
2. Revise la familia [monitores](/es/familias/monitores/).
3. Contraste fichas concretas del catálogo.
4. Solicite alcance de instalación, capacitación y soporte en [contacto](/es/contacto/).

## Preguntas frecuentes

### ¿Un monitor “UCI” sirve en cualquier cama?
No automáticamente. Depende de protocolos, módulos, central y perfil de paciente del servicio.

### ¿Hay que igualar todos los monitores del hospital?
Homogeneizar ayuda a capacitación y repuestos, pero cada servicio puede requerir un nivel distinto. Evalúe por unidad.

### ¿Qué documento pedir antes de cotizar?
Caso de uso, cantidad, requisitos de central/módulos y restricciones de instalación.
`,
    cuerpo_en: `# What this guide is for

Purchasing, biomedical engineering and clinical leadership often compare monitors by parameter lists. In the ICU the real risk is different: **choosing a device that does not fit room flow, central station, training or documentary support**.

This guide supports an institutional decision without invented clinical claims. It complements the [monitors](/en/families/monitores/) landing and the [advanced ICU multiparameter monitor](/en/products/monitor-multiparametrico-uci-avanzado) sheet.

## 1. Define the use case before the brochure

Answer in writing:

1. Adult, pediatric, neonatal or mixed?
2. Fixed beds, intra-hospital transport, or both?
3. Integration to a central / nursing station required?
4. Which parameters are mandatory in your protocol (ECG, SpO₂, NIBP, IBP, EtCO₂, etc.)?
5. Who operates the device each shift and with what training?

> Without a use case, purchasing collapses into catalog marketing.

## 2. What to review in the technical evaluation

| Criterion | Why it matters |
| --- | --- |
| Real parameters and modules | Avoids paying for unused capabilities |
| Alarms and shift usability | Reduces fatigue and misconfiguration |
| Connectivity / central | Impacts nursing flow and supervision |
| Consumables and sensors | Drives total cost of ownership |
| Documentation and applicable registration | Traceability for purchasing and engineering |
| Local install and support | Service continuity after purchase |

Compare published catalog alternatives (e.g. [basic multiparameter monitor](/en/products/monitor-multiparametrico-basico) vs advanced ICU) with the same checklist.

## 3. Common institutional mistakes

- Buying “the most complete” without an adoption plan.
- Ignoring room layout, cabling and workstations.
- Underestimating training and sensor replacement.
- Not aligning purchase with preventive maintenance.

## 4. How to proceed with I-ME

1. Clarify the monitoring bottleneck (not a favorite brand).
2. Review the [monitors](/en/families/monitores/) family.
3. Contrast concrete catalog sheets.
4. Request install, training and support scope via [contact](/en/contact/).

## FAQ

### Does an “ICU” monitor fit every bed?
Not automatically. It depends on protocols, modules, central station and patient profile.

### Should every hospital monitor be identical?
Homogeneity helps training and spare parts, but each service may need a different level. Evaluate by unit.

### What to request before a quote?
Use case, quantity, central/module requirements and installation constraints.
`,
  },
  {
    slug: 'checklist-compra-desfibrilador-documentacion',
    titulo_es: 'Checklist de compra: desfibrilador con respaldo documental',
    titulo_en: 'Purchase checklist: defibrillator with documentary backing',
    cuerpo_es: `# Por qué la compra de un desfibrilador no es solo “el equipo”

En urgencias, quirófano y áreas críticas, el desfibrilador es un activo de continuidad. La decisión institucional debe cubrir **uso previsto, documentación, capacitación, consumibles y soporte** — no solo el precio de lista.

Use esta checklist junto a la familia [cardiología / reanimación](/es/familias/cardiologia-reanimacion/) y la ficha del [desfibrilador bifásico con monitor](/es/productos/desfibrilador-bifasico-con-monitor).

## Checklist previo a cotizar

- [ ] Área de uso (urgencias, UCI, quirófano, ambulancia, área pública).
- [ ] Perfil de operadores y plan de capacitación.
- [ ] Necesidad de monitor integrado / ECG / impresión.
- [ ] Modo AED vs manual (según protocolo institucional).
- [ ] Consumibles (parches, baterías, papel) y vida útil estimada.
- [ ] Documentación regulatoria aplicable y fichas técnicas.
- [ ] Alcance de instalación, puesta en marcha y mantenimiento.
- [ ] Responsable interno de inventario y revisiones periódicas.

## Qué pedir en la cotización (mínimo)

1. Referencia exacta y configuración.
2. Lista de accesorios incluidos vs opcionales.
3. Condiciones de garantía y tiempos de respuesta de soporte.
4. Capacitación inicial (quién, cuántas horas, sede).
5. Evidencia documental disponible para el proceso de compra.

## Señales de alerta

- Cotización sin desglose de consumibles.
- Promesas clínicas genéricas sin ficha.
- Sin plan de capacitación ni mantenimiento.
- “Compatible con todo” sin validar su protocolo.

## Siguiente paso con I-ME

Revise alternativas en [cardiología / reanimación](/es/familias/cardiologia-reanimacion/), contraste la ficha del [desfibrilador bifásico con monitor](/es/productos/desfibrilador-bifasico-con-monitor) y solicite una cotización con alcance claro en [contacto](/es/contacto/).

## Preguntas frecuentes

### ¿INVIMA “certificado” en un anuncio basta?
No. Confirme la documentación aplicable a la referencia concreta en el proceso de compra — no confíe solo en titulares de marketing.

### ¿Conviene comprar el modelo más avanzado?
Solo si el servicio puede operarlo, mantenerlo y sostener consumibles. Capacidad no usada es CapEx muerto.
`,
    cuerpo_en: `# Why buying a defibrillator is not only “the device”

In ED, OR and critical areas, a defibrillator is a continuity asset. The institutional decision must cover **intended use, documentation, training, consumables and support** — not list price alone.

Use this checklist with the [cardiology / resuscitation](/en/families/cardiologia-reanimacion/) family and the [biphasic defibrillator with monitor](/en/products/desfibrilador-bifasico-con-monitor) sheet.

## Checklist before requesting a quote

- [ ] Use area (ED, ICU, OR, ambulance, public area).
- [ ] Operator profile and training plan.
- [ ] Need for integrated monitor / ECG / printing.
- [ ] AED vs manual mode (per institutional protocol).
- [ ] Consumables (pads, batteries, paper) and estimated lifespan.
- [ ] Applicable regulatory docs and technical sheets.
- [ ] Install, commissioning and maintenance scope.
- [ ] Internal owner for inventory and periodic checks.

## What to request in the quote (minimum)

1. Exact reference and configuration.
2. Included vs optional accessories list.
3. Warranty terms and support response times.
4. Initial training (who, hours, site).
5. Documentary evidence available for the purchasing file.

## Red flags

- Quote without consumables breakdown.
- Generic clinical promises without a sheet.
- No training or maintenance plan.
- “Compatible with everything” without validating your protocol.

## Next step with I-ME

Review alternatives in [cardiology / resuscitation](/en/families/cardiologia-reanimacion/), contrast the [biphasic defibrillator with monitor](/en/products/desfibrilador-bifasico-con-monitor) sheet and request a scoped quote via [contact](/en/contact/).

## FAQ

### Is an “INVIMA certified” ad enough?
No. Confirm documentation applicable to the exact reference in the purchasing file — do not rely on marketing headlines alone.

### Should you buy the most advanced model?
Only if the service can operate it, maintain it and sustain consumables. Unused capability is dead CapEx.
`,
  },
  {
    slug: 'financiamiento-equipos-medicos-colombia',
    titulo_es: 'Financiamiento de equipos médicos en Colombia: qué aclarar antes de firmar',
    titulo_en: 'Medical equipment financing in Colombia: what to clarify before signing',
    cuerpo_es: `# El financiamiento no sustituye el caso de uso

Financiar un equipo biomédico puede acelerar la puesta en marcha, pero **no convierte una mala especificación en un buen proyecto**. Antes de firmar, alinee necesidad clínica-operativa, alcance comercial y condiciones financieras.

Esta nota complementa el [simulador de financiación](/es/financiacion/) y el [hub de recursos](/es/recursos/).

## 1. Preguntas que debe responder la institución

1. ¿Qué problema operativo o de servicio resuelve el equipo en 90 días?
2. ¿Cuál es el coste total (equipo + instalación + capacitación + consumibles)?
3. ¿Quién aprueba CapEx / Opex y con qué documentos?
4. ¿El flujo de caja soporta la cuota sin comprometer insumos críticos?
5. ¿Hay plan B si se retrasa importación, instalación o capacitación?

## 2. Qué aclarar en la propuesta financiera

| Punto | Detalle a pedir |
| --- | --- |
| Monto financiado | Qué incluye y qué queda fuera |
| Plazo y cuota | Escenarios, no un solo número |
| Tasa / costos | Condiciones indicativas vs vinculantes |
| Garantías | Requisitos documentales institucionales |
| Cronograma | Compra → entrega → instalación → pago |
| Salidas | Qué pasa ante incumplimiento o cambio de alcance |

> El simulador público es **indicativo**. Las condiciones finales se confirman en cotización formal.

## 3. Errores comunes

- Financiar el brochure, no el proyecto.
- Olvidar consumibles y mantenimiento en el flujo.
- Firmar sin alcances de instalación y capacitación.
- Mezclar urgencia clínica con presión comercial sin checklist.

## 4. Ruta recomendada con I-ME

1. Defina el equipo / familia en catálogo o [recursos](/es/recursos/).
2. Use el [simulador](/es/financiacion/) solo como orden de magnitud.
3. Solicite cotización con alcance técnico + opciones de pago en [contacto](/es/contacto/).

## Preguntas frecuentes

### ¿La cuota del simulador es una oferta vinculante?
No. Es una herramienta de orientación. La oferta formal se emite por escrito.

### ¿Se puede financiar instalación y capacitación?
Depende del esquema acordado. Pídalo explícitamente en la cotización.
`,
    cuerpo_en: `# Financing does not replace the use case

Financing biomedical equipment can speed commissioning, but **it does not turn a weak specification into a good project**. Before signing, align clinical-operational need, commercial scope and financial terms.

This note complements the [financing simulator](/en/financing/) and the [resources hub](/en/resources/).

## 1. Questions the institution must answer

1. Which operational or service problem does the device solve in 90 days?
2. What is the total cost (device + install + training + consumables)?
3. Who approves CapEx / OpEx and with which documents?
4. Can cash flow support the installment without risking critical supplies?
5. Is there a plan B if import, install or training slips?

## 2. What to clarify in the financial proposal

| Point | Detail to request |
| --- | --- |
| Financed amount | What is included and what is out of scope |
| Term and installment | Scenarios, not a single number |
| Rate / costs | Indicative vs binding conditions |
| Guarantees | Institutional documentary requirements |
| Timeline | Purchase → delivery → install → payment |
| Exits | What happens on default or scope change |

> The public simulator is **indicative**. Final terms are confirmed in a formal quote.

## 3. Common mistakes

- Financing the brochure, not the project.
- Forgetting consumables and maintenance in cash flow.
- Signing without install and training scope.
- Mixing clinical urgency with commercial pressure without a checklist.

## 4. Recommended path with I-ME

1. Define the device / family in the catalog or [resources](/en/resources/).
2. Use the [simulator](/en/financing/) only as order of magnitude.
3. Request a quote with technical scope + payment options via [contact](/en/contact/).

## FAQ

### Is the simulator installment a binding offer?
No. It is an orientation tool. Formal offers are issued in writing.

### Can install and training be financed?
It depends on the agreed scheme. Ask for it explicitly in the quote.
`,
  },
  {
    slug: 'criterios-hospitalarios-ventilacion-mecanica',
    titulo_es: 'Criterios hospitalarios para ventilación mecánica',
    titulo_en: 'Hospital criteria for mechanical ventilation equipment',
    cuerpo_es: `# Decidir un ventilador es decidir un servicio

La compra de ventilación mecánica impacta UCI, urgencias, transporte y quirófano. El criterio institucional debe unir **perfil de paciente, modos requeridos, utilidades de sala, capacitación y continuidad de soporte** — no solo la ficha de marketing.

Oriéntese con la familia [ventiladores](/es/familias/ventiladores/) y referencias publicadas como el [Monnal T75](/es/productos/ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide).

## 1. Criterios de servicio (antes de comparar marcas)

1. Población: adulto, pediátrico, neonatal, transporte.
2. Entorno: UCI fija, quirófano, traslado, emergencias.
3. Modos y monitorización exigidos por protocolo institucional.
4. Disponibilidad de gases, energía y espacio en sala.
5. Competencia del personal que configura y responde alarmas.
6. Plan de mantenimiento, filtros y consumibles.

## 2. Matriz corta de evaluación

| Dimensión | Pregunta clave |
| --- | --- |
| Clínica-operativa | ¿Qué escenario cubre el 80% de uso real? |
| Técnica | ¿La configuración cotizada incluye lo obligatorio? |
| Humana | ¿Hay capacitación y dueño clínico del equipo? |
| Económica | ¿Coste total a 3–5 años (no solo CapEx)? |
| Continuidad | ¿Soporte, repuestos y tiempos de respuesta? |

## 3. Qué no hacer

- Comprar por urgencia de censo sin plan de adopción.
- Mezclar requisitos de transporte y UCI sin especificar ambos.
- Omitir instalación y puesta en marcha del alcance.
- Prometer resultados clínicos no verificados en copy comercial.

## 4. Camino con I-ME

1. Declare el escenario dominante del servicio.
2. Revise [ventiladores](/es/familias/ventiladores/).
3. Contraste fichas (p. ej. [Monnal T75](/es/productos/ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide)).
4. Solicite cotización con alcance técnico en [contacto](/es/contacto/).

## Preguntas frecuentes

### ¿Un ventilador de transporte reemplaza uno de UCI?
No por defecto. Son perfiles distintos. Si necesita ambos, especifíquelo en la compra.

### ¿Basta con la demo del fabricante?
La demo ayuda, pero la decisión debe incluir utilidades, capacitación, consumibles y soporte documentado.
`,
    cuerpo_en: `# Choosing a ventilator means choosing a service

Mechanical ventilation purchasing affects ICU, ED, transport and OR. Institutional criteria must join **patient profile, required modes, room utilities, training and support continuity** — not marketing sheets alone.

Orient with the [ventilators](/en/families/ventiladores/) family and published references such as [Monnal T75](/en/products/ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide).

## 1. Service criteria (before comparing brands)

1. Population: adult, pediatric, neonatal, transport.
2. Setting: fixed ICU, OR, transfer, emergencies.
3. Modes and monitoring required by institutional protocol.
4. Availability of gases, power and room space.
5. Competence of staff who configure and answer alarms.
6. Maintenance plan, filters and consumables.

## 2. Short evaluation matrix

| Dimension | Key question |
| --- | --- |
| Clinical-operational | Which scenario covers 80% of real use? |
| Technical | Does the quoted config include what is mandatory? |
| Human | Is there training and a clinical owner? |
| Economic | 3–5 year total cost (not CapEx only)? |
| Continuity | Support, spare parts and response times? |

## 3. What not to do

- Buy under census urgency without an adoption plan.
- Mix transport and ICU requirements without specifying both.
- Omit install and commissioning from scope.
- Promise unverified clinical outcomes in commercial copy.

## 4. Path with I-ME

1. State the service’s dominant scenario.
2. Review [ventilators](/en/families/ventiladores/).
3. Contrast sheets (e.g. [Monnal T75](/en/products/ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide)).
4. Request a technically scoped quote via [contact](/en/contact/).

## FAQ

### Does a transport ventilator replace an ICU ventilator?
Not by default. They are different profiles. If you need both, specify that in the purchase.

### Is a manufacturer demo enough?
Demos help, but the decision must include utilities, training, consumables and documented support.
`,
  },
];

const meta = {
  publicado: true,
  autor_tipo: 'ime',
  autor_nombre: 'Equipo I-ME',
  autor_empresa: 'I-ME International Medical Enterprise',
  autor_bio_corta:
    'Contenido editorial institucional orientado a compras e ingeniería biomédica. Sin claims clínicos no verificados.',
};

let ok = 0;
for (const post of posts) {
  const row = { ...post, ...meta };
  const { data, error } = await sb.from('articulos').upsert(row, { onConflict: 'slug' }).select('slug,publicado');
  if (error) {
    console.error('FAIL', post.slug, error.message);
    process.exitCode = 1;
  } else {
    console.log('OK', data?.[0]?.slug, 'publicado=', data?.[0]?.publicado);
    ok += 1;
  }
}
console.log(`Done ${ok}/${posts.length}`);
