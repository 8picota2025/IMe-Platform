"""Rutas del perfil. Las lecturas de otros sistemas no crean carpetas."""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path

PERFIL_INSTALADO = Path(__file__).resolve().parents[2]
RAIZ_PRODUCCION = Path("/home/shoky")


@dataclass(frozen=True)
class Contexto:
    perfil: Path
    logs: Path
    tablon: Path
    modo_json: Path
    latido: Path
    cola: Path
    franja_log: Path
    panel_log: Path
    grok_log: Path | None
    n8n_url: str
    syncthing_url: str
    ops_hub_url: str


def cargar(
    perfil: Path | None = None,
    logs: Path | None = None,
    tablon: Path | None = None,
    modo_json: Path | None = None,
    latido: Path | None = None,
    cola: Path | None = None,
    franja_log: Path | None = None,
    panel_log: Path | None = None,
    grok_log: Path | None = None,
) -> Contexto:
    home = Path.home()
    hermes = Path(os.environ.get("HERMES_HOME", str(home / ".hermes")))
    base = Contexto(
        perfil=(perfil or _perfil_por_defecto()).resolve(),
        logs=(logs or Path(os.environ.get("INTEGRADOR_LOG_DIR", str(home / "logs" / "integrador")))).resolve(),
        tablon=(tablon or Path(os.environ.get("HERMES_TABLON", str(hermes / "shared" / "tablon")))).resolve(),
        modo_json=(
            modo_json or Path(os.environ.get("HERMES_MODO_JSON", str(hermes / "shared" / "estado" / "modo.json")))
        ).resolve(),
        latido=(
            latido or Path(os.environ.get("HERMES_LATIDO", str(hermes / "shared" / "estado" / "latido-grokbot.json")))
        ).resolve(),
        cola=(cola or Path(os.environ.get("CONTENIDOS_COLA", str(hermes / "shared" / "contenidos" / "cola")))).resolve(),
        franja_log=(franja_log or Path(os.environ.get("FRANJA_LOG", str(home / ".local" / "state" / "franja" / "log")))).resolve(),
        panel_log=(panel_log or Path(os.environ.get("PANEL_LOG", str(home / ".local" / "state" / "panel" / "log")))).resolve(),
        grok_log=_grok_log(grok_log),
        n8n_url=os.environ.get("N8N_BASE_URL", "").strip(),
        syncthing_url=os.environ.get("SYNCTHING_URL", "").strip(),
        ops_hub_url=os.environ.get("OPS_HUB_URL", "").strip(),
    )
    if grok_log is not None:
        base = replace(base, grok_log=grok_log.resolve())
    return base


def _perfil_por_defecto() -> Path:
    explicito = os.environ.get("INTEGRADOR_PERFIL", "").strip()
    if explicito:
        return Path(explicito)
    return PERFIL_INSTALADO


def _grok_log(explicito: Path | None) -> Path | None:
    if explicito is not None:
        return explicito
    valor = os.environ.get("GROK_DECISIONES", "").strip()
    if not valor:
        return None
    return Path(valor)


def es_ruta_de_produccion(path: Path) -> bool:
    candidato = path if path.is_absolute() else path.resolve()
    texto = str(candidato)
    if texto == str(RAIZ_PRODUCCION) or texto.startswith(str(RAIZ_PRODUCCION) + "/"):
        return True
    return False


def afirmar_ensayo(raiz: Path) -> None:
    """Rollback y suscripción solo corren en un árbol marcado, nunca en srv1715444."""
    if es_ruta_de_produccion(raiz):
        raise PermissionError("rechazado: la ruta es de producción")
    marca = raiz / "ENTORNO-DE-PRUEBA"
    if not marca.is_file():
        raise PermissionError("rechazado: falta ENTORNO-DE-PRUEBA")


def afirmar_escritura(ctx: Contexto, path: Path) -> None:
    destino = path.resolve()
    permitidas = (
        ctx.logs.resolve(),
        (ctx.tablon / "locks").resolve(),
        (ctx.tablon / "salida").resolve(),
    )
    if any(destino == raiz or raiz in destino.parents for raiz in permitidas):
        return
    raise PermissionError("escritura fuera de logs, locks o salida del tablón")
