# Fichas PDF → landing ES/EN (agente Hermes `contenidos`)

Sustituye a `scripts/enrich-product-locale-fields-hermes.mjs` (usaba el perfil
`biomedsvc`, ya retirado, y escribía en Supabase con la service role).

## Flujo

1. Se deja un PDF descriptivo en `~/ime-fichas/entrada/` del servidor Hermes
   (más adelante también por Telegram vía Enlace).
2. Una unidad `path` de systemd de usuario lanza `hermes -p contenidos` con la
   skill `ficha-pdf-landing`: extrae el texto, busca si el producto existe
   (`buscar_productos`) y redacta el contenido en español e inglés sin inventar
   datos (INVIMA, garantías, prestaciones).
3. Solo por MCP `ime-comercio` (nunca con la service role):
   - `subir_ficha_pdf` → URL firmada (PUT, 2 h) al bucket `fichas`,
     ruta `propuestas/<slug>/<sha256[:16]>.pdf`.
   - `proponer_producto` (producto nuevo) o `proponer_ficha` (existente). Ambas
     aceptan `nombre_en` y `atributos` de landing
     (`beneficios_*`, `valor_*`, `preguntas_frecuentes_*`, `seo_keywords_*`)
     y el estudio SEO (`seo_es|en`: title, meta description, H1/H2, intención;
     `estudio_seo`: consultas reales de Google Search Console, canibalización,
     enlaces internos, slug). `seo_es|en` aún no sobrescribe el title/meta que
     genera `buildProductoSeo`: queda para revisión y un PR posterior.
4. Revisión humana obligatoria en el admin:
   - Ingesta PDF → "Productos propuestos desde fichas PDF" → **Crear producto
     inactivo** (sin precio) o Rechazar.
   - Ficha de producto → "Propuestas del agente" → Aplicar (los atributos se
     mezclan, no se reemplazan) o Rechazar.
5. Al publicar, `scripts/mirror-fichas-pdf.mjs` (antes de `astro build`) copia
   los PDF de Storage de productos activos a
   `public/assets/productos/<slug>/ficha-tecnica.pdf`; la landing enlaza esa
   copia del hosting (Hostinger) y, si no existe, la URL de Storage.

## Migración

`20261009170000_comercio_propuesta_producto.sql` amplía el guard de
`comercio_confirmaciones` para que `proponer_producto` siga el flujo de
`proponer_ficha` (pendiente → confirmada/rechazada por un perfil del CMS).
