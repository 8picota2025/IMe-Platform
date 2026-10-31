#!/usr/bin/env bash
# Interruptor local: on [horas] | off | estado | comando "RESPALDO ON 2"
# --dry-run no escribe. No arranca servicios ni envía correo.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-python3}"

if [[ $# -lt 1 ]]; then
  echo "uso: respaldo.sh on [horas] | off | estado | comando TEXTO [--quien --motivo --origen --now --dry-run]" >&2
  exit 2
fi

sub="$1"
shift
horas=""
texto=""
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      args+=(--dry-run)
      shift
      ;;
    --quien|--motivo|--origen|--now)
      if [[ $# -lt 2 ]]; then
        echo "falta valor para $1" >&2
        exit 2
      fi
      args+=("$1" "$2")
      shift 2
      ;;
    *)
      if [[ "$sub" == "on" && -z "$horas" && "$1" =~ ^[0-9]+([.,][0-9]+)?h?$ ]]; then
        horas="${1%[hH]}"
        shift
      elif [[ "$sub" == "comando" && -z "$texto" ]]; then
        texto="$1"
        shift
      else
        echo "argumento no reconocido: $1" >&2
        exit 2
      fi
      ;;
  esac
done

tiene_quien=0
for argumento in "${args[@]+"${args[@]}"}"; do
  if [[ "$argumento" == "--quien" ]]; then
    tiene_quien=1
  fi
done
if [[ $tiene_quien -eq 0 ]]; then
  quien="${RESPALDO_QUIEN:-${USER:-}}"
  if [[ -z "$quien" ]]; then
    echo "falta --quien o RESPALDO_QUIEN" >&2
    exit 2
  fi
  args+=(--quien "$quien")
fi

tiene_origen=0
for argumento in "${args[@]+"${args[@]}"}"; do
  if [[ "$argumento" == "--origen" ]]; then
    tiene_origen=1
  fi
done
if [[ $tiene_origen -eq 0 ]]; then
  args+=(--origen cli)
fi

case "$sub" in
  on)
    texto="RESPALDO ON"
    if [[ -n "$horas" ]]; then
      texto="RESPALDO ON ${horas}"
    fi
    ;;
  off) texto="RESPALDO OFF" ;;
  estado) texto="RESPALDO ESTADO" ;;
  comando)
    if [[ -z "$texto" ]]; then
      echo "falta el texto del comando" >&2
      exit 2
    fi
    ;;
  *)
    echo "subcomando desconocido: $sub" >&2
    exit 2
    ;;
esac

exec "$PY" "$DIR/comando.py" "${args[@]}" "$texto"
