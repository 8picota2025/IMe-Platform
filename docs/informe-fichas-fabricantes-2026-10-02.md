# Informe: fichas de fabricante y landings enriquecidas — I-ME

**Fecha:** 2026-10-02 · **Proyecto:** `ime-platform` (https://i-me.com.co) · **Rama:** `feat/fichas-fabricantes-landings`

## 1. Resumen ejecutivo

- Se auditó la BBDD de producción (Supabase): **716 productos activos**; **384 no tenían ni ficha PDF ni landing enriquecida** (ni beneficios, ni valor, ni FAQ).
- Se buscaron y descargaron las fichas oficiales de los fabricantes en `/home/shoky/0 IME/Fabricantes/` (la carpeta existente, con mayúsculas) y se localizaron fichas para **200 productos** (**166 PDFs distintos**; varios productos comparten ficha).
- Para esos **200 productos** se redactó contenido nuevo **solo con datos presentes en la ficha** (descripción SEO, 3-4 beneficios, propuesta de valor, 4 FAQ, 6-7 palabras clave, especificaciones), en **español e inglés**, y se enlazó el PDF descargable.
- Los PDFs se publican en el hosting en `public/assets/productos/fichas/<fabricante>/…` (193 MB tras optimizar imágenes; los originales intactos siguen en `0 IME/Fabricantes`).
- **Quedan 184 productos sin ficha** (motivos en la sección 5): repuestos sin ficha propia, modelos que el fabricante ya no publica, webs que solo muestran imágenes y registros genéricos sin SKU.
- **Nada se ha escrito en producción todavía.** El cambio está en un PR (sin fusionar) + 9 migraciones SQL; ver sección 7 para los dos pasos que requieren tu aprobación.

## 2. Cobertura por fabricante

| Fabricante                 | Productos con ficha + landing enriquecida | Idioma de la ficha                     |
| -------------------------- | ----------------------------------------: | -------------------------------------- |
| GMD (marca Konfort Plus)   |                                       101 | español (101)                          |
| Advanced Instrumentations  |                                        27 | español (23), inglés (4)               |
| Saikang Medical            |                                        26 | español (14), inglés (11), francés (1) |
| Fisher & Paykel Healthcare |                                        14 | inglés (14)                            |
| GMD (marca Nube)           |                                         7 | español (7)                            |
| GMD (marca Carditek)       |                                         6 | español (6)                            |
| Bio-Med Devices            |                                         5 | inglés (5)                             |
| GMD (marca Latidos)        |                                         4 | español (4)                            |
| Medin Medical Innovations  |                                         3 | inglés (3)                             |
| Bistos                     |                                         3 | inglés (3)                             |
| Mercury Medical            |                                         2 | inglés (2)                             |
| GMD (marca GMR)            |                                         1 | español (1)                            |
| Dr. Mach                   |                                         1 | español (1)                            |
| **Total**                  |                                   **200** | español 157 · inglés 42 · francés 1    |

Fuentes (todas oficiales del fabricante, salvo la nota de abajo): advanced-inst.com (WordPress, API de medios), saikangmedical.com (fichas `_ES` cuando existen), resources.fphcare.com, gmd.com.co (titular de Konfort Plus, Carditek, Latidos y Nube), medin-medical.com, dr-mach.de, biomeddevices.com, mercurymed.com. La ficha de **Bistos** (`Catalog_BISTOS_BT-500-550-400_NICU.pdf`) es el catálogo oficial del fabricante, alojado por un distribuidor, porque bistos.co.kr entrega sus descargas por JavaScript.

## 3. Qué se hizo en cada landing

Para cada producto enriquecido (`atributos` JSONB + columnas, **sin cambios de esquema**):

- `ficha_pdf` → `/assets/productos/fichas/<fabricante>/<archivo>.pdf` (el botón «Descargar ficha técnica» ya existía en `ProductoLanding.astro`).
- `descripcion_larga_es/en` → texto SEO con nombre, modelo, cifras de la ficha y uso. En los productos GMD/Konfort Plus se **conserva** la descripción existente y se **añade** el párrafo nuevo (no se pierde texto).
- `atributos.beneficios_es/en` (3-4), `valor_es/en`, `preguntas_frecuentes_es/en` (3 de producto + 1 automática «¿Dónde descargo la ficha técnica?»), `seo_keywords_es/en` (6-7, ya alimentan `<title>` y meta description vía `buildProductoSeo`).
- `especificaciones[]` → datos de la ficha, **fusionados** con las existentes (no se borran las anteriores).
- `atributos.ficha_fabricante` → trazabilidad: fabricante, idioma, URL de origen, fecha de descarga.

Regla del proyecto respetada: **cero datos inventados**. Cuando una cifra era ambigua en el PDF (tablas con etiquetas y valores separados) se omitió.

## 4. Revisión recomendada antes de publicar

- **B-2000 Plus (Advanced)** — La web de Advanced solo publica la ficha **B-2000 Pro**; se usó y el texto lo indica ("la ficha disponible para esta línea corresponde a la B-2000 Pro"). Confirmar con el proveedor que es el mismo equipo.
- **KP4202-20 / -28, KP4152-20 / -28, KP4192-20 / -28 (bastones)** — GMD publica una ficha por modelo base; las variantes de color comparten la ficha de la variante cromo (-22). Cifras comunes; el color se indica en el texto.
- **KP4102-22 (bastón en T cromo)** — **Excluido**: la ficha que GMD enlaza para esa referencia es la de bastón de 4 apoyos (error en origen). Pendiente de corrección por GMD.
- **Blenders Bio-Med (EQ-34-E-0001, -0004, -0005, -0005-2)** — Comparten un catálogo "Blender Gallery"; las cifras de flujo por modelo se dieron solo a nivel de serie. EQ-34-E-0005-2 aparece en el catálogo como "0-30 lpm / ref. 2002F70D": incoherencia de nombre en el catálogo I-ME (el 2002F70D es de 0-70 lpm).
- **Resusa-Tee y KBE-9119A/R/V** — Sus PDFs son imágenes (sin texto): el contenido de Resusa-Tee se leyó visualmente; las KBE-9119 solo llevan datos de nombre (color y ancho).
- **SKP011 (colchón Saikang)** — La única ficha publicada por Saikang está en **francés**.
- **Wigglepads OPT010 (F&P)** — La ficha usada (Optiflow Junior 2) los lista como repuestos compatibles "Wigglepads 2" (WJR110/112/114); la referencia exacta OPT010 no aparece.
- **Nivairo (EQ-1-C-0195), Humidificador 950 (EQ-7-E-0004-1-1), máscara nasal RT04 (EQ-1-C-0097-1)** — **Excluidos**: el catálogo describe una máscara _nasal_ pero la ficha de F&P es de máscara _facial completa_ (Nivairo+); para el humidificador 950 solo existe el manual del circuito, no del equipo; y la RT04 no coincide con la ficha de máscara Neopuff.
- **Lámpara pielítica Mach LED 150FP (Dr. Mach)** — **Excluida**: el folleto solo la menciona de pasada, sin datos propios.
- **Producto de prueba activo en producción:** `Testp` — "Test de pasarela de pagos" (familia insumos-accesorios) figura **activo** en la BBDD. Dado tu criterio de no dejar datos de prueba en producción, conviene desactivarlo/borrarlo (no lo he tocado).

## 5. Productos sin ficha (184)

| Motivo                                                                             | Productos |
| ---------------------------------------------------------------------------------- | --------: |
| GMD/Konfort Plus – repuesto o accesorio (sin ficha técnica propia)                 |        62 |
| Registro genérico sin SKU ni fabricante identificable                              |        27 |
| Saikang – modelo ya no figura en la web oficial                                    |        17 |
| Angell Technology / radiología – sin PDF público (solo especificaciones en la web) |        15 |
| GMD/Konfort Plus – producto sin ficha técnica publicada                            |        13 |
| Otros fabricantes – sin PDF público accesible                                      |        12 |
| Northern Meditec – la web solo publica imágenes, sin PDF                           |        12 |
| Perlong – sin ficha pública                                                        |         8 |
| Fisher & Paykel – sin documento específico verificable                             |         7 |
| Ilumitec – sin ficha pública                                                       |         4 |
| BM (Brother Medical) – sin ficha pública                                           |         3 |
| Otros – sin ficha localizada                                                       |         3 |
| Producto de prueba (Wompi sandbox)                                                 |         1 |

Detalle:

<details><summary><strong>GMD/Konfort Plus – repuesto o accesorio (sin ficha técnica propia)</strong> (62)</summary>

- `150-0100` Carra Para Cilindro - 680 L
- `FS696-R` Llanta Sin Freno Para Cómodo Sanitario
- `FS696-RF` Llanta Con Freno Para Cómodo Sanitario
- `FS976ABJ-43-E` Espaldar En Nailon Para Silla De Transporte
- `FS980LA-35-A` Asiento Para Silla De Ruedas Pediátrica
- `GMR540-MDK-001` Empaque para Regulador de Válvulas GMR
- `GMRN-NB` Nebulizador para Compresor NUBE
- `GMRN211-KITA` Kit de Nebulización Adulto NUBE 3000
- `GMRN211-KITPE` Kit de Nebulización Pediátrico NUBE 3000
- `GMRN457-12F` Filtro para Compresor Nebulizador NUBE 3000
- `GMRN457-1F` Filtro Par Compresor Nebulizador Panda
- `GMRN457-KIT` Kit de Nebulización Adulto NUBE
- `GMRN457-KITPE` Kit de Nebulización Pediátrico NUBE
- `GMRN818-KIT` Clenny Kit Para Nube 7000
- `GMRN818-KITMN` Kit de Nebulización Del Nube 7000
- `GMRN846-KIT` Kit De Nebulización Smart Del Nube 5000
- `GMRN846-KITMN` Kit De Nebulización Del Nube 5000
- `JBS168-00-011` Rueda Delantera de 4" Para Grúa Hidráulica Konfort Plus
- `JBS168-00-012` Rueda Trasera Con Freno De 4" Para Grúa Hidráulica Konfort Plus
- `JBS168-00-021` Arnés Móvil para Grúa Hidráulica
- `JBS168-00-1A` Actuador hidráulico para jbs168-1
- `KB2-798L-T` Tapón Para Silla Ducha KB2-798L
- `KB215SR-AL-B` Balde Para Comodo Sanitario
- `KB215SR-AL-LEG` Pata Para Cómodo Sanitario En Aluminio
- `KB215SR-AL-TIP` Tapón Para Cómodo Sanitario
- `KB225CR-AL19-SRF` Pata con Rueda sin Freno en Aluminio
- `KB225CR-AP1-RF` Pata Con Rueda Y Freno En Acero Color Blanco
- `KB225CR-AP1-SFR` Pata con Rueda sin Freno color Blanco
- `KB225CR-AP1-TA` Aro Y Tapa Para Cómodo Sanitario
- `KB3-2001L` Axilares para Muletas
- `KB3-2010` Manilares para Muletas KP
- `KBE1432RF-MP23-RP` Respaldo para KBE1432RF-MP23L
- `KBE1432RF-MP23L-AS` Asiento para KBE1432RF-MP23L
- `KBE1432RF-MP23L-FR` Frenos para KBE1432RF-MP23L
- `KBE1432RF-MP23L-LLD` Llanta Delantera para KBE1432RF-MP23L
- `KBE1432RF-MP23L-LLT` Llanta Trasera para SDR KBE1432RF-MP23L
- `KBE1462-FR` Freno para SDR Estándar color Gris
- `KBE1462FF-M23D-A` Asiento para SDR KBE1462FF-M23-D
- `KBE1462FF-M23D-RP` Reposapiés para SDR KBE1452FF-M23-D
- `KBE1462FF-M23D-RST` Rueda Delantera sin Tenedor
- `KBE1462RE-P23L-RP` Reposapiés elevables para SDR KBE1462RE-PP23L
- `KBO1432RF-MP23-FR` Frenos para SDR KBO1432RF-MP23
- `KBO1432RF-MP23-RP` Reposapiés para SDR KBO1432RF-MP23
- `KBO1432RF-MP23-RT` Rueda Trasera Para Silla De Transporte
- `KP-BAL-2` Balde para Cómodo Sanitario KP
- `KP-PARF-2` Patas en Aluminio para Cómodo Sanitario KP
- `KP1-816L-TIP` Tapón para Caminador KP1-816L Color Gris
- `KP2-6542SR-AP1-A` Asiento Para Cómodo Sanitario KP2-6542SR
- `KP2-6542SR-AP1-R` Espaldar Para Cómodo Sanitario KP2-6542SR
- `KP2-6542SR-TIPN` Tapón Para Cómodo KP2-6542SR
- `KP2-6543CR-AL19-R` Respaldo Para Cómodo Sanitario KP
- `KP285-AL-19` Caminador con ruedas Rollator en aluminio con reposapiés
- `KP4-1T-19D` Recatón Color Gris para Bastón de 1 Apoyo Dc
- `KP4-1T-20D` Recatón Color Negro Para Bastón De 1 Apoyo
- `KP4-1T-26D` Recatón Color Café Para Bastón De 1 Apoyo
- `KP4-4T-19D` Recatón Color Gris para Bastón de 4 Apoyos
- `KP4-4T-20D` Recatón Color Negro para Bastón de 4 Apoyos
- `KP4-4T-D14` Tapón En Forma De X - 4 Apoyos
- `SRELS-LT` Llanta Trasera para SDR Iron Light
- `SRELS-PAD` Pad para SDR Iron Light
- `SRELS-RPE` Reposapiés Elevables para SDR Iron Light
- `SRELS-RPR` Reposapiés Removibles para SDR Iron Light

</details>

<details><summary><strong>Registro genérico sin SKU ni fabricante identificable</strong> (27)</summary>

- `—` Bomba de Infusión Volumétrica UCI
- `—` Bomba de Jeringa Precisión Microdosis
- `—` Camilla Hospitalaria Eléctrica Articulable
- `—` Carro de Paro para Reanimación
- `—` Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio
- `—` Combo 100 Cajas de Tirillas + 100 Cajas de Lancetas + 25 Glucómetros en obsequio
- `—` Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio
- `—` Combo 200 Cajas de Tirillas + 200 Cajas de Lancetas + 67 Glucómetros en obsequio
- `—` Cuna de Calor Radiante Neonatal Servo
- `—` Desfibrilador Bifásico con Monitor
- `—` Ecógrafo Color Doppler Diagnóstico Vascular
- `—` Ecógrafo Portátil con WiFi y DICOM
- `—` Electrocardiógrafo 12 Derivaciones Digital
- `—` Electrocardiógrafo Inalámbrico Portátil
- `—` Holter 24 Horas Ritmo Cardíaco
- `—` Incubadora Neonatal de Transporte
- `—` Lámpara Cialítica LED Doble para Quirófano
- `—` Mesa Quirúrgica Motorizada Multiposición
- `—` Mesa Quirúrgica Ortopédica Radiolúcida
- `—` Monitor Central UCI Multicama
- `—` Monitor Fetal CTG con Impresora
- `—` Monitor Multiparamétrico Básico
- `—` Monitor Multiparamétrico UCI Avanzado
- `—` Monitor de Transporte Prehospitalario
- `—` Máquina de Anestesia con Ventilador
- `—` Ultrasonido Point-of-Care Pocket
- `—` Ventilador Mecánico UCI Adulto-Pediátrico

</details>

<details><summary><strong>Saikang – modelo ya no figura en la web oficial</strong> (17)</summary>

- `SK-C1` Cama de Hospital SK-C1
- `SK-C1-R00` Cama de Hospital Plana R00
- `SK-C1-R000w` Camilla Manual de Una Función R000w
- `SK-D2C` Gabinete Dental SK-D2C
- `SKD-A-Z0n` Cama de Atención Pediátrica Z0n
- `SKD-C-HB421` Cama de Atención Domiciliaria HB421
- `SKD-C-HB422` Cama de Atención Domiciliaria HB422
- `SKD-C-HB424` Cama de Atención Domiciliaria HB424
- `SKD-D-H6k` Cama de Atención Domiciliaria VIP H6k
- `SKE008-1` Silla de Espera SKE008-1
- `SKH050` Estantería Hospitalaria SKH050
- `SKH061` Estantería Hospitalaria SKH061
- `SKH092` Gabinete de Almacenamiento SKH092
- `SKR-IT625` Carro de Infusión SKR-IT625
- `SKR058-CT` Carro de Enfermería SKR058-CT
- `SKS002` Mesita de Noche SKS002
- `SKS002-W` Mesita de Noche SKS002-W

</details>

<details><summary><strong>Angell Technology / radiología – sin PDF público (solo especificaciones en la web)</strong> (15)</summary>

- `ALC-280` Arco en C ALC-280 Series
- `DR-CEILING` Sistema de Rayos X DR Montado en Techo
- `DR-FLOOR` Sistema de Rayos X DR Montado en Suelo
- `DR-MOBILE` Sistema de Rayos X DR Móvil
- `DR-TELECOMAND` Sistema DR de Mesa Telecomandada
- `DR-UC-ARM` DR Dinámico de Brazo-UC
- `DTP573` DR Dinámico DTP573
- `TCQ-III` Detector Plano Inalámbrico TCQ-III
- `—` Arco en C Móvil de Radiografía Digital Dinámica HUA II
- `—` Equipo Móvil de Radiografía Digital Dinámica Lingxi
- `—` Sistema Radiográfico de Piso MTP
- `—` Sistema de Mamografía Digital Fanghua
- `—` Sistema de Radiografía Digital Dinámica UC-ARM DTP580
- `—` Sistema de Radiografía Digital Dinámica de Techo Changfeng
- `—` Sistema de Radiografía Digital Dinámica de Techo QOMO

</details>

<details><summary><strong>GMD/Konfort Plus – producto sin ficha técnica publicada</strong> (13)</summary>

- `DES-KBE1462FF-M23-D` Deslizadores Traseros para SDR KBE1462FF-M23-D
- `DESDE-KBE1462FF-M23-D` Deslizadores Delanteros para SDR KBE1462FF-M23-D
- `KIT 2` Kit 2 De Oxígeno Con Cilindro De 416 l
- `KP4102-22` Baston Con Empuñadura En T Ergonómico Color Cromo Konfort Plus
- `LATIDOS-C` Adaptador AC-DC para Tensiómetro Latidos
- `LTD-B10-50` Combo 50 Cajas de Tirillas + 50 Cajas de Lancetas + 10 Glucómetros en obsequio
- `LTD-B10-600` Combo 600 Cajas de Tirillas + 600 Cajas de Lancetas + 200 Glucómetros en obsequio
- `MD15-015` Cilindro De Oxígeno 416 L
- `SKB-2A-SKB2A11` Tablero Espinal SKB2A11
- `SKB-4A-SKB2A12` Tablero Espinal SKB2A12
- `SKP001` Colchón SKP001
- `SKU-B1-SKB2C01` Camilla de Ambulancia SKB2C01
- `SKW-B2-SKB1C02` Silla para Subir Escaleras SKB1C02-1

</details>

<details><summary><strong>Otros fabricantes – sin PDF público accesible</strong> (12)</summary>

- `EQ-1-C-0023-1-1-1-1` Vital Care Wipes Ref 1240115 Vital Care
- `EQ-1-E-0003-1-1-1` Torre de Laparoscopia 4K SonoScape SV-M4K120
- `EQ-1-E-0003-1-1-1-1` Torre de Laparoscopia FHD SonoScape X-2600
- `EQ-41-C-0008` Nuprep Skin Markers Ref 122-736100 Natus Medical
- `EQ-5-C-0016` Gorro Medin Medical
- `—` Lámpara Auxiliar Tipo LED Ref 110 Dr Mach
- `—` Lámpara Pielítica Tipo LED Mach LED Ref 150FP Dr Mach
- `—` Mesa de Cirugía Con Elevación de Riñón Ref 7000SK Benq
- `—` Mesa de Cirugía Para Neurología y Laparoscopia Ref 7000SN Benq
- `—` Mesa de Cirugía Ref 7000S Benq
- `—` Monitor de Paciente Biolight S12 | Monitoreo Avanzado con Tecnología IoT
- `—` Monitor de Signos Vitales Portátil Biolight M860 | Precisión y Movilidad Clínica

</details>

<details><summary><strong>Northern Meditec – la web solo publica imágenes, sin PDF</strong> (12)</summary>

- `Acuarius` Monitor Multiparámetro Acuarius
- `Aquarius-LITE` Oxímetro Aquarius LITE
- `Atlas-N3` Máquina de Anestesia Atlas N3
- `Atlas-N5` Máquina de Anestesia Atlas N5
- `Atlas-N7` Máquina de Anestesia Atlas N7
- `Crius-V6` Ventilador Mecánico Crius V6
- `FM-9000` Monitor Fetal y Materno FM-9000
- `Gemini` Monitor Multiparámetro Gemini
- `Pisces` Monitor Multiparámetro Pisces
- `Taurus` Monitor Multiparámetro Taurus
- `Venus` Monitor Multiparámetro Venus
- `Virgo` Monitor Modular Multiparámetro Virgo

</details>

<details><summary><strong>Perlong – sin ficha pública</strong> (8)</summary>

- `EBSA-20` Balanza para Bebé Electrónica EBSA-20
- `RGT-A-200-RT` Báscula Corporal Doble Regla RGT.A-200-RT
- `RGT-RT` Balanza Corporal con Doble Regla RGT-RT
- `TCS-200-RT` Báscula Corporal Electrónica TCS-200-RT
- `TCS-200B-RT` Balanza Corporal Electrónica TCS-200B-RT
- `YRBB-20` Balanza para Bebé YRBB-20
- `ZT-120` Báscula Corporal ZT-120
- `ZT-150A` Báscula Corporal ZT-150A

</details>

<details><summary><strong>Fisher & Paykel – sin documento específico verificable</strong> (7)</summary>

- `EQ-1-C-0060` Cascada Reusable Para Humidificador Ref MR340S Fisher & Paykel
- `EQ-1-C-0097-1` Máscara Nasal Desechable No Ventilada Fisher & Paykel
- `EQ-1-C-0191-1` Optiflow+ Asymmetrical Nasal Cannula Fisher & Paykel
- `EQ-1-C-0192` Cánula Nasal Optiflow Adulto Fisher & Paykel
- `EQ-1-C-0195` Máscara Nivairo Fisher & Paykel
- `EQ-7-E-0004-1-1` Humidificador Respiratorio Ref 950 Fisher & Paykel
- `—` Sistema CPAP Neonatal para UCI

</details>

<details><summary><strong>Ilumitec – sin ficha pública</strong> (4)</summary>

- `LED-X18-100K` Lámpara Cielítica LED-X18 100K
- `LED-X36` Lámpara Cielítica LED-X36
- `LED-X3618` Lámpara Cielítica LED-X3618 con Satélite
- `LED-X3636` Lámpara Cielítica LED-X3636 con Satélite

</details>

<details><summary><strong>BM (Brother Medical) – sin ficha pública</strong> (3)</summary>

- `BME002` Sillón Reclinable BME002
- `BME006` Silla Reclinable BME006
- `BME007` Sillón Reclinable BME007

</details>

<details><summary><strong>Otros – sin ficha localizada</strong> (3)</summary>

- `DUS-3000` Sistema de Ultrasonido DUS-3000
- `V-1000` Ventilador para UCI V-1000
- `VP-50` Bomba de Infusión VP-50

</details>

<details><summary><strong>Producto de prueba (Wompi sandbox)</strong> (1)</summary>

- `Testp` Test de pasarela de pagos

</details>

Cómo desbloquearlos: pedir las fichas por email a los fabricantes (contactos en `Fabricantes/*/contacto.txt`: Northern Meditec, Perlong, Ilumitec, BM, Angell), o enviarme PDFs que ya tengáis y los incorporo con el mismo script. Los 27 registros genéricos sin SKU (p. ej. "Monitor Multiparamétrico Básico") parecen marcadores de posición del catálogo y no corresponden a un modelo concreto.

## 6. Lista de productos enriquecidos

| SKU               | Producto                                                               | Fabricante                 | Ficha   |
| ----------------- | ---------------------------------------------------------------------- | -------------------------- | ------- |
| `A3158`           | Incubadora Neonatal de Transporte A3158                                | Advanced Instrumentations  | español |
| `A3186`           | Incubadora Neonatal A3186                                              | Advanced Instrumentations  | español |
| `A3186-Plus`      | Incubadora Neonatal A3186+                                             | Advanced Instrumentations  | español |
| `A4051`           | Cuna de Calor Radiante A4051                                           | Advanced Instrumentations  | español |
| `B-1000-PRO`      | Cama Hospitalaria Eléctrica B-1000 Pro                                 | Advanced Instrumentations  | español |
| `B-2000`          | Cama Hospitalaria Manual B-2000                                        | Advanced Instrumentations  | español |
| `B-2000-PLUS`     | Cama Hospitalaria Eléctrica B-2000 Plus                                | Advanced Instrumentations  | español |
| `DUS-5000`        | Sistema de Ultrasonido DUS-5000                                        | Advanced Instrumentations  | inglés  |
| `DUS-5000-PLUS`   | Sistema de Ultrasonido DUS-5000 Plus                                   | Advanced Instrumentations  | inglés  |
| `DUS-6000`        | Sistema de Ultrasonido Versátil DUS-6000                               | Advanced Instrumentations  | inglés  |
| `DUS-7000`        | Sistema de Ultrasonido DUS-7000                                        | Advanced Instrumentations  | inglés  |
| `ECG-12C`         | Electrocardiógrafo ECG-12C                                             | Advanced Instrumentations  | español |
| `ECG-3-Plus`      | Electrocardiógrafo ECG-3 Plus                                          | Advanced Instrumentations  | español |
| `FM-9000-PLUS`    | Monitor Fetal y Materno FM-9000 Plus                                   | Advanced Instrumentations  | español |
| `IP-200`          | Bomba de Infusión IP-200                                               | Advanced Instrumentations  | español |
| `OT-30`           | Mesa de Operaciones Manual OT-30                                       | Advanced Instrumentations  | español |
| `OT-500`          | Mesa de Operaciones OT-500                                             | Advanced Instrumentations  | español |
| `PM-2000A-PRO`    | Monitor de Paciente PM-2000A PRO                                       | Advanced Instrumentations  | español |
| `PM-2000M`        | Monitor Modular PM-2000M                                               | Advanced Instrumentations  | español |
| `PM-2000XL`       | Sistema de Monitorización PM-2000XL                                    | Advanced Instrumentations  | español |
| `PM-2000XL-PRO`   | Sistema de Monitorización PM-2000XL PRO                                | Advanced Instrumentations  | español |
| `PM-200M`         | Monitor Modular de Paciente PM-200M                                    | Advanced Instrumentations  | español |
| `PT-2000`         | Lámpara de Fototerapia PT-2000                                         | Advanced Instrumentations  | español |
| `SL-Series`       | Lámpara Quirúrgica Halógena SL Series                                  | Advanced Instrumentations  | español |
| `ST-100`          | Camilla Manual ST-100                                                  | Advanced Instrumentations  | español |
| `ST-2000`         | Camilla para Pacientes ST-2000                                         | Advanced Instrumentations  | español |
| `VSM-300`         | Monitor de Signos Vitales VSM-300                                      | Advanced Instrumentations  | español |
| `EQ-34-E-0001`    | Blender Serie Bajo Flujo Con Flujómetro de 0 a 15 Lpm Ref 2003FL Bio-M | Bio-Med Devices            | inglés  |
| `EQ-34-E-0004`    | Blender Serie Alto Flujo Con Flujómetro de 0 a 70Lpm Ref 2002F70D Bio- | Bio-Med Devices            | inglés  |
| `EQ-34-E-0005`    | Blender Serie Bajo Flujo Con Doble Flujómetro de 0 a 15 Ref 2003FF15 B | Bio-Med Devices            | inglés  |
| `EQ-34-E-0005-1`  | Ventilador Mecánico Neonatal Pediátrico Adulto Ref TV-100 Bio-Med      | Bio-Med Devices            | inglés  |
| `EQ-34-E-0005-2`  | Blender Serie de Alto Flujo Con Flujómetro de 0 a 30Lpm Ref 2002F70D B | Bio-Med Devices            | inglés  |
| `EQ-3-E-0004-1`   | Incubadora Abierta o Servocuna Ref BT550 Bistos                        | Bistos                     | inglés  |
| `EQ-35-E-0001`    | Incubadora de Cuidado Intensivo Ref BT-500 Bistos                      | Bistos                     | inglés  |
| `EQ-35-E-0002`    | Lámpara de Fototerapia Ref BT-400 Bistos                               | Bistos                     | inglés  |
| `—`               | Lámpara Quirúrgica Tipo LED Mach LED Ref 300MC Dr Mach                 | Dr. Mach                   | español |
| `EQ-1-C-0046`     | Prematuro Wigglepads Ref OPT010 Fisher & Paykel                        | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0050-1`   | Interfaz Nasal Optiflow Junior 2 Fisher & Paykel                       | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0050-1-1` | Kit de Blender Para Transición Fisher & Paykel                         | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0057`     | Arnés Para CPAP de Burbuja Fisher & Paykel                             | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0062`     | Kit CPAP de Burbuja Ref BC161-10 Fisher & Paykel                       | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0063`     | Tubo Nasal Para CPAP de Burbuja Fisher & Paykel                        | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0066`     | Máscara Para CPAP de Burbuja Fisher & Paykel                           | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0070`     | Prong Nasal Para CPAP Burbuja Fisher & Paykel                          | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0081`     | Gorro Para CPAP de Burbuja Fisher & Paykel                             | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0096`     | Kit de Máscaras Para Neopuff Ref RD800-EN Fisher & Paykel              | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0097`     | Máscara Para Neopuff Desechable Fisher & Paykel                        | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-C-0111`     | Circuito Desechable Para Neopuff Ref RD1300-10 Fisher & Paykel         | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-E-0002`     | Resucitador Neonatal Neopuff Fisher & Paykel                           | Fisher & Paykel Healthcare | inglés  |
| `EQ-1-E-0003`     | Sistema de Alto Flujo Airvo 2 Fisher & Paykel                          | Fisher & Paykel Healthcare | inglés  |
| `CDK-222`         | Compresor Nebulizador Carditek Bubu                                    | GMD (marca Carditek)       | español |
| `CDK-BD-2317W`    | Balanza Digital de Peso Corporal Carditek                              | GMD (marca Carditek)       | español |
| `CDK-BPM-65B+`    | Tensiómetro Digital Carditek Power                                     | GMD (marca Carditek)       | español |
| `CDK-BPM-65R`     | Tensiómetro Digital Carditek Vital                                     | GMD (marca Carditek)       | español |
| `CDK-BPM-66EP`    | Tensiómetro Digital Carditek Smart                                     | GMD (marca Carditek)       | español |
| `CDK-BPM-75B`     | Tensiómetro Digital de muñeca Carditek Pulse                           | GMD (marca Carditek)       | español |
| `CDK-195`         | Compresor Nebulizador Zen                                              | GMD / GMD                  | español |
| `GMR-SM181`       | Aspirador De Secreciones Pórtatil ADS100                               | GMD / GMD                  | español |
| `HY5`             | Caminador 5 Funciones HY5                                              | GMD / GMD                  | español |
| `JPD-FR202`       | Termómetro digital de frente                                           | GMD / GMD                  | español |
| `KBE-622`         | Silla De Ruedas Estándar en Acero con Rin Estrella 22" de 45,7 cm de a | GMD / GMD                  | español |
| `KBE-622FR`       | Silla De Ruedas Estándar en Acero con Rin Estrella 22" y Freno de Asi  | GMD / GMD                  | español |
| `KBE-9000D`       | Silla De Ruedas Estándar Con Rin Estrella KP                           | GMD / GMD                  | español |
| `KBE-9110HC`      | Silla de ruedas                                                        | GMD / GMD                  | español |
| `KBE-9119A`       | Silla De Ruedas Estándar en Acero Color Azul de 46 cm de ancho         | GMD / GMD                  | español |
| `KBE-9119R`       | Silla De Ruedas Estándar en Acero Color Rojo de 46 cm de ancho         | GMD / GMD                  | español |
| `KBE-9119V`       | Silla De Ruedas Estándar en Acero Color Verde de 46 cm de ancho        | GMD / GMD                  | español |
| `KBE-982E`        | Silla De Ruedas Estándar con Rin estrella de 46 cm de ancho            | GMD / GMD                  | español |
| `KBF-AB23-LXL`    | Faja Abdominal De 23 cm Talla L/XL                                     | GMD / GMD                  | español |
| `KBF-AB23-SM`     | Faja Abdominal De 23 cm Talla S/M                                      | GMD / GMD                  | español |
| `KBF-AB30-LXL`    | Faja Abdominal De 30 cm Talla L/XL                                     | GMD / GMD                  | español |
| `KBF-AB30-SM`     | Faja Abdominal De 30 cm Talla S/M                                      | GMD / GMD                  | español |
| `KBF-CAMP-LXL`    | Faja Lumbo Sacra Tipo Camp Talla L/XL                                  | GMD / GMD                  | español |
| `KBF-CAMP-SM`     | Faja Lumbo Sacra Tipo Camp Talla S/M                                   | GMD / GMD                  | español |
| `KIT1`            | Kit 1 De Oxígeno Con Cilindro De 680 l                                 | GMD / GMD                  | español |
| `KP-II`           | Silla De Ruedas Activa Marco Rígido Oliva - 16"                        | GMD / GMD                  | español |
| `KP1-8130G-5`     | Caminador Doble Función con Ruedas                                     | GMD / GMD                  | español |
| `KP1-8150L3`      | Caminador Doble Función KP1-8150L3                                     | GMD / GMD                  | español |
| `KP1-8437`        | Rollator En Acero KP1-8437                                             | GMD / GMD                  | español |
| `KP1-8437-1`      | Rollator En Acero KP1-8437-1                                           | GMD / GMD                  | español |
| `KP1-8440`        | Rollator En Acero Con Reposapiés KP1-8440                              | GMD / GMD                  | español |
| `KP1-8440-I`      | Rollator En Acero KP1-8440-I                                           | GMD / GMD                  | español |
| `KP1342AL-19`     | Caminador Doble Función KP1342AL-19                                    | GMD / GMD                  | español |
| `KP140-14`        | Silla De Ruedas Basculante y Reclinable Énova de 35,5 cm de ancho      | GMD / GMD                  | español |
| `KP140-16`        | Silla De Ruedas Basculante y Reclinable de 40,6 cm de ancho            | GMD / GMD                  | español |
| `KP9031-12`       | Silla De Ruedas en Acero Pediátrica Lima de 30,5 cm de ancho           | GMD / GMD                  | español |
| `KP9031-14`       | Silla De Ruedas en Acero Pediátrica Lima de 35,5 cm de ancho           | GMD / GMD                  | español |
| `KP9031-18`       | Silla De Ruedas Iron Move de 45,7 cm de ancho                          | GMD / GMD                  | español |
| `KP9031-20`       | Silla De Ruedas Iron Move de 50 cm de ancho                            | GMD / GMD                  | español |
| `KP9065-12`       | Silla De Ruedas Pediátrica en Aluminio Uva de 30,4 cm de ancho         | GMD / GMD                  | español |
| `KP9065-14`       | Silla De Ruedas Pediátrica en Aluminio Uva de 35,5 cm de ancho         | GMD / GMD                  | español |
| `KP9071-16`       | Silla De Ruedas Activa Plegable Luna de 40,6 cm de ancho               | GMD / GMD                  | español |
| `KP9071-16L`      | Silla de Ruedas Estándar Plus aluminio rin radio -16L                  | GMD / GMD                  | español |
| `KP9071-18`       | Silla De Ruedas Activa Plegable Luna de 45,7 cm de ancho               | GMD / GMD                  | español |
| `KP9071-18L`      | Silla de Ruedas Estándar Plus aluminio rin radio -18L                  | GMD / GMD                  | español |
| `KP9806L`         | Silla de Ruedas De Transporte en Aluminio Tipo Avión                   | GMD / GMD                  | español |
| `KPC-BD02`        | Cama Eléctrica 3 funciones                                             | GMD / GMD                  | español |
| `KPM-A6`          | Silla De Ruedas Motorizada en Acero con batería recargable             | GMD / GMD                  | español |
| `KPM-A8`          | Silla de Ruedas Motorizada Con Batería de Litio de 44,5 cm de ancho    | GMD / GMD                  | español |
| `LTD-B10-TR`      | Tirillas Reactivas Para El Glucómetro LTD-B10 x 50 Unidades            | GMD / GMD                  | español |
| `ME-2015`         | Cilindro De Oxígeno 680 L                                              | GMD / GMD                  | español |
| `GMR870-015`      | Regulador Para Válvulas GMR870                                         | GMD (marca GMR)            | español |
| `JBS168-1`        | Grúa Hidráulica Konfort Plus                                           | GMD / Konfort Plus         | español |
| `KB-RA`           | Rodillera Universal Konfort Plus                                       | GMD / Konfort Plus         | español |
| `KB215SR-AL`      | Cómodo Sanitario En Aluminio Anodizado Konfort Plus                    | GMD / Konfort Plus         | español |
| `KB225CR-AL19`    | Cómodo Sanitario En Aluminio Anodizado Con Ruedas Konfort Plus         | GMD / Konfort Plus         | español |
| `KB225CR-AP1`     | Cómodo Sanitario En Acero Pintado Con Ruedas Konfort Plus              | GMD / Konfort Plus         | español |
| `KB311L-AL19`     | Muleta Convencional En Aluminio Talla L Konfort Plus                   | GMD / Konfort Plus         | español |
| `KB311M-AL19`     | Muleta Convencional En Aluminio Talla M Konfort Plus                   | GMD / Konfort Plus         | español |
| `KB311S-AL19`     | Muleta Convencional En Aluminio Talla S Konfort Plus                   | GMD / Konfort Plus         | español |
| `KBC-AA`          | Cabestrillo Adulto Color Azul Profundo Konfort Plus                    | GMD / Konfort Plus         | español |
| `KBC-PA`          | Cabestrillo Pediátrico Color Azul Konfort Plus                         | GMD / Konfort Plus         | español |
| `KBE-9113`        | Silla De Ruedas Estándar Desarmable En Acero Con Tapicería Acolchada K | GMD / Konfort Plus         | español |
| `KBE-9125T`       | Silla De Ruedas De Transporte Básica En Acero Konfort Plus             | GMD / Konfort Plus         | español |
| `KBE-9630L`       | Silla De Ruedas Estándar Y De Transporte En Aluminio Konfort Plus      | GMD / Konfort Plus         | español |
| `KBE-9953`        | Silla De Ruedas Estándar En Acero Reclinable Konfort Plus              | GMD / Konfort Plus         | español |
| `KBE-9953-II`     | Silla De Ruedas Estándar En Acero Bariátrica De 61,5 cm Konfort Plus   | GMD / Konfort Plus         | español |
| `KBE-9953-III`    | Silla De Ruedas Estándar En Acero Bariátrica De 56,5 cm Konfort Plus   | GMD / Konfort Plus         | español |
| `KBE1432RF-MP23L` | Silla De Ruedas De Transporte En Aluminio Konfort Plus                 | GMD / Konfort Plus         | español |
| `KBE1462FF-M23-D` | Silla De Ruedas Estándar Desarmable En Acero Con Tapicería En PVC Konf | GMD / Konfort Plus         | español |
| `KBE1462RR-PP23L` | Silla De Ruedas Estándar En Acero Con Reposapiés y Apoyabrazos Removib | GMD / Konfort Plus         | español |
| `KBE9119F`        | Silla De Ruedas Estándar En Acero Con Apoyabrazos Abatibles Konfort Pl | GMD / Konfort Plus         | español |
| `KBO1432RF-MP23`  | Silla De Ruedas De Transporte En Acero Konfort Plus                    | GMD / Konfort Plus         | español |
| `KP1-3520L`       | Silla Para Ducha Con Brazos Konfort Plus                               | GMD / Konfort Plus         | español |
| `KP1-8120L`       | Caminador Doble Función En Bronce Konfort Plus                         | GMD / Konfort Plus         | español |
| `KP1-8160L`       | Caminador Desarmable En Aluminio Konfort Plus                          | GMD / Konfort Plus         | español |
| `KP1-816L-19`     | Caminador Stand Up Doble Función Konfort Plus                          | GMD / Konfort Plus         | español |
| `KP153-AL-12`     | Caminador Con Ruedas de 5" En Aluminio Color Azul Konfort Plus         | GMD / Konfort Plus         | español |
| `KP153-AL-19`     | Caminador Con Ruedas de 5" En Aluminio Color Gris Konfort Plus         | GMD / Konfort Plus         | español |
| `KP2-6543CR-AL19` | Cómodo Sanitario En Aluminio Anodizado Con Ruedas de 120 kg Konfort Pl | GMD / Konfort Plus         | español |
| `KP271-AL-2`      | Rollator En Aluminio Konfort Plus                                      | GMD / Konfort Plus         | español |
| `KP3-67034`       | Eleva Sanitario Con Seguro Y Apoyabrazos Konfort Plus                  | GMD / Konfort Plus         | español |
| `KP3-856L-19`     | Muleta Canadiense Doble Regulación Talla L Konfort Plus                | GMD / Konfort Plus         | español |
| `KP3-856M-19`     | Muleta Canadiense Doble Regulación Talla M Konfort Plus                | GMD / Konfort Plus         | español |
| `KP321-AL-19`     | Muleta Canadiense Adulto Integral Color Plata Konfort Plus             | GMD / Konfort Plus         | español |
| `KP4-76085-20`    | Baston Plegable Con Empuñadura En T Color Negro Konfort Plus           | GMD / Konfort Plus         | español |
| `KP4-76085-22`    | Baston Plegable Con Empuñadura En T Color Cromo Konfort Plus           | GMD / Konfort Plus         | español |
| `KP4-76085-28`    | Baston Plegable Con Empuñadura En T Color Bronce Konfort Plus          | GMD / Konfort Plus         | español |
| `KP4-832L6-20`    | Bastón Para Invidente Plegable Konfort Plus                            | GMD / Konfort Plus         | español |
| `KP4102-20`       | Baston Con Empuñadura En T Ergonómico Color Negro Konfort Plus         | GMD / Konfort Plus         | español |
| `KP4102-24`       | Baston Con Empuñadura En T Ergonómico Color Madera Nogal Konfort Plus  | GMD / Konfort Plus         | español |
| `KP4102-28`       | Baston Con Empuñadura En T Ergonómico Color Bronce Konfort Plus        | GMD / Konfort Plus         | español |
| `KP4152-20`       | Bastón Cuello De Cisne Y Correa De Seguridad Color Negro Konfort Plus  | GMD / Konfort Plus         | español |
| `KP4152-22`       | Bastón Cuello De Cisne Y Correa De Seguridad Color Cromo Konfort Plus  | GMD / Konfort Plus         | español |
| `KP4152-28`       | Bastón Cuello De Cisne Y Correa De Seguridad Color Bronce Konfort Plus | GMD / Konfort Plus         | español |
| `KP4192-20`       | Bastón Tipo Paraguas Color Negro Konfort Plus                          | GMD / Konfort Plus         | español |
| `KP4192-22`       | Bastón Tipo Paraguas Color Cromo Konfort Plus                          | GMD / Konfort Plus         | español |
| `KP4192-28`       | Bastón Tipo Paraguas Color Bronce Konfort Plus                         | GMD / Konfort Plus         | español |
| `KP4202-20`       | Bastón 4 Apoyos Base Pequeña Color Negro Konfort Plus                  | GMD / Konfort Plus         | español |
| `KP4202-22`       | Bastón 4 Apoyos Base Pequeña Color Cromo Konfort Plus                  | GMD / Konfort Plus         | español |
| `KP4202-28`       | Bastón 4 Apoyos Base Pequeña Color Bronce Konfort Plus                 | GMD / Konfort Plus         | español |
| `KP4819-21`       | Bastón 4 Apoyos Con Linterna Konfort Plus                              | GMD / Konfort Plus         | español |
| `KP68080`         | Barra De Seguridad Tamaño - 30.48 cm Konfort Plus                      | GMD / Konfort Plus         | español |
| `KP68081`         | Barra De Seguridad Tamaño - 40.64 cm Konfort Plus                      | GMD / Konfort Plus         | español |
| `KP68082`         | Barra De Seguridad Tamaño - 45.72 cm Konfort Plus                      | GMD / Konfort Plus         | español |
| `KP68083`         | Barra De Seguridad Tamaño - 60.96 cm Konfort Plus                      | GMD / Konfort Plus         | español |
| `KPSEMPA2G1-27`   | Superficie Especial para el Manejo de la Presión SEMP I Konfort Plus   | GMD / Konfort Plus         | español |
| `SRELS-44`        | Silla De Ruedas Iron Light Ancho Del Asiento 44 cm Y Reposapiés Removi | GMD / Konfort Plus         | español |
| `LTD-B10`         | Glucómetro Latidos                                                     | GMD (marca Latidos)        | español |
| `LTD-B10-K`       | Kit de Glucometría Basic Latidos                                       | GMD (marca Latidos)        | español |
| `LTD-B10-L`       | Lancetas Para Glucómetros Latidos x 50 Unidades                        | GMD (marca Latidos)        | español |
| `LTD-BD-260`      | Balanza con Monitor de Grasa Latidos                                   | GMD (marca Latidos)        | español |
| `GMRN-211`        | Compresor Nebulizador Nube 3000+                                       | GMD (marca Nube)           | español |
| `GMRN-222`        | Compresor Nebulizador Nube 1000 - Figura de Búho                       | GMD (marca Nube)           | español |
| `GMRN-235`        | Compresor Nebulizador Nube 1000 - Figura de Balón de Fútbol            | GMD (marca Nube)           | español |
| `GMRN457-12`      | Compresor Nebulizador Nube 3000                                        | GMD (marca Nube)           | español |
| `GMRN457-171`     | Compresor Nebulizador Nube 1000 Con Diseño De Perro                    | GMD (marca Nube)           | español |
| `GMRN457-183`     | Compresor Nebulizador Nube 1000 Con Diseño De Pez Payaso               | GMD (marca Nube)           | español |
| `GMRN846`         | Compresor Nebulizador Nube 5000                                        | GMD (marca Nube)           | español |
| `EQ-5-C-0008`     | Prong Nasal Medin Medical                                              | Medin Medical Innovations  | inglés  |
| `EQ-5-C-0011`     | Mascarilla Medin Medical                                               | Medin Medical Innovations  | inglés  |
| `EQ-5-E-0003`     | Ventilador Neonatal No Invasivo Ref NC3 Medin                          | Medin Medical Innovations  | inglés  |
| `EQ-50-C-0004`    | Sistema de Hiperinflado de 1 Litro Mercury                             | Mercury Medical            | inglés  |
| `EQ-50-C-006`     | Sistema Resusa-Tee Ref 10-51504 Mercury                                | Mercury Medical            | inglés  |
| `SK-A3-X01`       | Cuna Neonatal X01                                                      | Saikang Medical            | español |
| `SK-AD3-X01-1`    | Cuna Neonatal X01-1                                                    | Saikang Medical            | español |
| `SK-C1-V2k`       | Camilla Manual V2k                                                     | Saikang Medical            | inglés  |
| `SKA-1B-SKB1A02`  | Camilla Transportadora SKB1A02                                         | Saikang Medical            | español |
| `SKA-1C-SKB1A01`  | Camilla Plegable SKB1A01                                               | Saikang Medical            | español |
| `SKB-1A-SKB2A10`  | Tablero Espinal SKB2A10                                                | Saikang Medical            | inglés  |
| `SKB039-H`        | Camilla Transportadora SKB039(H)                                       | Saikang Medical            | inglés  |
| `SKB3A104`        | Camilla Blanda SKB3A104                                                | Saikang Medical            | inglés  |
| `SKC-3B5-SKB039D` | Camilla para Ambulancia SKB039(D)                                      | Saikang Medical            | español |
| `SKD-C-CQ8k`      | Cama de Atención Pediátrica CQ8k                                       | Saikang Medical            | español |
| `SKE001`          | Silla de Asistente SKE001                                              | Saikang Medical            | español |
| `SKE001-19`       | Sofá de Asistente SKE001-19                                            | Saikang Medical            | inglés  |
| `SKE011`          | Silla de Espera SKE011                                                 | Saikang Medical            | inglés  |
| `SKE011-1`        | Silla de Espera SKE011-1                                               | Saikang Medical            | inglés  |
| `SKE020-1`        | Taburete SKE020-1                                                      | Saikang Medical            | español |
| `SKE941`          | Silla Reclinable SKE941                                                | Saikang Medical            | español |
| `SKE942`          | Sillón Reclinable SKE942                                               | Saikang Medical            | inglés  |
| `SKH042`          | Mesa de Sobrecama SKH042                                               | Saikang Medical            | español |
| `SKH046-2`        | Mesita de Noche SKH046-2                                               | Saikang Medical            | español |
| `SKM-A-SKR-IB00`  | Carro de ABS SKR-IB00                                                  | Saikang Medical            | español |
| `SKM-G-SKB037C`   | Camilla para Pacientes SKB037(C)                                       | Saikang Medical            | inglés  |
| `SKP011`          | Colchón Viscoelástico SKP011                                           | Saikang Medical            | francés |
| `SKR-AT625-1`     | Carro de Anestesia SKR-AT625-1                                         | Saikang Medical            | inglés  |
| `SKS008`          | Mesita de Noche SKS008                                                 | Saikang Medical            | español |
| `SKS009-2`        | Mesita de Noche SKS009-2                                               | Saikang Medical            | español |
| `SKS036`          | Mesa de Noche SKS036                                                   | Saikang Medical            | inglés  |

## 7. Despliegue (requiere tu aprobación en dos pasos)

1. **Merge del PR** a `main` → CI/CD publica en Hostinger los PDFs (`public/assets/productos/fichas/`) y el sitio se reconstruye. Hasta que se aplique el paso 2, el build sigue leyendo Supabase y mostrará los datos antiguos con enlaces a PDFs ya publicados.
2. **Aplicar las 9 migraciones** `supabase/migrations/20261002??0000_enriquecer_fichas_*.sql` con el workflow manual **"Deploy Supabase Migrations"** (`workflow_dispatch`). Son `UPDATE … WHERE slug = …` idempotentes; no crean ni borran filas. Después, lanzar un rebuild para que las landings muestren beneficios, FAQ y PDF.

Verificación realizada (sin tocar producción):

- `npm run lint`, `astro check` y `vitest` en verde.
- Build estático completo con el fallback local (1649 páginas); las landings de muestra incluyen el enlace al PDF y el PDF existe en `dist/`.
- Las 9 migraciones se ejecutaron en un PostgreSQL local desechable con un snapshot de los 718 productos de producción: 200 filas actualizadas, ejecución repetida idempotente, sin errores.
- Nota: las migraciones se generan a partir de un snapshot de hoy. Si alguien edita antes esos productos en el CMS, los campos tocados se sobrescriben.

## 8. Artefactos

- `src/data/fichas-enriquecimiento/*.json` — contenido redactado por fabricante + `manifest.json` (SKU → PDF de origen, URL oficial, idioma).
- `scripts/apply-fichas-enriquecimiento.mjs` — copia PDFs (dedupe por contenido), actualiza `mock-productos.json` y genera las migraciones. `scripts/optimize-fichas-pdf.py` recomprime imágenes. `scripts/audit-fichas-landings.mjs`, `audit-fichas-detalle.mjs`, `gmd-fichas.mjs`, `gmd-fichas-reintento.mjs` — auditoría y localización de fichas en gmd.com.co.
- Peso: el repo crece unos 193 MB por los PDFs (`public/` ya pesaba ~1 GB).
