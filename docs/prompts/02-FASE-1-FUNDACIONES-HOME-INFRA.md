# FASE 1 revisada — Fundaciones, Home, i18n, esquema e infraestructura

**Objetivo:** levantar un sitio estático navegable, bilingüe, accesible y desplegable, con Home premium, identidad real refinada, capa de datos intercambiable, schema base, Edge Functions scaffold y contratos para pagos/IA sin implementar aún flujos reales.

**Prompt listo para Claude Code:** pega primero el Contexto Maestro y luego este bloque.

```txt
[PEGAR CONTEXTO MAESTRO]

PRECONDICIÓN:
F0 completada. Existen:
- src/data/extraccion_ime.json
- src/data/contenido_ime.json
- src/data/financiacion_referencia.json
- src/styles/tokens-extraidos.json
- src/data/assets_manifest.json
- assets en public/assets/extraccion/
- CONTENIDO-INVENTARIO.md
- PENDIENTES.md

Si algo falta, no inventes. Registra pendiente y crea mock/placeholder neutro.

OBJETIVO F1:
Fundaciones + Home premium navegable, bilingüe, accesible y desplegable. Crear backbone de datos/infra para F2-F4. NO construir catálogo completo, landings de producto, CMS, asesor real, carrito ni checkout.

DECISIONES REVISADAS:
- El asesor real NO llega en F2; llega en Fase Asesor después de F3.
- F1 solo deja shell mock del asesor, contratos Edge y schema compatible.
- Pagos reales NO se implementan en F1; se scaffoldea PaymentGateway para Wompi/Stripe en F4.

==================================================================
1. PROYECTO Y CONFIGURACIÓN
==================================================================
- Inicializa Astro 5 con TypeScript estricto.
- output: 'static'.
- site: 'https://i-me.com.co'.
- Puerto dev obligatorio: 43421.
- Integraciones: @astrojs/sitemap, @astrojs/tailwind.
- Tailwind consume CSS variables; no dupliques paleta hardcodeada.
- i18n nativo Astro:
  - defaultLocale: 'es'
  - locales: ['es','en']
  - routing prefixDefaultLocale: true
  - rutas /es/ y /en/
  - '/' redirige a /es/
- Scripts package.json:
  - dev: astro dev --host 0.0.0.0 --port 43421
  - build
  - preview
  - check
  - validate: astro check + grep seguridad + build
- Estructura mínima:
  - src/layouts/
  - src/pages/es/
  - src/pages/en/
  - src/components/
  - src/components/home/
  - src/components/ui/
  - src/lib/
  - src/data/
  - src/i18n/
  - src/styles/
  - src/admin/placeholder/
  - scripts/
  - supabase/schema.sql
  - supabase/functions/
  - public/assets/
  - .github/workflows/

==================================================================
2. i18n
==================================================================
- Crea src/i18n/es.json y src/i18n/en.json para cadenas de interfaz:
  nav, botones, footer, formularios, estados, errores, accesibilidad.
- Contenido editorial real viene desde contenido_ime.json en ES.
- EN editorial queda como traducción borrador marcada COPY_CLIENTE_REVISAR o placeholder neutro cuando no exista.
- No inventes specs ni cifras en EN.
- Crea src/i18n/utils.ts:
  - getLocale(url)
  - t(locale, key)
  - getLocalizedPath(path, locale)
  - getAlternateLinks(currentPath)
  - normalizeLocalizedSlug(entity, locale)
- Selector de idioma debe mantener ruta equivalente, no mandar siempre a Home.
- hreflang: es, es-CO, en, x-default.

==================================================================
3. DESIGN SYSTEM DESDE TOKENS REALES
==================================================================
Antes de escribir UI, lee/aplica la skill de diseño frontend del entorno si existe.

- src/styles/globals.css con CSS custom properties tomadas de tokens-extraidos.json.
- Tokens:
  - colores base reales.
  - derivadas premium para hover/focus/elevación sin cambiar identidad.
  - tipografía real self-hosted cuando sea posible.
  - font-display: swap.
  - escala fluida clamp.
  - espaciado.
  - radios.
  - sombras suaves.
  - contenedores 1180–1280px.
- Tema claro principal.
- Tema oscuro opcional diseñado, no inversión automática.
- Script anti-FOUC inline en head.
- Focus visible global.
- prefers-reduced-motion y prefers-contrast.
- Máximo cuidado con glassmorphism: contraste AA garantizado.

==================================================================
4. LAYOUT GLOBAL Y SEO BASE
==================================================================
Crea Layout.astro:
- skip-link.
- header, main, footer.
- un solo H1 por página.
- View Transitions.
- Lenis inicializado una sola vez y desactivado en reduced motion.
- GSAP/ScrollTrigger cargado solo donde se use.

Crea BaseHead.astro:
- title "Página | I-ME".
- meta description <160.
- canonical por idioma.
- hreflang.
- OG/Twitter.
- theme-color.
- favicons.
- JSON-LD Organization en Home solo con datos reales.

==================================================================
5. NAVBAR Y FOOTER
==================================================================
Navbar:
- logo real.
- links: Inicio, Catálogo, Servicios, Financiación, Contacto.
- selector idioma.
- CTA Cotizar ahora.
- toggle tema.
- badge carrito placeholder (lógica F4).
- menú mobile accesible:
  - focus trap.
  - Escape.
  - aria-expanded.
  - gestión de foco.
- indicador ruta activa.
- sombra/opacidad en scroll.

Footer:
- navegación.
- 8 familias reales.
- contacto real.
- slogan real.
- copyright.
- enlaces legales placeholder para F5.
- avisos de pendientes si faltan datos.

==================================================================
6. HOME PREMIUM
==================================================================
Reconstruye la Home de /77/ con contenido real de contenido_ime.json, refinada a premium.

Secciones en orden:
1. Hero full viewport:
   - video real quirofano-completo.mp4 si está disponible.
   - fallback imagen real.
   - claim y subclaim reales.
   - CTA Ver catálogo + Solicitar asesoría.
   - animación GSAP sobria.
   - ECG sutil no invasivo.
2. Banda de confianza:
   - métricas reales.
   - sellos reales.
   - sin contadores falsos.
3. Quiénes somos.
4. Visión/misión/calidad/compromiso si existen.
5. Valores.
6. Catálogo por categoría:
   - 8 familias reales.
   - enlaces definitivos a /catalogo.
7. Equipos destacados:
   - desde capa de datos mock.
   - cards premium.
   - Ver detalles apunta a /es/productos/[slug] aunque landing sea F2.
8. Servicios 01–04.
9. Teaser financiación:
   - copy real de financiacion_referencia.json.
   - sin tasas.
   - CTA /financiacion.
10. FAQ real.
11. Cierre emocional + CTA WhatsApp/contacto.

Animaciones:
- reveals 600–900ms.
- microinteracciones 180–260ms.
- power3.out.
- desactivar con reduced motion.
- no animación decorativa sin función.

==================================================================
7. CAPA DE DATOS INTERCAMBIABLE
==================================================================
Crea:
- src/lib/supabase.ts
- src/lib/datos.ts
- src/lib/format.ts
- src/lib/seo.ts
- src/lib/motion.ts
- src/lib/asesor.ts mock
- src/lib/payment/types.ts con interfaces, sin implementación real aún.
- src/lib/fulfillment.ts con stubs: getFulfillmentPendientes(), actualizarEstadoFulfillment(),
  getProveedorParaProducto(). No expone precio_costo fuera del servidor.

Mocks desde F0:
- src/data/mock-familias.json
- src/data/mock-tipos.json
- src/data/mock-productos.json
- src/data/mock-cotizaciones.json vacío

Funciones:
- getFamilias(locale)
- getTipos(familiaSlug, locale)
- getProductos(params, locale)
- getProductoBySlug(slug, locale)
- getProductosDestacados(locale)
- getProductosBySlugs(slugs, locale)
- buscarProductos(query, locale)
- submitCotizacion(datos)

Regla:
- Si hay env Supabase, usa Supabase.
- Si no, usa mocks.
- supabase-js fuera del critical path cuando no se necesite.

==================================================================
8. SUPABASE SCHEMA BASE
==================================================================
Crea supabase/schema.sql idempotente y comentado.

Extensiones:
- vector
- pg_trgm
- uuid-ossp o pgcrypto según convenga

Tablas:
1. familias:
   - id uuid
   - slug unique
   - nombre_es, nombre_en
   - descripcion_es, descripcion_en
   - orden int
   - activo bool
   - created_at, updated_at

2. tipos:
   - id uuid
   - familia_id FK
   - slug
   - nombre_es, nombre_en
   - orden
   - activo
   - unique(familia_id, slug)

3. productos:
   - id uuid
   - slug unique
   - familia_id FK
   - tipo_id FK nullable
   - nombre_es, nombre_en
   - descripcion_corta_es, descripcion_corta_en
   - descripcion_larga_es, descripcion_larga_en
   - especificaciones jsonb default '[]'
   - aplicaciones_es text[]
   - aplicaciones_en text[]
   - imagen_principal text
   - galeria text[]
   - ficha_pdf text
   - tipo_comercial text check ('consumible','equipo') default 'equipo'
   - fulfillment_mode text check ('dropship','cotizacion','individualizado') default 'cotizacion'
   - precio numeric nullable
   - moneda text default 'COP'
   - stock int nullable
   - destacado bool
   - nuevo bool
   - activo bool
   - orden int
   - embedding vector(1024) nullable  -- default Voyage; documentar cambio si proveedor cambia
   - busqueda_tsv tsvector
   - created_at, updated_at

4. solicitudes_cotizacion:
   - id uuid
   - nombre, empresa, email, telefono
   - productos jsonb
   - mensaje
   - consentimiento_datos bool default false
   - consentimiento_timestamp timestamptz nullable
   - leida bool
   - created_at

5. pedidos:
   - id uuid
   - cliente jsonb
   - items jsonb
   - subtotal numeric
   - total numeric
   - moneda text
   - mercado text check ('CO','INTL')
   - proveedor_pago text check ('wompi','stripe')
   - estado text
   - referencia_pasarela text unique
   - checkout_url text nullable
   - fulfillment_id uuid nullable  -- FK a fulfillments (tabla dropshipping)
   - metadata jsonb
   - consentimiento_datos bool default false
   - consentimiento_timestamp timestamptz nullable
   - leida bool
   - created_at, updated_at

6. eventos_pago:
   - id uuid
   - proveedor_pago text
   - event_id text
   - referencia_pasarela text
   - payload jsonb
   - procesado bool
   - created_at
   - unique(proveedor_pago, event_id)

7. articulos:
   - id uuid
   - slug unique
   - titulo_es, titulo_en
   - cuerpo_es, cuerpo_en
   - publicado bool
   - created_at, updated_at

8. llm_uso y asesor_uso pueden dejarse como stub o comentadas para Fase Asesor.

9. proveedores (módulo dropshipping):
   - id uuid
   - slug text unique
   - nombre text
   - contacto_email text
   - contacto_whatsapp text
   - canal text check ('email','whatsapp','webhook','api','manual') default 'email'
   - webhook_url text nullable
   - api_config jsonb nullable
   - notas text
   - activo bool default true
   - created_at, updated_at

10. proveedor_producto (relación proveedor↔producto con precio confidencial):
    - id uuid
    - proveedor_id uuid → proveedores
    - producto_id uuid → productos
    - precio_costo numeric  -- CONFIDENCIAL: nunca en APIs públicas ni cliente
    - moneda_costo text default 'COP'
    - prioridad int default 1  -- 1 = proveedor preferente si hay varios
    - activo bool default true
    - unique(proveedor_id, producto_id)

11. fulfillments (seguimiento de envíos):
    - id uuid
    - pedido_id uuid → pedidos
    - proveedor_id uuid → proveedores
    - estado text check ('pendiente','notificado','preparando','enviado','entregado','cancelado','error') default 'pendiente'
    - tracking_number text nullable
    - tracking_url text nullable
    - notas text
    - notificado_at timestamptz nullable
    - enviado_at timestamptz nullable
    - entregado_at timestamptz nullable
    - error_detalle text nullable
    - created_at, updated_at

RLS módulo dropshipping:
- proveedores: solo authenticated lee/escribe.
- proveedor_producto: solo authenticated. precio_costo visible solo aquí, nunca en APIs públicas.
- fulfillments: solo authenticated y service_role de Edge Functions.

RPC dropshipping:
- get_proveedor_para_producto(p_producto_id uuid): devuelve proveedor_id, canal,
  contacto_email, contacto_whatsapp, webhook_url, api_config para el proveedor activo
  de mayor prioridad. security definer. No expone precio_costo.

Índices:
- productos slug, familia_id, tipo_id, activo, destacado.
- GIN especificaciones.
- GIN busqueda_tsv.
- HNSW embedding comentado/activo según extensión disponible.

Triggers:
- updated_at.
- busqueda_tsv.

RLS:
- familias/tipos/productos/articulos SELECT público solo activo/publicado.
- escritura solo authenticated.
- solicitudes_cotizacion INSERT público; SELECT solo authenticated.
- pedidos SELECT solo authenticated; escritura real por Edge Functions service_role.
- eventos_pago solo service_role/auth según política.

Storage buckets:
- productos
- fichas
- articulos
lectura pública, escritura authenticated.

==================================================================
9. EDGE FUNCTIONS SCAFFOLDING
==================================================================
Crea carpetas con index.ts stub + README por función:
- asesor/              -> Fase Asesor
- generar-embeddings/  -> Fase Asesor
- ingesta-pdf/         -> F3
- crear-pago/          -> F4
- webhook-wompi/       -> F4
- webhook-stripe/      -> F4
- trigger-rebuild/     -> F3
- _shared/
  - cors.ts
  - errors.ts
  - supabase-server.ts
  - payment-gateway.ts  -- interfaces Wompi/Stripe, sin secretos ni lógica real
  - llm-gateway.ts      -- interface mínima, implementación real F3/Fase Asesor

Todas:
- CORS restringible.
- manejo de errores estándar.
- sin claves reales.
- README con variables requeridas.

==================================================================
10. SHELL DEL ASESOR MOCK
==================================================================
- Componente Asesor.astro + TS vanilla.
- Widget flotante o embebible.
- Accesible:
  - rol dialog.
  - focus trap.
  - Escape.
  - aria-live.
  - teclado completo.
- En F1 responde mock desde src/lib/asesor.ts.
- Carga diferida al interactuar.
- Indicar en PENDIENTES.md que lógica real llega en Fase Asesor.

==================================================================
11. INFRA Y DESPLIEGUE
==================================================================
public/.htaccess:
- compresión.
- cache assets.
- security headers básicos.
- redirect / a /es/.
- no SPA fallback.

robots.txt:
- Disallow /admin
- Sitemap.

llms.txt placeholder.

.env.example:
- PUBLIC_SUPABASE_URL
- PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- VOYAGE_API_KEY
- WOMPI_PUBLIC_KEY
- WOMPI_PRIVATE_KEY
- WOMPI_EVENTS_SECRET
- STRIPE_PUBLIC_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- TURNSTILE_SITE_KEY
- TURNSTILE_SECRET_KEY
- CI_DEPLOY_HOOK / GITHUB_TOKEN según estrategia

Los workflows de CI/CD ya existen desde Fase -1:
- `.github/workflows/ci.yml` — lint + check en cada PR.
- `.github/workflows/deploy-preprod.yml` — deploy a staging al merge en preprod.
- `.github/workflows/deploy-prod.yml` — deploy a raíz al merge en main + repository_dispatch.

En F1 NO se crean nuevos workflows. Verifica únicamente:
- `deploy-prod.yml` tiene habilitado el evento `repository_dispatch` (necesario para el trigger-rebuild de F3).
- Los nombres de secrets en los workflows coinciden con los de `.env.example` recién creado.
- Si algún workflow falta porque Fase -1 no se ejecutó, créalo siguiendo la especificación de Fase -1.
- Documenta cualquier discrepancia como TODO_CLIENTE en PENDIENTES.md.

==================================================================
12. ACCESIBILIDAD Y PERFORMANCE BASELINE
==================================================================
- WCAG 2.2 AA.
- contraste 4.5:1 / 3:1.
- navegación teclado.
- focus visible.
- alt correcto.
- imágenes dimensionadas.
- fuentes con swap.
- supabase-js fuera del critical path.
- Lighthouse objetivo Home mobile Perf ≥90, A11y ≥95, SEO ≥95.
- Si no se puede ejecutar, documentar NO_EJECUTADO_ENTORNO.

==================================================================
PROHIBIDO EN F1
==================================================================
- Construir catálogo completo o landings.
- Implementar asesor real.
- Implementar CMS.
- Implementar carrito o checkout.
- Inventar datos.
- Exponer service_role.
- Usar SPA fallback.
- Cambiar identidad visual de forma ajena al sitio real.

==================================================================
ENTREGABLES F1
==================================================================
- Proyecto Astro arrancable en :43421.
- i18n ES/EN con hreflang.
- globals.css con tokens reales refinados.
- Layout + BaseHead.
- Navbar + Footer.
- Home premium.
- Mocks desde F0.
- capa datos mock⇄Supabase.
- schema.sql.
- Edge Functions scaffolding.
- shell asesor mock.
- .htaccess, robots.txt, llms.txt.
- .env.example.
- Workflows de Fase -1 verificados (repository_dispatch activo en deploy-prod.yml).
- README.md actualizado.
- PENDIENTES.md actualizado.

==================================================================
CRITERIOS DE ACEPTACIÓN F1
==================================================================
- npm run dev levanta en localhost:43421.
- Home refleja identidad real refinada.
- ES/EN funciona y mantiene ruta equivalente.
- Navegación por teclado completa.
- Un solo H1.
- Home usa contenido real F0.
- Schema soporta Familia→Tipo→Producto, comercio híbrido, pedidos con proveedor Wompi/Stripe y embeddings futuros.
- service_role y claves privadas no aparecen en cliente/dist.
- npm run build genera dist desplegable.
- Reporte final claro con pendientes.
```
