#!/usr/bin/env bash
# Sondeo de códigos HTTP por User-Agent en rutas públicas.
# No cambia el servidor. No abre /admin con un UA de confianza: solo informa el código.
# Uso: scripts/probe-ai-crawlers.sh [https://i-me.com.co]
set -u

HOST="${1:-https://i-me.com.co}"
HOST="${HOST%/}"

declare -a AGENTS=(
  'GPTBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'
  'ChatGPT-User|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)'
  'OAI-SearchBot|Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)'
  'ClaudeBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +https://www.anthropic.com/claudebot)'
  'PerplexityBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'
  'Google-Extended|Mozilla/5.0 (compatible; Google-Extended)'
  'Googlebot|Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  'Bingbot|Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
  'Applebot|Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1)'
  'Applebot-Extended|Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot-Extended/0.1)'
  'meta-externalagent|meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
)

declare -a PATHS=(
  '/robots.txt'
  '/llms.txt'
  '/es/'
  '/en/'
  '/es/catalogo/'
  '/es/conocimiento/'
  '/admin'
)

printf '%-22s %-28s %6s %8s\n' 'UA' 'Ruta' 'HTTP' 'Bytes'
for entry in "${AGENTS[@]}"; do
  name="${entry%%|*}"
  ua="${entry#*|}"
  for path in "${PATHS[@]}"; do
    tmp="$(mktemp)"
    code="$(curl -sS -o "$tmp" -w '%{http_code}' -A "$ua" --max-time 25 "${HOST}${path}" || echo 'ERR')"
    bytes="$(wc -c < "$tmp" | tr -d ' ')"
    rm -f "$tmp"
    printf '%-22s %-28s %6s %8s\n' "$name" "$path" "$code" "$bytes"
    sleep 2
  done
done
