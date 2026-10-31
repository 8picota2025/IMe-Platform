"""Modo efectivo. Activo solo con las cuatro condiciones; si falta una, sombra."""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .contexto import Contexto
from .detector import grok_no_disponible

COT = ZoneInfo("America/Bogota")


def ahora_cot() -> datetime:
    return datetime.now(COT)


def modo_declarado(ctx: Contexto) -> str:
    valor = os.environ.get("INTEGRADOR_MODO", "").strip().lower()
    if not valor:
        valor = _clave_env(ctx.perfil / ".env", "INTEGRADOR_MODO").lower()
    if valor not in {"sombra", "activo"}:
        return "sombra"
    return valor


def modo_efectivo(ctx: Contexto, ahora: datetime | None = None) -> str:
    if modo_declarado(ctx) != "activo":
        return "sombra"
    if not (ctx.perfil / "ACTIVO_AUTORIZADO").is_file():
        return "sombra"
    if leer_modo_compartido(ctx.modo_json) != "respaldo":
        return "sombra"
    if not grok_no_disponible(ctx.latido, ahora or ahora_cot()):
        return "sombra"
    return "activo"


def leer_modo_compartido(path: Path) -> str:
    if not path.is_file():
        return ""
    bruto = path.read_text(encoding="utf-8").strip()
    if not bruto:
        return ""
    if bruto.startswith("{"):
        try:
            dato = json.loads(bruto)
        except json.JSONDecodeError as exc:
            raise ValueError("modo.json no es JSON válido") from exc
        if not isinstance(dato, dict):
            raise ValueError("modo.json no es un objeto")
        return str(dato.get("modo", "")).strip().lower()
    return bruto.lower()


def _clave_env(path: Path, clave: str) -> str:
    if not path.is_file():
        return ""
    for linea in path.read_text(encoding="utf-8").splitlines():
        limpia = linea.strip()
        if not limpia or limpia.startswith("#") or "=" not in limpia:
            continue
        nombre, _, valor = limpia.partition("=")
        if nombre.strip() == clave:
            return valor.strip().strip('"').strip("'")
    return ""
