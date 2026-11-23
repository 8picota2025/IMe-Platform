# Deploy automático de Edge Functions (CI)

Workflow: `.github/workflows/deploy-supabase-functions.yml`  
Proyecto Supabase: `nnfbucwiasuggyfoyydo`

## Cuándo corre

- **Push a `main`** que toque:
  - `supabase/functions/**`
  - `supabase/config.toml`
  - Librerías comercio/cotización en `src/lib/mcp-comercio-*.ts`, `comercio-operacion.ts`, `commerce-policy.ts`, `cotizacion-*.ts`
  - El propio workflow
- **`workflow_dispatch`** manual desde GitHub Actions

Concurrencia: grupo `deploy-supabase-functions`, `cancel-in-progress: true` (un deploy a la vez).

## Pasos del job

1. **Secrets filtrados** — escribe `.secrets.env` desde GitHub Secrets, luego `grep -vE '^[A-Z_]+=$'` deja solo claves con valor. Un secret ausente en GitHub interpola a cadena vacía; **enviar vacío pisaría producción** (incidentes 2026-07-03 / 2026-07-05). Si el archivo filtrado queda vacío, se omite `secrets set`.
2. **`supabase secrets set --env-file .secrets.filtered.env --project-ref … --yes`**
3. **`supabase functions deploy --project-ref … --yes`** con hasta **3 reintentos** (pausa 20 s) ante fallos transitorios del bundler esm.sh (HTTP 522).

Requiere `SUPABASE_ACCESS_TOKEN` en secrets del repositorio.

## Operación local (equivalente)

```bash
export SUPABASE_ACCESS_TOKEN=…
export SUPABASE_PROJECT_REF=nnfbucwiasuggyfoyydo
supabase secrets set --env-file .secrets.filtered.env --project-ref "$SUPABASE_PROJECT_REF" --yes
supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF" --yes
```

No commitear `.secrets.env` con valores reales.

## Relación con otros workflows

| Workflow                        | Alcance                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                        | Lint, check, build, tests Deno unitarios (incl. `twenty-crm.test.ts`); no despliega                                                       |
| `deploy-supabase-functions.yml` | Secrets + deploy de **todas** las funciones del proyecto                                                                                  |
| Migraciones SQL                 | Workflow aparte (dashboard / Deploy Supabase Migrations); las funciones pueden responder `migracion_pendiente` hasta aplicar la migración |

Guía general de despliegue: `DEPLOYMENT_GUIDE.md` § Edge Functions (comandos manuales por función).
