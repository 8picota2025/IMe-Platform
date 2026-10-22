# I-ME Platform — Instrucciones de proyecto para agentes IA

## Identidad del proyecto

E-commerce biomédico premium B2B para I-ME (International Medical Enterprise).
Mercados: Colombia, España, Latinoamérica.
Working dir: /home/shoky/Documents/I-ME/0106-ime-web-claude-design
Dev: http://localhost:44334

## Stack

- Frontend: Astro 6 SSG, output static, TypeScript estricto, TailwindCSS
- Hosting: Hostinger estático (dist/) vía CI/CD FTP/SSH
- Backend/secretos: Supabase Edge Functions (Deno)
- Datos: Supabase Postgres + Auth + Storage, RLS estricta
- Pagos: Wompi (Colombia) + Stripe (INTL) tras capa PaymentGateway swappable
- IA: gateway LLM swappable (Claude/OpenAI) + embeddings Voyage voyage-3 (1024 dims)
- Animación: GSAP + ScrollTrigger + View Transitions + Lenis

## Modelo comercial (dropshipping)

- consumible → pago online (Wompi/Stripe) → notificar proveedor → proveedor envía
- equipo_dropship → cotización → aprobada → notificar proveedor → proveedor envía
- equipo_cotizacion → cotización sin fulfillment automático
- equipo_individualizado → atención personalizada → fulfillment a medida
- fulfillment_mode enum: 'dropship' | 'cotizacion' | 'individualizado'
- precio_costo: CONFIDENCIAL — nunca al cliente, nunca en dist/

## Decisiones inamovibles

- Sin React, sin framer-motion, sin Three.js
- service_role y claves privadas SOLO en Edge Functions, jamás en cliente o dist/
- Cero datos inventados (productos, specs, precios, tasas, certificaciones)
- i18n: /es/ default (es-CO) y /en/, hreflang completo
- Reconstrucción de landings: publicar en CMS → rebuild CI → deploy estático
- El cliente NUNCA decide que un pago está aprobado
- precio: campo único numeric (COP), sin precios jsonb
- Asesor comercial puro — prohibido diagnóstico, consejo clínico, precio comprometido

## Estructura de archivos clave

src/layouts/Layout.astro
src/pages/es/{index,catalogo,productos/[slug],servicios,financiacion,contacto,admin}.astro
src/pages/en/{index,catalog,products/[slug],services,financing,contact,admin}.astro
src/pages/{es,en}/legal/[slug].astro
src/components/{Navbar,Footer,Hero,CatalogoGrid,ProductoCard,ProductoShell,Asesor,Carrito,SimuladorFinanciero}.astro
src/lib/{supabase,datos,embeddings,llm-gateway,payment-gateway,cotizacion,fulfillment,format,seo,motion}.ts
src/data/{mock-productos,mock-familias,mock-tipos,financiacion,contacto,extraccion_ime}.json
src/i18n/{es,en}.json + utils.ts
src/styles/globals.css
supabase/{schema.sql,functions/}
.github/workflows/{ci.yml,deploy-preprod.yml,deploy-prod.yml}
docs/prompts/
CLAUDE.md, AGENTS.md, PENDIENTES.md, BACKLOG_V2.md, README.md

## Convenciones de código

- TypeScript strict: noUncheckedIndexedAccess, no any implícito
- CSS: variables de design tokens en globals.css; cero colores hardcodeados en componentes
- Commits: conventional commits (feat|fix|chore|docs|refactor|test|perf|style)(scope): mensaje
- No outline:none sin visible focus substitute
- prefers-reduced-motion desactiva animaciones complejas
- Imágenes: siempre con width/height; lazy salvo LCP; astro:assets

## Lo que NO debes hacer

- Inventar datos, specs, precios, tasas, certificaciones o testimonios
- Exponer service_role, claves LLM o claves de pasarela en cliente o dist/
- Añadir React, framer-motion o Three.js
- Crear features de fases futuras dentro de la fase actual
- Commitear .env con valores reales

## Estado de fases (actualizar al cerrar cada una)

[x] Fase -1 — Infra, GitHub, agentes, CI/CD | rama: main (base)
[x] F0 — Discovery y tokens | rama: feature/fase-0
[x] F1 — Fundaciones, Home e infra | rama: feature/fase-1
[x] F2 — Catálogo, landings y SEO | rama: feature/fase-2
[x] F3 — CMS, ingesta PDF y rebuild | rama: feature/fase-3
[x] Asesor — RAG conversacional | rama: feature/fase-asesor
[x] F4 — Comercio híbrido y dropshipping | rama: feature/fase-4 (código implementado; pruebas reales bloqueadas por credenciales)
[x] F4.1 — Escenario A y cierre de Comercio (Wompi v1.1) | rama: feature/fase-4.1 (código implementado; migración SQL `productos.disponible`/`disponible_actualizado_at` aplicada en BD real el 2026-06-15 — ver PENDIENTES; origen: plataforma/prompts/IME_F4_Commerce_Pasarelas_v1.1.md + huecos F1 §8.3/§8.5)
[ ] F5 — Auditoría, legales y despliegue | rama: feature/fase-5 (iniciada)

## Etiquetas de pendiente (usar exactamente estas)

TODO_CLIENTE | COPY_CLIENTE_REVISAR | BLOQUEANTE_BACKEND | BLOQUEANTE_CONTENIDO
BLOQUEANTE_LEGAL | OPCIONAL_MEJORA | BACKLOG_V2 | NO_EJECUTADO_ENTORNO

## Cursor Cloud specific instructions

- Comandos estándar (dev/build/check/lint/test/validate) están en `README.md` y `package.json`; no los dupliques.
- El dev server (`npm run dev`) escucha en `0.0.0.0:44334`. Funciona **completo sin backend**: `src/lib/datos.ts`/`supabase.ts` degradan a los JSON mock en `src/data/mock-*.json` cuando faltan las vars de Supabase, así que el catálogo, fichas de producto y flujo de cotización/carrito son navegables sin credenciales. No hace falta Supabase para verificar la UI del producto.
- `.env` no es necesario para arrancar; `cp .env.example .env` deja todos los valores en blanco y el sitio arranca igual. Todos los servicios externos (Supabase, Wompi/Stripe, LLM/Voyage, Turnstile, Ollama) son opcionales para desarrollo local y sólo se necesitan para probar flujos dinámicos reales (pago real, login admin, Asesor RAG).
- `npm run build` ejecuta primero `scripts/mirror-cms-images.mjs`, que es un **no-op silencioso sin credenciales de Supabase**, por lo que el build funciona offline (genera ~995 páginas estáticas).
- Node: `engines` pide `>=22.12.0`. Al instalar aparece un warning `EBADENGINE` de una dependencia transitiva que pide `>=22.22.1`; con el Node 22.14 del entorno todo (install/lint/check/test/build/dev) funciona correctamente — es sólo un warning.
- Supabase Edge Functions (`supabase/functions/`, Deno) se despliegan a Supabase Cloud vía CI; no hay `supabase/config.toml` ni stack local en el repo.
