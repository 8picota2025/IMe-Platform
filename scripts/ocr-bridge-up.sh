#!/usr/bin/env bash
# Plan A estable: bridge moondream + túnel CF + sync secret Edge.
# Uso:
#   ./scripts/ocr-bridge-up.sh           # arranca y sincroniza secrets
#   ./scripts/ocr-bridge-up.sh --status  # health local + túnel
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUNTIME="${IME_OCR_RUNTIME:-/tmp/ime-ocr}"
mkdir -p "$RUNTIME"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC2046
  eval "$(grep -E '^(OCR_BRIDGE_SECRET|OCR_BRIDGE_PORT|LLM_VISION_MODEL|OCR_BRIDGE_URL|SUPABASE_URL|OCR_BRIDGE_ALLOWED_HOSTS)=' .env | sed 's/^/export /')"
  set +a
fi

PORT="${OCR_BRIDGE_PORT:-3850}"
MODEL="${LLM_VISION_MODEL:-moondream}"
SECRET="${OCR_BRIDGE_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  SECRET="$(openssl rand -hex 24)"
  echo "[ocr] OCR_BRIDGE_SECRET vacío — generando y persistiendo en .env"
  if grep -q '^OCR_BRIDGE_SECRET=' .env 2>/dev/null; then
    sed -i "s|^OCR_BRIDGE_SECRET=.*|OCR_BRIDGE_SECRET=$SECRET|" .env
  else
    printf '\nOCR_BRIDGE_SECRET=%s\n' "$SECRET" >> .env
  fi
  export OCR_BRIDGE_SECRET="$SECRET"
fi

REPO="${IME_OCR_GH_REPO:-8picota2025/IMe-Platform}"

status() {
  echo "=== local :${PORT} ==="
  curl -sf "http://127.0.0.1:${PORT}/health" || echo 'DOWN'
  echo
  URL=$(grep -E '^OCR_BRIDGE_URL=' .env 2>/dev/null | cut -d= -f2- || true)
  echo "=== tunnel ${URL:-?} ==="
  if [[ -n "${URL:-}" ]]; then
    curl -sf -H "Authorization: Bearer ${SECRET}" "${URL}/health" || echo 'DOWN'
    echo
  fi
  echo "=== processes ==="
  pgrep -af 'ocr-moondream-bridge|cloudflared tunnel --url' || true
}

if [[ "${1:-}" == '--status' ]]; then
  status
  exit 0
fi

echo "[ocr] stopping previous…"
pkill -f "node scripts/ocr-moondream-bridge.mjs" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
sleep 1

echo "[ocr] starting bridge :${PORT} model=${MODEL}"
OCR_BRIDGE_SECRET="$SECRET" OCR_BRIDGE_PORT="$PORT" LLM_VISION_MODEL="$MODEL" \
  SUPABASE_URL="${SUPABASE_URL:-}" OCR_BRIDGE_ALLOWED_HOSTS="${OCR_BRIDGE_ALLOWED_HOSTS:-}" \
  nohup node scripts/ocr-moondream-bridge.mjs >"$RUNTIME/bridge.log" 2>&1 &
echo $! >"$RUNTIME/bridge.pid"

for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 0.25
done
curl -sf "http://127.0.0.1:${PORT}/health" | tee "$RUNTIME/health.json"
echo

echo "[ocr] starting cloudflared quick tunnel…"
: >"$RUNTIME/cloudflared.log"
nohup cloudflared tunnel --url "http://127.0.0.1:${PORT}" --http-host-header localhost \
  >"$RUNTIME/cloudflared.log" 2>&1 &
echo $! >"$RUNTIME/cloudflared.pid"

URL=""
for _ in $(seq 1 60); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$RUNTIME/cloudflared.log" | head -1 || true)
  if [[ -n "$URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$URL" ]]; then
  echo "[ocr] ERROR: no trycloudflare URL. Ver $RUNTIME/cloudflared.log" >&2
  exit 1
fi

echo "[ocr] OCR_BRIDGE_URL=$URL"
if grep -q '^OCR_BRIDGE_URL=' .env 2>/dev/null; then
  sed -i "s|^OCR_BRIDGE_URL=.*|OCR_BRIDGE_URL=$URL|" .env
else
  printf '\nOCR_BRIDGE_URL=%s\n' "$URL" >> .env
fi
printf '%s\n' "$URL" >"$RUNTIME/tunnel.url"

echo "[ocr] probing tunnel…"
for _ in $(seq 1 20); do
  if curl -sf -H "Authorization: Bearer ${SECRET}" "$URL/health" >/dev/null; then
    break
  fi
  sleep 0.5
done
curl -sf -H "Authorization: Bearer ${SECRET}" "$URL/health"
echo

if command -v gh >/dev/null 2>&1; then
  echo "[ocr] sync GitHub secrets + Edge deploy…"
  gh secret set OCR_BRIDGE_URL --repo "$REPO" --body "$URL"
  gh secret set OCR_BRIDGE_SECRET --repo "$REPO" --body "$SECRET"
  gh secret set LLM_VISION_MODEL --repo "$REPO" --body "$MODEL" 2>/dev/null || true
  gh secret set OCR_VISION_PROVIDER --repo "$REPO" --body ollama 2>/dev/null || true
  gh workflow run "Deploy Supabase Functions" --repo "$REPO"
  echo "[ocr] workflow lanzado. Espera ~1–2 min a que Edge tenga la URL nueva."
else
  echo "[ocr] gh no disponible — actualiza secrets a mano:"
  echo "  OCR_BRIDGE_URL=$URL"
  echo "  OCR_BRIDGE_SECRET=<set in .env>"
fi

echo
echo "[ocr] listo. Logs: $RUNTIME/bridge.log  $RUNTIME/cloudflared.log"
echo "[ocr] status: $0 --status"
