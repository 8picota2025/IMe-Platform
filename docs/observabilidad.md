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
- `PUBLIC_GA_ID`: habilita Google Analytics 4. En producción el fallback es `G-YKKFCZHE2N`.
- `PUBLIC_GTM_ID`: opcional; habilita Google Tag Manager y `dataLayer`.
- `PUBLIC_CLARITY_ID`: habilita Microsoft Clarity para heatmaps y session replay.
- `PUBLIC_SEARCH_CONSOLE_VERIFICATION`: meta `google-site-verification` (método HTML tag).
- `PUBLIC_SEARCH_CONSOLE_FILE`: `googleXXXX.html` escrito en `dist/` (método archivo HTML).
- `PUBLIC_ANALYTICS_DOMAIN`: `cookie_domain` de GA/GTM (`i-me.com.co`).
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
- `https://i-me.com.co/es/` con `G-YKKFCZHE2N`
- `https://i-me.com.co/sitemap-index.xml`
- `https://<project-ref>.supabase.co/functions/v1/health`

## Google Search Console + GA4

Producción ya envía gtag `G-YKKFCZHE2N` en `<head>` de `/es/` (home canónica; `/` hace 301).

1. Search Console → añadir propiedad URL-prefix `https://i-me.com.co/`.
2. Verificar con **Google Analytics** (misma cuenta con permiso Edit en GA4). No hace falta meta extra.
3. Sitemaps → enviar `https://i-me.com.co/sitemap-index.xml`.
4. GA4 Admin → Product links → Search Console → vincular la propiedad.
5. Conversiones GA4 a marcar: `quote_submit`, `whatsapp_click`, `begin_checkout`, `purchase`.

Si Google pide HTML tag o archivo, guardar el token en el secret `PUBLIC_SEARCH_CONSOLE_VERIFICATION` o el filename en `PUBLIC_SEARCH_CONSOLE_FILE` y redeploy.

### Estado actual

- Quedo operativo un smoke monitor programado en GitHub Actions cada 15 minutos:
  [`/.github/workflows/observabilidad-smoke.yml`](../.github/workflows/observabilidad-smoke.yml)
- Checks incluidos:
  - home publica con keyword `I-ME`
  - home `/es/` con gtag `G-YKKFCZHE2N`
  - `sitemap-index.xml`
  - `health` de Supabase
- Cada check fuerza IPv4 (`curl -4`) porque el AAAA de Hostinger es inalcanzable y los runners de GHA colgaban ~30s en IPv6; además reintenta hasta 4 veces con backoff.
- Si se desean alertas por correo/SMS fuera de GitHub, queda pendiente configurar UptimeRobot o BetterStack con credenciales del cliente.

## Verificaciones

- `npm run validate`
- `curl https://<project-ref>.supabase.co/functions/v1/health`
- consulta SQL sobre `eventos_sistema` para confirmar filas nuevas
- `gh workflow run observabilidad-smoke.yml`
