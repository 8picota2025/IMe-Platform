"""Aviso del bot-forge. Ya no envía correo: deja la solicitud en la cola de Emilio."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import ime_log
import solicitud_emilio

log = ime_log.get_logger("bot-forge-notify")


def notify(
    destinatario: str,
    asunto: str,
    cuerpo: str,
    solicitante: str,
    plantilla: str = "",
    aprobacion: str = "",
) -> dict:
    if not solicitante.strip():
        log.error("accion=notify resultado=rechazado detalle=sin solicitante")
        raise ValueError("solicitante obligatorio")
    pedido = solicitud_emilio.solicitar(
        plantilla=plantilla,
        destinatario=destinatario,
        aprobacion=aprobacion,
        solicitante=solicitante,
        asunto=asunto,
        cuerpo=cuerpo,
    )
    log.info(
        "usuario=%s accion=notify objetivo=%s resultado=encolado",
        solicitante,
        destinatario,
    )
    return pedido
