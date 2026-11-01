#!/usr/bin/env python3
"""Hub de ops.i-me.com.co. Escucha en 127.0.0.1:18880, detrás de nginx.

Tras usuario y clave, el segundo factor es un código por correo
(IME_OPS_2FA_EMAIL). POST /post/approve y POST /post/reject registran
usuario, hora y decisión y encolan al bot dueño. Esas acciones no envían
correo ni WhatsApp.
"""

from __future__ import annotations

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent))

from acciones import AccionError, Pedido, decidir
from almacen import Almacen
from kanban_md import parse
from registro import log
import sys as _ime_sys
from pathlib import Path as _ImePath

def _directorio_ime_log() -> _ImePath:
    """ime_log.py vive en ops/srv1715444 y no iba en el árbol copiado a ~/bin."""
    aqui = _ImePath(__file__).resolve().parent
    candidatos = [aqui, aqui.parent / "srv1715444"]
    for ruta in candidatos:
        if (ruta / "ime_log.py").is_file():
            return ruta
    sys.stderr.write(
        "falta ime_log.py. Copiar ops/srv1715444/ime_log.py junto a ime-ops-hub.py "
        "(WorkingDirectory de ime-ops-hub.service).\n"
    )
    raise SystemExit(1)


_ime_sys.path.insert(0, str(_directorio_ime_log()))
import correo_2fa
import ime_log

bitacora = ime_log.get_logger("ime-ops-hub")
import secretos

_GESTOR_2FA = None


def gestor_2fa() -> correo_2fa.Gestor:
    global _GESTOR_2FA
    if _GESTOR_2FA is None:
        def enviar(destino: str, codigo: str) -> None:
            correo_2fa.enviar_smtp(
                destino,
                codigo,
                host=os.environ["IME_OPS_SMTP_HOST"].strip(),
                port=int(os.environ["IME_OPS_SMTP_PORT"].strip()),
                user=os.environ["IME_OPS_SMTP_USER"].strip(),
                password=os.environ["IME_OPS_SMTP_PASS"],
                remitente=os.environ["IME_OPS_SMTP_FROM"].strip(),
                logger=bitacora,
            )

        _GESTOR_2FA = correo_2fa.Gestor(
            ahora=time.time,
            enviar=enviar,
            pepper=secretos.secreto_hmac(),
            destinatario=os.environ.get("IME_OPS_2FA_EMAIL", ""),
        )
    return _GESTOR_2FA

TABLERO_DEFECTO = "Kanban-Aprobaciones.md"


def directorio_kanban() -> Path:
    crudo = os.environ.get("IME_OPS_KANBAN_DIR", "").strip()
    if not crudo:
        raise RuntimeError("falta IME_OPS_KANBAN_DIR")
    return Path(crudo)


def ruta_db() -> Path:
    explicita = os.environ.get("IME_OPS_DB", "").strip()
    if explicita:
        return Path(explicita)
    return directorio_kanban() / "ops-hub.db"


def ruta_tablero(nombre: str) -> Path:
    limpio = nombre.strip() or TABLERO_DEFECTO
    if not limpio.endswith(".md"):
        limpio += ".md"
    if "/" in limpio or limpio.startswith("."):
        raise AccionError(400, "tablero invalido")
    return directorio_kanban() / limpio


