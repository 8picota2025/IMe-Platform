"""Secretos del hub. Solo entorno: sin valores por defecto y sin mostrarlos."""

from __future__ import annotations

import hashlib
import hmac
import os
import time

import base64
import struct


def _limpio(nombre: str) -> str:
    return os.environ.get(nombre, "").strip()


def token() -> str:
    return _limpio("IME_OPS_TOKEN")


def secreto_hmac() -> bytes:
    valor = _limpio("IME_OPS_SECRET")
    if not valor:
        raise RuntimeError("falta IME_OPS_SECRET")
    return valor.encode("utf-8")


def semilla_totp() -> str:
    return _limpio("IME_OPS_TOTP_SECRET")


def auth_activa() -> bool:
    if _limpio("IME_OPS_REQUIRE_AUTH") == "1":
        return True
    return bool(token() or _limpio("OPS_ADMIN_PASSWORD") or _limpio("OPS_ADMIN_PASSWORD_ALT") or _limpio("OPS_GERENCIA_PASSWORD"))


def _cuentas() -> dict[str, dict]:
    admin = [clave for clave in (_limpio("OPS_ADMIN_PASSWORD"), _limpio("OPS_ADMIN_PASSWORD_ALT")) if clave]
    gerencia = [clave for clave in (_limpio("OPS_GERENCIA_PASSWORD"),) if clave]
    cuentas: dict[str, dict] = {}
    if admin:
        for usuario in (_limpio("OPS_ADMIN_USER") or "root@i-me.com.co", _limpio("OPS_ADMIN_ALIAS") or "shoky"):
            cuentas[usuario.lower()] = {"usuario": usuario, "claves": admin, "rol": "admin"}
    if gerencia:
        usuario = _limpio("OPS_GERENCIA_USER") or "gerencia@i-me.com.co"
        cuentas[usuario.lower()] = {"usuario": usuario, "claves": gerencia, "rol": "gerencia_kanbans"}
    return cuentas


def _igual(izquierda: str, derecha: str) -> bool:
    if not izquierda or not derecha:
        return False
    return hmac.compare_digest(izquierda.encode("utf-8"), derecha.encode("utf-8"))


def autenticar(usuario: str, clave: str) -> tuple[str, str] | None:
    cuenta = _cuentas().get((usuario or "").strip().lower())
    if cuenta and any(_igual(clave, guardada) for guardada in cuenta["claves"]):
        return cuenta["usuario"], cuenta["rol"]
    api = token()
    if api and _igual(clave, api):
        admin = _limpio("OPS_ADMIN_USER") or "root@i-me.com.co"
        return admin, "admin"
    return None


def verificar_totp(codigo: str) -> bool:
    semilla = semilla_totp()
    if not semilla:
        return True
    if not codigo or not codigo.isdigit() or len(codigo) != 6:
        return False
    relleno = "=" * ((8 - len(semilla) % 8) % 8)
    try:
        llave = base64.b32decode((semilla + relleno).upper(), casefold=True)
    except Exception as exc:
        raise RuntimeError("IME_OPS_TOTP_SECRET no es base32") from exc
    contador = int(time.time()) // 30
    for ajuste in (-1, 0, 1):
        mensaje = struct.pack(">Q", contador + ajuste)
        digest = hmac.new(llave, mensaje, hashlib.sha1).digest()
        pos = digest[-1] & 0x0F
        valor = (struct.unpack(">I", digest[pos : pos + 4])[0] & 0x7FFFFFFF) % 1000000
        if f"{valor:06d}" == codigo:
            return True
    return False


def firmar_sesion(usuario: str, rol: str, expira: int | None = None) -> str:
    exp = expira if expira is not None else int(time.time()) + 43200
    payload = f"{usuario}|{rol}|{exp}"
    firma = hmac.new(secreto_hmac(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}|{firma}"


def leer_sesion(cookie: str) -> tuple[str, str] | None:
    partes = (cookie or "").split("|")
    if len(partes) != 4:
        return None
    usuario, rol, exp_s, firma = partes
    try:
        if int(exp_s) < int(time.time()):
            return None
    except ValueError:
        return None
    payload = f"{usuario}|{rol}|{exp_s}"
    esperada = hmac.new(secreto_hmac(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(firma, esperada):
        return None
    return usuario, rol
