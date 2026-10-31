"""Fuentes del kanban: Supabase (cotizaciones) y kanban.db de Hermes. No inventa filas."""

from __future__ import annotations

import json
import re
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

from kanban_md import Tarjeta
from registro import log

CERRADAS = frozenset(
    {
        "enviada",
        "aceptada",
        "rechazada",
        "perdida",
        "cerrada",
        "archivada",
        "cancelada",
        "facturada",
        "convertida",
    }
)


class FuenteNoDisponible(Exception):
    """La fuente estaba configurada y no respondió. No se reescribe el tablero."""


def _columna(nombres: list[str], opciones: tuple[str, ...]) -> str | None:
    bajos = {nombre.lower(): nombre for nombre in nombres}
    for opcion in opciones:
        if opcion in bajos:
            return bajos[opcion]
    return None


def leer_hermes(path: Path) -> list[Tarjeta]:
    if not path.is_file():
        raise FuenteNoDisponible(f"kanban.db de Hermes ausente: {path}")
    uri = f"file:{path.resolve()}?mode=ro"
    try:
        conexion = sqlite3.connect(uri, uri=True)
    except sqlite3.Error as exc:
        raise FuenteNoDisponible(f"kanban.db de Hermes no se abre: {exc}") from exc
    try:
        conexion.row_factory = sqlite3.Row
        tablas = [
            fila[0]
            for fila in conexion.execute(
                "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"
            )
        ]
        preferida = next(
            (tabla for tabla in tablas if tabla.lower() in {"cards", "kanban", "tarjetas", "tasks", "kanban_cards"}),
            None,
        )
        if preferida is None:
            log(f"kanban.db sin tabla de tarjetas ({', '.join(tablas) or 'vacia'})")
            return []
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", preferida):
            raise FuenteNoDisponible("nombre de tabla no usable")
        columnas = [fila[1] for fila in conexion.execute(f'pragma table_info("{preferida}")')]
        id_col = _columna(columnas, ("id", "card_id", "tarjeta_id"))
        titulo_col = _columna(columnas, ("titulo", "title", "nombre", "name"))
        if not id_col or not titulo_col:
            raise FuenteNoDisponible(f"kanban.db sin id o titulo en {preferida}")
        tablero_col = _columna(columnas, ("tablero", "board", "kanban"))
        carril_col = _columna(columnas, ("carril", "lane", "columna", "column", "estado"))
        origen_col = _columna(columnas, ("origen", "source", "tipo"))
        ref_col = _columna(columnas, ("ref", "numero", "reference"))
        bot_col = _columna(columnas, ("bot_dueno", "bot", "owner", "dueno"))
        cot_col = _columna(columnas, ("cotizacion_id", "quote_id"))
        filas = conexion.execute(f'select * from "{preferida}"').fetchall()
    finally:
        conexion.close()
    tarjetas: list[Tarjeta] = []
    for fila in filas:
        tarjetas.append(
            Tarjeta(
                id=str(fila[id_col]),
                titulo=str(fila[titulo_col] or fila[id_col]),
                carril=str(fila[carril_col] or "") if carril_col else "",
                origen=str(fila[origen_col] or "hermes") if origen_col else "hermes",
                ref=str(fila[ref_col] or "") if ref_col else "",
                bot_dueno=str(fila[bot_col] or "") if bot_col else "",
                cotizacion_id=str(fila[cot_col] or "") if cot_col else "",
                notas="",
                tablero=str(fila[tablero_col] or "") if tablero_col else "",
            )
        )
    return tarjetas


def leer_cotizaciones(url: str, llave: str, timeout: float = 20) -> list[Tarjeta]:
    consulta = (
        f"{url.rstrip('/')}/rest/v1/solicitudes_cotizacion"
        "?select=id,numero,estado,empresa,notas_internas,send_error,archived_at"
        "&archived_at=is.null"
    )
    peticion = urllib.request.Request(
        consulta,
        headers={
            "apikey": llave,
            "Authorization": f"Bearer {llave}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
            filas = json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise FuenteNoDisponible(f"supabase rechazo cotizaciones (HTTP {exc.code})") from exc
    except urllib.error.URLError as exc:
        raise FuenteNoDisponible(f"supabase inalcanzable ({exc.reason})") from exc
    except json.JSONDecodeError as exc:
        raise FuenteNoDisponible("supabase respondio sin json") from exc
    if not isinstance(filas, list):
        raise FuenteNoDisponible("supabase respondio sin lista")
    tarjetas: list[Tarjeta] = []
    for fila in filas:
        if not isinstance(fila, dict) or fila.get("archived_at"):
            continue
        estado = str(fila.get("estado") or "").strip().lower()
        if estado in CERRADAS:
            continue
        numero = str(fila.get("numero") or fila.get("id") or "")
        alertas = []
        if "no enviar" in str(fila.get("notas_internas") or "").lower():
            alertas.append("NO ENVIAR")
        if str(fila.get("send_error") or "").strip():
            alertas.append("send_error")
        tarjetas.append(
            Tarjeta(
                id=numero or str(fila.get("id")),
                titulo=numero or str(fila.get("id")),
                carril="",
                origen="cotizacion",
                ref=numero,
                cotizacion_id=str(fila.get("id") or ""),
                notas=", ".join(alertas),
                bot_dueno="correo",
            )
        )
    return tarjetas
