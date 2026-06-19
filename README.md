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
npm run dev   # http://localhost:44334
```

## Comandos

| Comando            | Acción                                   |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Dev server en localhost:44334            |
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
3. Crear usuario admin manualmente (ver `ADMIN_GUIDE.md`)
4. Desplegar Edge Functions desde `supabase/functions/`

## Pagos y asesor

- Consumibles: checkout online con Wompi (CO) o Stripe (INTL) desde Edge Function `crear-pago`.
- Equipos: cotización o atención personalizada según `tipo_comercial` y `fulfillment_mode`.
- Webhooks: `webhook-wompi` y `webhook-stripe` verifican firma y estado server-side.
- Asesor IA: Edge Function `asesor` con Turnstile, rate-limit, presupuesto y fallback por palabra clave.
- Las pruebas reales requieren secretos en Supabase/CI; ver `PENDIENTES.md`.
- Desarrollo local sin credenciales: `LLM_PROVIDER=ollama` / `EMBEDDING_PROVIDER=ollama` (Ollama autoalojado, coste $0) — ver `docs/decisions/0005-ollama-asesor-local.md`.

## Legales y F5

- Páginas legales borrador: `/es/legal/*` y `/en/legal/*`.
- Los textos legales están marcados `COPY_CLIENTE_REVISAR` / `BLOQUEANTE_LEGAL` hasta revisión de abogado.
- El desarrollo puede continuar en QA, performance, contenido aprobado, Supabase, Asesor y deploy técnico sin cerrar aprobación jurídica ni pruebas reales de pasarelas; esos dos frentes permanecen como ToDo bloqueante antes de producción.
- `public/.htaccess` incluye redirecciones 301 para legado `/77/` y `/1old`.
- Auditoría y QA: `VALIDACION.md`, `VALIDACION_VISUAL.md`, `QA.md`, `REMEDIACION.md`, `CRITERIOS_ACEPTACION.md`.

## Build y deploy

```bash
npm run validate   # lint + check + build
# Deploy web por FTP a Hostinger + deploy de Edge Functions a Supabase
# (configurado en .github/workflows/)
```

## Agentes IA

Este proyecto usa Claude Code como agente principal. Lee `AGENTS.md` al iniciar
cada sesión. Estado de fases en AGENTS.md sección "Estado de fases".

## Documentación

- `AGENTS.md` — instrucciones para agentes IA, estado de fases
- `SETUP.md` — prerrequisitos e instalación local
- `CONTRIBUTING.md` — flujo de ramas y git
- `AGENTS_GUIDE.md` — división de trabajo entre agentes
- `ADMIN_GUIDE.md` — uso operativo del back-office `/admin`
- `VALIDACION.md` — evidencia y pipeline F5
- `QA.md` — matriz de pruebas F5
- `REMEDIACION.md` — hallazgos abiertos/cerrados
- `CRITERIOS_ACEPTACION.md` — criterios para preprod/prod
- `RESUMEN_EJECUTIVO.md` — estado ejecutivo del proyecto
- `PENDIENTES.md` — pendientes activos por etiqueta
- `BACKLOG_V2.md` — fuera de alcance V1
- `docs/prompts/` — prompts de fase versionados
