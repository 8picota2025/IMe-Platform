"""Hermes ejecuta estos archivos desde ~/.hermes/scripts/integrador/."""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


def ejecutar(nombre: str) -> None:
    explicito = os.environ.get("INTEGRADOR_PERFIL", "").strip()
    if explicito:
        destino = Path(explicito) / "scripts" / nombre
    else:
        destino = Path.home() / ".hermes" / "profiles" / "integrador" / "scripts" / nombre
    if not destino.is_file():
        sys.stderr.write("integrador: no está el script del perfil\n")
        raise SystemExit(1)
    sys.path.insert(0, str(destino.parent))
    runpy.run_path(str(destino), run_name="__main__")
