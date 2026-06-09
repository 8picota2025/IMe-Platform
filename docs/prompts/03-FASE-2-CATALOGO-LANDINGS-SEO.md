# FASE 2 revisada — Catálogo, landings estáticas, SEO técnico y páginas públicas

**Objetivo:** construir el núcleo comercial indexable: catálogo B2B premium con jerarquía Familia→Tipo→Producto, filtros por campo, buscador en cliente, landings estáticas por producto en ES/EN, SEO técnico y `llms.txt`. El asesor conversacional queda fuera.

```txt
[PEGAR CONTEXTO MAESTRO]

PRECONDICIÓN:
F0 y F1 completadas. Existen capa de datos mock⇄Supabase, familias/tipos/productos reales desde F0, Layout, Navbar, Footer, i18n, design system, schema.sql y rutas base.

OBJETIVO F2:
Catálogo jerárquico + landings estáticas de producto + SEO/LLM completo + páginas Servicios/Contacto/Conocimiento stub/Financiación placeholder. NO implementar asesor conversacional, CMS, carrito ni checkout.

DECISIONES DE ALCANCE:
- Asesor conversacional fuera de F2.
- Buscador F2 = palabras clave + filtros en cliente sobre índice JSON generado en build.
- Si faltan tipos, saltar nivel o agrupar en "General".
- Landings estáticas vía getStaticPaths para ES y EN.
- Financiación real y comercio llegan en F4.
- Datos faltantes se etiquetan; no se inventan.

==================================================================
A. ÍNDICE DE CATÁLOGO EN BUILD
==================================================================
Genera durante build:
- public/data/catalogo-index.es.json
- public/data/catalogo-index.en.json
- src/data/catalogo-index.es.json opcional para import local
- src/data/catalogo-index.en.json opcional

Cada item debe incluir solo lo necesario:
- id
- slug
- nombre
- familia {slug,nombre}
- tipo {slug,nombre} o null
- descripcion_corta
- imagen_principal
- tipo_comercial
- precio visible solo si real y permitido
- moneda
- mercado/precios si aplica sin inventar
- destacado
- nuevo
- texto_busqueda normalizado
- especificaciones_reducidas {clave: valor}

No incluir descripción larga completa ni payload pesado.

Normalización:
- minúsculas.
- remover acentos para búsqueda.
- conservar texto original para mostrar.
- construir texto_busqueda con nombre + descripción + specs reales.

==================================================================
B. PÁGINA DE CATÁLOGO
==================================================================
Rutas:
- /es/catalogo
- /en/catalog

Debe sentirse como catálogo B2B biomédico premium, no marketplace genérico.

B1. Vista inicial:
- header editorial.
- buscador prominente.
- tarjetas de las 8 familias reales.
- microcopy real si existe.
- imagen real si existe; si no, placeholder neutro de diseño sin stock.

B2. Jerarquía:
- Catálogo → Familia → Tipo → Producto.
- Al abrir familia, mostrar tipos.
- Si familia no tiene tipos, mostrar productos directamente.
- Productos sin tipo → grupo "General".
- Botón "Mostrar todos" en catálogo, familia y tipo.
- Migas de pan enlazables.

B3. Filtros dinámicos por campo:
- Generar facetas desde especificaciones del ámbito actual.
- Mostrar solo claves con ≥2 valores distintos.
- AND entre claves.
- OR dentro de la misma clave.
- Filtros adicionales:
  - tipo_comercial consumible/equipo.
  - destacado.
  - nuevo.
- Sidebar desktop.
- Drawer/acordeón mobile.
- contador de resultados.
- reset visible.

B4. Buscador:
- debounce 300ms.
- tolerante a acentos y mayúsculas.
- fuzzy ligero sin librería pesada o con implementación mínima.
- combinable con familia/tipo/facetas.
- resaltado de coincidencias.
- estado vacío con reset y CTA a contacto.

B5. Estado URL:
Query params:
- familia
- tipo
- q
- filtros
- pagina
- comercial
- destacado
- nuevo

Debe:
- restaurar al recargar.
- soportar back/forward.
- ser enlazable.
- no romper SSR estático.

B6. Cards:
- imagen dimensionada.
- lazy loading salvo primeras.
- nombre.
- familia/tipo.
- descripción corta.
- badges reales.
- CTA Ver detalles → landing.
- CTA secundario:
  - equipo → Solicitar cotización.
  - consumible → Añadir a lista/placeholder compra hasta F4.
- Comparar: permite añadir hasta 3 productos.

B7. Accesibilidad:
- resultados anunciados con aria-live.
- skeleton con aria-busy.
- filtros por teclado.
- drawer con focus trap y Escape.
- no focus oculto.

==================================================================
C. LANDINGS DE PRODUCTO ESTÁTICAS
==================================================================
Rutas:
- /es/productos/[slug]
- /en/products/[slug]

Implementa getStaticPaths desde capa de datos. Cada producto activo real tiene landing en ambos locales.

C1. Estructura:
- Breadcrumb: Inicio / Catálogo / Familia / Tipo si existe / Producto.
- Hero:
  - imagen destacada.
  - nombre.
  - familia/tipo.
  - descripción corta real.
  - badges.
  - CTA principal según tipo_comercial:
    - equipo → Solicitar cotización.
    - consumible → Comprar/Añadir, pero sin checkout real hasta F4; enlaza a contacto o flujo placeholder.
  - Descargar ficha PDF si existe.
- Galería:
  - lightbox accesible.
  - teclado.
  - Escape.
  - focus trap.
- Especificaciones:
  - tabla premium.
  - agrupada por grupo si existe.
  - solo datos reales.
  - si solo specs_raw, mostrar como bloque "Especificaciones publicadas" y marcar estructuración pendiente.
- Aplicaciones/usos solo si hay datos reales.
- Comparador hasta 3 productos.
- Productos relacionados:
  - misma familia/tipo.
  - no inventar razones.
- CTA sticky tras scroll.
- Bloque contacto/cotización.

C2. EN:
- UI traducida.
- contenido factual EN solo si existe validado.
- Si falta traducción: mostrar borrador marcado internamente COPY_CLIENTE_REVISAR o fallback controlado a ES con aviso para cliente en PENDIENTES, no de cara al usuario salvo decisión.
- No traducir specs técnicas inventando.

==================================================================
D. SEO TÉCNICO Y LLM
==================================================================
Por cada página:
- title único.
- description <160.
- canonical por idioma a URL final.
- hreflang recíproco es, es-CO, en, x-default.
- OG/Twitter.
- imagen OG de producto si existe.

JSON-LD:
- Organization en Home si F1 no lo completó.
- Product en landings:
  - name.
  - image.
  - description.
  - brand si es real.
  - category real.
  - no price/SKU/rating/availability si no existen.
- BreadcrumbList en internas.
- FAQPage donde haya FAQ real.

Sitemap:
- ambos locales.
- todas las landings.
- catálogo, servicios, contacto, financiación placeholder, conocimiento stub.
- alternates si Astro lo permite.

llms.txt definitivo:
- descripción de I-ME.
- propuesta de valor real.
- familias.
- productos con enlaces.
- contacto.
- notas de alcance: catálogo, cotización, financiación, soporte.

Enlazado interno:
- Home→catálogo.
- categoría→landings.
- landing→familia.
- landing→relacionados.
- footer→familias.
- texto descriptivo, no "clic aquí".

==================================================================
E. PÁGINAS PÚBLICAS RESTANTES
==================================================================
Servicios:
- /es/servicios
- /en/services
- contenido real de F0.
- hero sobrio.
- servicios 01–04 con bullets.
- flujo de trabajo si existe.
- CTA contacto.

Contacto:
- /es/contacto
- /en/contact
- formulario operativo con submitCotizacion:
  - nombre.
  - empresa.
  - email.
  - teléfono.
  - mensaje.
  - productos interesados opcional.
- estados éxito/error accesibles.
- datos reales de contacto.
- WhatsApp con mensaje precargado.
- consentimiento legal placeholder hasta F5, registrado como BLOQUEANTE_LEGAL si se opera.

Conocimiento:
- /es/conocimiento
- /en/knowledge
- stub visual.
- no inventar artículos.
- registrar BACKLOG_V2.

Financiación:
- /es/financiacion
- /en/financing
- placeholder "próximamente" o teaser con copy real si ya está extraído.
- simulador real no llega hasta F4.

==================================================================
F. PERFORMANCE
==================================================================
- imágenes con astro:assets.
- dimensiones explícitas.
- lazy salvo LCP.
- JS catálogo ligero.
- sin libs pesadas para fuzzy.
- supabase-js no en critical path público.
- presupuestos:
  - Perf mobile ≥90.
  - A11y ≥95.
  - SEO ≥95.
  - LCP <2.5s.
  - CLS <0.1.
  - TBT <200ms.
Si no se ejecuta Lighthouse, documentar NO_EJECUTADO_ENTORNO.

==================================================================
PROHIBIDO EN F2
==================================================================
- Implementar asesor conversacional.
- Implementar CMS.
- Implementar carrito/checkout.
- Renderizar landings en cliente.
- Inventar productos/specs/precios/SKUs/ratings/certificaciones/artículos.
- JSON-LD con campos no reales.
- SPA fallback.
- Cambiar identidad visual.

==================================================================
ENTREGABLES F2
==================================================================
- catalogo-index.es/en.json.
- página catálogo con jerarquía, filtros, búsqueda, URL sync.
- comparador.
- ProductoCard.
- landings estáticas ES/EN.
- galería/lightbox.
- specs table.
- SEO/meta/hreflang/JSON-LD.
- sitemap.
- llms.txt.
- Servicios y Contacto operativos.
- Conocimiento stub.
- Financiación placeholder.
- PENDIENTES.md y BACKLOG_V2.md actualizados.

==================================================================
CRITERIOS DE ACEPTACIÓN F2
==================================================================
- Catálogo navega Familia→Tipo→Producto y maneja tipos ausentes.
- Filtros por campo y buscador funcionan en cliente con URL sincronizada.
- Cada producto tiene landing estática en ES y EN.
- View-source muestra meta, hreflang y JSON-LD.
- Datos fieles a F0.
- sitemap y llms.txt incluyen landings.
- Servicios/Contacto no tienen enlaces rotos.
- Reporte de cierre con pruebas y pendientes.
```
