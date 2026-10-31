"""Criterios del encargo de logs. No toca el servidor."""

from __future__ import annotations

import os
import re
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))

import enviar_cola  # noqa: E402
import hostinger_direct  # noqa: E402
import ime_log  # noqa: E402


class Logs(unittest.TestCase):
    def test_no_guarda_secretos_y_un_fallo_queda_en_el_log(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            os.environ["IME_LOG_DIR"] = tmp
            os.environ["OPS_ADMIN_PASSWORD"] = "clave-ficticia-xyz"
            try:
                logger = ime_log.get_logger("prueba-secretos")
                logger.info("password=%s", os.environ["OPS_ADMIN_PASSWORD"])
                try:
                    Path("/ruta/que/no/existe-ime-log").read_text()
                except Exception:
                    logger.exception("accion=leer resultado=error")
                    codigo = 1
                else:
                    codigo = 0
                texto = (Path(tmp) / "prueba-secretos.log").read_text(encoding="utf-8")
            finally:
                os.environ.pop("IME_LOG_DIR", None)
                os.environ.pop("OPS_ADMIN_PASSWORD", None)
        self.assertEqual(codigo, 1)
        self.assertNotIn("clave-ficticia-xyz", texto)
        self.assertIn("<redacted>", texto)
        self.assertIn("ERROR", texto)
        self.assertIn("Traceback", texto)

    def test_cola_ausente_sale_distinto_de_cero(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            os.environ["IME_LOG_DIR"] = tmp
            try:
                codigo = enviar_cola.procesar(Path(tmp) / "no-esta.jsonl")
                texto = (Path(tmp) / "enviar-cola.log").read_text(encoding="utf-8")
            finally:
                os.environ.pop("IME_LOG_DIR", None)
        self.assertEqual(codigo, 1)
        self.assertIn("ERROR", texto)

    def test_notify_no_usa_smtp(self):
        self.assertFalse(hasattr(hostinger_direct, "SMTP"))
        texto = Path(hostinger_direct.__file__).read_text(encoding="utf-8")
        self.assertNotIn("smtp" + "lib", texto)
        aviso = (RAIZ / "imeia" / "plugins" / "bot-forge" / "notify.py").read_text(encoding="utf-8")
        self.assertNotIn("smtp" + "lib", aviso)
        self.assertNotIn("send_message", aviso)

    def test_sin_except_pass_ni_smtp_en_srv(self):
        for path in RAIZ.rglob("*.py"):
            if path.name.startswith("test_"):
                continue
            texto = path.read_text(encoding="utf-8")
            self.assertIsNone(re.search(r"except[^:\n]*:\s*\n\s*pass\b", texto), path.name)
            self.assertNotIn("smtp" + "lib", texto, path.name)
            self.assertNotIn("SMTP_SSL", texto, path.name)
            self.assertNotIn("send_message", texto, path.name)
