# PR — UniX: SEO, disponibilidad y compliance (2026-11-09)

Rama: `feat/unix-seo-posicionamiento` (base `origin/main`). Sin push, PR, merge ni deploy.

Fichas afectadas (ES `/es/productos/` y EN `/en/products/`):

- `unix-wanda-2-0-pro-robot-humanoide-ref-wanda-2-0-pro-unix`
- `unix-panther-pro-robot-humanoide-ref-panther-pro-unix`
- `unix-pioneer-h-robot-cuadrupedo-ref-pioneer-h-unix`

## 1. Disponibilidad (causa raíz)

**Causa:** `ProductoCard.astro`, `ProductoLanding.astro` y el quickview de `catalogo-cliente.ts` caían al texto `producto.ficha_disponible` («Disponible» / «Available») cuando `stock` era `null` o `undefined`. Cualquier producto sin stock documentado mostraba «Disponible».

**Corrección:** lógica única en `src/lib/disponibilidad-producto.ts`:

| Caso                                                              | Nivel               | ES                                 | EN                                    |
| ----------------------------------------------------------------- | ------------------- | ---------------------------------- | ------------------------------------- |
| `disponible === false` o `stock === 0`                            | `no_disponible`     | No disponible temporalmente        | Temporarily unavailable               |
| `stock > 0` (documentado)                                         | `stock_documentado` | Stock disponible: N                | Stock disponible: N (texto existente) |
| Sin stock y sin precio público, o modo cotización/individualizado | `bajo_cotizacion`   | **Disponibilidad bajo cotización** | **Availability on request**           |
| Sin stock, con precio y otro modo                                 | `consultar`         | Consultar disponibilidad           | Check availability                    |

- Ficha (hero): usa `etiquetaDisponibilidad`.
- Tarjeta: la etiqueta «Stock» pasa a «Disponibilidad» cuando no hay stock documentado; el valor corto es «Bajo cotización» / «On request». Decisión de copy: la frase completa va en la ficha.
- Quickview del catálogo: misma regla. Ya no muestra «Disponible» para `data-disponible="1"` sin stock.
- Claves nuevas en `es.json` / `en.json`: `ficha_bajo_cotizacion`, `ficha_bajo_cotizacion_corto`, `ficha_consultar_corto`.

**Tests:** `src/lib/disponibilidad-producto.test.ts`, 9 casos (niveles; ES/EN; ningún «Disponible»/«Available» sin stock documentado).

**Guard de build:** `scripts/validate-seo.mjs` → `checkFichasUnix()` sobre `dist/` para las seis fichas. Falla si hay `>Disponible<`, `>Available<` o `Stock disponible` / `Stock Available` sin stock. Exige la frase «Disponibilidad bajo cotización» (ES) o «Availability on request» (EN). Comprueba que el título tenga un único `| I-ME`, que la meta mida ≤155 caracteres y que haya `FAQPage` JSON-LD. En EN, los grupos de especificaciones no pueden tener títulos en español. Corre con `npm run audit:seo-build` (CI y deploy-prod).

**Pendiente de decisión (no tocado):** el filtro «Disponible» del catálogo (`catalogo.disponibilidad_si`) filtra por el flag `disponible`, así que las fichas UniX entran en ese filtro. No es un texto de stock, pero el nombre sugiere disponibilidad.

## 2. Títulos (H1 sin cambios)

`src/data/producto-seo-copy.ts`: entradas para los tres slugs, con `title` y `description` en ES y EN. `ProductoSeoCopy.h1` e `intro` pasan a opcionales. Las páginas ES y EN pasan `seoH1` / `seoIntro` solo si existen (`exactOptionalPropertyTypes`). El H1 sigue siendo `producto.nombre`.

Sufijo: `Layout` no compone el título (no llama a `buildPageTitle`). El HTML generado tiene un único `| I-ME`, verificado en `dist/` y en el guard.

Títulos en `dist/`:

- ES: «Robot humanoide UniX Wanda 2.0 Pro en Colombia | I-ME» · «UniX Panther Pro: robot humanoide con ruedas en Colombia | I-ME» · «UniX Pioneer H: robot cuadrúpedo industrial en Colombia | I-ME»
- EN: «UniX Wanda 2.0 Pro Humanoid Robot in Colombia | I-ME» · «UniX Panther Pro Wheeled Humanoid Robot in Colombia | I-ME» · «UniX Pioneer H Industrial Quadruped Robot in Colombia | I-ME»

