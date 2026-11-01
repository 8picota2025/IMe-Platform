"""Código de acceso por correo para el panel ops.

Genera 6 dígitos con secrets, guarda solo el HMAC y no escribe el código
en el log. El destinatario sale de IME_OPS_2FA_EMAIL.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import smtplib
import ssl
import threading
from email.message import EmailMessage
from typing import Callable

VALIDEZ_S = 10 * 60
MAX_INTENTOS = 5
MIN_ENTRE_ENVIOS_S = 60
MAX_POR_HORA = 5
VENTANA_HORA_S = 3600

VARIABLES_SMTP = (
    "IME_OPS_2FA_EMAIL",
    "IME_OPS_SMTP_HOST",
    "IME_OPS_SMTP_PORT",
    "IME_OPS_SMTP_USER",
    "IME_OPS_SMTP_PASS",
    "IME_OPS_SMTP_FROM",
)


class LimiteEnvio(Exception):
    def __init__(self, motivo: str) -> None:
        self.motivo = motivo
        super().__init__(motivo)


class EnvioError(Exception):
    def __init__(self, tipo: str) -> None:
        self.tipo = tipo
        super().__init__(tipo)


def interruptor(entorno: dict[str, str]) -> str:
    """off por defecto. Solo on activa el código. Cualquier otro texto es invalido."""
    valor = str(entorno.get("IME_OPS_2FA", "off")).strip().lower()
    if valor in {"", "off"}:
        return "off"
    if valor == "on":
        return "on"
    return "invalido"


def activo(entorno: dict[str, str] | None = None) -> bool:
    fuente = os.environ if entorno is None else entorno
    return interruptor(fuente) == "on"


def variables_faltantes(entorno: dict[str, str]) -> list[str]:
    if interruptor(entorno) != "on":
        return []
    faltan = []
    for nombre in VARIABLES_SMTP:
        if not str(entorno.get(nombre, "")).strip():
            faltan.append(nombre)
    return faltan


def _hash(codigo: str, pepper: bytes) -> str:
    return hmac.new(pepper, codigo.encode("utf-8"), hashlib.sha256).hexdigest()


class Gestor:
    def __init__(
        self,
        *,
        ahora: Callable[[], float],
        enviar: Callable[[str, str], None],
        pepper: bytes,
        destinatario: str,
    ) -> None:
        self._ahora = ahora
        self._enviar = enviar
        self._pepper = pepper
        self._destinatario = destinatario.strip()
        self._retos: dict[str, dict] = {}
        self._envios: list[float] = []
        self._lock = threading.Lock()

    def pedir(self, usuario: str, rol: str) -> str:
        """Devuelve el id del reto. El código solo se entrega a `enviar`."""
        with self._lock:
            ahora = self._ahora()
            self._purgar(ahora)
            if self._envios and ahora - self._envios[-1] < MIN_ENTRE_ENVIOS_S:
                raise LimiteEnvio("limite_minuto")
            if len(self._envios) >= MAX_POR_HORA:
                raise LimiteEnvio("limite_hora")
            codigo = f"{secrets.randbelow(1_000_000):06d}"
            reto_id = secrets.token_urlsafe(24)
            try:
                self._enviar(self._destinatario, codigo)
            except EnvioError:
                raise
            except Exception as exc:
                raise EnvioError(exc.__class__.__name__) from None
            self._envios.append(ahora)
            for viejo in [clave for clave, reto in self._retos.items() if reto["usuario"] == usuario]:
                del self._retos[viejo]
            self._retos[reto_id] = {
                "hash": _hash(codigo, self._pepper),
                "expira": ahora + VALIDEZ_S,
                "intentos": 0,
                "usado": False,
                "usuario": usuario,
                "rol": rol,
            }
            return reto_id

    def verificar(self, reto_id: str, codigo: str) -> tuple[str, str, str]:
        """(usuario, rol, motivo). motivo ok|ausente|usado|caducado|agotado|incorrecto."""
        with self._lock:
            reto = self._retos.get(reto_id or "")
            if reto is None:
                return "", "", "ausente"
            if reto["usado"]:
                return reto["usuario"], reto["rol"], "usado"
            ahora = self._ahora()
            if ahora > reto["expira"]:
                reto["usado"] = True
                return reto["usuario"], reto["rol"], "caducado"
            if reto["intentos"] >= MAX_INTENTOS:
                reto["usado"] = True
                return reto["usuario"], reto["rol"], "agotado"
            reto["intentos"] += 1
            recibido = _hash((codigo or "").strip(), self._pepper)
            if not hmac.compare_digest(reto["hash"], recibido):
                if reto["intentos"] >= MAX_INTENTOS:
                    reto["usado"] = True
                    return reto["usuario"], reto["rol"], "agotado"
                return reto["usuario"], reto["rol"], "incorrecto"
            reto["usado"] = True
            return reto["usuario"], reto["rol"], "ok"

    def _purgar(self, ahora: float) -> None:
        self._envios = [marca for marca in self._envios if ahora - marca < VENTANA_HORA_S]
        muertos = [clave for clave, reto in self._retos.items() if ahora > reto["expira"] + VALIDEZ_S]
        for clave in muertos:
            del self._retos[clave]


def enviar_smtp(
    destinatario: str,
    codigo: str,
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    remitente: str,
    logger,
    smtp_factory=None,
) -> None:
    """TLS obligatorio. El logger no recibe el código ni la contraseña."""
    mensaje = EmailMessage()
    mensaje["Subject"] = "Código de acceso al panel ops"
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje.set_content(
        "Código de acceso al panel ops: "
        + codigo
        + "\nCaduca en 10 minutos y solo sirve una vez.\n"
        + "Si no pediste este código, ignóralo.\n"
    )
    contexto = ssl.create_default_context()
    if smtp_factory is not None:
        smtp = smtp_factory(host, port, contexto)
    elif port == 465:
        smtp = smtplib.SMTP_SSL(host, port, context=contexto, timeout=20)
    else:
        smtp = smtplib.SMTP(host, port, timeout=20)
    try:
        if port != 465:
            smtp.ehlo()
            if not smtp.has_extn("starttls"):
                raise EnvioError("sin_starttls")
            smtp.starttls(context=contexto)
            smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(mensaje)
    finally:
        try:
            smtp.quit()
        except Exception:
            pass
    logger.info("2fa correo enviado")
