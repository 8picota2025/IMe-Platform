"""Log con rotación. Ningún secreto sale en el mensaje."""

from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from zoneinfo import ZoneInfo

from .contexto import Contexto, afirmar_escritura

COT_NOMBRE = "America/Bogota"
_CLAVES_SECRETAS = re.compile(r"(TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL)")
_BEARER = re.compile(r"(?i)\b(bearer\s+)\S+")
_LOGGERS: dict[str, logging.Logger] = {}


def redactar(texto: str, extras: list[str] | None = None) -> str:
    limpio = texto
    for valor in _secretos(extras or []):
        limpio = limpio.replace(valor, "[redactado]")
    return _BEARER.sub(r"\1[redactado]", limpio)


def redactar_dato(dato: object, extras: list[str] | None = None) -> object:
    if isinstance(dato, str):
        return redactar(dato, extras)
    if isinstance(dato, list):
        return [redactar_dato(item, extras) for item in dato]
    if isinstance(dato, dict):
        return {str(clave): redactar_dato(valor, extras) for clave, valor in dato.items()}
    return dato


def configurar(ctx: Contexto) -> logging.Logger:
    clave = str(ctx.logs)
    existente = _LOGGERS.get(clave)
    if existente is not None:
        return existente
    ctx.logs.mkdir(parents=True, exist_ok=True)
    destino = ctx.logs / "integrador.log"
    afirmar_escritura(ctx, destino)
    log = logging.getLogger(f"integrador.{clave}")
    log.setLevel(logging.INFO)
    log.propagate = False
    formato = _FormatoSeguro("%(asctime)s %(levelname)s %(message)s", ctx)
    formato.converter = _hora_cot  # type: ignore[attr-defined]
    archivo = RotatingFileHandler(destino, maxBytes=1_048_576, backupCount=5, encoding="utf-8")
    archivo.setFormatter(formato)
    consola = logging.StreamHandler()
    consola.setFormatter(formato)
    log.addHandler(archivo)
    log.addHandler(consola)
    _LOGGERS[clave] = log
    return log


def _hora_cot(segundos: float) -> time.struct_time:
    momento = datetime.fromtimestamp(segundos, ZoneInfo(COT_NOMBRE))
    return momento.timetuple()


class _FormatoSeguro(logging.Formatter):
    def __init__(self, fmt: str, ctx: Contexto) -> None:
        super().__init__(fmt)
        self._ctx = ctx

    def format(self, record: logging.LogRecord) -> str:
        return redactar(super().format(record), secretos_de_perfil(self._ctx.perfil))


def secretos_de_perfil(perfil: Path) -> list[str]:
    archivo = perfil / ".env"
    if not archivo.is_file():
        return []
    valores: list[str] = []
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        clave, _, valor = limpia.partition("=")
        valor = valor.strip().strip('"').strip("'")
        if _CLAVES_SECRETAS.search(clave) and len(valor) >= 8:
            valores.append(valor)
    return valores


def _secretos(extras: list[str]) -> list[str]:
    vistos: list[str] = []
    for clave, valor in os.environ.items():
        if _CLAVES_SECRETAS.search(clave) and len(valor) >= 8:
            vistos.append(valor)
    for valor in extras:
        if len(valor) >= 8:
            vistos.append(valor)
    # Los más largos primero, para no dejar colas de un secreto dentro de otro.
    return sorted(set(vistos), key=len, reverse=True)

