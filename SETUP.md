# Setup — Prerrequisitos e instalación local

## Requisitos

| Herramienta | Versión mínima | Verificar          |
| ----------- | -------------- | ------------------ |
| Node.js     | >=22.12.0      | `node --version`   |
| npm         | >=10           | `npm --version`    |
| Git         | >=2.40         | `git --version`    |
| Claude Code | latest         | `claude --version` |
| Codex CLI   | latest         | `codex --version`  |

## Instalación

```bash
# 1. Clonar el repo
git clone <REPO_URL> 0106-ime-web-claude-design
cd 0106-ime-web-claude-design

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env
# Rellenar valores reales en .env (ver sección de variables)

# 4. Verificar que el entorno funciona
npm run validate
```

## Variables de entorno (.env)

```bash
PUBLIC_SUPABASE_URL=          # URL del proyecto Supabase
PUBLIC_SUPABASE_ANON_KEY=     # Clave anónima de Supabase (segura en cliente)
SUPABASE_SERVICE_ROLE_KEY=    # SOLO en Edge Functions — nunca en cliente
ANTHROPIC_API_KEY=            # Claude API
OPENAI_API_KEY=               # OpenAI API (gateway alternativo)
VOYAGE_API_KEY=               # Voyage embeddings
WOMPI_PUBLIC_KEY=             # Wompi Colombia (pública)
WOMPI_PRIVATE_KEY=            # Wompi privada — SOLO Edge Functions
WOMPI_EVENTS_SECRET=          # Firma webhooks Wompi
STRIPE_PUBLIC_KEY=            # Stripe (pública)
STRIPE_SECRET_KEY=            # Stripe secreta — SOLO Edge Functions
STRIPE_WEBHOOK_SECRET=        # Firma webhooks Stripe
TURNSTILE_SITE_KEY=           # Cloudflare Turnstile (pública)
TURNSTILE_SECRET_KEY=         # Turnstile secreta — SOLO Edge Functions
CI_DEPLOY_HOOK=               # Hook para trigger-rebuild desde CMS
```

## Instalar agentes IA

```bash
# Claude Code
npm install -g @anthropic-ai/claude-code
claude --version

# Codex CLI (opcional, agente secundario)
npm install -g @openai/codex
codex --version
```

## Scraping (F0)

Playwright está instalado a nivel sistema. Para instalar el navegador Chromium:

```bash
npx playwright install chromium
```

## Dev server

```bash
npm run dev
# → http://localhost:43421
```
