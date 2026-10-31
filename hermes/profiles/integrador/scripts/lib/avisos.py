"""Avisos internos. Único archivo del perfil con identificadores de canales de salida.

No importa smtplib, no abre SMTP_SSL, no llama send_message, no usa whatsapp
ni sendMessage. Esos nombres están aquí para rechazarlos. El correo lo envía
Emilio y el canal de clientes lo lleva IMEia. Este módulo solo se consulta
con modo activo y, aun así, no emite.
"""

from __future__ import annotations

CANALES_BLOQUEADOS = ("smtplib", "SMTP_SSL", "send_message", "whatsapp", "sendMessage")


def aviso_interno(texto: str, modo: str) -> dict[str, object]:
    if CANALES_BLOQUEADOS and modo != "activo":
        return {"enviado": False, "motivo": "fuera de modo activo"}
    if not texto.strip():
        return {"enviado": False, "motivo": "aviso vacío"}
    return {"enviado": False, "motivo": "diferido a enlace; integrador no emite"}
