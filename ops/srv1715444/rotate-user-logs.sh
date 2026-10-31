#!/usr/bin/env bash
# Rotación de los logs de ops. No instalar sin OK de Shoky.
# Sustituye o amplía ~/scripts/rotate-user-logs.sh
set -euo pipefail
dir="${HOME}/logs"
mkdir -p "$dir"
cd "$dir"
for nombre in \
  ime-ops-hub ime-cluster-ha healthcheck ai-watchdog ime-backup-stage-noa \
  rotate-user-logs backup-critical-config exposure-audit update-readiness-check \
  solicitud-emilio enviar-cola hostinger-direct bot-forge-notify cola-emilio
do
  archivo="${nombre}.log"
  if [[ -f "$archivo" && $(wc -c < "$archivo") -gt 2097152 ]]; then
    stamp="$(date +%Y%m%d%H%M%S)"
    mv "$archivo" "${archivo}.${stamp}"
    gzip -f "${archivo}.${stamp}" || true
  fi
done
ls -1t ./*.log.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
