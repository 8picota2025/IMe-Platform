"""Una línea por decisión, en hora de Colombia, sin secretos."""

from __future__ import annotations

import fcntl
import json
import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from .bitacora import redactar_dato, secretos_de_perfil
from .contexto import Contexto, afirmar_escritura

COT = ZoneInfo("America/Bogota")


def marcar_tiempo(momento: datetime | None = None) -> str:
    actual = momento or datetime.now(COT)
    if actual.tzinfo is None:
        actual = actual.replace(tzinfo=COT)
    return actual.astimezone(COT).isoformat(timespec="seconds")


def anexar(ctx: Contexto, registro: dict[str, Any]) -> None:
    ctx.logs.mkdir(parents=True, exist_ok=True)
    destino = ctx.logs / "decisiones.jsonl"
    afirmar_escritura(ctx, destino)
    limpio = redactar_dato(registro, secretos_de_perfil(ctx.perfil))
    if not isinstance(limpio, dict):
        raise TypeError("la decisión redactada no es un objeto")
    linea = json.dumps(limpio, ensure_ascii=False, sort_keys=True) + "\n"
    with destino.open("a", encoding="utf-8") as archivo:
        fcntl.flock(archivo.fileno(), fcntl.LOCK_EX)
        archivo.write(linea)
        archivo.flush()
        os.fsync(archivo.fileno())
        fcntl.flock(archivo.fileno(), fcntl.LOCK_UN)


def ids_registrados(ctx: Contexto) -> set[str]:
    destino = ctx.logs / "decisiones.jsonl"
    if not destino.is_file():
        return set()
    vistos: set[str] = set()
    for numero, linea in enumerate(destino.read_text(encoding="utf-8").splitlines(), start=1):
        if not linea.strip():
            continue
        try:
            dato = json.loads(linea)
        except json.JSONDecodeError as exc:
            raise ValueError(f"decisión ilegible en la línea {numero}") from exc
        orden = dato.get("orden")
        if isinstance(orden, str) and orden:
            vistos.add(orden)
    return vistos
