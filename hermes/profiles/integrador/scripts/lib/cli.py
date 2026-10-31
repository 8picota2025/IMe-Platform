"""Argumentos comunes. No imprime el entorno."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .bitacora import configurar
from .contexto import cargar
from .orden import procesar_orden, rutina_comparador, rutina_reenvio, rutina_vigilancia


def parser(descripcion: str) -> argparse.ArgumentParser:
    argumento = argparse.ArgumentParser(description=descripcion)
    argumento.add_argument("--perfil", default="")
    argumento.add_argument("--logs", default="")
    argumento.add_argument("--tablon", default="")
    argumento.add_argument("--modo-json", default="")
    argumento.add_argument("--latido", default="")
    argumento.add_argument("--entrada", default="")
    return argumento


def contexto_de_args(args: argparse.Namespace):
    return cargar(
        perfil=Path(args.perfil) if args.perfil else None,
        logs=Path(args.logs) if args.logs else None,
        tablon=Path(args.tablon) if args.tablon else None,
        modo_json=Path(args.modo_json) if args.modo_json else None,
        latido=Path(args.latido) if args.latido else None,
    )


def main_entrada(argv: list[str] | None = None) -> int:
    args = parser("Registra una orden del tablón en modo sombra.") .parse_args(argv)
    if not args.entrada:
        sys.stderr.write("falta --entrada\n")
        return 1
    ctx = contexto_de_args(args)
    log = configurar(ctx)
    try:
        dato = json.loads(Path(args.entrada).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        log.error("no se pudo leer la orden: %s", type(exc).__name__)
        return 1
    if not isinstance(dato, dict):
        log.error("la orden no es un objeto")
        return 1
    try:
        resultado = procesar_orden(ctx, dato)
    except (OSError, ValueError, PermissionError) as exc:
        log.error("despertar falló: %s", type(exc).__name__)
        return 1
    sys.stdout.write(resultado + "\n")
    return 0 if resultado in {"registrada", "duplicada", "ajena", "apagado", "job_apagado"} else 1


def main_rutina(nombre: str, argv: list[str] | None = None) -> int:
    args = parser(nombre).parse_args(argv)
    ctx = contexto_de_args(args)
    log = configurar(ctx)
    try:
        if nombre == "reenvio":
            rutina_reenvio(ctx)
        elif nombre == "vigilancia":
            rutina_vigilancia(ctx)
        elif nombre == "comparador":
            rutina_comparador(ctx)
        elif nombre == "tablon":
            from .orden import barrer_entrada

            barrer_entrada(ctx)
        else:
            raise ValueError("rutina desconocida")
    except (OSError, ValueError, PermissionError) as exc:
        log.error("rutina %s falló: %s", nombre, type(exc).__name__)
        return 1
    sys.stdout.write("sombra\n")
    return 0
