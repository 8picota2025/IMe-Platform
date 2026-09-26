# Cluster Ventilación / terapia respiratoria — plan de contenido

> Estado: **esperando validación biomédica** (2026-09-26). Autorizado por el usuario el
> 2026-09-26. Mismo proceso que Monitoreo/UCI: no se redacta ni publica ninguna afirmación
> técnica hasta que el Ing. Rojas devuelva firmado `Validacion_biomedica_Ventilacion.docx`
> (entregado en el escritorio del usuario). ADR-0013.

## Punto de partida

- **Tema** `ventilacion-terapia-respiratoria` (ADR-0014) con un artículo:
  `criterios-hospitalarios-ventilacion-mecanica` (criterios de compra, sin datos por modelo).
- **Catálogo:**
  - familia `ventiladores`: 11 equipos. UCI: Monnal T75 y TEO, V-1000, Crius V6 y un producto
    sin marca. Transporte: Monnal T60 y T60 Advanced, TV-100. Neonatal: SLE6000 convencional y
    con alta frecuencia, NC3.
  - familia `terapia-respiratoria-soporte-vital`: 45 productos. Entre ellos alto flujo
    Airvo 2 y 3, circuitos Optiflow, humidificador MR850, CPAP neonatal, blenders,
    nebulizadores, aspiradores y oxígeno.
- **Landings existentes:** `ventiladores_mecanicos` (`/es/ventiladores-mecanicos-uci/`) y
  `alto_flujo_fisher_paykel`. El pilar debe enlazarlas, no duplicarlas.

## Piezas previstas

| Pieza                                                             | Depende de     | Nota                                                                                                        |
| ----------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Pilar: «Guía de ventiladores mecánicos hospitalarios en Colombia» | A1–A3, B1–B6   | Qué ofrece cada modelo del catálogo, UCI vs. transporte, neonatal, instalación, consumibles, mantenimiento. |
| Ventilador de UCI o de transporte                                 | A1, B1         | Amplía la FAQ del artículo existente.                                                                       |
| Ventilación neonatal: convencional, alta frecuencia y no invasiva | A1, B2         | Diferencias de equipo, no indicaciones clínicas.                                                            |
| Alto flujo nasal y humidificación: qué necesita el equipo         | B9             | Enlaza la landing de alto flujo.                                                                            |
| Checklist de recepción e instalación de un ventilador             | B3, B6, B7, B8 | Candidata a segunda herramienta (mismo motor que el checklist de monitores).                                |
| Artículo existente                                                | C1–C7          | Correcciones que pida la sección C.                                                                         |

## Correcciones de catálogo a confirmar (sección A)

- `ventilador-mecanico-uci-adulto-pediatrico` (sin marca) lista el modo **NAVA**, propio de un
  fabricante concreto. Hay que saber a qué equipo real corresponde, o retirarlo.
- La ficha del Monnal T75 cita la «Directiva 93/12/CEE»; probablemente debería decir 93/42/CEE.

Se corrigen en el CMS cuando el Ing. Rojas lo confirme, no antes.

## Fuera de alcance

Consejo clínico (modos por paciente, parámetros, destete), precios, clases de riesgo INVIMA,
imágenes inventadas de equipos.

## Siguiente paso

Recibir la validación. Luego: borradores en preview (`PREVIEW_DRAFTS=true`), URL de sandbox al
usuario, migración de publicación y embeddings del asesor, como en Monitoreo.
