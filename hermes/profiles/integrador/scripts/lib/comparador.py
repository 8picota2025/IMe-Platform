"""Cruza las decisiones de Hermes con lo que reporta Grok. Solo escribe el informe."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .contexto import Contexto, afirmar_escritura

COT = ZoneInfo("America/Bogota")


def comparar(ctx: Contexto, ahora: datetime | None = None) -> Path:
    momento = ahora or datetime.now(COT)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=COT)
    momento = momento.astimezone(COT)
    hermes = _leer_jsonl(ctx.logs / "decisiones.jsonl")
    grok = _reportes_grok(ctx)
    por_hermes = {item["orden"]: item for item in hermes if item.get("orden")}
    por_grok = {item["orden"]: item for item in grok if item.get("orden")}
    ordenes = sorted(set(por_hermes) | set(por_grok))
    filas = ["| orden | hermes | grok | cruce |", "| --- | --- | --- | --- |"]
    for orden in ordenes:
        izquierda = por_hermes.get(orden)
        derecha = por_grok.get(orden)
        filas.append(
            f"| {orden} | {_celda(izquierda)} | {_celda(derecha)} | {_cruce(izquierda, derecha)} |"
        )
    if not ordenes:
        filas.append("| — | sin decisiones | sin reporte | sin cruce |")
    texto = "\n".join(
        [
            f"# Comparación integrador {momento.strftime('%Y-%m-%d')} COT",
            "",
            "Hermes en sombra anota lo que habría hecho. Grok sigue siendo quien ejecuta.",
            "",
            *filas,
            "",
        ]
    )
    ctx.logs.mkdir(parents=True, exist_ok=True)
    destino = ctx.logs / f"comparacion-{momento.strftime('%Y%m%d')}.md"
    afirmar_escritura(ctx, destino)
    destino.write_text(texto, encoding="utf-8")
    return destino


def _reportes_grok(ctx: Contexto) -> list[dict[str, str]]:
    reportes: list[dict[str, str]] = []
    if ctx.grok_log is not None:
        reportes.extend(_leer_jsonl(ctx.grok_log))
    eventos = ctx.tablon / "eventos"
    candidatos = []
    if eventos.is_dir():
        candidatos.extend(sorted(eventos.glob("*.json")))
    if ctx.tablon.is_dir():
        candidatos.extend(sorted(ctx.tablon.glob("*.json")))
    for path in candidatos:
        try:
            dato = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"reporte de Grok ilegible: {path.name}") from exc
        if not isinstance(dato, dict):
            continue
        if dato.get("fuente") != "grok" or "hecho" not in dato:
            continue
        orden = dato.get("orden") or dato.get("id")
        if isinstance(orden, str):
            reportes.append(
                {
                    "orden": orden,
                    "accion": str(dato.get("hecho", "")),
                    "resultado": str(dato.get("resultado", "")),
                }
            )
    return reportes


def _leer_jsonl(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    filas: list[dict[str, str]] = []
    for numero, linea in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not linea.strip():
            continue
        try:
            dato = json.loads(linea)
        except json.JSONDecodeError as exc:
            raise ValueError(f"jsonl ilegible en {path.name}:{numero}") from exc
        if not isinstance(dato, dict):
            continue
        orden = dato.get("orden")
        if not isinstance(orden, str) or not orden:
            continue
        accion = dato.get("accion") or dato.get("hecho") or ""
        resultado = dato.get("resultado_esperado") or dato.get("resultado") or ""
        filas.append({"orden": orden, "accion": str(accion), "resultado": str(resultado)})
    return filas


def _celda(item: dict[str, str] | None) -> str:
    if item is None:
        return "—"
    texto = item.get("accion", "").replace("|", "/")
    return texto[:120] or "—"


def _cruce(hermes: dict[str, str] | None, grok: dict[str, str] | None) -> str:
    if hermes is None:
        return "solo_grok"
    if grok is None:
        return "solo_hermes"
    if hermes.get("accion", "").strip() == grok.get("accion", "").strip():
        return "coincide"
    return "distinto"
