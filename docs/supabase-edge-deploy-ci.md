# CI — despliegue de Edge Functions y secretos

Workflow: `.github/workflows/deploy-supabase-functions.yml`.

## Cuándo corre

Push a `main` que toque:

- `supabase/functions/**`, `supabase/config.toml`
- libs compartidas de comercio/cotización en `src/lib/` (lista en el workflow)
- el propio workflow

También `workflow_dispatch` manual.

`concurrency`: grupo `deploy-supabase-functions`, `cancel-in-progress: true`.

## Secretos (orden crítico)

1. Se arma `.secrets.env` con variables de GitHub Secrets.
2. **`grep -vE '^[A-Z_]+=$' .secrets.filtered.env`** — omite claves cuyo valor interpoló vacío.
3. Solo si el archivo filtrado no está vacío: `supabase secrets set --env-file ... --yes`.

**No** subir el `.env` completo sin filtrar: un secret ausente en GitHub interpola a cadena vacía y **pisa** el valor real en Supabase (incidentes 2026-07-03 y 2026-07-05).

`CO_DEFAULT_IVA_PCT=19` va fijo en el archivo del workflow (no es secret de GitHub).

## Deploy de funciones

- Hasta 3 intentos con pausa de 20 s (fallos transitorios de esm.sh al bundlear).
- Comando: `supabase functions deploy --project-ref nnfbucwiasuggyfoyydo --yes` (sin prompts en CI, #274).

## Desarrollo local

Mismo patrón manual:

```bash
npx supabase functions deploy <nombre> --project-ref nnfbucwiasuggyfoyydo
```

Secretos: panel Supabase o CLI; nunca commitear valores reales.

## Ver también

- MCP y tokens: `docs/mcp-ime-comercio-http.md`
- Cotizaciones: `docs/commercial-quote-dev.md`