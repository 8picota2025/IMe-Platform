# FASE -1 — Arquitectura de desarrollo: GitHub, Claude Code y Codex en paralelo

> Se ejecuta ANTES que cualquier otra fase. Produce la infraestructura de desarrollo sobre la que
> corren F0–F5. No genera código de aplicación: genera el **entorno, los convenios, la memoria
> compartida de los agentes y los pipelines** que hacen que todo lo demás funcione de forma
> coherente con dos agentes de IA en paralelo.

---

## PROMPT PARA CLAUDE CODE — FASE -1

```
Eres un ingeniero senior de DevOps y arquitectura de desarrollo. Tu tarea es configurar
la infraestructura de desarrollo completa del proyecto I-ME antes de que empiece el código.

PROYECTO: I-ME Platform — plataforma biomédica e-commerce (catálogo, dropshipping, asesor IA,
CMS, pagos híbridos). Stack: Astro 5 SSG + Supabase + Edge Functions + TypeScript estricto.

CONTEXTO IMPORTANTE: el proyecto usará DOS agentes de IA en paralelo:
  - Claude Code (Anthropic) — lee CLAUDE.md y AGENTS.md
  - Codex CLI (OpenAI) — lee AGENTS.md
La coordinación entre ambos se hace por Git. La memoria compartida vive en AGENTS.md.
El repo de GitHub es el punto de sincronización: sin commit, sin cambio de agente.

Working dir: ./0106-ime-web-claude-design
Dev server esperado: http://localhost:43421

==================================================================
1. PREREQUISITOS (documentar, no instalar automáticamente)
==================================================================
Genera SETUP.md con los pasos de instalación local verificados:
  - Node.js LTS (≥20). Crear .nvmrc con la versión exacta.
  - Git configurado con identidad y SSH key para GitHub.
  - Claude Code: npm install -g @anthropic-ai/claude-code
    (verificar en https://docs.anthropic.com/en/docs/claude-code/overview)
  - Codex CLI: npm install -g @openai/codex
    (verificar en https://developers.openai.com/codex/cli/reference)
  - Playwright para scraping en F0: npx playwright install chromium
  - VS Code recomendado con extensiones: ESLint, Prettier, GitLens, Astro.
  Para cada herramienta: cómo verificar que está instalada (comando --version o equivalente).

==================================================================
2. REPOSITORIO GITHUB
==================================================================
Configura el repositorio ./0106-ime-web-claude-design como git repo y genera los artefactos:

2a. ESTRUCTURA DE RAMAS:
  - main          → producción (raíz Hostinger). Protegida: merge solo por PR + 1 aprobación.
  - preprod       → pre-producción (staging). Protegida: merge solo por PR.
  - develop       → integración. Rama base para trabajo diario.
  - feature/fase-0, feature/fase-1 ... feature/fase-asesor, feature/fase-4, feature/fase-5
                  → una rama por fase. Se crea al iniciar la fase, se fusiona a develop al cerrar.
  Documenta el flujo en CONTRIBUTING.md:
    1) git checkout develop && git pull
    2) git checkout -b feature/fase-X
    3) trabajar con el agente
    4) commit + push antes de cambiar de agente o de sesión
    5) PR feature/fase-X → develop → review → merge
    6) Al cerrar F5: PR develop → preprod → auditoría de contenido → PR preprod → main

2b. ARCHIVOS DE CONFIGURACIÓN DEL REPO:
  - .gitignore: node_modules, dist, .env*, .DS_Store, *.log, .astro, .cache, playwright-report.
  - .gitattributes: LF endings para .ts, .astro, .md, .json, .css.
  - .nvmrc: versión Node LTS exacta.
  - .editorconfig: indent_size=2, charset=utf-8, trim_trailing_whitespace=true.
  Crea también .github/PULL_REQUEST_TEMPLATE.md con secciones:
    ## Fase / descripción, ## Qué hace este PR, ## Cómo probarlo,
    ## Checklist ([ ] lint, [ ] check types, [ ] sin secretos, [ ] PENDIENTES actualizado).

2c. SECRETS DE GITHUB (documentar nombres, no valores):
  Genera .github/SECRETS.md (NO commiteado — añadir a .gitignore) con la lista de secrets que
  deben crearse en Settings > Secrets and variables > Actions:
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (solo en EF)
    ANTHROPIC_API_KEY, OPENAI_API_KEY, VOYAGE_API_KEY
    WOMPI_PUBLIC_KEY, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET
    STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
    TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY
    HOSTINGER_FTP_HOST, HOSTINGER_FTP_USER, HOSTINGER_FTP_PASSWORD (o SSH equivalente)
    HOSTINGER_PREPROD_PATH, HOSTINGER_PROD_PATH
  Instrucción: crear .github/SECRETS.md como archivo local, añadirlo al .gitignore global o local,
  y cargar los valores reales en GitHub una vez disponibles (TODO_CLIENTE).

==================================================================
3. MEMORIA COMPARTIDA DE AGENTES: AGENTS.md + CLAUDE.md
==================================================================
Este es el artefacto más importante de la fase.

3a. AGENTS.md (raíz del proyecto) — fuente de verdad COMPARTIDA para Claude Code y Codex:
Crea AGENTS.md con el siguiente contenido (dense, cero relleno):

---
# I-ME Platform — Instrucciones de proyecto para agentes IA

## Identidad del proyecto
E-commerce biomédico premium B2B para I-ME (International Medical Enterprise).
Mercados: Colombia, España, Latinoamérica.
Working dir: ./0106-ime-web-claude-design  |  Dev: http://localhost:43421

## Stack
- Frontend: Astro 5, output static, TypeScript estricto, TailwindCSS
- Hosting: Hostinger estático (dist/) vía CI/CD
- Backend/secretos: Supabase Edge Functions (Deno)
- Datos: Supabase Postgres + Auth + Storage, RLS estricta
- Pagos: Wompi (Colombia) + Stripe (INTL) tras capa PaymentGateway swappable
- IA: gateway LLM swappable (Claude/OpenAI) + embeddings Voyage voyage-3 (1024 dims)
- Animación: GSAP + ScrollTrigger + View Transitions + Lenis

## Modelo comercial (dropshipping)
- consumible → pago online (Wompi/Stripe) → notificar proveedor → proveedor envía
- equipo_dropship → cotización → aprobada → notificar proveedor → proveedor envía
- equipo_individualizado → atención personalizada → fulfillment a medida
- Campo en productos: fulfillment_mode enum('dropship','cotizacion','individualizado')
- precio_costo: CONFIDENCIAL — nunca al cliente, nunca en dist/

## Decisiones inamovibles
- Sin React, sin framer-motion, sin Three.js
- service_role y claves privadas SOLO en Edge Functions, jamás en cliente o dist/
- Cero datos inventados (productos, specs, precios, tasas, certificaciones)
- i18n: /es/ default (es-CO) y /en/, hreflang completo
- Reconstrucción de landings: publicar en CMS → rebuild CI → deploy estático
- El cliente NUNCA decide que un pago está aprobado

## Estructura de archivos clave
src/layouts/Layout.astro
src/pages/{index,catalogo,productos/[slug],servicios,financiacion,contacto,admin}.astro
src/components/{Navbar,Footer,Hero,CatalogoGrid,ProductoCard,ProductoShell,Asesor,Carrito,SimuladorFinanciero,AsistenteWhatsApp}.astro
src/lib/{supabase,datos,embeddings,llm-gateway,payment-gateway,cotizacion,fulfillment,format,seo,motion}.ts
src/data/{mock-productos,mock-familias,mock-tipos,financiacion,contacto,extraccion_ime}.json
src/i18n/{es,en}.json + utils.ts
src/styles/globals.css  ← tokens CSS reales de /77/, no inventados
supabase/{schema.sql,functions/}
.github/workflows/{ci.yml,deploy-preprod.yml,deploy-prod.yml}
docs/prompts/  ← prompts de fase (no eliminar)
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
[ ] F0 — Discovery y tokens | rama: feature/fase-0
[ ] F1 — Fundaciones, Home e infra | rama: feature/fase-1
[ ] F2 — Catálogo, landings y SEO | rama: feature/fase-2
[ ] F3 — CMS, ingesta PDF y rebuild | rama: feature/fase-3
[ ] Fase Asesor — RAG conversacional | rama: feature/fase-asesor
[ ] F4 — Comercio híbrido y dropshipping | rama: feature/fase-4
[ ] F5 — Auditoría, legales y despliegue | rama: feature/fase-5

## Etiquetas de pendiente (usar exactamente estas)
TODO_CLIENTE | COPY_CLIENTE_REVISAR | BLOQUEANTE_BACKEND | BLOQUEANTE_CONTENIDO
BLOQUEANTE_LEGAL | OPCIONAL_MEJORA | BACKLOG_V2 | NO_EJECUTADO_ENTORNO
---

3b. CLAUDE.md (raíz) — wrapper para Claude Code que incluye AGENTS.md:
  Crea CLAUDE.md con este contenido:
  ---
  @AGENTS.md

  ## Notas específicas para Claude Code
  - Usa /init si AGENTS.md no está cargado al inicio de la sesión.
  - Ejecuta /memory para verificar qué archivos están cargados.
  - El auto-memory (v2.1.59+) puede generar notas automáticas — mantenlas en .claude/memory/.
  - Si hay conflicto entre instrucciones aquí y en el prompt de fase, gana el prompt de fase.
  ---

3c. Crea también .claude/settings.json con:
  { "autoMemoryEnabled": true }
  Y .codex/config.toml con:
  project_doc_max_bytes = 65536
  Estos archivos van al repo (no contienen secretos).

==================================================================
4. DIVISIÓN DE TRABAJO ENTRE AGENTES
==================================================================
Documenta en AGENTS_GUIDE.md:

CLAUDE CODE — tareas preferidas (contexto largo, razonamiento arquitectónico):
  - Decisiones de arquitectura y schema de Supabase
  - Edge Functions (lógica de negocio, webhooks, pagos, RAG, ingesta PDF)
  - Sistema i18n, SEO técnico y JSON-LD
  - Layout, design system y fundaciones de F1
  - CMS y flujos complejos de F3
  - Asesor conversacional (F2.5 / Fase Asesor)
  - Auditoría y documentación de F5

CODEX CLI — tareas preferidas (generación de código, componentes, calidad):
  - Componentes UI estáticos (cards, badges, skeletons, botones, formularios)
  - Tests unitarios y de integración
  - Refactors de código existente (renombrar, extraer, reorganizar)
  - Generación de datos mock desde esquemas
  - Revisión y corrección de código generado por Claude Code
  - Scripts de utilidad (generate-sitemap, validate, etc.)

REGLA UNIVERSAL para ambos:
  1. ANTES de empezar: git pull, verificar en qué rama estás, leer AGENTS.md.
  2. AL TERMINAR UNA TAREA: commit + push. Nunca cambies de agente con cambios sin commitear.
  3. Conflicto entre agentes: gana el último commit. Si ambos modificaron el mismo archivo, resolver en PR.
  4. Ningún agente toca .env con valores reales. Ninguno commitea secretos.

PROTOCOLO DE HANDOFF (cuando pasas de un agente al otro):
  git add -A && git commit -m "chore(agente): handoff a [claude-code|codex] — [descripción breve]"
  git push
  Luego inicia el otro agente en la misma rama con: "Continúa desde el último commit. Lee AGENTS.md."

==================================================================
5. CALIDAD DE CÓDIGO
==================================================================
Configura en el proyecto:

5a. ESLint + Prettier:
  - eslint.config.mjs con reglas para TypeScript estricto + Astro.
  - .prettierrc: singleQuote: true, semi: false, tabWidth: 2, printWidth: 100.
  - Devdependencies: eslint, @eslint/js, typescript-eslint, eslint-plugin-astro, prettier.

5b. Lint-staged + Husky (opcional pero recomendado):
  - Ejecuta eslint + prettier --check antes de cada commit.
  - Instalar: npm pkg set scripts.prepare="husky" && npx husky init
  - .husky/pre-commit: npx lint-staged

5c. Scripts en package.json:
  "dev": "astro dev --host 0.0.0.0 --port 43421",
  "build": "astro build",
  "preview": "astro preview --port 43421",
  "check": "astro check",
  "lint": "eslint src --max-warnings 0",
  "format": "prettier --write src",
  "validate": "npm run lint && npm run check && npm run build"

==================================================================
6. GITHUB ACTIONS
==================================================================
Crea tres workflows:

6a. .github/workflows/ci.yml — en cada PR a develop/preprod/main:
  - checkout, node setup (usa .nvmrc), npm ci
  - npm run lint
  - npm run check
  - grep de seguridad: service_role, ANTHROPIC_API_KEY, SERVICE_KEY en src/ (debe dar 0)
  - Si falla cualquier paso → bloquea el merge.

6b. .github/workflows/deploy-preprod.yml — al merge a preprod:
  - checkout, node setup, npm ci
  - Construir con variables de preprod (PUBLIC_SUPABASE_URL, etc.)
  - FTP/SSH deploy a HOSTINGER_PREPROD_PATH
  - Mensaje Slack/email (OPCIONAL_MEJORA) al completar

6c. .github/workflows/deploy-prod.yml — al merge a main O por repository_dispatch:
  - Igual que preprod pero a HOSTINGER_PROD_PATH
  - concurrency: group prod, cancel-in-progress: true (evita deploys solapados)
  - El evento repository_dispatch lo usa el CMS (F3) para rebuild al publicar.

Todos los secrets referenciados como ${{ secrets.NOMBRE }} — nunca hardcodeados.

==================================================================
7. CARPETA DE DOCUMENTOS Y PROMPTS
==================================================================
- Crea docs/prompts/ y copia ahí los archivos de fase (00-CONTEXTO-MAESTRO, 01-FASE-0, etc.)
  para tenerlos versionados en el repo.
- Crea docs/decisions/ para registrar decisiones arquitectónicas (ADRs) a medida que se toman.
- Estos documentos SE COMMITEAN al repo — son parte del proyecto, no solo notas externas.

------------------------------------------------------------------
ENTREGABLES DE FASE -1
------------------------------------------------------------------
AGENTS.md + CLAUDE.md (memoria compartida); SETUP.md (prerrequisitos);
CONTRIBUTING.md (flujo de ramas y git); AGENTS_GUIDE.md (división de trabajo);
.gitignore, .gitattributes, .nvmrc, .editorconfig;
.github/{PULL_REQUEST_TEMPLATE.md, workflows/ci.yml, deploy-preprod.yml, deploy-prod.yml};
.claude/settings.json; .codex/config.toml;
eslint.config.mjs, .prettierrc, package.json con scripts;
docs/prompts/ con los archivos de fase copiados.

------------------------------------------------------------------
CRITERIOS DE ACEPTACIÓN
------------------------------------------------------------------
- claude --version y codex --version responden sin error (documentado en SETUP.md).
- git log muestra el commit inicial del proyecto.
- npm run validate pasa (lint + check + build) sin errores sobre el proyecto vacío/stub.
- Los tres workflows de GitHub Actions están definidos y hacen referencia a los secrets correctos.
- AGENTS.md cargado en ambos agentes (Claude Code: /memory muestra AGENTS.md y CLAUDE.md).
- AGENTS_GUIDE.md documenta claramente quién hace qué y el protocolo de handoff.
- Ningún secret real en ningún archivo del repo.
- Reporte de cierre: repo listo, agentes configurados, primer commit hecho, próximo paso: F0.
```

---

## Nota sobre el protocolo de handoff

El riesgo más subestimado del trabajo paralelo con dos agentes no es técnico: es **la pérdida de
contexto entre sesiones**. Cada vez que inicias un agente nuevo (Claude Code o Codex), empieza
desde cero. AGENTS.md es lo que evita que "empiece desde cero" se convierta en "reescribe lo que
ya está". Cuanto más actualizado esté AGENTS.md (especialmente la sección de estado de fases),
menos tiempo pierde cada agente reorientándose. Trata AGENTS.md como un log vivo, no como un
documento estático.
