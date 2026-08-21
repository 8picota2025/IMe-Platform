#!/usr/bin/env bash
# Levanta puente OCR moondream (:3850) + túnel Cloudflare quick.
# Uso: ./scripts/ocr-bridge-up.sh
# Luego actualiza OCR_BRIDGE_URL en GitHub secrets + redeploy Edge (o este script
# imprime la URL nueva para `gh secret set` + `gh workflow run`).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck disable=SC2046
  export $(grep -E '^(OCR_BRIDGE_SECRET|OCR_BRIDGE_PORT|LLM_VISION_MODEL)=' .env | xargs -d '\n')
  set +a
fi

PORT="${OCR_BRIDGE_PORT:-3850}"
MODEL="${LLM_VISION_MODEL:-moondream}"
SECRET="${OCR_BRIDGE_SECRET:-}"

mkdir -p /tmp/ime-ocr
pkill -f "node scripts/ocr-moondream-bridge.mjs" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
sleep 1

OCR_BRIDGE_SECRET="$SECRET" OCR_BRIDGE_PORT="$PORT" LLM_VISION_MODEL="$MODEL" \
  nohup node scripts/ocr-moondream-bridge.mjs >"/tmp/ime-ocr/bridge.log" 2>&1 &
echo $! > /tmp/ime-ocr/bridge.pid

for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 0.3
done
curl -sf "http://127.0.0.1:${PORT}/health" | tee /tmp/ime-ocr/health.json
echo

nohup cloudflared tunnel --url "http://127.0.0.1:${PORT}" --http-host-header localhost \
  >"/tmp/ime-ocr/cloudflared.log" 2>&1 &
echo $! > /tmp/ime-ocr/cloudflared.pid

URL=""
for i in $(seq 1 40); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/ime-ocr/cloudflared.log | head -1 || true)
  if [[ -n "$URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$URL" ]]; then
  echo "No se obtuvo URL trycloudflare. Ver /tmp/ime-ocr/cloudflared.log" >&2
  exit 1
fi

echo "OCR_BRIDGE_URL=$URL"
if [[ -f .env ]]; then
  if grep -q '^OCR_BRIDGE_URL=' .env; then
    sed -i "s|^OCR_BRIDGE_URL=.*|OCR_BRIDGE_URL=$URL|" .env
  else
    printf '\nOCR_BRIDGE_URL=%s\n' "$URL" >> .env
  fi
fi

echo
echo "Siguiente (prod Edge):"
echo "  gh secret set OCR_BRIDGE_URL --repo 8picota2025/IMe-Platform --body \"$URL\""
echo "  gh workflow run \"Deploy Supabase Functions\" --repo 8picota2025/IMe-Platform"
echo
echo "Health túnel:"
curl -sf -H "Authorization: Bearer ${SECRET}" "$URL/health" || true
echo
