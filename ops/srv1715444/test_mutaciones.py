"""Un GET no borra. El borrado exige POST, CSRF y la palabra BORRAR, y queda en el log."""

from __future__ import annotations

import importlib.util
import os
import sys
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

os.environ.setdefault("IME_OPS_TOKEN", "token-prueba-panel-ops-32chars")
os.environ.setdefault("IME_OPS_SECRET", "secreto-prueba-panel-ops")
os.environ.setdefault("IME_OPS_2FA", "off")
os.environ.setdefault("IME_LOG_DIR", "/tmp/ime-ops-mutaciones-log")

import mutaciones


class _SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)

_RAIZ = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("ime_ops_hub_srv", _RAIZ / "ime-ops-hub.py")
hub = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(hub)


class StubDocumenso:
    def __init__(self) -> None:
        self.borrados: list[str] = []
        self.guardados: list[str] = []

    def delete_envelope(self, env_id: str) -> dict:
        self.borrados.append(env_id)
        return {"ok": True}

    def download_signed_pdfs(self, env_id: str, client_code: str = "") -> dict:
        self.guardados.append(env_id)
        return {"ok": True, "saved_files": [{"path": "/tmp/firmado.pdf"}]}

    def get_full_status(self) -> dict:
        return {"counts": {}, "envelopes": [], "quote_flows": [], "service": {}}


class Reglas(unittest.TestCase):
    def test_confirmacion_y_csrf(self):
        secreto = b"semilla"
        token = mutaciones.token_csrf(secreto, "shoky")
        self.assertTrue(mutaciones.csrf_valido(secreto, "shoky", token))
        self.assertFalse(mutaciones.csrf_valido(secreto, "shoky", "otro"))
        self.assertFalse(mutaciones.csrf_valido(secreto, "otro", token))
        self.assertTrue(mutaciones.confirmacion_valida("/api/documenso/delete", "BORRAR"))
        self.assertFalse(mutaciones.confirmacion_valida("/api/documenso/delete", "borrar"))
        self.assertFalse(mutaciones.confirmacion_valida("/api/documenso/delete", ""))
        self.assertIn("/api/documenso/delete", mutaciones.RUTAS_SOLO_POST)
        self.assertIn("/api/documenso/download", mutaciones.RUTAS_SOLO_POST)
        self.assertIn("/logout", mutaciones.RUTAS_SOLO_POST)


class Http(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stub = StubDocumenso()
        hub.ime_documenso = cls.stub
        cls.httpd = hub.ThreadingHTTPServer(("127.0.0.1", 0), hub.OpsHubHandler)
        cls.hilo = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.hilo.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        cls.csrf = mutaciones.token_csrf(hub.SESSION_SECRET, "root@i-me.com.co")

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        self.stub.borrados.clear()
        self.stub.guardados.clear()

    def _login(self) -> str:
        datos = urllib.parse.urlencode(
            {"username": "root@i-me.com.co", "password": os.environ["IME_OPS_TOKEN"]}
        ).encode()
        req = urllib.request.Request(self.base + "/login", data=datos, method="POST")
        abridor = urllib.request.build_opener(_SinRedireccion())
        try:
            abridor.open(req)
        except urllib.error.HTTPError as exc:
            if exc.code not in (302, 303):
                raise
            cookie = exc.headers.get("Set-Cookie", "")
        else:
            raise AssertionError("el login debía redirigir")
        self.assertIn("ime_ops_session=", cookie)
        return cookie.split(";", 1)[0]

    def _abrir(self, ruta: str, datos: dict | None = None, cookie: str = ""):
        cuerpo = urllib.parse.urlencode(datos).encode() if datos is not None else None
        req = urllib.request.Request(self.base + ruta, data=cuerpo, method="POST" if datos is not None else "GET")
        if cookie:
            req.add_header("Cookie", cookie)
        abridor = urllib.request.build_opener(_SinRedireccion())
        try:
            respuesta = abridor.open(req)
            return respuesta.status, respuesta.read(), dict(respuesta.headers)
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read(), dict(exc.headers)

    def test_get_no_borra_y_post_sin_confirmacion_tampoco(self):
        cookie = self._login()
        codigo, _, cabeceras = self._abrir("/api/documenso/delete?envelope_id=sobre-1", cookie=cookie)
        self.assertEqual(codigo, 405)
        self.assertIn("POST", cabeceras.get("Allow", ""))
        self.assertEqual(self.stub.borrados, [])

        codigo, _, _ = self._abrir(
            "/api/documenso/delete",
            {"csrf": self.csrf, "envelope_id": "sobre-1", "confirmar": "no"},
            cookie,
        )
        self.assertEqual(codigo, 400)
        self.assertEqual(self.stub.borrados, [])

        codigo, _, _ = self._abrir(
            "/api/documenso/delete",
            {"csrf": "falso", "envelope_id": "sobre-1", "confirmar": "BORRAR"},
            cookie,
        )
        self.assertEqual(codigo, 403)
        self.assertEqual(self.stub.borrados, [])

    def test_post_confirmado_borra_y_queda_en_el_log(self):
        cookie = self._login()
        codigo, _, _ = self._abrir(
            "/api/documenso/delete",
            {"csrf": self.csrf, "envelope_id": "sobre-real", "confirmar": "BORRAR"},
            cookie,
        )
        self.assertIn(codigo, (302, 303))
        self.assertEqual(self.stub.borrados, ["sobre-real"])
        texto = Path(os.environ["IME_LOG_DIR"], "ime-ops-hub.log").read_text(encoding="utf-8")
        self.assertIn("documenso borrar", texto)
        self.assertIn("sobre-real", texto)
        self.assertIn("resultado=ok", texto)

    def test_get_guardar_logout_y_token_no_tienen_efecto(self):
        cookie = self._login()
        codigo, _, _ = self._abrir("/api/documenso/download?envelope_id=sobre-2", cookie=cookie)
        self.assertEqual(codigo, 405)
        self.assertEqual(self.stub.guardados, [])
        codigo, _, _ = self._abrir("/logout", cookie=cookie)
        self.assertEqual(codigo, 405)
        codigo, cuerpo, cabeceras = self._abrir("/?token=" + os.environ["IME_OPS_TOKEN"])
        self.assertEqual(codigo, 405)
        self.assertNotIn("ime_ops_session=", cabeceras.get("Set-Cookie", ""))
        self.assertNotIn(os.environ["IME_OPS_TOKEN"], cuerpo.decode("utf-8", "replace"))


if __name__ == "__main__":
    unittest.main()
