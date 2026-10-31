#!/usr/bin/env python3
"""Antes este proceso lanzaba el sync cada 2 minutos y se tragaba el fallo.

Ese bucle queda apagado: reescribía Kanban-Aprobaciones.md y el resto de tableros.
El hub vive en el servicio de usuario ime-ops-hub. El sync, si hace falta, se corre a mano.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from registro import log


def main() -> int:
    log("bucle de sync cada 2 minutos desactivado; no se reescriben los kanban")
    return 0


if __name__ == "__main__":
    sys.exit(main())
