#!/usr/bin/env bash
# Lee la URL trycloudflare del log del servicio y sincroniza GH + Edge si cambió.
set -euo pipefail
ROOT=/home/shoky/cursor/ime-platform
RUNTIME=/tmp/ime-ocr
REPO=8picota2025/IMe-Platform
LOG="$RUNTIME/cloudflared.service.log"
mkdir -p "$RUNTIME"

URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | tail -1 || true)
if [[ -z "$URL" ]]; then
  echo "[ocr-sync] sin URL aún"
  exit 0
fi

PREV=""
[[ -f "$RUNTIME/tunnel.url" ]] && PREV=$(cat "$RUNTIME/tunnel.url")
if [[ "$URL" == "$PREV" ]]; then
  # Health check only
  if curl -sf "$URL/health" >/dev/null; then
    exit 0
  fi
  echo "[ocr-sync] URL conocida pero health DOWN — reintento sync"
fi

echo "[ocr-sync] URL=$URL"
printf '%s\n' "$URL" >"$RUNTIME/tunnel.url"
if [[ -f "$ROOT/.env" ]]; then
  if grep -q '^OCR_BRIDGE_URL=' "$ROOT/.env"; then
    sed -i "s|^OCR_BRIDGE_URL=.*|OCR_BRIDGE_URL=$URL|" "$ROOT/.env"
  else
    printf '\nOCR_BRIDGE_URL=%s\n' "$URL" >>"$ROOT/.env"
  fi
fi

SECRET=$(grep -E '^OCR_BRIDGE_SECRET=' "$ROOT/.env" | cut -d= -f2- || true)
gh secret set OCR_BRIDGE_URL --repo "$REPO" --body "$URL"
[[ -n "$SECRET" ]] && gh secret set OCR_BRIDGE_SECRET --repo "$REPO" --body "$SECRET"
gh workflow run "Deploy Supabase Functions" --repo "$REPO"
echo "[ocr-sync] secrets + workflow OK $(date -Is)" | tee -a "$RUNTIME/sync.log"
