"""Solicitud de correo para Emilio. Este módulo no envía."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import ime_log

log = ime_log.get_logger("solicitud-emilio")


def solicitar(
    *,
    plantilla: str,
    destinatario: str,
    aprobacion: str,
    solicitante: str,
    asunto: str = "",
    cuerpo: str = "",
) -> dict:
    if not solicitante.strip():
        raise ValueError("solicitante obligatorio")
    if not destinatario.strip():
        raise ValueError("destinatario obligatorio")
    pedido = {
        "accion": "enviar_correo",
        "ejecutor": "emilio",
        "plantilla": plantilla,
        "destinatario": destinatario,
        "aprobacion": aprobacion,
        "solicitante": solicitante.strip(),
        "asunto": asunto,
        "cuerpo": cuerpo,
        "envia": False,
    }
    destino = Path(ime_log.directorio()) / "cola-emilio.jsonl"
    with destino.open("a", encoding="utf-8") as archivo:
        archivo.write(json.dumps(pedido, ensure_ascii=False) + "\n")
    url = os.environ.get("PANEL_TABLON_WEBHOOK_URL", "").strip()
    if url:
        cabeceras = {"Content-Type": "application/json"}
        secreto = os.environ.get("PANEL_TABLON_WEBHOOK_SECRET", "").strip()
        if secreto:
            cabeceras["X-Panel-Token"] = secreto
        peticion = urllib.request.Request(
            url, data=json.dumps(pedido).encode(), headers=cabeceras, method="POST"
        )
        try:
            with urllib.request.urlopen(peticion, timeout=20) as respuesta:
                if respuesta.status >= 300:
                    raise RuntimeError(f"tablon HTTP {respuesta.status}")
        except urllib.error.HTTPError as exc:
            log.exception("tablon rechazo la solicitud de %s", solicitante)
            raise RuntimeError(f"tablon HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            log.exception("tablon inalcanzable para %s", solicitante)
            raise RuntimeError(f"tablon inalcanzable ({exc.reason})") from exc
    log.info(
        "usuario=%s accion=solicitud_emilio objetivo=%s plantilla=%s resultado=encolado",
        solicitante,
        destinatario,
        plantilla or "-",
    )
    return {"ok": True, "encolado": True, "ejecutor": "emilio"}
