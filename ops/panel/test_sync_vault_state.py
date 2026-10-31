"""Criterios de aceptación del sincronizador. No llama a producción."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import unittest
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))
import sync_vault_state as sync  # noqa: E402

ZONA = ZoneInfo("America/Bogota")
AHORA = datetime(2026, 10, 31, 16, 0, tzinfo=ZONA)


def fila(**extra):
    base = {
        "id": "11111111-1111-1111-1111-111111111111",
        "numero": "REF-A",
        "estado": "en_revision",
        "notas_internas": "",
        "send_error": None,
        "validez_hasta": "2026-12-01",
        "precio_total_ofertado": 10,
        "moneda": "COP",
        "aprobado_por": None,
        "aprobado_at": None,
        "aprobacion_tipo": None,
        "empresa": "Clinica A",
        "nombre": "Ana",
        "archived_at": None,
    }
    base.update(extra)
    return base


FILAS = [
    fila(numero="REF-BAJA", precio_total_ofertado=10, empresa="Clinica A"),
    fila(
        id="22222222-2222-2222-2222-222222222222",
        numero="REF-ALTA",
        precio_total_ofertado=500,
        empresa="Clinica B",
        notas_internas="NO ENVIAR duplicado",
        send_error="smtp",
        validez_hasta="2026-11-02",
    ),
    fila(
        id="33333333-3333-3333-3333-333333333333",
        numero="REF-CERRADA",
        estado="enviada",
        precio_total_ofertado=9999,
    ),
    fila(
        id="44444444-4444-4444-4444-444444444444",
        numero="REF-ARCHIVO",
        precio_total_ofertado=8000,
        archived_at="2026-10-01T00:00:00+00:00",
    ),
    fila(
        id="55555555-5555-5555-5555-555555555555",
        numero="REF-MEDIA",
        estado="respondida",
        precio_total_ofertado=100,
        aprobado_por="shoky",
        aprobado_at="2026-10-30T12:00:00+00:00",
        aprobacion_tipo="ok_shoky",
    ),
    fila(
        id="66666666-6666-6666-6666-666666666666",
        numero="REF-PERDIDA",
        estado="perdida",
        precio_total_ofertado=50,
    ),
]


class SeccionAbiertas(unittest.TestCase):
    def test_solo_abiertas_orden_total_pendiente_y_alertas(self):
        abiertas = sync.cotizaciones_abiertas(FILAS)
        self.assertEqual([f["numero"] for f in abiertas], ["REF-ALTA", "REF-MEDIA", "REF-BAJA"])
        principal = sync.render_principal(FILAS, AHORA, [])
        abstract = sync.render_abstract(FILAS, AHORA)
        overview = sync.render_overview(FILAS, AHORA)
        for texto in (principal, abstract, overview):
            self.assertIn("source: supabase_management_api", texto)
            self.assertIn("updated: 2026-10-31T16:00:00-05:00", texto)
            self.assertNotIn("REF-CERRADA", texto)
            self.assertNotIn("REF-ARCHIVO", texto)
            self.assertNotIn("REF-PERDIDA", texto)
        self.assertLess(principal.index("REF-ALTA"), principal.index("REF-MEDIA"))
        self.assertLess(principal.index("REF-MEDIA"), principal.index("REF-BAJA"))
        self.assertIn("PENDIENTE", principal)
        self.assertIn("NO ENVIAR", principal)
        self.assertIn("send_error", principal)
        self.assertIn("ok_shoky", principal)
        self.assertIn("Pendientes de aprobacion: 2", abstract)
        self.assertIn("Con alerta: 1", abstract)
        self.assertIn("Abiertas: 3", abstract)

    def test_fuente_sin_columna_equivocada_ni_except_pass(self):
        texto = (RAIZ / "sync_vault_state.py").read_text(encoding="utf-8")
        self.assertNotIn("cod" + "igo", texto.lower())
        self.assertIsNone(re.search(r"except[^:\n]*:\s*pass", texto))
        self.assertIn("numero", sync.CONSULTA_ABIERTAS)
        self.assertIn("archived_at is null", sync.CONSULTA_ABIERTAS)
        self.assertNotIn("precio_costo", sync.CONSULTA_ABIERTAS)


class Handler(BaseHTTPRequestHandler):
    estado_http = 401
    cuerpo = b'{"message":"Unauthorized"}'

    def do_POST(self):  # noqa: N802
        self.send_response(self.estado_http)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(self.cuerpo)

    def log_message(self, fmt, *args):
        return


def servir(estado_http: int, cuerpo: bytes):
    Handler.estado_http = estado_http
    Handler.cuerpo = cuerpo
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    hilo = threading.Thread(target=server.serve_forever, daemon=True)
    hilo.start()
    return server


def ejecutar(env: dict) -> subprocess.CompletedProcess[str]:
    limpio = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "LANG": "C.UTF-8",
        "PYTHONUNBUFFERED": "1",
    }
    limpio.update(env)
    return subprocess.run(
        [sys.executable, str(RAIZ / "sync_vault_state.py")],
        env=limpio,
        capture_output=True,
        text=True,
        check=False,
    )


class Cli(unittest.TestCase):
    def test_token_invalido_no_pisa_el_panel(self):
        server = servir(401, b'{"message":"Unauthorized"}')
        try:
            import tempfile

            with tempfile.TemporaryDirectory() as tmp:
                raiz = Path(tmp)
                previo = raiz / sync.NOMBRE_PANEL
                previo.write_text("PREVIO\n", encoding="utf-8")
                antes = previo.read_bytes()
                proc = ejecutar(
                    {
                        "IME_VAULT": str(raiz),
                        "IME_SUPABASE_MGMT_URL": f"http://127.0.0.1:{server.server_port}/query",
                        "SUPABASE_ACCESS_TOKEN": "token-invalido",
                    }
                )
                self.assertNotEqual(proc.returncode, 0)
                self.assertIn("HTTP 401", proc.stderr)
                self.assertIn("no se sobrescribe", proc.stderr)
                self.assertEqual(previo.read_bytes(), antes)
                self.assertFalse((raiz / "Estado-Vivo-CMS-y-RFQs.abstract.md").exists())
        finally:
            server.shutdown()
            server.server_close()

    def test_replica_fallida_sale_3_tras_escribir(self):
        cuerpo = json.dumps([]).encode()
        server = servir(200, cuerpo)
        try:
            import tempfile

            with tempfile.TemporaryDirectory() as tmp:
                raiz = Path(tmp)
                bloqueo = raiz / "no-es-directorio"
                bloqueo.write_text("x", encoding="utf-8")
                proc = ejecutar(
                    {
                        "IME_VAULT": str(raiz / "vault"),
                        "IME_SUPABASE_MGMT_URL": f"http://127.0.0.1:{server.server_port}/query",
                        "SUPABASE_ACCESS_TOKEN": "token-de-prueba",
                        "IME_HERMES_PROFILES": str(bloqueo / "perfil"),
                    }
                )
                self.assertEqual(proc.returncode, 3)
                panel = (raiz / "vault" / sync.NOMBRE_PANEL).read_text(encoding="utf-8")
                self.assertIn("source: supabase_management_api", panel)
                self.assertIn("updated:", panel)
        finally:
            server.shutdown()
            server.server_close()


class Hermes(unittest.TestCase):
    def test_copia_sin_rsync(self):
        import tempfile

        script = RAIZ / "hermes-perfiles-aplicar.sh"
        texto = script.read_text(encoding="utf-8")
        self.assertNotIn("cod" + "igo", texto.lower())
        self.assertIn("IME_INSTALL_RSYNC", texto)
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            origen = raiz / "Estado-Vivo-CMS-y-RFQs.md"
            origen.write_text("panel\n", encoding="utf-8")
            destino = raiz / "perfil"
            proc = subprocess.run(
                ["bash", str(script), str(origen), str(destino)],
                check=False,
                capture_output=True,
                text=True,
                env={
                    "PATH": "/usr/bin:/bin",
                    "HOME": os.environ.get("HOME", ""),
                    "IME_INSTALL_RSYNC": "",
                },
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual((destino / origen.name).read_text(encoding="utf-8"), "panel\n")
            self.assertNotIn("rsync", proc.stderr)


if __name__ == "__main__":
    unittest.main()
