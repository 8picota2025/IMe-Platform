#!/usr/bin/env bash
# Herramienta local del presupuesto IVA/descuento. No es producción.
#   ./scripts/presupuesto-local.sh            # arranca o reusa
#   ./scripts/presupuesto-local.sh --status
#   ./scripts/presupuesto-local.sh --restart
#   ./scripts/presupuesto-local.sh --install  # systemd --user + Tailscale
#   ./scripts/presupuesto-local.sh --foreground
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${IME_PRESUPUESTO_PORT:-44339}"
BIND="127.0.0.1"
LOCAL_URL="http://${BIND}:${PORT}"
VPN_HOST="${IME_PRESUPUESTO_VPN_HOST:-server-main.tail05fdf1.ts.net}"
VPN_URL="http://${VPN_HOST}:${PORT}"
BRANCH_ESPERADA="feature/presupuesto-iva-descuento-bancos"
UNIT_NAME="ime-presupuesto-iva.service"
UNIT_SRC="${ROOT}/scripts/${UNIT_NAME}"
UNIT_DST="${HOME}/.config/systemd/user/${UNIT_NAME}"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

port_up() {
  ss -ltn 2>/dev/null | grep -q ":${PORT} "
}

http_ok() {
  python3 - <<PY
import sys, urllib.request
try:
    r = urllib.request.urlopen("${LOCAL_URL}/comercial/", timeout=4)
    sys.exit(0 if r.status == 200 else 1)
except Exception:
    sys.exit(1)
PY
}

unit_active() {
  systemctl --user is-active --quiet "${UNIT_NAME}" 2>/dev/null
}

ensure_vpn() {
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "tailscale no está en PATH; el puerto queda solo en ${LOCAL_URL}" >&2
    return 1
  fi
  tailscale serve --https="${PORT}" off >/dev/null 2>&1 || true
  tailscale serve --http="${PORT}" off >/dev/null 2>&1 || true
  tailscale serve --bg --yes --tcp "${PORT}" "tcp://${BIND}:${PORT}"
}

print_urls() {
  echo "Local: ${LOCAL_URL}/comercial/"
  echo "VPN:   ${VPN_URL}/comercial/"
  echo "Admin: ${VPN_URL}/admin/"
}

stop_port() {
  if unit_active; then
    systemctl --user stop "${UNIT_NAME}"
  fi
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
  echo "local: ${LOCAL_URL}/comercial/"
  echo "vpn: ${VPN_URL}/comercial/"
  if unit_active; then
    echo "systemd: ACTIVO (${UNIT_NAME})"
  else
    echo "systemd: APAGADO"
  fi
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

start_astro() {
  export IME_PRESUPUESTO_PORT="${PORT}"
  export ASTRO_NO_I18N=1
  echo "Arrancando presupuesto local en ${LOCAL_URL}/comercial/"
  echo "VPN: ${VPN_URL}/comercial/"
  exec /usr/bin/npx astro dev --host "${BIND}" --port "${PORT}"
}

install_unit() {
  ensure_worktree
  mkdir -p "${HOME}/.config/systemd/user"
  install -m 0644 "${UNIT_SRC}" "${UNIT_DST}"
  systemctl --user daemon-reload
  loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || true
  systemctl --user enable "${UNIT_NAME}"
  if port_up && ! unit_active; then
    echo "Libero ${PORT} para que lo tome systemd..."
    stop_port
  fi
  systemctl --user restart "${UNIT_NAME}"
  ensure_vpn || true
  echo "Instalado ${UNIT_NAME} (enable + linger)."
  print_urls
}

case "${1:-}" in
  --status)
    status
    exit 0
    ;;
  --install)
    install_unit
    exit 0
    ;;
  --restart)
    if [[ -f "${UNIT_DST}" ]]; then
      systemctl --user restart "${UNIT_NAME}"
      ensure_vpn || true
      status
      exit 0
    fi
    stop_port
    ;;
  --foreground)
    ensure_worktree
    start_astro
    ;;
esac

ensure_worktree

if port_up; then
  if http_ok; then
    echo "Ya está activo."
    print_urls
    echo "Vista previa PDF usa el renderer local. No envíes el correo desde i-me.com.co si necesitas este PDF."
    exit 0
  fi
  echo "Puerto ${PORT} ocupado pero /comercial/ no responde. Reinicio..."
  stop_port
fi

if [[ -f "${UNIT_DST}" ]]; then
  systemctl --user start "${UNIT_NAME}"
  ensure_vpn || true
  echo "Arrancado vía systemd (${UNIT_NAME})."
  print_urls
  exit 0
fi

ensure_vpn || true
start_astro
