"""El hub no arranca con valores de reserva y no los escribe en el log."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
HUB = RAIZ / "ops" / "srv1715444" / "ime-ops-hub.py"
ORIGINAL = RAIZ / "ops" / "hub" / "original" / "ime-ops-hub.py"
SERVICIO = RAIZ / "ops" / "hub" / "systemd" / "ime-ops-hub.service"
DESPLIEGUE = RAIZ / "ops" / "hub" / "DESPLIEGUE.md"
IME_LOG = RAIZ / "ops" / "srv1715444" / "ime_log.py"
NOMBRES = ("IME_OPS_TOKEN", "IME_OPS_SECRET")
SMTP = (
    "IME_OPS_2FA_EMAIL",
    "IME_OPS_SMTP_HOST",
    "IME_OPS_SMTP_PORT",
    "IME_OPS_SMTP_USER",
    "IME_OPS_SMTP_PASS",
    "IME_OPS_SMTP_FROM",
)
RESERVA = re.compile(r'os\.environ\.get\("IME_OPS_(?:TOKEN|SECRET|TOTP_SECRET)",\s*"[^"]+"\)')


class Arranque(unittest.TestCase):
    def test_el_codigo_no_trae_valores_de_reserva(self):
        for path in (HUB, ORIGINAL):
            texto = path.read_text(encoding="utf-8")
            self.assertIsNone(RESERVA.search(texto), path.name)
            self.assertIn("exigir_secretos_arranque", texto)
            for nombre in NOMBRES:
                self.assertNotIn(f"<REDACTED:{nombre}>", texto)

    def test_sin_variables_sale_y_el_log_solo_dice_el_nombre(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            for nombre in (*NOMBRES, *SMTP, "IME_OPS_2FA"):
                env.pop(nombre, None)
            env["IME_LOG_DIR"] = tmp
            proc = subprocess.run(
                [sys.executable, str(HUB)],
                cwd=str(HUB.parent),
                env=env,
                capture_output=True,
                text=True,
                timeout=20,
            )
            self.assertEqual(proc.returncode, 1)
            logs = list(Path(tmp).glob("*.log"))
            self.assertTrue(logs, "no hubo log")
            salida = proc.stderr + proc.stdout + logs[0].read_text(encoding="utf-8")
            self.assertIn("arranque abortado", salida)
            for nombre in NOMBRES:
                self.assertIn(nombre, salida)
            for nombre in SMTP:
                self.assertNotIn(nombre, salida)
            self.assertNotIn("<REDACTED:", salida)
            self.assertIn("chmod 600", salida)
            self.assertIn("ime-ops-hub.service", salida)
            self.assertNotIn("IME_OPS_TOTP_SECRET", salida)

    def test_con_2fa_on_exige_smtp_y_apagado_no(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            for nombre in (*NOMBRES, *SMTP, "IME_OPS_2FA"):
                env.pop(nombre, None)
            env["IME_OPS_2FA"] = "on"
            env["IME_LOG_DIR"] = tmp
            proc = subprocess.run(
                [sys.executable, str(HUB)],
                cwd=str(HUB.parent),
                env=env,
                capture_output=True,
                text=True,
                timeout=20,
            )
            self.assertEqual(proc.returncode, 1)
            logs = list(Path(tmp).glob("*.log"))
            salida = proc.stderr + proc.stdout + (logs[0].read_text(encoding="utf-8") if logs else "")
            for nombre in (*NOMBRES, *SMTP):
                self.assertIn(nombre, salida)
            self.assertNotIn("apagado", salida)

        with tempfile.TemporaryDirectory() as tmp:
            env = os.environ.copy()
            for nombre in (*SMTP, "IME_OPS_2FA", "IME_OPS_TOTP_SECRET"):
                env.pop(nombre, None)
            env["IME_OPS_2FA"] = "off"
            env["IME_OPS_TOKEN"] = "token-de-prueba"
            env["IME_OPS_SECRET"] = "secreto-de-prueba"
            env["IME_LOG_DIR"] = tmp
            try:
                proc = subprocess.run(
                    [sys.executable, str(HUB)],
                    cwd=str(HUB.parent),
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                salida_proc = proc.stderr + proc.stdout
            except subprocess.TimeoutExpired as exc:
                def _txt(valor):
                    if valor is None:
                        return ""
                    if isinstance(valor, bytes):
                        return valor.decode("utf-8", "replace")
                    return valor
                salida_proc = _txt(exc.stderr) + _txt(exc.stdout)
            logs = list(Path(tmp).glob("*.log"))
            salida = salida_proc + (logs[0].read_text(encoding="utf-8") if logs else "")
            self.assertIn("2fa correo apagado", salida)
            self.assertNotIn("arranque abortado", salida)
            self.assertNotIn("IME_OPS_SMTP_HOST", salida)
            self.assertNotIn("token-de-prueba", salida)
            self.assertNotIn("secreto-de-prueba", salida)

    def test_el_servicio_exige_el_env_y_el_despliegue_copia_ime_log(self):
        self.assertTrue(IME_LOG.is_file())
        unidad = SERVICIO.read_text(encoding="utf-8")
        self.assertIn("EnvironmentFile=%h/.config/ime-ops-hub.env", unidad)
        self.assertNotIn("EnvironmentFile=-", unidad)
        self.assertIn("600", unidad)
        texto = DESPLIEGUE.read_text(encoding="utf-8")
        self.assertIn("ops/srv1715444/ime_log.py", texto)
        self.assertIn("chmod 600", texto)
        self.assertIn("openssl rand -hex 32", texto)


if __name__ == "__main__":
    unittest.main()
