# EXTRACCION-REPORTE — F0

## Método de extracción

**Fuente primaria localizada:** `https://i-me.com.co/77/js/cms.js`

El catálogo del sitio usa un CMS basado en `localStorage` con una variable `DEFAULT_PRODUCTS`
embebida directamente en el JS. El filtro por categoría (`?cat=familia`) funciona en cliente
sobre este array. Los datos fueron extraídos directamente de la variable JS — no por render DOM.

**Método:** `datos-js` (fuente directa del JS, no DOM render)

## Resultados

| Métrica              | Valor                      |
| -------------------- | -------------------------- |
| Familias extraídas   | 8 / 8 esperadas            |
| Productos extraídos  | 24                         |
| Productos con imagen | 24 (100%)                  |
| Productos destacados | 7                          |
| Assets descargados   | 17 / 17 (100%)             |
| Specs estructuradas  | 0 (solo descripción corta) |
| Fichas PDF           | 0                          |
| Tipos/subcategorías  | 0                          |

## Decisiones de extracción

1. **Slug generado** desde nombre del producto (no existía slug en la fuente). `slug_generado: true` en todos.
2. **Destacados**: inferidos de los productos que aparecen en el carrusel de Home.
3. **Imágenes**: paths relativos del sitio (`/77/assets/img/portfolio/ImgXX.jpg`) descargados a `public/assets/extraccion/img/`.
4. **Familias**: tomadas del objeto `CATEGORIES` en cms.js con nombres oficiales.

## Pendientes registrados

### TODO_CLIENTE

- Tipos/subcategorías de los 24 productos
- Descripciones largas y specs técnicas estructuradas (fichas PDF)
- Fichas PDF de productos
- Datos de contacto: dirección, teléfono completo
- Credenciales: Supabase, LLM, Wompi, Stripe, Turnstile, Hostinger

### COPY_CLIENTE_REVISAR

- Traducción EN de todo el contenido factual
- Textos de secciones institucionales (verificar con la home real)

### BLOQUEANTE_LEGAL

- Tasas de financiación reales
- Plazos y condiciones exactos del plan de financiación
- Aliado financiero responsable de los créditos
- Aviso legal de financiación revisado por abogado

### NO_EJECUTADO_ENTORNO

- Lighthouse performance/a11y (no hay servidor activo)
- Validación de datos estructurados (no hay build con Schema real)

## Próximo paso

**F1 — Fundaciones, Home e infraestructura**

Ejecutar sobre rama `feature/fase-1` con los datos de F0 disponibles en:

- `src/data/extraccion_ime.json` — catálogo real (24 productos, 8 familias)
- `src/data/contenido_ime.json` — contenido institucional
- `src/data/financiacion_referencia.json` — copy de financiación
- `src/styles/tokens-extraidos.json` — tokens CSS (revisar y refinar)
- `public/assets/extraccion/` — assets descargados
