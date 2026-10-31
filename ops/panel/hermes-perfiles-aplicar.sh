#!/usr/bin/env bash
# Copia un artefacto del panel a uno o más perfiles Hermes.
# La copia usa Python (shutil). No hace falta rsync.
# Con IME_INSTALL_RSYNC=1, si rsync falta, intenta instalarlo y aun así copia con Python.
set -euo pipefail

log() {
  printf '%s %s\n' "$(TZ=America/Bogota date '+%Y-%m-%d %H:%M:%S %Z')" "$*" >&2
}

if [[ "${IME_INSTALL_RSYNC:-}" == "1" ]]; then
  if ! command -v rsync >/dev/null 2>&1; then
    log "rsync no esta instalado; intento instalarlo"
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update && apt-get install -y rsync || log "no se pudo instalar rsync; la copia sigue sin el"
    else
      log "no hay apt-get; la copia sigue sin rsync"
    fi
  fi
fi

if [[ $# -lt 2 ]]; then
  log "uso: hermes-perfiles-aplicar.sh <origen> <destino> [destino...]"
  exit 1
fi

src=$1
shift
if [[ ! -e "$src" ]]; then
  log "origen ausente: $src"
  exit 1
fi

python3 - "$src" "$@" <<'PY'
import shutil
import sys
from pathlib import Path

origen = Path(sys.argv[1])
for crudo in sys.argv[2:]:
    destino = Path(crudo)
    destino.mkdir(parents=True, exist_ok=True)
    objetivo = destino / origen.name
    if origen.is_dir():
        if objetivo.exists():
            shutil.rmtree(objetivo)
        shutil.copytree(origen, objetivo)
    else:
        shutil.copy2(origen, objetivo)
PY
