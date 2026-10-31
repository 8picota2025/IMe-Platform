"""Lectura IMAP de Hostinger. No envía correo: eso lo pide a Emilio."""

from __future__ import annotations

import imaplib
import os

import ime_log
import solicitud_emilio

log = ime_log.get_logger("hostinger-direct")


def _conectar() -> imaplib.IMAP4_SSL:
    host = os.environ.get("IMAP_HOST", "").strip()
    usuario = os.environ.get("IMAP_USER", "").strip()
    clave = os.environ.get("IMAP_PASSWORD", "").strip()
    if not host or not usuario or not clave:
        raise RuntimeError("faltan IMAP_HOST, IMAP_USER o IMAP_PASSWORD")
    cliente = imaplib.IMAP4_SSL(host)
    cliente.login(usuario, clave)
    return cliente


def listar_no_leidos(buzon: str = "INBOX", limite: int = 20) -> list[bytes]:
    cliente = _conectar()
    try:
        cliente.select(buzon, readonly=True)
        estado, datos = cliente.search(None, "UNSEEN")
        if estado != "OK":
            raise RuntimeError(f"IMAP search {estado}")
        ids = (datos[0] or b"").split()
        return ids[:limite]
    except Exception:
        log.exception("no se pudo leer %s", buzon)
        raise
    finally:
        try:
            cliente.logout()
        except Exception:
            log.exception("logout IMAP")


def enviar_correo(*_args, **_kwargs):
    """El envío ya no vive aquí."""
    raise RuntimeError("hostinger_direct solo lee IMAP. El correo lo envía Emilio.")


def solicitar_envio(*, destinatario: str, asunto: str, cuerpo: str, solicitante: str, plantilla: str = "", aprobacion: str = "") -> dict:
    log.info("usuario=%s accion=leer_y_derivar objetivo=%s resultado=solicitud", solicitante, destinatario)
    return solicitud_emilio.solicitar(
        plantilla=plantilla,
        destinatario=destinatario,
        aprobacion=aprobacion,
        solicitante=solicitante,
        asunto=asunto,
        cuerpo=cuerpo,
    )
