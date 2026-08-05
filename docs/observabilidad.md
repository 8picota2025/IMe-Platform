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
- `PUBLIC_GA_ID`: habilita Google Analytics 4 (`G-...`) para pageviews, eventos y conversiones.
- `PUBLIC_GTM_ID`: opcional; habilita Google Tag Manager y `dataLayer`.
- `PUBLIC_CLARITY_ID`: habilita Microsoft Clarity para heatmaps y session replay.
- `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`: habilitan analitica first-party hacia `track-analytics`.

## Analitica marketing

La web emite eventos sin PII hacia cuatro destinos cuando estan configurados:

- GA4: `page_view`, `cta_clicked`, `quote_submit`, `whatsapp_click`, `begin_checkout`, `purchase`, etc.
- GTM: mismos eventos en `dataLayer`.
- Clarity: heatmaps y grabaciones de sesion.
- Supabase: copia first-party en `analytics_eventos` para el CMS.

Eventos principales:

```text
page_view
session_engaged
scroll_depth
product_view
quick_view
cta_clicked
quote_open
quote_submit
whatsapp_click
add_to_cart
begin_checkout
purchase
pdf_download
```

Conversiones recomendadas en GA4:

```text
quote_submit
whatsapp_click
begin_checkout
purchase
```

Dashboard CMS:

- `/admin#/marketing`
- Periodo: ultimos 30 dias
- KPIs: visitas, sesiones, permanencia, scroll, conversiones, funnel, fuentes UTM, paginas top, productos top y CTAs.
- Heatmaps/session replay: se consultan en Clarity; CMS muestra estado de configuracion y resumen first-party.

## Monitores externos recomendados

- `https://i-me.com.co/` con keyword `I-ME`
- `https://i-me.com.co/sitemap-index.xml`
- `https://<project-ref>.supabase.co/functions/v1/health`

### Estado actual

- Quedo operativo un smoke monitor programado en GitHub Actions cada 5 minutos:
  [`/.github/workflows/observabilidad-smoke.yml`](../.github/workflows/observabilidad-smoke.yml)
- Checks incluidos:
  - home publica con keyword `I-ME`
  - `sitemap-index.xml`
  - `health` de Supabase
- Cada check fuerza IPv4 (`curl -4`) porque el AAAA de Hostinger es inalcanzable y los runners de GHA colgaban ~30s en IPv6; además reintenta hasta 4 veces con backoff.
- Si se desean alertas por correo/SMS fuera de GitHub, queda pendiente configurar UptimeRobot o BetterStack con credenciales del cliente.

## Verificaciones

- `npm run validate`
- `curl https://<project-ref>.supabase.co/functions/v1/health`
- consulta SQL sobre `eventos_sistema` para confirmar filas nuevas
- `gh workflow run observabilidad-smoke.yml`
