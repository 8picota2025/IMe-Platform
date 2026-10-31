"""Lock por tarea. Grok y Hermes no ejecutan la misma orden a la vez."""

from __future__ import annotations

import fcntl
import re
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from .contexto import Contexto, afirmar_escritura

_NOMBRE = re.compile(r"[^A-Za-z0-9._-]+")


def sanear(valor: str) -> str:
    limpio = _NOMBRE.sub("-", valor).strip("-")
    return (limpio or "tarea")[:64]


@contextmanager
def candado_tarea(ctx: Contexto, tarea: str) -> Iterator[Path]:
    ruta = ctx.tablon / "locks" / f"{sanear(tarea)}.lock"
    afirmar_escritura(ctx, ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    archivo = ruta.open("a+", encoding="utf-8")
    try:
        fcntl.flock(archivo.fileno(), fcntl.LOCK_EX)
        yield ruta
    finally:
        fcntl.flock(archivo.fileno(), fcntl.LOCK_UN)
        archivo.close()
