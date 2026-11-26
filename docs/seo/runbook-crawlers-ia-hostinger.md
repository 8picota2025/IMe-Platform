# Runbook: crawlers de IA en i-me.com.co (Hostinger / LiteSpeed)

Fecha: 26-11-2026. El 429 a `GPTBot/1.2` y a `meta-externalagent` **no está en el repo**.

## Qué se comprobó en el código

- `public/robots.txt` tiene un solo grupo `User-agent: *`. No hay `Disallow` de GPTBot, ChatGPT, OpenAI, ClaudeBot, PerplexityBot, Google-Extended, Googlebot, Bingbot, Applebot ni `meta-externalagent`. `/_astro/` no está bloqueado. Admin, comercial, mkt y pagos siguen en `Disallow`.
- `public/.htaccess` no tiene `RewriteCond` por `HTTP_USER_AGENT` ni reglas de ModSecurity. No se añade un allow por User-Agent: el acceso a `/admin` no debe depender del UA.
- El `curl` del 26-11 a `https://i-me.com.co/es/` con UA de GPTBot respondió **HTTP 429**, `server: LiteSpeed`, `platform: hostinger`, cuerpo vacío. `robots.txt` y `llms.txt` respondieron 200 en la prueba del encargo.

El 429 es un límite de la plataforma Hostinger/LiteSpeed (hcdn). No hay un ajuste por dominio en hPanel para exceptuar User-Agent. No se desactiva el WAF desde el repo y no se abre `/admin` por el nombre del bot.

## Qué puede hacer Shoky

La vía es un ticket a Hostinger o el CDN, pidiendo que GPTBot y `meta-externalagent` dejen de recibir 429 en el HTML público de `i-me.com.co`. No existe un interruptor en el panel del dominio para esa lista.

User-Agent a mencionar en el ticket: `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Googlebot`, `Bingbot`, `Applebot`, `Applebot-Extended` y `meta-externalagent`. `/admin`, `/comercial`, `/mkt` y los pagos siguen con auth y con `Disallow` en `robots.txt`.

## Cómo comprobarlo después del OK

```bash
scripts/probe-ai-crawlers.sh https://i-me.com.co
```

Aceptación en producción (después del ticket o del CDN, no de un ajuste de hPanel):

```bash
curl -sS -D - -o /tmp/gptbot-es.html -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' https://i-me.com.co/es/
```

Se espera **200** y un cuerpo no vacío en `/es/`, `/es/catalogo/`, una ficha 200 y un artículo de conocimiento. Lo mismo con `meta-externalagent/1.1`. `/admin` no debe quedar más abierto que hoy (401/403/redirect a login, no un 200 de panel).

Esta PR no ejecuta el cambio en Hostinger ni el ping de IndexNow contra producción.
