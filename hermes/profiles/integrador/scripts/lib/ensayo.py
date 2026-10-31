"""Preparar .env y suscribir el tablón. Solo en un árbol de ensayo."""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .contexto import afirmar_ensayo, es_ruta_de_produccion

COT = ZoneInfo("America/Bogota")
_SECRETOS = re.compile(r"(TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL)")


def preparar_env(perfil: Path, raiz: Path) -> Path:
    afirmar_ensayo(raiz)
    if es_ruta_de_produccion(perfil):
        raise PermissionError("rechazado: el perfil es de producción")
    ejemplo = perfil / ".env.example"
    for linea in ejemplo.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        clave, _, valor = limpia.partition("=")
        if _SECRETOS.search(clave) and valor.strip():
            raise ValueError("el ejemplo trae un secreto")
    destino = perfil / ".env"
    destino.write_text(ejemplo.read_text(encoding="utf-8"), encoding="utf-8")
    destino.chmod(0o600)
    return destino


def suscribir(raiz: Path, ahora: datetime | None = None) -> None:
    afirmar_ensayo(raiz)
    bots = raiz / "tablon" / "bots.txt"
    if not bots.is_file():
        raise FileNotFoundError("falta bots.txt")
    momento = ahora or datetime.now(COT)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=COT)
    sello = momento.astimezone(COT).strftime("%Y%m%d")
    shutil.copy2(bots, bots.with_name(f"bots.txt.bak-{sello}"))
    lineas = bots.read_text(encoding="utf-8").splitlines()
    if "integrador" not in {linea.strip() for linea in lineas}:
        lineas.append("integrador")
        bots.write_text("\n".join(lineas) + "\n", encoding="utf-8")
