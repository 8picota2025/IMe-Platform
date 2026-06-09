# I-ME Platform

Plataforma web biomédica B2B — e-commerce de equipos médicos (Colombia, España, LATAM).

## Stack

- **Frontend**: Astro 6 SSG · TypeScript estricto · TailwindCSS
- **Hosting**: Hostinger estático (`dist/`) vía CI/CD FTP/SSH
- **Backend**: Supabase Edge Functions (Deno)
- **Datos**: Supabase Postgres + Auth + Storage + RLS
- **Pagos**: Wompi (CO) + Stripe (INTL) detrás de `PaymentGateway`
- **IA**: Gateway LLM swappable + Voyage `voyage-3` embeddings

## Desarrollo local

```bash
# Requisitos: Node >=22.12.0, git
node -v   # debe ser >=22.12.0
npm install
npm run dev   # http://localhost:43421
```

## Comandos

| Comando            | Acción                                   |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Dev server en localhost:43421            |
| `npm run build`    | Build de producción → `dist/`            |
| `npm run preview`  | Preview del build                        |
| `npm run check`    | TypeScript + Astro check                 |
| `npm run lint`     | ESLint (0 warnings tolerados)            |
| `npm run format`   | Prettier sobre src/                      |
| `npm run validate` | lint + check + build (pipeline completo) |

## Variables de entorno

Copia `.env.example` a `.env` y rellena los valores reales (ver SETUP.md):

```bash
cp .env.example .env
```

## Supabase

1. Crear proyecto en supabase.com (TODO_CLIENTE)
2. Aplicar `supabase/schema.sql` en el SQL Editor
3. Crear usuario admin manualmente (ver ADMIN_GUIDE.md cuando exista)

## Build y deploy

```bash
npm run validate   # lint + check + build
# Deploy por FTP/SSH a Hostinger (configurado en .github/workflows/)
```

## Agentes IA

Este proyecto usa Claude Code como agente principal. Lee `AGENTS.md` al iniciar
cada sesión. Estado de fases en AGENTS.md sección "Estado de fases".

## Documentación

- `AGENTS.md` — instrucciones para agentes IA, estado de fases
- `SETUP.md` — prerrequisitos e instalación local
- `CONTRIBUTING.md` — flujo de ramas y git
- `AGENTS_GUIDE.md` — división de trabajo entre agentes
- `PENDIENTES.md` — pendientes activos por etiqueta
- `BACKLOG_V2.md` — fuera de alcance V1
- `docs/prompts/` — prompts de fase versionados
