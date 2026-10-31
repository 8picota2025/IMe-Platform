"""Argumentos compartidos por los comandos de respaldo."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from respaldo_lib import ahora_utc, parse_iso, resolver_raiz, transport_desde_entorno


def parser_base(descripcion: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=descripcion)
    parser.add_argument("--estado-dir", default=None)
    parser.add_argument("--now", default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def ahora_de(args: argparse.Namespace) -> datetime:
    if args.now:
        return parse_iso(args.now)
    return ahora_utc()


def emitir(obj: object) -> int:
    json.dump(obj, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


def transporte_si_aplica(dry_run: bool):
    if dry_run:
        return None
    return transport_desde_entorno()


def raiz_de(args: argparse.Namespace):
    from respaldo_lib import Rutas

    return Rutas(resolver_raiz(args.estado_dir))
