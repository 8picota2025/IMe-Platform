# Observabilidad I-ME

Consultas operativas para `eventos_sistema` y checklist minimo de configuracion.

## Consultas SQL

```sql
-- Errores por funcion, ultimos 7 dias
select fn, count(*)
from eventos_sistema
where nivel = 'error'
  and ts > now() - interval '7 days'
group by fn
order by 2 desc;
```

```sql
-- p95 de duracion por funcion, ultimas 24 horas
select
  fn,
  percentile_cont(0.95) within group (order by duracion_ms) as p95_ms
from eventos_sistema
where ts > now() - interval '1 day'
  and duracion_ms is not null
group by fn;
```

```sql
-- Funnel semanal de negocio
select evento, count(*)
from eventos_sistema
where evento in ('cotizacion_registrada', 'pago_confirmado', 'factura_emitida')
  and ts > now() - interval '7 days'
group by evento;
```

## Variables necesarias

- `PUBLIC_SENTRY_DSN`: habilita Sentry en el cliente Astro.
- `SENTRY_DSN`: habilita captura de excepciones en Edge Functions.
- `SENTRY_AUTH_TOKEN`: opcional; necesario solo si se habilita subida de source maps en CI.

## Monitores externos recomendados

- `https://i-me.com.co/` con keyword `I-ME`
- `https://i-me.com.co/sitemap-index.xml`
- `https://<project-ref>.supabase.co/functions/v1/health`

## Verificaciones

- `npm run validate`
- `curl https://<project-ref>.supabase.co/functions/v1/health`
- consulta SQL sobre `eventos_sistema` para confirmar filas nuevas
