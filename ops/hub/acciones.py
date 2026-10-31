"""Aprobar o rechazar: deja usuario, hora y decisión, y encola al bot dueño.

Aprobar una cotización llama al RPC de marca. No envía correo ni WhatsApp.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from almacen import Almacen
from kanban_md import CarrilAusente, Tarjeta, Tablero, parse, render
from registro import log, marca


class AccionError(Exception):
    def __init__(self, status: int, mensaje: str):
        super().__init__(mensaje)
        self.status = status


@dataclass
class Pedido:
    tarjeta_id: str
    decision: str
    usuario: str
    tablero: str
    origen: str = ""
    bot_dueno: str = ""
    cotizacion_id: str = ""
    aprobacion_tipo: str = ""
    ref: str = ""
    margen: str = ""


@dataclass
class Resultado:
    ok: bool
    idempotente: bool
    status: int
    mensaje: str


def escribir_atomico(path: Path, texto: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporal = path.with_name(f".{path.name}.tmp")
    temporal.write_text(texto, encoding="utf-8")
    os.replace(temporal, path)


def leer_tablero(path: Path) -> Tablero:
    if not path.is_file():
        from kanban_md import tablero_vacio

        return tablero_vacio()
    return parse(path.read_text(encoding="utf-8"))


def _payload(pedido: Pedido, cuando: str) -> dict:
    return {
        "accion": "encolar",
        "decision": pedido.decision,
        "tarjeta_id": pedido.tarjeta_id,
        "bot_dueno": pedido.bot_dueno,
        "usuario": pedido.usuario,
        "decidido_at": cuando,
        "origen": "ops-hub",
        "envia": False,
        "cotizacion_id": pedido.cotizacion_id,
        "ref": pedido.ref,
    }


def encolar_webhook(payload: dict) -> None:
    url = os.environ.get("PANEL_TABLON_WEBHOOK_URL", "").strip()
    if not url:
        raise AccionError(502, "PANEL_TABLON_WEBHOOK_URL no configurado")
    secreto = os.environ.get("PANEL_TABLON_WEBHOOK_SECRET", "").strip()
    cabeceras = {"Content-Type": "application/json"}
    if secreto:
        cabeceras["X-Panel-Token"] = secreto
    peticion = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=cabeceras, method="POST")
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:
            if respuesta.status >= 300:
                raise AccionError(502, f"tablon HTTP {respuesta.status}")
    except urllib.error.HTTPError as exc:
        raise AccionError(502, f"tablon HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise AccionError(502, f"tablon inalcanzable ({exc.reason})") from exc


def marcar_cotizacion(pedido: Pedido) -> None:
    if pedido.aprobacion_tipo not in {"ok_shoky", "validacion_costeo_margen"}:
        raise AccionError(400, "tipo de aprobacion invalido")
    if not pedido.ref.strip() or not pedido.cotizacion_id.strip():
        raise AccionError(400, "cotizacion_id y ref son obligatorios")
    url = os.environ.get("SUPABASE_URL", "").strip()
    llave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not llave:
        raise AccionError(502, "faltan SUPABASE_URL o la llave de servicio")
    cuerpo: dict[str, object] = {
        "p_id": pedido.cotizacion_id,
        "p_por": pedido.usuario,
        "p_tipo": pedido.aprobacion_tipo,
        "p_ref": pedido.ref,
        "p_margen": None,
    }
    if pedido.aprobacion_tipo == "validacion_costeo_margen":
        if pedido.margen.strip() == "":
            raise AccionError(400, "margen requerido")
        cuerpo["p_margen"] = float(pedido.margen.replace(",", "."))
    peticion = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/rpc/aprobar_cotizacion_envio",
        data=json.dumps(cuerpo).encode(),
        headers={
            "Content-Type": "application/json",
            "apikey": llave,
            "Authorization": f"Bearer {llave}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:
            if respuesta.status >= 300:
                raise AccionError(502, f"rpc HTTP {respuesta.status}")
    except urllib.error.HTTPError as exc:
        raise AccionError(502, f"rpc HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise AccionError(502, f"rpc inalcanzable ({exc.reason})") from exc
    except ValueError as exc:
        raise AccionError(400, "margen invalido") from exc


def decidir(path: Path, almacen: Almacen, pedido: Pedido, transporte: dict | None = None) -> Resultado:
    if pedido.decision not in {"aprobada", "rechazada"}:
        raise AccionError(400, "decision invalida")
    if not pedido.usuario.strip():
        raise AccionError(400, "usuario obligatorio")
    if not pedido.tarjeta_id.strip():
        raise AccionError(400, "tarjeta obligatoria")
    tablero = leer_tablero(path)
    tarjeta = next((item for item in tablero.tarjetas if item.id == pedido.tarjeta_id), None)
    if tarjeta is None:
        raise AccionError(404, "tarjeta no esta en el tablero")
    origen = pedido.origen or tarjeta.origen
    bot = pedido.bot_dueno or tarjeta.bot_dueno
    cotizacion = pedido.cotizacion_id or tarjeta.cotizacion_id
    pedido = Pedido(
        tarjeta_id=pedido.tarjeta_id,
        decision=pedido.decision,
        usuario=pedido.usuario.strip(),
        tablero=pedido.tablero,
        origen=origen,
        bot_dueno=bot,
        cotizacion_id=cotizacion,
        aprobacion_tipo=pedido.aprobacion_tipo,
        ref=pedido.ref or tarjeta.ref,
        margen=pedido.margen,
    )
    es_marca_cotizacion = pedido.decision == "aprobada" and origen == "cotizacion"
    if not es_marca_cotizacion and not bot:
        raise AccionError(400, "la tarjeta no tiene bot dueno")
    try:
        if pedido.decision == "rechazada":
            tablero.carril("rechazados")
        else:
            tablero.carril("ejecutados")
    except CarrilAusente as exc:
        log(str(exc), "ERROR")
        raise AccionError(409, str(exc)) from exc

    previa = almacen.decision(pedido.tarjeta_id)
    if previa and previa["decision"] == pedido.decision and previa["encolado_estado"] == "enviado":
        _escribir_movida(path, tablero, tarjeta, previa)
        log(f"decision idempotente {pedido.tarjeta_id} por {previa['usuario']}")
        return Resultado(True, True, 200, "ya estaba decidida")

    guardada = almacen.guardar_decision(
        {
            "tarjeta_id": pedido.tarjeta_id,
            "tablero": pedido.tablero,
            "decision": pedido.decision,
            "usuario": pedido.usuario,
            "titulo": tarjeta.titulo,
            "origen": origen,
            "bot_dueno": bot,
            "cotizacion_id": cotizacion,
            "encolado_estado": "pendiente",
        }
    )
    payload = _payload(pedido, str(guardada["decidido_at"]))
    cola_id = almacen.encolar(pedido.tarjeta_id, pedido.decision, payload)
    rutas = transporte or {"encolar_webhook": encolar_webhook, "marcar_cotizacion": marcar_cotizacion}
    try:
        if es_marca_cotizacion:
            rutas["marcar_cotizacion"](pedido)
        else:
            rutas["encolar_webhook"](payload)
    except AccionError as exc:
        almacen.cerrar_cola(cola_id, "error", str(exc))
        almacen.guardar_decision(_estado_cola(guardada, "error", str(exc)))
        log(f"encolado fallo {pedido.tarjeta_id}: {exc}", "ERROR")
        raise
    almacen.cerrar_cola(cola_id, "enviado")
    guardada = almacen.guardar_decision(_estado_cola(guardada, "enviado", None))
    _escribir_movida(path, tablero, tarjeta, guardada)
    log(f"{pedido.decision} {pedido.tarjeta_id} por {guardada['usuario']} a las {guardada['decidido_at']}")
    return Resultado(True, False, 200, "decision registrada")


def _estado_cola(guardada: dict, estado: str, error: str | None) -> dict:
    return {
        "tarjeta_id": guardada["tarjeta_id"],
        "tablero": guardada["tablero"],
        "decision": guardada["decision"],
        "usuario": guardada["usuario"],
        "titulo": guardada.get("titulo"),
        "origen": guardada.get("origen"),
        "bot_dueno": guardada.get("bot_dueno"),
        "cotizacion_id": guardada.get("cotizacion_id"),
        "encolado_estado": estado,
        "encolado_error": error,
    }


def _escribir_movida(path: Path, tablero: Tablero, tarjeta: Tarjeta, decision: dict) -> None:
    try:
        movida = _mover(tablero, tarjeta, decision)
    except CarrilAusente as exc:
        log(str(exc), "ERROR")
        raise AccionError(409, str(exc)) from exc
    escribir_atomico(path, render(movida))


def _mover(tablero: Tablero, tarjeta: Tarjeta, decision: dict) -> Tablero:
    if decision["decision"] == "rechazada":
        carril = tablero.carril("rechazados")
    else:
        carril = tablero.carril("ejecutados")
    nuevas = []
    for item in tablero.tarjetas:
        if item.id != tarjeta.id:
            nuevas.append(item)
            continue
        nuevas.append(
            Tarjeta(
                id=item.id,
                titulo=item.titulo,
                carril=carril,
                origen=item.origen,
                ref=item.ref,
                bot_dueno=item.bot_dueno,
                cotizacion_id=item.cotizacion_id,
                usuario=str(decision["usuario"]),
                decidido_at=str(decision["decidido_at"]),
                decision=str(decision["decision"]),
                notas=item.notas,
            )
        )
    return Tablero(tablero.frontmatter, list(tablero.carriles), nuevas)