class Hub(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        log(fmt % args, "HTTP")

    def _enviar(self, status: int, cuerpo: dict | str, tipo: str = "application/json") -> None:
        if isinstance(cuerpo, dict):
            data = json.dumps(cuerpo).encode()
        else:
            data = cuerpo.encode()
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _cookie(self) -> str:
        for parte in self.headers.get("Cookie", "").split(";"):
            nombre, _, valor = parte.strip().partition("=")
            if nombre == "ime_ops_session":
                return valor
        return ""

    def _sesion(self) -> tuple[str, str] | None:
        try:
            return secretos.leer_sesion(self._cookie())
        except RuntimeError as exc:
            log(str(exc), "ERROR")
            return None

    def _autorizado(self) -> bool:
        if not secretos.auth_activa():
            return True
        if self._sesion():
            return True
        esperado = secretos.token()
        if not esperado:
            return False
        recibido = self.headers.get("X-Ops-Token", "").strip()
        autorizacion = self.headers.get("Authorization", "")
        if autorizacion.lower().startswith("bearer "):
            recibido = autorizacion[7:].strip()
        if len(recibido) != len(esperado):
            return False
        distinto = 0
        for izquierda, derecha in zip(recibido, esperado):
            distinto |= ord(izquierda) ^ ord(derecha)
        return distinto == 0

    def _usuario(self, campos: dict[str, str]) -> str:
        cabecera = self.headers.get("X-Remote-User", "").strip()
        return cabecera or campos.get("usuario", "").strip()

    def _campos(self) -> dict[str, str]:
        longitud = int(self.headers.get("Content-Length", "0") or "0")
        if longitud > 100_000:
            raise AccionError(413, "cuerpo demasiado grande")
        crudo = self.rfile.read(longitud)
        tipo = self.headers.get("Content-Type", "")
        if "application/json" in tipo:
            dato = json.loads(crudo.decode() or "{}")
            if not isinstance(dato, dict):
                raise AccionError(400, "json invalido")
            return {str(clave): "" if valor is None else str(valor) for clave, valor in dato.items()}
        parsed = parse_qs(crudo.decode(), keep_blank_values=True)
        return {clave: valores[-1] if valores else "" for clave, valores in parsed.items()}

    def do_GET(self) -> None:  # noqa: N802
        ruta = self.path.split("?", 1)[0]
        if ruta == "/salud":
            self._enviar(200, {"ok": True, "servicio": "ime-ops-hub"})
            return
        if ruta == "/login/codigo":
            self._enviar(200, _html_codigo(), "text/html; charset=utf-8")
            return
        if ruta not in {"/", "/kanban", "/login"}:
            self._enviar(404, {"ok": False, "error": "no existe"})
            return
        if secretos.auth_activa() and not self._sesion():
            self._enviar(200, _html_login(), "text/html; charset=utf-8")
            return
        path = ruta_tablero(TABLERO_DEFECTO)
        texto = path.read_text(encoding="utf-8") if path.is_file() else ""
        self._enviar(200, _html(parse(texto) if texto else parse("")), "text/html; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802
        ruta = self.path.split("?", 1)[0]
        if ruta == "/login":
            self._entrar()
            return
        if ruta == "/login/codigo":
            self._confirmar_codigo()
            return
        if ruta not in {"/post/approve", "/post/reject"}:
            self._enviar(404, {"ok": False, "error": "no existe"})
            return
        if not self._autorizado():
            log("acceso rechazado", "ERROR")
            bitacora.info(
                "usuario=- ip=%s accion=%s objetivo=%s resultado=rechazado",
                self.client_address[0],
                ruta,
                "-",
            )
            self._enviar(401, {"ok": False, "error": "no autorizado"})
            return
        try:
            campos = self._campos()
            pedido = Pedido(
                tarjeta_id=campos.get("id", ""),
                decision="aprobada" if ruta == "/post/approve" else "rechazada",
                usuario=self._usuario(campos),
                tablero=campos.get("tablero", TABLERO_DEFECTO),
                origen=campos.get("origen", ""),
                bot_dueno=campos.get("bot_dueno", ""),
                cotizacion_id=campos.get("cotizacion_id", ""),
                aprobacion_tipo=campos.get("aprobacion_tipo", ""),
                ref=campos.get("ref", ""),
                margen=campos.get("margen", ""),
            )
            almacen = Almacen(ruta_db())
            try:
                resultado = decidir(ruta_tablero(pedido.tablero), almacen, pedido)
            finally:
                almacen.close()
        except AccionError as exc:
            log(str(exc), "ERROR")
            bitacora.info(
                "usuario=%s ip=%s accion=%s objetivo=%s resultado=error status=%s",
                pedido.usuario or "-",
                self.client_address[0],
                pedido.decision,
                pedido.tarjeta_id,
                exc.status,
            )
            self._enviar(exc.status, {"ok": False, "error": str(exc)})
            return
        except json.JSONDecodeError:
            log("json invalido", "ERROR")
            self._enviar(400, {"ok": False, "error": "json invalido"})
            return
        except Exception as exc:
            log(f"excepcion: {type(exc).__name__}: {exc}", "ERROR")
            self._enviar(500, {"ok": False, "error": "error interno"})
            return
        self._enviar(
            resultado.status,
            {"ok": resultado.ok, "idempotente": resultado.idempotente, "mensaje": resultado.mensaje},
        )
        bitacora.info(
            "usuario=%s ip=%s accion=%s objetivo=%s resultado=%s",
            pedido.usuario,
            self.client_address[0],
            pedido.decision,
            pedido.tarjeta_id,
            resultado.mensaje,
        )

    def _entrar(self) -> None:
        try:
            campos = self._campos()
        except AccionError as exc:
            self._enviar(exc.status, {"ok": False, "error": str(exc)})
            return
        except json.JSONDecodeError:
            self._enviar(400, _html_login("Credenciales inválidas."), "text/html; charset=utf-8")
            return
        quien = secretos.autenticar(campos.get("username", ""), campos.get("password", ""))
        if not quien:
            log("login rechazado", "ERROR")
            bitacora.info("2fa envio usuario=%s resultado=credenciales", campos.get("username") or "-")
            self._enviar(401, _html_login("Credenciales inválidas."), "text/html; charset=utf-8")
            return
        if not correo_2fa.activo():
            bitacora.info("2fa verificar usuario=%s resultado=apagado", quien[0])
            try:
                cookie = secretos.firmar_sesion(*quien)
            except RuntimeError as exc:
                log(str(exc), "ERROR")
                self._enviar(500, {"ok": False, "error": "falta el secreto de sesion"})
                return
            cuerpo = _html_login("Sesión abierta.").encode()
            self.send_response(303)
            self.send_header("Set-Cookie", f"ime_ops_session={cookie}; HttpOnly; SameSite=Strict; Path=/")
            self.send_header("Location", "/")
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)
            return
        try:
            reto = gestor_2fa().pedir(*quien)
        except correo_2fa.LimiteEnvio as exc:
            bitacora.info("2fa envio usuario=%s resultado=%s", quien[0], exc.motivo)
            self._enviar(429, _html_login("Espera antes de pedir otro código."), "text/html; charset=utf-8")
            return
        except (correo_2fa.EnvioError, RuntimeError) as exc:
            tipo = getattr(exc, "tipo", exc.__class__.__name__)
            bitacora.error("2fa envio usuario=%s resultado=error tipo=%s", quien[0], tipo)
            self._enviar(502, _html_login("No se pudo enviar el código."), "text/html; charset=utf-8")
            return
        bitacora.info("2fa envio usuario=%s resultado=enviado", quien[0])
        cuerpo = _html_codigo().encode()
        self.send_response(200)
        self.send_header("Set-Cookie", f"ime_ops_2fa={reto}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600")
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _confirmar_codigo(self) -> None:
        try:
            campos = self._campos()
        except (AccionError, json.JSONDecodeError):
            self._enviar(400, _html_codigo("Código inválido."), "text/html; charset=utf-8")
            return
        reto = ""
        for parte in (self.headers.get("Cookie") or "").split(";"):
            parte = parte.strip()
            if parte.startswith("ime_ops_2fa="):
                reto = parte.split("=", 1)[1]
        usuario, rol, motivo = gestor_2fa().verificar(reto, campos.get("codigo", ""))
        bitacora.info("2fa verificar usuario=%s resultado=%s", usuario or "-", motivo)
        if motivo != "ok":
            self._enviar(401, _html_codigo("Código incorrecto, caducado o ya usado."), "text/html; charset=utf-8")
            return
        try:
            cookie = secretos.firmar_sesion(usuario, rol)
        except RuntimeError as exc:
            log(str(exc), "ERROR")
            self._enviar(500, {"ok": False, "error": "falta el secreto de sesion"})
            return
        cuerpo = _html_login("Sesión abierta.").encode()
        self.send_response(303)
        self.send_header("Set-Cookie", f"ime_ops_session={cookie}; HttpOnly; SameSite=Strict; Path=/")
        self.send_header("Set-Cookie", "ime_ops_2fa=deleted; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
        self.send_header("Location", "/")
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)


def _html_login(mensaje: str = "") -> str:
    aviso = f"<p role='alert'>{_e(mensaje)}</p>" if mensaje else ""
    return (
        "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        "<title>Ops IME</title></head><body>"
        "<h1>Ops</h1>"
        "<p>La contraseña no se muestra en esta página. Está solo en el entorno del servidor.</p>"
        f"{aviso}"
        "<form method='post' action='/login'>"
        "<label>Usuario <input name='username' autocomplete='username' required></label>"
        "<label>Contraseña <input type='password' name='password' autocomplete='current-password' required></label>"
        "<button type='submit'>Entrar</button>"
        "</form></body></html>"
    )


def _html_codigo(mensaje: str = "") -> str:
    aviso = f"<p role='alert'>{_e(mensaje)}</p>" if mensaje else ""
    return (
        "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        "<title>Ops IME</title></head><body>"
        "<h1>Código por correo</h1>"
        "<p>Enviamos un código de 6 dígitos al correo configurado en el servidor. "
        "Caduca en 10 minutos y solo sirve una vez. El destinatario no se edita aquí.</p>"
        f"{aviso}"
        "<form method='post' action='/login/codigo'>"
        "<label>Código <input name='codigo' inputmode='numeric' maxlength='6' autocomplete='one-time-code' required></label>"
        "<button type='submit'>Confirmar</button>"
        "</form></body></html>"
    )


def _html(tablero) -> str:
    columnas = []
    for carril in tablero.carriles:
        tarjetas = [tarjeta for tarjeta in tablero.tarjetas if tarjeta.carril == carril]
        fichas = []
        for tarjeta in tarjetas:
            fichas.append(
                "<article>"
                f"<h3>{_e(tarjeta.titulo)}</h3>"
                f"<p>{_e(tarjeta.usuario or 'PENDIENTE')} {_e(tarjeta.decidido_at)}</p>"
                "<form method='post' action='/post/approve'>"
                f"<input type='hidden' name='id' value='{_e(tarjeta.id)}'>"
                "<label>Usuario <input name='usuario' required autocomplete='username'></label>"
                "<button type='submit'>Aprobar</button></form>"
                "<form method='post' action='/post/reject'>"
                f"<input type='hidden' name='id' value='{_e(tarjeta.id)}'>"
                "<label>Usuario <input name='usuario' required autocomplete='username'></label>"
                "<button type='submit'>Rechazar</button></form>"
                "</article>"
            )
        columnas.append(f"<section><h2>{_e(carril)}</h2>{''.join(fichas) or '<p>Sin tarjetas</p>'}</section>")
    return (
        "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        "<title>Ops IME</title><style>"
        "body{font-family:system-ui,sans-serif;margin:1rem;background:#f5f1e8;color:#171a1c}"
        "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:.75rem}"
        "section,article{background:#fffdf8;border:1px solid #d7d0c2;border-radius:8px;padding:.75rem}"
        "button{min-height:2.4rem}button:focus-visible,a:focus-visible{outline:3px solid #005e60;outline-offset:2px}"
        "@media (prefers-reduced-motion: reduce){*{transition:none;animation:none}}"
        "</style></head><body><h1>Ops</h1>"
        "<p>Aprobar marca o encola. No envía correo ni WhatsApp.</p>"
        f"<main>{''.join(columnas)}</main></body></html>"
    )


def _e(valor: str) -> str:
    return (
        str(valor)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def servir(bind: str, puerto: int) -> None:
    servidor = ThreadingHTTPServer((bind, puerto), Hub)
    log(f"ime-ops-hub en http://{bind}:{puerto}")
    servidor.serve_forever()


def main() -> None:
    bind = os.environ.get("IME_OPS_BIND", "127.0.0.1").strip() or "127.0.0.1"
    if bind not in {"127.0.0.1", "localhost", "::1"}:
        log("IME_OPS_BIND solo puede ser loopback", "ERROR")
        sys.exit(1)
    if correo_2fa.interruptor(os.environ) == "invalido":
        log("arranque abortado: IME_OPS_2FA debe ser off u on", "ERROR")
        sys.exit(1)
    faltan = [nombre for nombre in ("IME_OPS_TOKEN", "IME_OPS_SECRET") if not os.environ.get(nombre, "").strip()]
    faltan.extend(correo_2fa.variables_faltantes(os.environ))
    if faltan:
        log("arranque abortado: faltan " + ", ".join(faltan), "ERROR")
        sys.exit(1)
    if not correo_2fa.activo():
        log("2fa correo apagado (IME_OPS_2FA=off); no se exige código ni SMTP")
    puerto = int(os.environ.get("IME_OPS_PORT", "18880"))
    try:
        directorio_kanban()
    except RuntimeError as exc:
        log(str(exc), "ERROR")
        sys.exit(1)
    servir(bind, puerto)


if __name__ == "__main__":
    main()
