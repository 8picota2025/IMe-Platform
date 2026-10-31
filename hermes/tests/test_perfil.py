"""Criterios de aceptación del perfil integrador en sombra."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unittest
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from zoneinfo import ZoneInfo

from soporte import PERFIL_REPO, contexto, huella, mundo, orden

from lib.avisos import aviso_interno
from lib.bitacora import configurar
from lib.comparador import comparar
from lib.ensayo import preparar_env, suscribir
from lib.jobs import cargar_jobs
from lib.modo import modo_efectivo
from lib.orden import procesar_orden, rutina_vigilancia
from lib.rollback import rollback
from lib.vigilancia import informe
from lib.webhook import mismo_id

COT = ZoneInfo("America/Bogota")
PATRON_CANALES = re.compile(r"smtplib|SMTP_SSL|send_message|whatsapp|sendMessage")
PATRON_EXCEPT = re.compile(r"except\s*(Exception|\w+(\s*,\s*\w+)*)?\s*:\s*\n?\s*pass\b")


class Sombra(unittest.TestCase):
    def setUp(self) -> None:
        self.env = patch.dict(os.environ, {"INTEGRADOR_MODO": "sombra"})
        self.env.start()
        self.tmp = TemporaryDirectory()
        self.datos = mundo(Path(self.tmp.name))
        self.ctx = contexto(self.datos)

    def tearDown(self) -> None:
        self.env.stop()
        self.tmp.cleanup()

    def test_orden_de_prueba_registra_una_linea_sin_efectos(self) -> None:
        sensibles = [
            self.datos["tmp"] / "crontab.txt",
            self.datos["tmp"] / "supabase.sql",
            self.datos["tmp"] / "n8n.json",
            self.datos["tmp"] / "profiles" / "enlace" / "SOUL.md",
            self.datos["tmp"] / "webhook-id.txt",
            self.datos["tablon"] / "despertador.sh",
        ]
        antes = {path: huella(path) for path in sensibles}
        resultado = procesar_orden(self.ctx, orden())
        self.assertEqual(resultado, "registrada")
        lineas = (self.datos["logs"] / "decisiones.jsonl").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(lineas), 1)
        registro = json.loads(lineas[0])
        self.assertEqual(registro["orden"], "ORDEN-PRUEBA-1")
        self.assertEqual(registro["fuente"], "grok")
        self.assertEqual(registro["modo"], "sombra")
        self.assertIn("-05:00", registro["ts"])
        self.assertTrue(registro["accion"])
        self.assertTrue(registro["resultado_esperado"])
        for path, digest in antes.items():
            self.assertEqual(huella(path), digest, path.name)
        self.assertFalse((self.datos["tablon"] / "salida").exists())
        self.assertTrue((self.datos["tablon"] / "locks" / "tablon.lock").is_file())
        self.assertFalse((self.datos["tmp"] / "franja-que-no-existe").exists())

    def test_orden_ajena_no_registra(self) -> None:
        self.assertEqual(procesar_orden(self.ctx, orden(para="enlace", id="OTRA")), "ajena")
        self.assertFalse((self.datos["logs"] / "decisiones.jsonl").exists())

    def test_dos_despertares_una_ejecucion(self) -> None:
        entrada = self.datos["tmp"] / "orden.json"
        entrada.write_text(json.dumps(orden(id="ORDEN-LOCK")), encoding="utf-8")
        script = PERFIL_REPO / "scripts" / "despertar.py"
        cmd = [
            sys.executable,
            str(script),
            "--entrada",
            str(entrada),
            "--perfil",
            str(self.datos["perfil"]),
            "--logs",
            str(self.datos["logs"]),
            "--tablon",
            str(self.datos["tablon"]),
            "--modo-json",
            str(self.datos["modo"]),
            "--latido",
            str(self.datos["latido"]),
        ]
        entorno = os.environ.copy()
        entorno["INTEGRADOR_MODO"] = "sombra"
        procesos = [subprocess.Popen(cmd, env=entorno) for _ in range(2)]
        codigos = [proceso.wait(timeout=30) for proceso in procesos]
        self.assertEqual(codigos, [0, 0])
        lineas = (self.datos["logs"] / "decisiones.jsonl").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(lineas), 1)
        self.assertEqual(json.loads(lineas[0])["orden"], "ORDEN-LOCK")

    def test_sin_flag_no_hay_modo_activo(self) -> None:
        self.datos["modo"].write_text('{"modo": "respaldo"}\n', encoding="utf-8")
        self.datos["latido"].write_text('{"disponible": false}\n', encoding="utf-8")
        with patch.dict(os.environ, {"INTEGRADOR_MODO": "activo"}):
            self.assertEqual(modo_efectivo(self.ctx), "sombra")
            self.assertEqual(procesar_orden(self.ctx, orden(id="SIN-FLAG")), "registrada")
        registro = json.loads((self.datos["logs"] / "decisiones.jsonl").read_text(encoding="utf-8"))
        self.assertEqual(registro["modo"], "sombra")
        self.assertFalse((self.datos["tablon"] / "salida").exists())

    def test_grok_de_vuelta_retorna_a_sombra(self) -> None:
        (self.datos["perfil"] / "ACTIVO_AUTORIZADO").write_text("ok de ensayo\n", encoding="utf-8")
        self.datos["modo"].write_text('{"modo": "respaldo"}\n', encoding="utf-8")
        self.datos["latido"].write_text(
            '{"ultimo_ok": "2026-10-31T18:40:00-05:00", "fallos_seguidos": 0, "disponible": true}\n',
            encoding="utf-8",
        )
        ahora = datetime(2026, 10, 31, 18, 50, tzinfo=COT)
        with patch.dict(os.environ, {"INTEGRADOR_MODO": "activo"}):
            self.assertEqual(modo_efectivo(self.ctx, ahora), "sombra")

    def test_activo_solo_con_las_cuatro_condiciones_y_sin_emision(self) -> None:
        (self.datos["perfil"] / "ACTIVO_AUTORIZADO").write_text("ok de ensayo\n", encoding="utf-8")
        self.datos["modo"].write_text('{"modo": "respaldo"}\n', encoding="utf-8")
        self.datos["latido"].write_text('{"disponible": false, "fallos_seguidos": 2}\n', encoding="utf-8")
        antes = huella(self.datos["tmp"] / "crontab.txt")
        with patch.dict(os.environ, {"INTEGRADOR_MODO": "activo"}):
            self.assertEqual(modo_efectivo(self.ctx), "activo")
            self.assertEqual(procesar_orden(self.ctx, orden(id="ACTIVO-1")), "registrada")
            aviso = aviso_interno("novedad interna", "activo")
        self.assertFalse(aviso["enviado"])
        registro = json.loads((self.datos["logs"] / "decisiones.jsonl").read_text(encoding="utf-8"))
        self.assertEqual(registro["modo"], "activo")
        self.assertTrue((self.datos["tablon"] / "salida" / "ACTIVO-1.json").is_file())
        self.assertEqual(huella(self.datos["tmp"] / "crontab.txt"), antes)
        self.assertNotIn("ACTIVO_AUTORIZADO", os.listdir(PERFIL_REPO))


class SecretosYCanales(unittest.TestCase):
    def test_el_log_no_guarda_el_valor_ficticio(self) -> None:
        with TemporaryDirectory() as carpeta:
            datos = mundo(Path(carpeta))
            ctx = contexto(datos)
            ficticio = "ficticio-supabase-9f3a"
            with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": ficticio, "INTEGRADOR_MODO": "sombra"}):
                log = configurar(ctx)
                log.info("valor visto %s", ficticio)
                procesar_orden(ctx, orden(id="SEC-1", texto=f"lleva {ficticio}"))
            escrito = (datos["logs"] / "integrador.log").read_text(encoding="utf-8")
            decisiones = (datos["logs"] / "decisiones.jsonl").read_text(encoding="utf-8")
            self.assertNotIn(ficticio, escrito)
            self.assertNotIn(ficticio, decisiones)
            self.assertIn("[redactado]", escrito)

    def test_canales_solo_en_avisos(self) -> None:
        hits = []
        for path in PERFIL_REPO.rglob("*"):
            if not path.is_file() or path.suffix == ".pyc" or "__pycache__" in path.parts:
                continue
            if PATRON_CANALES.search(path.read_text(encoding="utf-8", errors="replace")):
                hits.append(path.relative_to(PERFIL_REPO).as_posix())
        self.assertEqual(hits, ["scripts/lib/avisos.py"])

    def test_no_hay_except_pass(self) -> None:
        for path in PERFIL_REPO.rglob("*.py"):
            self.assertIsNone(PATRON_EXCEPT.search(path.read_text(encoding="utf-8")), path.name)
            self.assertNotIn("subprocess", path.read_text(encoding="utf-8"))


class JobsYComparador(unittest.TestCase):
    def test_jobs(self) -> None:
        jobs = {str(job["id"]): job for job in cargar_jobs(PERFIL_REPO)}
        self.assertEqual(jobs["reenvio"]["modo"], "sombra")
        self.assertTrue(jobs["reenvio"]["enabled"])
        self.assertEqual(jobs["reenvio"]["schedule"]["expr"], "0 8 * * 1-6")
        self.assertEqual(jobs["tablon"]["modo"], "sombra")
        self.assertEqual(jobs["tablon"]["disparo"], "evento")
        self.assertTrue(jobs["tablon"]["enabled"])
        self.assertFalse(jobs["caducidades"]["enabled"])
        self.assertFalse(jobs["search-console"]["enabled"])
        self.assertTrue(jobs["reenvio"]["no_agent"])
        self.assertEqual(jobs["reenvio"]["deliver"], "local")

    def test_comparador_diario(self) -> None:
        with TemporaryDirectory() as carpeta:
            datos = mundo(Path(carpeta))
            ctx = contexto(datos)
            with patch.dict(os.environ, {"INTEGRADOR_MODO": "sombra"}):
                procesar_orden(ctx, orden(id="CMP-1", texto="mirar cola"))
            grok = datos["logs"] / "grok.jsonl"
            grok.write_text(
                json.dumps({"orden": "CMP-1", "accion": "reenvió la cola", "resultado": "hecho"}) + "\n",
                encoding="utf-8",
            )
            from dataclasses import replace

            ctx = replace(ctx, grok_log=grok)
            destino = comparar(ctx, datetime(2026, 10, 31, 21, 30, tzinfo=COT))
            texto = destino.read_text(encoding="utf-8")
            self.assertEqual(destino.name, "comparacion-20261031.md")
            self.assertIn("distinto", texto)
            self.assertIn("CMP-1", texto)

    def test_vigilancia_solo_lee(self) -> None:
        with TemporaryDirectory() as carpeta:
            datos = mundo(Path(carpeta))
            ctx = contexto(datos)
            from dataclasses import replace

            ctx = replace(
                ctx,
                n8n_url="http://n8n.local",
                syncthing_url="http://syncthing.local",
                ops_hub_url="http://ops-hub.local",
            )
            llamadas: list[str] = []

            class Falso:
                def get(self, url: str, headers: dict[str, str]) -> tuple[int, str]:
                    self_metodo = "GET"
                    if self_metodo != "GET":
                        raise AssertionError(self_metodo)
                    llamadas.append(url)
                    if url.endswith("/api/v1/workflows"):
                        cuerpo = {
                            "data": [
                                {"name": "avisos-telegram", "active": True},
                                {"name": "correo-entrante", "active": True},
                                {"name": "cola-salida-unica", "active": False},
                            ]
                        }
                        return 200, json.dumps(cuerpo)
                    if "/rest/db/status" in url:
                        return 200, json.dumps({"state": "idle"})
                    return 200, "ok"

            texto = informe(ctx, Falso(), datetime(2026, 10, 31, 8, 15, tzinfo=COT))
            with patch.dict(os.environ, {"INTEGRADOR_MODO": "sombra"}):
                self.assertEqual(
                    rutina_vigilancia(contexto(datos), datetime(2026, 10, 31, 8, 15, tzinfo=COT)),
                    "registrada",
                )
            self.assertIn("ausente", texto)
            self.assertIn("avisos-telegram: http 200, activo", texto)
            self.assertIn("ops-hub: http 200", texto)
            self.assertTrue(any(url.endswith("/api/v1/workflows") for url in llamadas))
            self.assertFalse((datos["tmp"] / "franja-que-no-existe").exists())


class RollbackYWebhook(unittest.TestCase):
    def test_rollback_de_ensayo_apaga_el_despertar(self) -> None:
        with TemporaryDirectory() as carpeta:
            datos = mundo(Path(carpeta))
            raiz = datos["tmp"]
            (raiz / "crontab.txt").write_text("*/5 /bin/true # despertador\n", encoding="utf-8")
            # El rollback espera crontab, bots y despertador dentro de la raíz de ensayo.
            shutil_crontab = raiz / "crontab.txt"
            self.assertTrue(shutil_crontab.is_file())
            with patch.dict(os.environ, {"INTEGRADOR_MODO": "sombra"}):
                procesar_orden(contexto(datos), orden(id="ANTES"))
                rollback(raiz, datetime(2026, 10, 31, 12, 0, tzinfo=COT))
                despues = contexto(
                    {
                        **datos,
                        "perfil": raiz / "profiles" / "integrador.disabled",
                    }
                )
                resultado = procesar_orden(despues, orden(id="DESPUES"))
            self.assertEqual(resultado, "apagado")
            lineas = (datos["logs"] / "decisiones.jsonl").read_text(encoding="utf-8").splitlines()
            self.assertEqual([json.loads(lineas[0])["orden"]], ["ANTES"])
            bots = (raiz / "tablon" / "bots.txt").read_text(encoding="utf-8")
            self.assertNotIn("integrador", bots)
            self.assertTrue((raiz / "tablon" / "bots.txt.bak-20261031").is_file())
            self.assertTrue((raiz / "tablon" / "despertador.sh.bak-20261031").is_file())
            self.assertTrue((raiz / "crontab.txt.bak-20261031").is_file())
            jobs = json.loads(
                (raiz / "profiles" / "integrador.disabled" / "cron" / "jobs.json").read_text(encoding="utf-8")
            )
            self.assertTrue(all(job["enabled"] is False for job in jobs["jobs"]))
            self.assertEqual((raiz / "crontab.txt").read_text(encoding="utf-8"), "*/5 /bin/true # despertador\n")

    def test_rollback_rechaza_produccion(self) -> None:
        with self.assertRaises(PermissionError):
            rollback(Path("/home/shoky/ensayo"))

    def test_suscripcion_no_cambia_el_webhook(self) -> None:
        with TemporaryDirectory() as carpeta:
            datos = mundo(Path(carpeta))
            antes = (datos["tmp"] / "webhook-id.txt").read_text(encoding="utf-8")
            (datos["tablon"] / "bots.txt").write_text("enlace\n", encoding="utf-8")
            suscribir(datos["tmp"], datetime(2026, 10, 31, 12, 0, tzinfo=COT))
            despues = (datos["tmp"] / "webhook-id.txt").read_text(encoding="utf-8")
            self.assertTrue(mismo_id(antes.strip(), despues.strip()))
            self.assertIn("integrador", (datos["tablon"] / "bots.txt").read_text(encoding="utf-8"))
            self.assertFalse(list((datos["tmp"]).rglob("*n8n*workflow*")))

    def test_env_de_ensayo_queda_en_600_y_vacio(self) -> None:
        with TemporaryDirectory() as carpeta:
            datos = mundo(Path(carpeta))
            destino = preparar_env(datos["perfil"], datos["tmp"])
            modo = destino.stat().st_mode & 0o777
            self.assertEqual(modo, 0o600)
            texto = destino.read_text(encoding="utf-8")
            self.assertIn("INTEGRADOR_MODO=sombra", texto)
            self.assertNotRegex(texto, r"_TOKEN=.+")
            self.assertNotRegex(texto, r"_KEY=.+")


if __name__ == "__main__":
    unittest.main()
