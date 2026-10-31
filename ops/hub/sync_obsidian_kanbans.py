"""Regenera los kanban desde datos. No pisa un carril que ya no es la bandeja de entrada."""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from almacen import Almacen
from acciones import escribir_atomico
from fuentes import FuenteNoDisponible, leer_cotizaciones, leer_hermes
from kanban_md import CarrilAusente, Tarjeta, fusionar, parse, render, tablero_vacio
from registro import log

TABLEROS = {
    "Kanban-Aprobaciones.md": "aprobaciones",
    "Kanban-1.md": "1",
    "Kanban-2.md": "2",
    "Kanban-3.md": "3",
    "Kanban-Comercial.md": "comercial",
    "Kanban-Proveedores.md": "proveedores",
}


def leer_existente(path: Path):
    if not path.is_file():
        return tablero_vacio() if path.name == "Kanban-Aprobaciones.md" else None
    return parse(path.read_text(encoding="utf-8"))


def fuentes_del_tablero(nombre: str, hermes: list[Tarjeta], cotizaciones: list[Tarjeta]) -> list[Tarjeta]:
    clave = TABLEROS[nombre]
    if nombre == "Kanban-Aprobaciones.md":
        return cotizaciones + [tarjeta for tarjeta in hermes if (tarjeta.tablero or "aprobaciones") == "aprobaciones"]
    return [tarjeta for tarjeta in hermes if tarjeta.tablero == clave]


def sincronizar(directorio: Path, db: Path, hermes_path: Path | None, supabase: tuple[str, str] | None) -> int:
    if hermes_path is None and supabase is None:
        log("sin IME_HERMES_KANBAN_DB ni Supabase; no se reescribe ningun kanban")
        return 2
    try:
        hermes = leer_hermes(hermes_path) if hermes_path else []
        cotizaciones = leer_cotizaciones(*supabase) if supabase else []
    except FuenteNoDisponible as exc:
        log(str(exc), "ERROR")
        return 2
    almacen = Almacen(db)
    try:
        decisiones = almacen.decisiones()
    finally:
        almacen.close()
    escritos = 0
    for nombre in TABLEROS:
        path = directorio / nombre
        fuentes = fuentes_del_tablero(nombre, hermes, cotizaciones)
        if not fuentes:
            log(f"{nombre} sin filas de origen; se deja como esta")
            continue
        existente = leer_existente(path)
        if existente is None:
            continue
        try:
            fusion = fusionar(existente, fuentes, decisiones)
        except CarrilAusente as exc:
            log(str(exc), "ERROR")
            return 1
        escribir_atomico(path, render(fusion))
        escritos += 1
    log(f"kanban actualizados: {escritos}")
    return 0


def main() -> int:
    directorio = os.environ.get("IME_OPS_KANBAN_DIR", "").strip()
    if not directorio:
        log("falta IME_OPS_KANBAN_DIR", "ERROR")
        return 1
    db = Path(os.environ.get("IME_OPS_DB", "").strip() or str(Path(directorio) / "ops-hub.db"))
    hermes = os.environ.get("IME_HERMES_KANBAN_DB", "").strip()
    url = os.environ.get("SUPABASE_URL", "").strip()
    llave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    supabase = (url, llave) if url and llave else None
    try:
        return sincronizar(Path(directorio), db, Path(hermes) if hermes else None, supabase)
    except Exception as exc:
        log(f"excepcion: {type(exc).__name__}: {exc}", "ERROR")
        return 1


if __name__ == "__main__":
    sys.exit(main())
