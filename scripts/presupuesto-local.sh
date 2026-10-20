#!/usr/bin/env bash
# Herramienta local del presupuesto IVA/descuento. No es producción.
#   ./scripts/presupuesto-local.sh            # arranca o reusa :44339
#   ./scripts/presupuesto-local.sh --status
#   ./scripts/presupuesto-local.sh --restart
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${IME_PRESUPUESTO_PORT:-44339}"
URL="http://127.0.0.1:${PORT}"
BRANCH_ESPERADA="feature/presupuesto-iva-descuento-bancos"

port_up() {
  ss -ltn 2>/dev/null | grep -q ":${PORT} "
}

http_ok() {
  python3 - <<PY
import sys, urllib.request
try:
    r = urllib.request.urlopen("${URL}/comercial/", timeout=4)
    sys.exit(0 if r.status == 200 else 1)
except Exception:
    sys.exit(1)
PY
}

stop_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  else
    local pids
    pids="$(ss -ltnp 2>/dev/null | awk -v p=":${PORT} " '$0 ~ p {print}' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill ${pids} 2>/dev/null || true
    fi
  fi
  sleep 1
}

status() {
  echo "rama: $(git rev-parse --abbrev-ref HEAD)"
  echo "worktree: ${ROOT}"
  echo "url: ${URL}/comercial/"
  if ! port_up; then
    echo "estado: APAGADO"
    return
  fi
  if http_ok; then
    echo "estado: ACTIVO"
  else
    echo "estado: ROTO (puerto ocupado, /comercial/ no responde)"
  fi
}

ensure_worktree() {
  local rama
  rama="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${rama}" != "${BRANCH_ESPERADA}" ]]; then
    echo "Este sandbox solo corre en ${BRANCH_ESPERADA} (ahora: ${rama})." >&2
    exit 1
  fi

  if [[ ! -e node_modules ]]; then
    if [[ -d /home/shoky/cursor/ime-platform/node_modules ]]; then
      ln -s /home/shoky/cursor/ime-platform/node_modules node_modules
    else
      npm ci
    fi
  fi

  if [[ ! -e .env && -f /home/shoky/cursor/ime-platform/.env ]]; then
    ln -s /home/shoky/cursor/ime-platform/.env .env
  fi
}

if [[ "${1:-}" == '--status' ]]; then
  status
  exit 0
fi

if [[ "${1:-}" == '--restart' ]]; then
  stop_port
fi

ensure_worktree

if port_up; then
  if http_ok; then
    echo "Ya está activo: ${URL}/comercial/"
    echo "Admin: ${URL}/admin/"
    echo "Vista previa PDF usa el renderer local (formato nuevo). No envíes el correo desde i-me.com.co si necesitas este PDF."
    exit 0
  fi
  echo "Puerto ${PORT} ocupado pero /comercial/ no responde. Reinicio..."
  stop_port
fi

export IME_PRESUPUESTO_PORT="${PORT}"
export ASTRO_NO_I18N=1
echo "Arrancando presupuesto local en ${URL}/comercial/"
exec npx astro dev --host 127.0.0.1 --port "${PORT}"
