# FASE 0 revisada — Discovery, scraping fiel, inventario y design tokens

**Objetivo:** capturar la verdad del sitio actual sin transformarla. Esta fase no diseña, no traduce, no normaliza inventando y no decide arquitectura futura más allá de preparar datos.

**Prompt listo para Claude Code:** pega primero el Contexto Maestro y luego este bloque completo.

```txt
[PEGAR CONTEXTO MAESTRO]

PRECONDICIÓN:
Fase -1 completada. El repo ./0106-ime-web-claude-design existe, git está inicializado,
AGENTS.md y CLAUDE.md están en raíz, y las ramas develop/main están creadas.
Si algo de esto falta, detente y ejecuta Fase -1 primero.

TAREA — FASE 0: DISCOVERY + EXTRACCIÓN FIEL DEL SITIO ACTUAL.

FUENTE DE VERDAD:
- Primaria: https://i-me.com.co/77/
- Secundaria restringida: https://i-me.com.co/1old SOLO para copy de financiación.

REGLA RECTORA:
Capturar, no crear. Cero invención. Cero rediseño. Cero traducción nueva. Si un dato no existe, se registra como faltante con etiqueta. No lo completes tú.

HECHOS BASELINE A VERIFICAR:
- Sitio estático multipágina bajo /77/: index.html, catalogo.html, servicios.html, contacto.html.
- El catálogo se renderiza por JavaScript. El HTML sin ejecutar JS puede mostrar "No hay productos en esta categoría".
- 8 familias esperadas: monitores, cardiologia, sala-cirugia, neonatologia, ultrasonido, soluciones-iv, mobiliario, anestesia.
- 8 productos destacados esperados en home: Monitor Multiparamétrico UCI Avanzado; Ecógrafo Color Doppler; Incubadora Neonatal de Transporte; Bomba de Infusión Volumétrica; Desfibrilador Bifásico; Máquina de Anestesia; Sistema Radiológico WR-3D Vertical; Sistema Radiológico WR-3D 3 en 1.
- Idioma real: español. EN no existe y debe quedar marcado como COPY_CLIENTE_REVISAR en fases futuras.
- Datos institucionales esperados: slogan "Equipamos tu misión de salvar vidas."; WhatsApp +57 313 867 4059; email info@i-me.com.co; certificaciones CE, FDA, INVIMA, ISO 13485 si aparecen; métricas 24+ categorías, 100% INVIMA, 32 Dpt, +15 años si aparecen.
- Assets esperados: /77/assets/img/logo-ime.png; /assets/img/portfolio/ImgNN.jpg; /assets/img/wr3d-*.webp; assets/video/quirofano-completo.mp4.
- Financiación desde /1old: planes flexibles, plazos hasta 60 meses, sin codeudor para instituciones de salud, financiamiento para creación de clínicas y salas de cirugía. No hay tasas reales.

==================================================================
1. ARCHIVOS Y CARPETAS DE F0
==================================================================
El repo ya existe (Fase -1). Crea los artefactos específicos de esta fase:

Archivos de control de extracción (si no existen aún):
  - PENDIENTES.md
  - BACKLOG_V2.md
  - CONTENIDO-INVENTARIO.md
  - VALIDACION_VISUAL.md
  - EXTRACCION-REPORTE.md

Carpetas de extracción:
  - src/data/
  - src/styles/
  - scripts/
  - public/assets/extraccion/img/
  - public/assets/extraccion/video/
  - public/assets/extraccion/pdf/
  - public/assets/extraccion/fonts/

Dependencia de scraping:
- Instala Playwright con Chromium: npx playwright install chromium.
  Documenta el comando exacto en README.md bajo la sección "Scraping (F0)".

==================================================================
2. EXTRACCIÓN DEL CATÁLOGO JS
==================================================================
Procede en este orden y documenta qué método funcionó.

2.1. Localizar fuente de datos preferida:
- Descarga HTML de /77/index.html y /77/catalogo.html.
- Inspecciona scripts y assets JS/CSS.
- Busca arrays/objetos/JSON/fetch relacionados con productos, categorías, specs, imágenes o filtros.
- Si encuentras la fuente primaria de datos, guárdala cruda en src/data/raw_catalogo_fuente.*.

2.2. Si no hay fuente de datos localizable:
- Renderiza con Playwright/Chromium headless:
  - /77/catalogo.html
  - /77/catalogo.html?cat=monitores
  - /77/catalogo.html?cat=cardiologia
  - /77/catalogo.html?cat=sala-cirugia
  - /77/catalogo.html?cat=neonatologia
  - /77/catalogo.html?cat=ultrasonido
  - /77/catalogo.html?cat=soluciones-iv
  - /77/catalogo.html?cat=mobiliario
  - /77/catalogo.html?cat=anestesia
- Espera a que termine el render JS.
- Extrae DOM final, cards, enlaces, imágenes y contenido visible.

2.3. Validación mínima:
- No te limites a los 8 destacados.
- Enumera todos los productos reales publicados.
- Verifica que los 8 productos destacados aparecen al menos como baseline.
- Si el catálogo real está vacío tras ejecutar JS, registra BLOQUEANTE_CONTENIDO y captura los 8 destacados de home como fallback real.

2.4. Campos por producto:
Captura sin transformar:
- id_origen si existe.
- nombre exacto.
- familia slug real.
- familia nombre visible.
- tipo/subcategoría si existe; si no existe: null y TODO_CLIENTE.
- descripción corta exacta.
- descripción larga si existe.
- especificaciones estructuradas como pares clave/valor si existen.
- specs_raw si las specs solo vienen como texto.
- grupo de especificación si existe.
- imagen_principal URL real.
- galeria URLs reales si existen.
- ficha_pdf URL real si existe.
- badges: destacado/nuevo/otros según aparezcan.
- slug si existe; si no, genera slug estable desde nombre y marca slug_generado=true.
- url_origen.
- notas_extraccion.

2.5. Formato final src/data/extraccion_ime.json:
{
  "fuente": "https://i-me.com.co/77/",
  "fecha_extraccion": "ISO-8601",
  "metodo_extraccion": "datos-js | dom-render | mixto | fallback-home",
  "familias": [
    {"slug":"...","nombre":"...","descripcion":"...","url_origen":"..."}
  ],
  "productos": [
    {
      "slug":"...",
      "slug_generado": false,
      "nombre":"...",
      "familia":"...",
      "tipo": null,
      "descripcion_corta":"...",
      "descripcion_larga":"...",
      "especificaciones":[{"clave":"...","valor":"...","grupo":null}],
      "specs_raw":"...",
      "imagen_principal":"...",
      "galeria":[],
      "ficha_pdf": null,
      "badges":[],
      "destacado": false,
      "nuevo": false,
      "url_origen":"...",
      "notas_extraccion":"..."
    }
  ],
  "conteo": {"familias": 0, "productos": 0}
}

==================================================================
3. CONTENIDO INSTITUCIONAL DE /77/
==================================================================
Guarda en src/data/contenido_ime.json el contenido real por página:

HOME:
- claim hero.
- subclaim.
- CTAs.
- Quiénes somos.
- Visión, misión, calidad, compromiso si existen.
- Valores.
- Bloques de catálogo por categoría.
- Entorno clínico.
- Servicios 01–04 y bullets.
- Métricas.
- FAQ.
- Cierre/CTA.
- slogan.

SERVICIOS:
- Todo el contenido real de /77/servicios.html.

CONTACTO:
- WhatsApp.
- email.
- teléfono.
- dirección si existe.
- redes si existen.
- campos reales del formulario.
- textos legales si aparecen.

FOOTER:
- navegación.
- categorías.
- contacto.
- copyright.

Marca COPY_CLIENTE_REVISAR cualquier texto claramente provisional.

==================================================================
4. FINANCIACIÓN DESDE /1old
==================================================================
- Extrae solo copy real de financiación.
- No extraigas diseño, colores, layout ni identidad de /1old.
- Guarda src/data/financiacion_referencia.json:
{
  "fuente": "https://i-me.com.co/1old",
  "copy": [],
  "plazos_mencionados": [],
  "condiciones_mencionadas": [],
  "tasas": null,
  "tabla": null,
  "simulador_fuente": null,
  "advertencias": ["No hay tasas reales publicadas"]
}
- Registra en PENDIENTES.md: BLOQUEANTE_LEGAL por tasas, plazos exactos, condiciones reales y aviso legal.

==================================================================
5. IDENTIDAD VISUAL Y TOKENS REALES
==================================================================
Descarga e inspecciona CSS de /77/. Guarda src/styles/tokens-extraidos.json con:
- font-family reales.
- pesos usados.
- @font-face y URLs.
- uso por titulares/cuerpo si se infiere claramente.
- colores HEX/RGB/HSL observados.
- CSS custom properties originales si existen.
- fondos, superficies, texto, marca, acento, bordes, estados.
- escala tipográfica, clamp, line-height.
- espaciados.
- radios.
- sombras.
- breakpoints.
- librerías de animación detectadas.
- descripción factual de animaciones existentes.
- assets clave: logo, video hero, imágenes por sección.

Documenta en VALIDACION_VISUAL.md sección "estado actual".

==================================================================
6. DESCARGA DE ASSETS
==================================================================
Descarga a public/assets/extraccion/ conservando nombres cuando sea posible:
- logo.
- imágenes de producto.
- imágenes WR-3D.
- imágenes de secciones.
- PDFs.
- video/poster hero.
- fuentes si están disponibles.

Crea src/data/assets_manifest.json:
[
  {"nombre":"...","url_origen":"...","ruta_local":"...","tipo":"img|video|pdf|font|otro","uso":"...","estado":"ok|404|error"}
]

Si un asset falla, anótalo en PENDIENTES.md como TODO_CLIENTE. No sustituyas por stock.

==================================================================
7. INVENTARIO Y PENDIENTES
==================================================================
CONTENIDO-INVENTARIO.md debe incluir tablas por:
- producto.
- familia.
- página.
- contacto.
- financiación.
- assets.
- idioma.

Columnas mínimas:
[dato] [existe en /77/] [valor] [falta] [etiqueta] [observación]

Marca explícitamente:
- EN ausente → COPY_CLIENTE_REVISAR.
- tipo/subcategoría ausente → TODO_CLIENTE.
- specs no estructurables → COPY_CLIENTE_REVISAR.
- tasas/condiciones financiación → BLOQUEANTE_LEGAL.
- credenciales futuras → TODO_CLIENTE.

PENDIENTES.md consolida por etiqueta.

==================================================================
PROHIBIDO EN F0
==================================================================
- Inventar productos, specs, tipos, tasas, cifras, certificaciones, clientes, testimonios.
- Traducir al inglés.
- Diseñar o mejorar estética.
- Sustituir assets por genéricos.
- Usar contenido de /1old salvo financiación.
- Normalizar datos si implica perder fidelidad.

==================================================================
ENTREGABLES F0
==================================================================
- src/data/extraccion_ime.json
- src/data/contenido_ime.json
- src/data/financiacion_referencia.json
- src/styles/tokens-extraidos.json
- src/data/assets_manifest.json
- assets descargados
- CONTENIDO-INVENTARIO.md
- VALIDACION_VISUAL.md
- PENDIENTES.md
- BACKLOG_V2.md
- EXTRACCION-REPORTE.md

==================================================================
CRITERIOS DE ACEPTACIÓN F0
==================================================================
- extraccion_ime.json contiene 8 familias mínimo y todos los productos realmente publicados.
- Los 8 destacados aparecen.
- Cada producto trae nombre, familia, descripción, specs estructuradas o specs_raw, imagen real y ficha PDF si existe.
- tokens-extraidos.json refleja fuentes y paleta reales.
- EN está marcado como ausente.
- /1old solo aporta financiación.
- Cero datos inventados.
- Reporte final: método, conteos, datos capturados, pendientes y bloqueantes.
```
