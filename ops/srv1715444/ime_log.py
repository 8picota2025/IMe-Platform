"""Log común de ops. No escribe secretos."""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

COT = timezone(timedelta(hours=-5))
_CLAVES = ("KEY", "TOKEN", "PASSWORD", "SECRET", "AUTHORIZATION")
_PAR = re.compile(
    r"(?i)\b([A-Z0-9_]*(?:KEY|TOKEN|PASSWORD|SECRET)|Authorization)\b(\s*[:=]\s*)(\S+)"
)


def directorio() -> Path:
    explicito = os.environ.get("IME_LOG_DIR", "").strip()
    ruta = Path(explicito) if explicito else Path.home() / "logs"
    ruta.mkdir(parents=True, exist_ok=True)
    return ruta


def redactar(texto: str) -> str:
    if not texto:
        return texto
    limpio = _PAR.sub(r"\1\2<redacted>", texto)
    for nombre, valor in os.environ.items():
        if not valor or len(valor) < 6:
            continue
        if any(marca in nombre.upper() for marca in _CLAVES):
            limpio = limpio.replace(valor, "<redacted>")
    return limpio


class _FiltroSecretos(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple):
            record.args = tuple(_ocultar_valor(item) if isinstance(item, str) else item for item in record.args)
        return True


def _ocultar_valor(texto: str) -> str:
    limpio = texto
    for nombre, valor in os.environ.items():
        if not valor or len(valor) < 6:
            continue
        if any(marca in nombre.upper() for marca in _CLAVES):
            limpio = limpio.replace(valor, "<redacted>")
    return limpio


class _Archivo(logging.Handler):
    """Abre ~/logs al escribir, para que IME_LOG_DIR valga también en pruebas."""

    def __init__(self, script: str):
        super().__init__()
        self.script = script
        self._interno: RotatingFileHandler | None = None
        self._ruta: Path | None = None

    def emit(self, record: logging.LogRecord) -> None:
        ruta = directorio() / f"{self.script}.log"
        if self._interno is None or self._ruta != ruta:
            if self._interno is not None:
                self._interno.close()
            self._interno = RotatingFileHandler(
                ruta, maxBytes=2 * 1024 * 1024, backupCount=5, encoding="utf-8"
            )
            if self.formatter:
                self._interno.setFormatter(self.formatter)
            self._ruta = ruta
        self._interno.emit(record)


class _HoraCot(logging.Formatter):
    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        momento = datetime.fromtimestamp(record.created, COT)
        return momento.strftime("%Y-%m-%d %H:%M:%S COT")

    def format(self, record: logging.LogRecord) -> str:
        return redactar(super().format(record))


def get_logger(script: str) -> logging.Logger:
    nombre = f"ime.{script}"
    logger = logging.getLogger(nombre)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.addFilter(_FiltroSecretos())
    formato = _HoraCot("%(asctime)s %(levelname)s " + script + " %(message)s")
    archivo = _Archivo(script)
    archivo.setFormatter(formato)
    consola = logging.StreamHandler()
    consola.setFormatter(formato)
    logger.addHandler(archivo)
    logger.addHandler(consola)
    return logger
