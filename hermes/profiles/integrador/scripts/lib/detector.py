"""Lee el latido de Grok. No escribe modo.json ni reinicia nada.

Grok se considera no disponible solo si el latido lo marca: disponible en
falso, dos fallos seguidos, o el último latido con más de 180 minutos.
Si el archivo no está, no se marca caída: el perfil se queda en sombra.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

COT = ZoneInfo("America/Bogota")
UMBRAL = timedelta(minutes=180)
_CLAVES_TIEMPO = {"ultimo_ok", "ts", "ultimo", "fecha"}


def grok_no_disponible(latido: Path, ahora: datetime) -> bool:
    if not latido.is_file():
        return False
    try:
        dato = json.loads(latido.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError("latido de Grok ilegible") from exc
    if not isinstance(dato, dict):
        return False
    if dato.get("disponible") is False:
        return True
    try:
        fallos = int(dato.get("fallos_seguidos") or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError("fallos_seguidos no es un entero") from exc
    if fallos >= 2:
        return True
    momentos = _momentos(dato)
    if not momentos:
        return False
    ultimo = max(momentos)
    if ahora.tzinfo is None:
        ahora = ahora.replace(tzinfo=COT)
    return ahora - ultimo > UMBRAL


def _momentos(dato: object) -> list[datetime]:
    hallados: list[datetime] = []
    if isinstance(dato, dict):
        for clave, valor in dato.items():
            if clave in _CLAVES_TIEMPO and isinstance(valor, str):
                momento = _parsear(valor)
                if momento is not None:
                    hallados.append(momento)
            else:
                hallados.extend(_momentos(valor))
    elif isinstance(dato, list):
        for item in dato:
            hallados.extend(_momentos(item))
    return hallados


def _parsear(valor: str) -> datetime | None:
    try:
        momento = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return None
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=COT)
    return momento
