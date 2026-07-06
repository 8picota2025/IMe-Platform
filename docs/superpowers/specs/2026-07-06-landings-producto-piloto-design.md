# Landings enriquecidas de producto — piloto (5 productos)

## Contexto

Existen 39 PDFs de ficha técnica en `/home/shoky/FTP/pdf producto` (38 mapean a
productos ya existentes en el catálogo por nombre/fabricante). Un usuario generó
7 maquetas HTML de referencia en `/home/shoky/FTP/landings-nuevas` como bocetos
de estilo/contenido — **no son para publicar tal cual**: usan navbar/footer
propios desconectados del sitio real, y contienen testimonios y una calificación
agregada inventados (ej. "Dra. Carmen López", "4.8 ★ / 24 reseñas"), lo cual
choca con la regla inamovible de este proyecto (`AGENTS.md`): **cero datos
inventados, incluidos testimonios**.

El sitio real (`cursor/IMe-Platform`, Astro 6) ya renderiza cada producto vía
`src/pages/{es,en}/productos|products/[slug].astro` → `ProductoLanding.astro`,
a partir de un único registro `Producto` (ES/EN en el mismo objeto, con
`especificaciones[]`, `galeria[]`, `ficha_pdf`, `descripcion_larga_es/en`,
`aplicaciones_es/en`). Los datos vienen de Supabase en producción y de
`src/data/mock-productos.json` como fallback local (`src/lib/datos.ts`).

En el otro clon local del mismo repo (`Documents/I-ME/0106-ime-web-claude-design`)
hay scripts sin commitear (`scripts/enrich-product-locale-fields*.mjs`,
`audit-product-fields.mjs`) que ya leen/escriben esta tabla con un LLM local
(Hermes) y una instrucción explícita de "no inventar". Se reutilizan/adaptan en
vez de reconstruir.

## Objetivo del piloto

Enriquecer 5 fichas de producto reales de principio a fin (datos, imágenes,
PDF descargable, copy persuasivo, SEO/AEO) para validar el patrón antes de
replicarlo a los 34 productos restantes.

## Productos piloto

1. Monitor de Paciente M12 — Biolight (`eq-monitor-de-paciente-m12-biolight`)
2. Sistema de Hipotermia Criticool — Belmont (`eq-sistema-de-hipotermia-criticool-belmont`)
3. Ten 20 Pasta Conductiva — Natus (`eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus`)
4. Ventilador Neonatal Pediátrico 6000 — SLE (`eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle`)
5. Máquina de Anestesia Prima Ref 460 — Penlon (`eq-maquina-de-anestesia-prima-ref-460-penlon`)

Variedad deliberada: monitor de gama media, equipo especializado, consumible
simple, ventilador de alta complejidad, máquina de anestesia — para que el
patrón de contenido/SEO se pruebe contra distintos niveles de complejidad
técnica antes de escalar.

## No-objetivos (fuera de este piloto)

- Los 34 productos restantes (fase siguiente, tras aprobar el patrón).
- Migración de esquema en Supabase (se usa `atributos` JSONB existente, sin
  `ALTER TABLE`).
- Páginas HTML estáticas independientes (descartado en la fase de diseño).
- Cuenta de LinkedIn, campañas de ads u otro contenido no pedido.

## Pipeline de contenido por producto

1. **Extracción del PDF**: texto ya disponible en
   `FTP/landings-nuevas/pdf_content.json`; extraer imágenes embebidas del PDF
   (`pdfimages`/`pdftoppm`) como primera fuente de fotos reales.
2. **Imágenes complementarias**: si el PDF no trae suficientes fotos de
   calidad, buscar en el sitio oficial del fabricante (mismo criterio que la
   campaña de imágenes de junio/2026 ya documentada en memoria del proyecto).
   Sin fotos inventadas/genéricas de stock que no sean el producto real.
3. **Especificaciones** (`especificaciones[]`, clave/valor/grupo): solo datos
   presentes en el PDF o la página oficial del fabricante.
4. **Copy persuasivo pero veraz** (pedido explícito del usuario): traducir
   cada especificación relevante en un beneficio para el comprador, en
   lenguaje cercano y convincente — no un volcado técnico plano. Ejemplo:
   "Pantalla táctil de 12.1″" → _"Visualiza hasta 7 parámetros a la vez en una
   pantalla táctil de 12.1″, para decisiones clínicas más rápidas."_ Cada
   frase de beneficio debe ser trazable a un dato real (spec, aplicación
   documentada, certificación del fabricante) — no se exageran prestaciones
   ni se inventan cifras.
