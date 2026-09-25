# Paquetes por canal y mapa UTM — clusters piloto

**Estado:** BORRADOR para revisión. **No se publica nada en redes sin aprobación humana** (mandato §16 y Fase 4).
**Fecha:** 25 de septiembre de 2026. **Clusters:** Monitoreo / UCI · INVIMA / regulación.
**Fuente de cada afirmación:** los artículos ya publicados en el Centro de Conocimiento. No se añaden datos nuevos; si una pieza necesita un dato que no está publicado, se marca `REQUIRES_VERIFICATION`.

---

## 1. Reglas UTM

La web ya guarda `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` y `utm_term` en los leads (`src/lib/commercial-attribution.ts`) y los lleva a Twenty CRM (ADR-0011). No hay una taxonomía fija en el código, así que **estas reglas son la convención**:

| Parámetro      | Valor                                                              | Regla                                                                                                       |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `utm_campaign` | `monitoreo-uci` · `invima-regulacion`                              | Igual al slug del tema en `topic_clusters`: un informe por cluster.                                         |
| `utm_source`   | `linkedin` · `instagram` · `facebook` · `x` · `whatsapp` · `email` | El canal donde se publica.                                                                                  |
| `utm_medium`   | `social-organico` · `social-pago` · `email` · `mensajeria`         | Orgánico y pago separados siempre.                                                                          |
| `utm_content`  | `<formato>-<pieza>`                                                | Formato: `post`, `carrusel`, `video`, `articulo`, `historia`. Pieza: nombre corto de la pieza (ver tablas). |
| `utm_term`     | sólo en campañas pagas                                             | La audiencia o palabra clave de la campaña paga.                                                            |

**Siempre:** minúsculas, sin tildes, guiones en lugar de espacios. Un cambio de mayúscula (`LinkedIn` frente a `linkedin`) parte el informe en dos.

**Plantilla:**

```
https://i-me.com.co/es/conocimiento/<slug-articulo>/?utm_source=<canal>&utm_medium=<medio>&utm_campaign=<cluster>&utm_content=<formato>-<pieza>
```

---

## 2. Cluster Monitoreo / UCI

**Audiencias:** ingeniería biomédica, compras y dirección clínica de UCI (LinkedIn); personal asistencial y decisores de clínicas medianas (Instagram, Facebook).

### 2.1 Mapa de enlaces

| Pieza                               | Canal     | Destino           | URL con UTM                                                                                                                                                                                                     |
| ----------------------------------- | --------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guía principal                      | LinkedIn  | Guía de monitores | https://i-me.com.co/es/conocimiento/guia-monitores-multiparametricos-hospitalarios-colombia/?utm_source=linkedin&utm_medium=social-organico&utm_campaign=monitoreo-uci&utm_content=post-guia-monitores          |
| Central o independientes            | LinkedIn  | Central multicama | https://i-me.com.co/es/conocimiento/central-monitoreo-multicama-o-monitores-independientes/?utm_source=linkedin&utm_medium=social-organico&utm_campaign=monitoreo-uci&utm_content=post-central-multicama        |
| Checklist de instalación            | LinkedIn  | Checklist         | https://i-me.com.co/es/conocimiento/checklist-recepcion-instalacion-monitor-hospitalario/?utm_source=linkedin&utm_medium=social-organico&utm_campaign=monitoreo-uci&utm_content=post-checklist-instalacion      |
| Carrusel básico vs. avanzado        | Instagram | Guía de monitores | https://i-me.com.co/es/conocimiento/guia-monitores-multiparametricos-hospitalarios-colombia/?utm_source=instagram&utm_medium=social-organico&utm_campaign=monitoreo-uci&utm_content=carrusel-basico-vs-avanzado |
| Carrusel adulto/pediátrico/neonatal | Instagram | UCI por tipo      | https://i-me.com.co/es/conocimiento/monitores-uci-adulto-pediatrica-neonatal/?utm_source=instagram&utm_medium=social-organico&utm_campaign=monitoreo-uci&utm_content=carrusel-tipos-uci                         |
| Errores de instalación              | Facebook  | Checklist         | https://i-me.com.co/es/conocimiento/checklist-recepcion-instalacion-monitor-hospitalario/?utm_source=facebook&utm_medium=social-organico&utm_campaign=monitoreo-uci&utm_content=post-errores-instalacion        |
| Guía por WhatsApp (asesores)        | WhatsApp  | Guía de monitores | https://i-me.com.co/es/conocimiento/guia-monitores-multiparametricos-hospitalarios-colombia/?utm_source=whatsapp&utm_medium=mensajeria&utm_campaign=monitoreo-uci&utm_content=articulo-guia-monitores           |

### 2.2 LinkedIn (3 publicaciones)

**Post 1 — Guía principal** · `post-guia-monitores`

