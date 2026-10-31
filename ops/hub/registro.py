"""Log del hub de ops. Hora de Bogotá, stderr y archivo. Sin secretos."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Bogota")


def ahora() -> datetime:
    return datetime.now(ZONA)


def marca(momento: datetime | None = None) -> str:
    return (momento or ahora()).astimezone(ZONA).isoformat(timespec="seconds")


def log(mensaje: str, nivel: str = "INFO", *, accion: str = "log", **extra: object) -> None:
    evento = {
        "ts": marca(),
        "nivel": nivel,
        "accion": accion,
        "mensaje": mensaje,
    }
    evento.update({clave: valor for clave, valor in extra.items() if valor is not None})
    linea = json.dumps(evento, ensure_ascii=False)
    print(linea, file=__import__("sys").stderr)
    destino = os.environ.get("IME_OPS_LOG", "").strip()
    if not destino:
        return
    path = Path(destino)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as archivo:
        archivo.write(linea + "\n")