5. **Aplicaciones clínicas** (`aplicaciones_es/en`, ya existe como columna
   `TEXT[]`): usos reales documentados en el PDF o material del fabricante.
6. **PDF descargable**: copiar a
   `public/assets/productos/importados/<slug>/ficha-tecnica.pdf` y setear
   `ficha_pdf`. El botón de descarga ya existe en `ProductoLanding.astro`
   (línea ~182); solo falta el dato.
7. **Bloque de valor (no "testimonio")**: se buscará en el sitio del
   fabricante un caso real con nombre y foto de un profesional. Si no existe
   para ese producto, en vez de fabricar una cita atribuida, se incluye un
   bloque corto "Por qué lo eligen las instituciones" con 1-2 frases de valor
   **sin comillas ni firma de una persona inexistente** — visualmente en la
   misma zona que ocuparía un testimonio, pero sin simular que alguien lo dijo.
   Si sí existe un caso real, se usa con crédito visible al fabricante/fuente.
8. **SEO/AEO**: ampliar `buildProductoSeo` (ya existe en `src/lib/seo.ts`) para
   ese producto con keywords reales del sector (nombre técnico + sinónimos
   clínicos + marca/modelo) en `title`, `description` y JSON-LD `Product`;
   añadir un párrafo autocontenido y citable (frases que respondan una
   pregunta completa por sí solas) pensado para motores de respuesta IA
   (ChatGPT/Perplexity/AI Overviews), sin keyword stuffing.
9. **Sincronización de datos**: actualizar `mock-productos.json` (dev) y la
   tabla `productos` en Supabase (prod) para estos 5 registros, adaptando los
   scripts `enrich-product-locale-fields*.mjs` del otro clon.

## Cambios de plantilla (`ProductoLanding.astro`)

Hoy la plantilla tiene: breadcrumb, hero (con CTA/precio/ficha resumen),
galería, especificaciones, relacionados, CTA de contacto, reseñas reales
(`Resenas.astro`), CTA sticky. **Faltan** dos secciones que sí aparecen en las
maquetas de referencia y que el usuario pidió mantener:

- **"Beneficios clave"**: grid de 3-4 tarjetas cortas (icono + frase de
  beneficio), justo después del hero. Contenido = los beneficios redactados en
  el paso 4, no texto libre nuevo por producto.
- **Bloque de valor** del paso 7, ubicado donde iría un testimonio (antes del
  bloque de contacto).

Ambas seguirán los design tokens ya definidos en `globals.css`
(`var(--t900)`, `var(--radius-lg)`, etc.), no el CSS propio de las maquetas.
Los datos de beneficios se guardan en `atributos.beneficios_es` /
`atributos.beneficios_en` (arrays de strings cortos) para no requerir
migración de esquema.

## Flujo de datos e i18n

- Nuevas claves de traducción (`producto.beneficios_titulo`,
  `producto.valor_titulo`, etc.) en `src/i18n/es.json` y `en.json`.
- `especificaciones`, `aplicaciones_es/en`, `atributos.beneficios_es/en`,
  `ficha_pdf`, `galeria` se escriben tanto en `mock-productos.json` como en
  Supabase para los 5 slugs piloto, para que dev y prod coincidan.

## Flujo git / despliegue

- Rama `feature/landings-producto-piloto` sobre `cursor/IMe-Platform`.
- Commits por producto o por tipo de cambio (plantilla vs. datos), siguiendo
  conventional commits del proyecto.
- PR abierto para revisión antes de merge a `main` (que dispara CI/CD).
- Los `UPDATE` en la tabla `productos` de Supabase producción se ejecutan solo
  después de que el PR esté aprobado (afectan datos en vivo aunque el código
  esté en rama).
- `npm run validate` debe pasar antes de cada commit (regla de `CLAUDE.md`).

## Verificación

- Levantar el dev server y revisar visualmente `/es/productos/<slug>` y
  `/en/products/<slug>` para los 5 productos (secciones nuevas, imágenes,
  botón de descarga de PDF funcionando, specs correctas).
- Revisar que ningún texto nuevo contenga cifras/certificaciones no
  verificables contra el PDF/fabricante.
- Confirmar JSON-LD válido (`Product` schema) y metadatos únicos por
  idioma/producto.

## Criterios de éxito del piloto

- Las 5 fichas muestran fotos reales del producto (no placeholder).
- Cada ficha tiene especificaciones reales, aplicaciones clínicas reales,
  sección de beneficios en lenguaje persuasivo pero veraz, PDF descargable,
  y SEO/AEO específico — sin ningún dato o testimonio inventado.
- El usuario aprueba el patrón visual/de contenido antes de replicarlo a los
  34 productos restantes.