## 3. Meta descriptions

Textos del brief, sin cambios de contenido. Longitudes medidas en `dist/`: ES 143 / 149 / 154; EN 144 / 143 / 137 caracteres.

Cifras cruzadas con `src/data/mock-productos.json` (ficha del fabricante ya cargada):

- Wanda: 23 GDL, brazos de 8 GDL, LiDAR ×1, Jetson Orin NX 16G.
- Panther: 34 GDL, base 4WD omnidireccional, brazos de 8 GDL, Jetson Orin NX 16G.
- Pioneer H: IP67, ~41 kg, ruedas en las patas, 25 kg sostenidos, 2 LiDAR 3D.

Ninguna cifra cambió.

## 4. EN: especificaciones y FAQ

- `especificaciones_en` (nuevo en mock; mapeado en `datos.ts` → `mockCamposIdioma`): traducción literal de grupos y etiquetas de cada ficha (21 / 25 / 28 filas). Verificado en `dist/`: no quedan «Básicos», «Rendimiento», «Sistema» ni similares en las fichas EN.
- `preguntas_frecuentes_en`: tres preguntas por producto, espejo de las ES. Precio no publicado; no es dispositivo médico; tercera pregunta: ficha de Pioneer H en chino, Pro Max no publicado en Panther Pro, ficha oficial en inglés en Wanda. La ficha EN emite `FAQPage` JSON-LD (verificado).

## 5. Enlaces y taxonomía

- **Home ES/EN:** un enlace nuevo en el bloque de botones existente. ES: `/es/familias/robots/` «Robots humanoides y cuadrúpedos UniX en Colombia». EN: `/en/families/robots/` «UniX humanoid and quadruped robots in Colombia».
- **Distribuidores (ES/EN):** «Ver ficha» de UniX por modelo (campo `sheetCta` en `UNIX_ROBOTS`). Los demás robots conservan «Ver ficha» / «View sheet».
- **Hub de robots:** nuevo tipo `robots-humanoides-cuadrupedos` («Humanoides y cuadrúpedos» / «Humanoid and quadruped robots», orden 20) en `mock-tipos.json`. Los tres UniX se reasignan a ese tipo. Los demás robots siguen en «Robots de recepción y atención» (verificado en `dist/`).
- **Metas:**
  - Hub (`familia-seo.ts`, robots), ES (144 caracteres): «Distribuidores de robots en Colombia: humanoides y cuadrúpedos UniX, recepción, telepresencia, limpieza autónoma y logística AMR con LiDAR SLAM.» EN (142): equivalente.
  - Distribuidores (`robotica-ingenieria.ts`, PAGE), ES (151): «Distribuidores de robots en Colombia y Latinoamérica: humanoides y cuadrúpedos UniX, recepción, telepresencia, limpieza y logística AMR con LiDAR SLAM.» EN (149): equivalente.
  - La versión sugerida del brief para distribuidores superaba 155 caracteres. Se conservan «Latinoamérica» y «LiDAR SLAM», porque los tests de `robotica-ingenieria` exigen ambas palabras.
- **Artículo** `robots-asistenciales-atencion-reduccion-carga-personal` (ES y EN): párrafo nuevo en la sección 1, sin lenguaje clínico ni telemedicina, con enlaces a la familia robots, a Wanda 2.0 Pro y a Panther Pro. Verificado en `dist/`.
- **Relacionados:** `seleccionarRelacionados` pone primero los productos de la misma marca dentro de la familia. Antes solo ordenaba por slug, y los «unix…» quedaban fuera del límite de 8. Efecto generalizado: en las fichas con marca, los relacionados de la misma marca salen primero. Verificado: cada ficha UniX enlaza a las otras dos.

## 6. Pulido

- **Alt de miniaturas de galería UniX:** `galeria_alt_es` / `galeria_alt_en` (p. ej. «UniX Wanda 2.0 Pro, robot humanoide: imagen 2 de 3»). No describe escenas que no vi. `ProductoLanding` usa el alt solo cuando existe; el resto de fichas mantiene `alt=""`.
- **og:image:width / height:** eran 1200×630 fijos en todas las fichas. Ahora las fichas con `imagen_ancho` / `imagen_alto` declaran el tamaño real: Wanda 1600×900, Panther 1600×900, Pioneer H 836×585 (verificado en `dist/`). Las demás fichas siguen con el valor por defecto.
- **Recompresión Panther hero (omitida):** WebP q70 da 142 KB con PSNR 36,4 dB. Llegar a ~120 KB exige bajar más la calidad. Se deja el original por riesgo visual, y no hubo revisión visual en este entorno.
- **Pioneer H:** sin galería nueva, para no inventar imágenes.
- Sin tocar: texto de la ficha china, ausencia de Product JSON-LD sin precio, política noindex de PDF.

