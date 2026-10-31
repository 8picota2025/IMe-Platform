#!/usr/bin/env python3
"""Vuelta atrás de los tres pasos. Rechaza /home/shoky."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.rollback import rollback  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    argumento = argparse.ArgumentParser(description="Rollback del perfil en un árbol de ensayo")
    argumento.add_argument("--raiz", required=True)
    args = argumento.parse_args(argv)
    try:
        resultado = rollback(Path(args.raiz))
    except (OSError, ValueError, PermissionError, FileNotFoundError, FileExistsError) as exc:
        sys.stderr.write(f"rollback rechazado: {type(exc).__name__}\n")
        return 1
    sys.stdout.write(resultado["perfil"] + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