> Al comparar monitores multiparamétricos, el error más caro no es elegir la marca equivocada: es no definir antes el caso de uso.
>
> Antes de cotizar, tenga por escrito cinco respuestas: tipo de paciente (adulto, pediátrico, neonatal), camas fijas o transporte, si necesita central, qué parámetros exige su protocolo y quién opera el equipo en cada turno.
>
> Reunimos en una guía, validada por nuestro equipo de ingeniería biomédica, qué mide cada modelo, cuándo conviene uno básico o uno de UCI avanzado, el mantenimiento y los consumibles que más pesan en el costo total.
>
> 👉 [enlace con UTM]

**Post 2 — Central o independientes** · `post-central-multicama`

> ¿Central de monitoreo o monitores independientes?
>
> Una central multicama suele justificarse con 4 o más camas de monitoreo continuo, cuando enfermería supervisa varios pacientes a la vez, o cuando necesita trazabilidad de alarmas para auditorías. En servicios de 1 a 3 camas, los monitores independientes suelen bastar.
>
> Lo que casi nadie presupuesta: red dedicada o VLAN, direcciones IP validadas antes de conectar y capacitación en la central.
>
> 👉 [enlace con UTM]

**Post 3 — Checklist de instalación** · `post-checklist-instalacion`

> Muchos problemas de la primera semana de un monitor nuevo no son del monitor: son del polo a tierra, de la red o de haber capacitado a un solo turno.
>
> Publicamos el checklist que usa nuestro equipo de ingeniería biomédica: qué preparar antes de la entrega, qué verificar al recibir, qué pruebas hacer antes de usarlo con pacientes y qué debe decir el acta.
>
> 👉 [enlace con UTM]

### 2.3 Instagram (2 carruseles)

**Carrusel 1 — Básico vs. UCI avanzado** · `carrusel-basico-vs-avanzado`

1. Portada: "¿Monitor básico o de UCI avanzado?"
2. Básico: urgencias, hospitalización general, posoperatorio simple. Interfaz sencilla, menor costo de consumibles.
3. UCI avanzado: parámetros invasivos (IBP, EtCO₂, gasto cardíaco), detección avanzada de arritmias, integración con central.
4. La regla: monitoreo invasivo de rutina o pacientes de alto riesgo → UCI avanzado. Mucho volumen y baja complejidad → básico.
5. CTA: "Guía completa en el enlace de la bio."

**Carrusel 2 — Adulto, pediátrico, neonatal** · `carrusel-tipos-uci`

1. Portada: "Un monitor, tres tipos de paciente."
2. Adulto: sensores y brazaletes de adulto, rangos de alarma de adulto.
3. Pediátrico: accesorios de tamaño pediátrico; frecuencias cardíaca y respiratoria de referencia más altas que en adultos.
4. Neonatal: sensores de SpO₂ de alta sensibilidad, brazaletes neonatales, modos "Neo".
5. La clave: pida los accesorios de cada tamaño desde la cotización y configure las alarmas según el protocolo.
6. CTA: "Artículo completo en el enlace de la bio."

Imágenes: sólo material real de producto o gráficos sin foto de producto. No generar imágenes ficticias de equipos (plan de contenido §1.6).

### 2.4 Facebook (1 publicación)

**Errores frecuentes al instalar un monitor** · `post-errores-instalacion`

> 5 errores que vemos al recibir monitores en clínicas y hospitales:
>
> 1. No verificar el polo a tierra.
> 2. Recibir sin inventario completo de accesorios.
> 3. Dejar las alarmas con los valores de fábrica.
> 4. Capacitar a un solo turno.
> 5. Conectar a la central sin validar la red.
>
> El checklist completo, gratis: [enlace con UTM]

Testimonios o casos de clientes: sólo reales y con autorización (`REQUIRES_VERIFICATION`). El mandato prohíbe inventarlos.

### 2.5 X

Primera iteración: **sólo escucha**, sin publicación original (plan de contenido §1.6). Búsquedas sugeridas: `monitor multiparamétrico UCI`, `ingeniería biomédica Colombia`, `dotación UCI`, `central de monitoreo hospital`.

---

## 3. Cluster INVIMA / regulación

**Audiencias:** compras e ingeniería biomédica de IPS (LinkedIn, Facebook); fabricantes y distribuidores internacionales que quieren entrar a Colombia (LinkedIn, prioridad del plan §2.6).

### 3.1 Mapa de enlaces

