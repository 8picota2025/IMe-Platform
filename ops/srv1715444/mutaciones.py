"""Acciones que cambian datos: solo POST, con CSRF y una palabra de confirmación."""

from __future__ import annotations

import hashlib
import hmac

# Rutas que antes respondían a GET y tenían efecto. Un GET aquí no debe hacer nada.
RUTAS_SOLO_POST = frozenset(
    {
        "/api/documenso/delete",
        "/api/documenso/download",
        "/logout",
        "/api/semaforo/refrescar",
        "/login/token",
    }
)

CONFIRMACION = {
    "/api/documenso/delete": "BORRAR",
    "/api/documenso/download": "GUARDAR",
    "/logout": "SALIR",
    "/api/semaforo/refrescar": "REFRESCAR",
}


def token_csrf(secreto: bytes, usuario: str) -> str:
    return hmac.new(secreto, b"csrf|" + usuario.encode("utf-8"), hashlib.sha256).hexdigest()


def csrf_valido(secreto: bytes, usuario: str, recibido: str) -> bool:
    if not usuario or not recibido:
        return False
    esperado = token_csrf(secreto, usuario)
    if len(esperado) != len(recibido):
        return False
    return hmac.compare_digest(esperado, recibido)


def confirmacion_valida(ruta: str, valor: str) -> bool:
    palabra = CONFIRMACION.get(ruta)
    if palabra is None:
        return True
    return valor == palabra
