# Runbook: crawlers de IA en i-me.com.co (Hostinger / LiteSpeed)

Fecha: 26-11-2026. El 429 a `GPTBot/1.2` y a `meta-externalagent` **no está en el repo**.

## Qué se comprobó en el código

- `public/robots.txt` tiene un solo grupo `User-agent: *`. No hay `Disallow` de GPTBot, ChatGPT, OpenAI, ClaudeBot, PerplexityBot, Google-Extended, Googlebot, Bingbot, Applebot ni `meta-externalagent`. `/_astro/` no está bloqueado. Admin, comercial, mkt y pagos siguen en `Disallow`.
- `public/.htaccess` no tiene `RewriteCond` por `HTTP_USER_AGENT` ni reglas de ModSecurity. No se añade un allow por User-Agent: el acceso a `/admin` no debe depender del UA.
- El `curl` del 26-11 a `https://i-me.com.co/es/` con UA de GPTBot respondió **HTTP 429**, `server: LiteSpeed`, `platform: hostinger`, cuerpo vacío. `robots.txt` y `llms.txt` respondieron 200 en la prueba del encargo.

La capa que rate-limita es el WAF o el bot protection de **hPanel / LiteSpeed (hcdn)**. No se desactiva el WAF entero desde este cambio.

## Cambio recomendado en el panel (lo aplica Shoky, no esta PR)

1. hPanel → sitio `i-me.com.co` → Seguridad / CDN / LiteSpeed Web Cache o Bot Protection (el nombre exacto depende del plan).
2. En la lista de bots o en las reglas de rate-limit de HTML, **permitir** estos User-Agent en rutas públicas (`/`, `/es/`, `/en/`, catálogo, fichas, conocimiento, `llms.txt`, `robots.txt`, sitemaps):
   - `GPTBot`
   - `ChatGPT-User`
   - `OAI-SearchBot`
   - `ClaudeBot`
   - `PerplexityBot`
   - `Google-Extended`
   - `Googlebot`
   - `Bingbot`
   - `Applebot`
   - `Applebot-Extended`
   - `meta-externalagent`
3. No crear una excepción por UA para `/admin`, `/comercial`, `/mkt`, `/es/pago/` ni `/en/payment/`. Esas rutas siguen con auth y con `Disallow` en `robots.txt`.
4. No apagar el WAF completo. Si el panel solo ofrece «desactivar bot fight / rate limit», limitarlo a los UA de la lista y a respuestas HTML públicas.

## Cómo comprobarlo después del OK

```bash
scripts/probe-ai-crawlers.sh https://i-me.com.co
```

Aceptación en producción (después del cambio de panel, no de esta PR):

```bash
curl -sS -D - -o /tmp/gptbot-es.html -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' https://i-me.com.co/es/
```

Se espera **200** y un cuerpo no vacío en `/es/`, `/es/catalogo/`, una ficha 200 y un artículo de conocimiento. Lo mismo con `meta-externalagent/1.1`. `/admin` no debe quedar más abierto que hoy (401/403/redirect a login, no un 200 de panel).

Esta PR no ejecuta el cambio en Hostinger ni el ping de IndexNow contra producción.