## 7. CMS (Supabase): requiere aplicar antes de desplegar

Sí. Producción lee `productos`, `landings` y `articulos` de Supabase. Sin estas migraciones, producción mantiene el copy anterior: meta del hub y de distribuidores, tipo «Recepción» de los UniX, FAQ EN vacía, especificaciones EN en español, alt de galería y dimensiones og.

Migraciones nuevas, **no aplicadas**, en `supabase/migrations/`:

1. `20261109210000_robotica_rehabilitacion_copy_cms.sql`: `landings` tipo `campana`, clave `robotica_rehabilitacion` (meta de distribuidores). Contenido igual a `robotica-ingenieria.ts`.
2. `20261109210100_familia_robots_copy_cms.sql`: `landings` tipo `familia`, clave `robots` (meta del hub). Contenido igual a `familia-seo.ts`.
3. `20261109210200_unix_productos_tipo_faq_specs_cms.sql`: inserta el tipo `robots-humanoides-cuadrupedos` en `tipos` (`ON CONFLICT` seguro). Reasigna `tipo_id` de los tres UniX. Fusiona en `productos.atributos` (con `||`) `preguntas_frecuentes_en`, `especificaciones_en`, `galeria_alt_es/en`, `imagen_ancho` e `imagen_alto`. Añade el párrafo del artículo solo si el ancla existe y el enlace aún no está.

Las dos primeras siguen el patrón de `20261102140000_ventiladores_landing_sin_marcas.sql` (UPDATE + `landings_historial`). Las tres son independientes entre sí. La 3 requiere que exista la familia `robots`.

Para las dos primeras, `src/lib/landings-cms.test.ts` ahora admite la corrección por migración (`CLAVES_CORREGIDAS_POR_MIGRACION` y `SLUGS_FAMILIA_CORREGIDOS_POR_MIGRACION`). Comprueba que el JSON de la migración coincide con el copy del código. No se relajó ninguna comprobación.

**Riesgos no verificados:** no hay acceso a la BD desde este entorno. Los SQL se generaron con un script a partir de los JSON; no se ejecutaron ni se parsearon con Postgres. El UPDATE del artículo puede no aplicar si el cuerpo en producción difiere del repo (en ese caso no hace nada).

## Validación

Entorno: sin `.env`, así que el build usa los datos mock del repo. La ruta Supabase no se probó.

| Paso                                            | Resultado                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`                                  | OK (sin errores, `--max-warnings 0`)                                    |
| `npm run check` (astro check)                   | 0 errores (407 archivos)                                                |
| `npx vitest run`                                | 96 archivos, 845 tests OK                                               |
| `npm run build`                                 | OK, 1479 páginas (ejecutado dos veces; el último sobre el estado final) |
| `node scripts/validate-seo.mjs` (sobre `dist/`) | OK, incluido el guard UniX                                              |

No se ejecutó `npm run validate` como un único comando. Sus cuatro pasos se corrieron por separado, y todos salieron con código 0.

Comprobaciones en `dist/` de las seis fichas: títulos, metas, frase de disponibilidad, `FAQPage` ES/EN, grupos EN, og dims, alt de galería y enlaces relacionados. Home ES/EN, distribuidores, hub y artículo verificados por HTML.

No hubo revisión visual en navegador.

## Pendiente y decisiones

1. **Conteo «ocho»:** el hub (cuerpo de `familia-seo.ts`) y la landing de distribuidores (`robotica-ingenieria.ts`) dicen «ocho referencias» / «Ocho robots». El hub muestra ahora 11 tarjetas (8 + 3 UniX). No se reescribió el cuerpo; hay que decidir el texto.
2. **Filtro «Disponible» del catálogo:** ver §1.
3. **Aplicar las tres migraciones** en Supabase antes del deploy, o editar los mismos valores en admin → Landings / productos.
4. **Verificar el cuerpo del artículo en producción** antes de aplicar la migración 3.
