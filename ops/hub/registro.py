"""Log del hub de ops. Hora de Bogotá, stderr y archivo. Sin secretos."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Bogota")


def ahora() -> datetime:
    return datetime.now(ZONA)


def marca(momento: datetime | None = None) -> str:
    return (momento or ahora()).astimezone(ZONA).isoformat(timespec="seconds")


def log(mensaje: str, nivel: str = "INFO") -> None:
    linea = f"[{marca()}] {nivel} {mensaje}"
    print(linea, file=__import__("sys").stderr)
    destino = os.environ.get("IME_OPS_LOG", "").strip()
    if not destino:
        return
    path = Path(destino)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as archivo:
        archivo.write(linea + "\n")
