"""Salud del panel: fuentes vivas, main no bloquea, /healthz no miente."""

from __future__ import annotations

import json
import os
import sys
import threading
import unittest
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import panel_salud


class SaludPanel(unittest.TestCase):
    def test_main_caido_no_tumba_el_cluster_de_srv(self):
        servicios = [
            {"name": "srv1715444 (.8)", "up": True},
            {"name": "OpenViking Local (:1935)", "up": True},
            {"name": "FastEmbed Local (:1936)", "up": True},
            {"name": "n8n Orquestador (:5678)", "up": True},
            {"name": "i-me.com.co (HTTPS)", "up": True},
            {"name": "main Windows (.80:445/:22)", "up": False},
            {"name": "main-wsl GPU (.81:8080 Qwen3)", "up": False},
            {"name": "main-wsl OmniRoute (.81:20128)", "up": False},
            {"name": "main-wsl OpenViking (.81:1933)", "up": False},
            {"name": "noa Backups (.10:445)", "up": False},
        ]
        resumen = panel_salud.resumen_servicios(servicios)
        self.assertEqual(resumen["estado"], "ok")
        self.assertEqual(resumen["up"], 5)
        self.assertEqual(resumen["total"], 5)
        self.assertEqual(resumen["remoto"]["up"], 0)
        self.assertEqual(resumen["remoto"]["total"], 5)
        self.assertFalse(resumen["depende_de_main"])

    def test_srv_caido_si_marca_roto(self):
        resumen = panel_salud.resumen_servicios(
            [{"name": "n8n Orquestador (:5678)", "up": False}, {"name": "main Windows (.80)", "up": True}]
        )
        self.assertEqual(resumen["estado"], "roto")
        self.assertEqual(resumen["remoto"]["up"], 1)

    def test_sin_sonda_no_finge_cien_por_ciento(self):
        resumen = panel_salud.resumen_servicios([])
        self.assertEqual(resumen["estado"], "sin_dato")
        self.assertEqual(resumen["health_pct"], 0.0)
        valor, pie = panel_salud.texto_cluster(resumen)
        self.assertEqual(valor, "sin dato")
        self.assertIn("srv1715444", pie)

    def test_tokens_sin_fichero_no_inventan_ahorro(self):
        estado = panel_salud.estado_tokens(False, 0)
        self.assertEqual(estado["estado"], "sin_dato")
        self.assertEqual(panel_salud.texto_ahorro(None), "sin dato")
        self.assertNotIn("82", panel_salud.texto_ahorro(None))

    def test_documenso_sin_sonda_no_dice_version_ni_up(self):
        self.assertEqual(panel_salud.texto_version_documenso(None, None), "sin dato")
        self.assertEqual(panel_salud.texto_version_documenso({}, None), "sin dato")
        self.assertNotIn("v2.18.0", panel_salud.texto_version_documenso({}, None))
        self.assertEqual(panel_salud.texto_webhook({}), "sin dato")
        self.assertEqual(panel_salud.texto_webhook({"id": "wh_1"}), "sin dato")
        self.assertEqual(panel_salud.texto_cert({}), "certificado sin dato")
        self.assertEqual(panel_salud.texto_equipo({}), "equipo sin dato")
        self.assertEqual(
            panel_salud.texto_api({"api_key_configured_in_env": True}),
            "clave presente en srv, sin sonda HTTP",
        )

    def test_documenso_muestra_la_version_que_trae_la_sonda(self):
        svc = {"version": "v9.1.0", "http_status": 200, "team": "ime", "cert_p12": True}
        self.assertEqual(panel_salud.texto_version_documenso(svc, None), "v9.1.0 · vivo")
        self.assertEqual(panel_salud.texto_equipo(svc), "equipo ime")
        self.assertEqual(panel_salud.texto_cert(svc), "certificado P12 activo")
        self.assertEqual(panel_salud.estado_documenso(svc, None)["estado"], "ok")
        self.assertEqual(panel_salud.estado_documenso({"http_status": 503}, None)["estado"], "roto")

    def test_listado_de_sobres_vale_como_fuente_viva(self):
        estado = panel_salud.estado_documenso_desde_state(
            {"counts": {"COMPLETED": 2, "PENDING": 1}, "envelopes": [], "service": {}},
            None,
        )
        self.assertEqual(estado["estado"], "ok")
        self.assertIn("vivo", estado["motivo"])

    def test_boveda_vacia_o_ausente_no_dice_sincronizada(self):
        ausente = panel_salud.estado_boveda(panel_salud.sonda_boveda("/ruta/que/no/existe-ime-vault"))
        self.assertEqual(ausente["estado"], "roto")
        self.assertNotIn("main", ausente["motivo"])
        vacia = panel_salud.estado_boveda({"existe": True, "legible": True, "notas": 0})
        self.assertEqual(vacia["estado"], "degradado")

    def test_healthz_ok_solo_si_cada_tarjeta_esta_ok(self):
        buenas = {
            nombre: {"estado": "ok", "motivo": "sonda"}
            for nombre in panel_salud.TARJETAS
        }
        cuerpo = panel_salud.ensamblar(buenas)
        cuerpo["service"] = "ime-ops-hub"
        self.assertEqual(cuerpo["status"], "ok")
        self.assertEqual(panel_salud.evaluar_healthz(cuerpo), [])

        cuerpo["tarjetas"]["tokens"] = {"estado": "sin_dato", "motivo": "sin usage.jsonl"}
        cuerpo["status"] = "ok"
        problemas = panel_salud.evaluar_healthz(cuerpo)
        self.assertTrue(any("tokens" in p for p in problemas))

    def test_healthz_de_produccion_viejo_no_pasa_el_contrato(self):
        viejo = {
            "status": "ok",
            "service": "ime-ops-hub",
            "domain": "ops.i-me.com.co",
            "time_cot": "2026-10-31 17:21:23 COT (UTC-5)",
        }
        self.assertIn("sin tarjetas", panel_salud.evaluar_healthz(viejo))

    def test_sonda_lenta_no_se_apila(self):
        espera = threading.Event()
        sonda = panel_salud.SondaUnica()
        valor, error = sonda.lanzar(lambda: espera.wait(5), 0.05)
        self.assertIsNone(valor)
        self.assertEqual(error, "timeout")
        valor2, error2 = sonda.lanzar(lambda: espera.wait(5), 0.05)
        self.assertEqual(error2, "timeout")
        espera.set()

    def test_sonda_propaga_el_tipo_de_excepcion_sin_el_mensaje(self):
        def falla() -> None:
            raise RuntimeError("detalle interno")

        valor, error = panel_salud.con_limite(falla, 1)
        self.assertIsNone(valor)
        self.assertEqual(error, "RuntimeError")


class HumoRemoto(unittest.TestCase):
    def test_healthz_publicado_cumple_el_contrato(self):
        url = os.environ.get("OPS_HEALTH_URL", "").strip()
        if not url:
            self.skipTest("OPS_HEALTH_URL vacío: no se llama a producción")
        with urllib.request.urlopen(url, timeout=8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        problemas = panel_salud.evaluar_healthz(payload)
        self.assertEqual(problemas, [], problemas)


if __name__ == "__main__":
    unittest.main()