| Pieza                            | Canal     | Destino               | URL con UTM                                                                                                                                                                                              |
| -------------------------------- | --------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qué es el registro sanitario     | LinkedIn  | Guía INVIMA           | https://i-me.com.co/es/conocimiento/registro-sanitario-invima-equipos-biomedicos/?utm_source=linkedin&utm_medium=social-organico&utm_campaign=invima-regulacion&utm_content=post-registro-sanitario      |
| Checklist de compra              | LinkedIn  | Checklist INVIMA      | https://i-me.com.co/es/conocimiento/checklist-invima-compra-equipos-medicos/?utm_source=linkedin&utm_medium=social-organico&utm_campaign=invima-regulacion&utm_content=post-checklist-compra             |
| Fabricantes internacionales (EN) | LinkedIn  | Guía INVIMA en inglés | https://i-me.com.co/en/knowledge/registro-sanitario-invima-equipos-biomedicos/?utm_source=linkedin&utm_medium=social-organico&utm_campaign=invima-regulacion&utm_content=post-fabricantes-en             |
| Cómo verificar un registro       | Instagram | Guía INVIMA           | https://i-me.com.co/es/conocimiento/registro-sanitario-invima-equipos-biomedicos/?utm_source=instagram&utm_medium=social-organico&utm_campaign=invima-regulacion&utm_content=carrusel-verificar-registro |
| Checklist de compra              | Facebook  | Checklist INVIMA      | https://i-me.com.co/es/conocimiento/checklist-invima-compra-equipos-medicos/?utm_source=facebook&utm_medium=social-organico&utm_campaign=invima-regulacion&utm_content=post-checklist-compra             |

### 3.2 LinkedIn (3 publicaciones)

**Post 1 — Qué es el registro sanitario** · `post-registro-sanitario`

> "Tiene INVIMA" no basta.
>
> El registro sanitario es una autorización a nombre de una empresa, no una cualidad del equipo, y un mismo registro puede amparar varios modelos. Lo que hay que comprobar es que el modelo exacto que le cotizan aparece amparado, con registro vigente, en la consulta pública del INVIMA.
>
> Explicamos cómo hacerlo en cuatro pasos, con la norma citada en cada punto (Decreto 4725 de 2005).
>
> 👉 [enlace con UTM]

**Post 2 — Checklist de compra** · `post-checklist-compra`

> Antes de firmar la compra de un equipo biomédico: registro o permiso por cada modelo, titular e importador, vigencia (10 años, con renovación tres meses antes del vencimiento), etiqueta y manuales en castellano, e inclusión en su programa de tecnovigilancia.
>
> Lo convertimos en un checklist por etapas: cotización, comparación de ofertas, recepción y después de la compra.
>
> 👉 [enlace con UTM]

**Post 3 — Para fabricantes internacionales (en inglés)** · `post-fabricantes-en`

> Planning to sell medical equipment in Colombia? Every model needs an INVIMA sanitary registration or marketing permit, held by a company and valid for 10 years. Buyers increasingly check it themselves in INVIMA's public database, model by model.
>
> Our guide explains what they look for, with every point tied to Decree 4725 of 2005.
>
> 👉 [link with UTM]

### 3.3 Instagram (1 carrusel)

**Cómo verificar un registro INVIMA** · `carrusel-verificar-registro`

1. Portada: "¿Cómo saber si un equipo tiene registro INVIMA vigente?"
2. Pida al proveedor el número de registro de cada modelo, por escrito.
3. Búsquelo en la consulta pública del INVIMA (Consulta avanzada).
4. Compare: estado y vigencia, titular, importador, fabricante y modelos amparados.
5. Si algo no coincide, pida la explicación por escrito antes de comprar.
6. CTA: "Guía completa en el enlace de la bio."

Sin contenido sobre clases de riesgo (decisión del 23/09/2026).

### 3.4 Facebook (1 publicación)

**Checklist de compra** · `post-checklist-compra`: el mismo texto del post 2 de LinkedIn, más corto y con el enlace de Facebook.

### 3.5 X

Sólo escucha: `registro sanitario INVIMA`, `INVIMA dispositivos médicos`, `tecnovigilancia`, `importar equipos médicos Colombia`.

---

## 4. Cómo medirlo

- **En la web:** `analytics_eventos` filtrado por `utm_campaign`: `quote_submit`, `whatsapp_click` y `page_view` de los artículos del cluster (plan §1.7 y §2.7).
- **En el CRM:** Twenty recibe la atribución completa en la nota de cada lead (ADR-0011). Sirve para contar leads por `utm_campaign` y `utm_content`.
- **En GA4:** sólo de quien acepta cookies (ADR-0012), así que los números de GA4 serán menores que los de `analytics_eventos`. No son comparables uno a uno.
- **Pendiente:** el dashboard mínimo por cluster todavía no existe; es el siguiente entregable de la Fase 2.

## 5. Antes de publicar

- [ ] Aprobación humana de cada pieza (mandato §16).
- [ ] Imágenes reales o gráficos sin foto de producto.
- [ ] Probar cada URL con UTM: debe abrir el artículo y, al enviar una cotización, el lead debe llegar a Twenty con la campaña correcta.
- [ ] En campañas pagas: `utm_medium=social-pago` y `utm_term` con la audiencia.
