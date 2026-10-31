"""Comprobaciones de solo lectura. No crea las fuentes que no existen."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Protocol
from zoneinfo import ZoneInfo

from .bitacora import redactar, secretos_de_perfil
from .contexto import Contexto

COT = ZoneInfo("America/Bogota")
FLUJOS_N8N = ("avisos-telegram", "correo-entrante", "cola-salida-unica")


class Transporte(Protocol):
    def get(self, url: str, headers: dict[str, str]) -> tuple[int, str]: ...


def informe(ctx: Contexto, transporte: Transporte | None = None, ahora: datetime | None = None) -> str:
    momento = ahora or datetime.now(COT)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=COT)
    momento = momento.astimezone(COT)
    cliente = transporte or _UrllibGet()
    secretos = secretos_de_perfil(ctx.perfil)
    lineas = [
        f"# Vigilancia integrador {momento.strftime('%Y-%m-%d %H:%M')} COT",
        "",
        _archivo("franja (GPU)", ctx.franja_log, secretos),
        _cola(ctx.cola),
        _archivo("panel", ctx.panel_log, secretos),
        *_n8n(ctx, cliente, secretos),
        _syncthing(ctx, cliente, secretos),
        _ops_hub(ctx, cliente),
        _modo(ctx.modo_json),
    ]
    return "\n".join(lineas) + "\n"


def guardar_informe(ctx: Contexto, texto: str, ahora: datetime | None = None) -> Path:
    from .contexto import afirmar_escritura

    momento = ahora or datetime.now(COT)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=COT)
    ctx.logs.mkdir(parents=True, exist_ok=True)
    destino = ctx.logs / f"vigilancia-{momento.astimezone(COT).strftime('%Y%m%d')}.md"
    afirmar_escritura(ctx, destino)
    destino.write_text(texto, encoding="utf-8")
    return destino


def _archivo(nombre: str, path: Path, secretos: list[str]) -> str:
    if not path.is_file():
        return f"- {nombre}: ausente ({path.name})"
    bruto = path.read_text(encoding="utf-8", errors="replace")
    cola = redactar("\n".join(bruto.splitlines()[-5:]), secretos).replace("\n", " | ")
    return f"- {nombre}: {len(bruto.splitlines())} líneas; cola: {cola[:240]}"


def _cola(path: Path) -> str:
    if not path.exists():
        return "- cola de contenidos: ausente, no se crea"
    if path.is_file():
        return f"- cola de contenidos: archivo presente ({path.name}), no se modifica"
    entradas = [item.name for item in path.iterdir() if not item.name.startswith(".")]
    return f"- cola de contenidos: {len(entradas)} entradas, no se modifica"


def _n8n(ctx: Contexto, cliente: Transporte, secretos: list[str]) -> list[str]:
    if not ctx.n8n_url:
        return [f"- n8n {nombre}: no consultado" for nombre in FLUJOS_N8N]
    url = ctx.n8n_url.rstrip("/") + "/api/v1/workflows"
    estado, cuerpo = _traer(cliente, url, _cabecera("X-N8N-API-KEY", "N8N_API_KEY"))
    activos = _flujos(cuerpo)
    lineas = []
    for nombre in FLUJOS_N8N:
        if nombre not in activos:
            lineas.append(f"- n8n {nombre}: http {estado}, no aparece en la lista")
            continue
        marca = "activo" if activos[nombre] else "inactivo"
        lineas.append(f"- n8n {nombre}: http {estado}, {marca}")
    return [redactar(linea, secretos) for linea in lineas]


def _syncthing(ctx: Contexto, cliente: Transporte, secretos: list[str]) -> str:
    if not ctx.syncthing_url:
        return "- syncthing ime-vault: no consultado"
    url = ctx.syncthing_url.rstrip("/") + "/rest/db/status?folder=ime-vault"
    estado, cuerpo = _traer(cliente, url, _cabecera("X-API-Key", "SYNCTHING_API_KEY"))
    fase = ""
    try:
        dato = json.loads(cuerpo)
    except json.JSONDecodeError:
        dato = None
    if isinstance(dato, dict) and isinstance(dato.get("state"), str):
        fase = f", estado {dato['state']}"
    return redactar(f"- syncthing ime-vault: http {estado}{fase}", secretos)


def _ops_hub(ctx: Contexto, cliente: Transporte) -> str:
    if not ctx.ops_hub_url:
        return "- ops-hub: no consultado"
    estado, _cuerpo = _traer(cliente, ctx.ops_hub_url, {})
    marca = "ok" if estado == 200 else "distinto de 200"
    return f"- ops-hub: http {estado} ({marca})"


def _modo(path: Path) -> str:
    if not path.is_file():
        return "- estado/modo.json: ausente"
    bruto = path.read_text(encoding="utf-8").strip().replace("\n", " ")
    return f"- estado/modo.json: {bruto[:180]}"


def _flujos(cuerpo: str) -> dict[str, bool]:
    try:
        dato = json.loads(cuerpo)
    except json.JSONDecodeError:
        return {}
    if isinstance(dato, dict):
        lista = dato.get("data", [])
    elif isinstance(dato, list):
        lista = dato
    else:
        return {}
    if not isinstance(lista, list):
        return {}
    hallados: dict[str, bool] = {}
    for item in lista:
        if not isinstance(item, dict):
            continue
        nombre = item.get("name")
        if isinstance(nombre, str):
            hallados[nombre] = item.get("active") is True
    return hallados


def _cabecera(nombre: str, variable: str) -> dict[str, str]:
    valor = os.environ.get(variable, "").strip()
    if not valor:
        return {}
    return {nombre: valor}


def _traer(cliente: Transporte, url: str, headers: dict[str, str]) -> tuple[int, str]:
    if not url.startswith(("https://", "http://")):
        raise ValueError("la vigilancia solo hace GET http(s)")
    return cliente.get(url, headers)


class _UrllibGet:
    def get(self, url: str, headers: dict[str, str]) -> tuple[int, str]:
        peticion = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(peticion, timeout=5) as respuesta:
                cuerpo = respuesta.read(65536).decode("utf-8", errors="replace")
                return int(respuesta.status), cuerpo
        except urllib.error.HTTPError as exc:
            cuerpo = exc.read(65536).decode("utf-8", errors="replace")
            return int(exc.code), cuerpo
