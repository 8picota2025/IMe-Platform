"""Comportamiento del respaldo: latido, detector, manual con caducidad, auditoría y dry-run."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from respaldo_lib import (  # noqa: E402
    LATIDO_MAX_S,
    MANUAL_HORAS_DEFECTO,
    OrigenInvalido,
    Rutas,
    aplicar_comando,
    detector_ciclo,
    evaluar,
    fusionar_remoto,
    manual_off,
    manual_on,
    parse_comando,
    registrar_latido,
)

AHORA = datetime(2026, 10, 31, 19, 0, tzinfo=timezone.utc)
RAIZ_PKG = Path(__file__).resolve().parents[1]


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class ParseComando(unittest.TestCase):
    def test_on_sin_horas(self) -> None:
        self.assertEqual(parse_comando("RESPALDO ON"), {"accion": "on", "horas": None})

    def test_on_horas_y_decimal(self) -> None:
        self.assertEqual(parse_comando("respaldo on 4"), {"accion": "on", "horas": 4.0})
        self.assertEqual(parse_comando("RESPALDO ON 1,5"), {"accion": "on", "horas": 1.5})
        self.assertEqual(parse_comando("RESPALDO ON 4h"), {"accion": "on", "horas": 4.0})

    def test_off_y_estado(self) -> None:
        self.assertEqual(parse_comando("  RESPALDO   OFF  "), {"accion": "off", "horas": None})
        self.assertEqual(parse_comando("RESPALDO ESTADO"), {"accion": "estado", "horas": None})

    def test_no_es_comando(self) -> None:
        self.assertIsNone(parse_comando("hola respaldo"))

    def test_rechaza_horas_invalidas(self) -> None:
        for texto in ("RESPALDO OFF 2", "RESPALDO", "RESPALDO ON 0", "RESPALDO ON 80", "RESPALDO ON -1"):
            with self.subTest(texto=texto):
                with self.assertRaises(ValueError):
                    parse_comando(texto)


class Detector(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(self.id().replace(".", "_"))
        # unittest no da tmp por id; usamos TemporaryDirectory vía addCleanup
        import tempfile

        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.rutas = Rutas(Path(self.tmp.name))

    def escribir(self, nombre: str, obj: object) -> None:
        path = self.rutas.raiz / nombre
        path.write_text(json.dumps(obj), encoding="utf-8")

    def test_sin_latido_estado_inicial_y_alerta(self) -> None:
        decision = evaluar(self.rutas, AHORA)
        self.assertTrue(decision["estado_inicial"])
        self.assertEqual(decision["modo_antes"], None)
        self.assertEqual(decision["modo_despues"], "respaldo")
        self.assertEqual(decision["motivo"], "sin_latido")
        self.assertEqual(decision["latido"], "ausente")
        self.assertIn("sin_latido", decision["alertas"])
        self.assertIn("sin_latido", decision["alertas_nuevas"])
        self.assertTrue(decision["cambia_modo"])
        self.assertFalse(decision["borra_manual"])

    def test_sin_latido_con_modo_opaco_deja_motivo_explicito(self) -> None:
        self.escribir("modo.json", {"modo": "respaldo"})
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["motivo"], "sin_latido")
        self.assertTrue(decision["cambia_modo"])
        self.assertIn("sin_latido", decision["alertas_nuevas"])

    def test_alerta_no_se_repite(self) -> None:
        self.escribir("modo.json", {"modo": "respaldo", "motivo": "sin_latido"})
        self.escribir("detector-ultimo.json", {"alertas": ["sin_latido"]})
        decision = evaluar(self.rutas, AHORA)
        self.assertIn("sin_latido", decision["alertas"])
        self.assertEqual(decision["alertas_nuevas"], [])
        self.assertFalse(decision["cambia_modo"])

    def test_latido_ok_vuelve_a_normal(self) -> None:
        self.escribir("modo.json", {"modo": "respaldo", "motivo": "sin_latido"})
        self.escribir(
            "latido-grokbot.json",
            {"estado": "ok", "utc": iso(AHORA - timedelta(seconds=60)), "quien": "emilio", "origen": "rutina"},
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["latido"], "ok")
        self.assertEqual(decision["modo_despues"], "normal")
        self.assertEqual(decision["motivo"], "latido_ok")
        self.assertEqual(decision["alertas"], [])
        self.assertTrue(decision["cambia_modo"])

    def test_latido_ok_reciente_no_cambia_normal(self) -> None:
        self.escribir("modo.json", {"modo": "normal", "motivo": "latido_ok"})
        self.escribir(
            "latido-grokbot.json",
            {"estado": "ok", "utc": iso(AHORA - timedelta(seconds=30)), "quien": "grok", "origen": "grok-tablon"},
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertFalse(decision["cambia_modo"])
        self.assertEqual(decision["modo_despues"], "normal")

    def test_fallo_y_sin_tokens_pasan_a_respaldo(self) -> None:
        for estado, motivo in (("fallo", "latido_fallo"), ("sin_tokens", "latido_sin_tokens")):
            with self.subTest(estado=estado):
                self.escribir("modo.json", {"modo": "normal", "motivo": "latido_ok"})
                self.escribir(
                    "latido-grokbot.json",
                    {"estado": estado, "utc": iso(AHORA), "quien": "emilio", "origen": "emilio"},
                )
                decision = evaluar(self.rutas, AHORA)
                self.assertEqual(decision["modo_despues"], "respaldo")
                self.assertEqual(decision["motivo"], motivo)
                self.assertIn(motivo, decision["alertas_nuevas"])

    def test_latido_caducado(self) -> None:
        self.assertEqual(LATIDO_MAX_S, 900)
        self.escribir("modo.json", {"modo": "normal", "motivo": "latido_ok"})
        self.escribir(
            "latido-grokbot.json",
            {
                "estado": "ok",
                "utc": iso(AHORA - timedelta(seconds=LATIDO_MAX_S + 1)),
                "quien": "emilio",
                "origen": "hermes",
            },
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["latido"], "caducado")
        self.assertEqual(decision["modo_despues"], "respaldo")
        self.assertEqual(decision["motivo"], "latido_caducado")
        self.assertIn("latido_caducado", decision["alertas_nuevas"])

    def test_manual_vigente_gana_al_latido_ok(self) -> None:
        self.escribir("modo.json", {"modo": "normal", "motivo": "latido_ok"})
        self.escribir(
            "latido-grokbot.json",
            {"estado": "ok", "utc": iso(AHORA), "quien": "emilio", "origen": "rutina"},
        )
        self.escribir(
            "modo-respaldo.manual",
            {
                "quien": "Shoky",
                "motivo": "mantenimiento",
                "desde_utc": iso(AHORA - timedelta(hours=1)),
                "expires_at": iso(AHORA + timedelta(hours=2)),
                "origen": "cli",
            },
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["manual"], "vigente")
        self.assertEqual(decision["modo_despues"], "respaldo")
        self.assertEqual(decision["motivo"], "manual")
        self.assertFalse(decision["borra_manual"])
        self.assertEqual(decision["quien"], "Shoky")

    def test_manual_caducado_se_borra_y_vuelve_el_latido(self) -> None:
        self.escribir("modo.json", {"modo": "respaldo", "motivo": "manual"})
        self.escribir(
            "latido-grokbot.json",
            {"estado": "ok", "utc": iso(AHORA), "quien": "emilio", "origen": "rutina"},
        )
        self.escribir(
            "modo-respaldo.manual",
            {
                "quien": "Shoky",
                "motivo": "ventana",
                "desde_utc": iso(AHORA - timedelta(hours=5)),
                "expires_at": iso(AHORA - timedelta(seconds=1)),
                "origen": "telegram",
            },
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["manual"], "caducado")
        self.assertTrue(decision["borra_manual"])
        self.assertEqual(decision["modo_despues"], "normal")
        self.assertEqual(decision["motivo"], "latido_ok")

    def test_legado_no_se_borra(self) -> None:
        self.escribir("modo.json", {"modo": "respaldo"})
        (self.rutas.raiz / "modo-respaldo.manual").write_text("manual: Shoky/iMErvis\n", encoding="utf-8")
        self.escribir(
            "latido-grokbot.json",
            {"estado": "ok", "utc": iso(AHORA), "quien": "emilio", "origen": "rutina"},
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["manual"], "legado")
        self.assertFalse(decision["borra_manual"])
        self.assertEqual(decision["modo_despues"], "respaldo")
        self.assertEqual(decision["motivo"], "manual_legado")
        self.assertIn("manual_sin_caducidad", decision["alertas"])

    def test_sin_latido_avisa_aunque_haya_manual(self) -> None:
        self.escribir("modo.json", {"modo": "respaldo", "motivo": "manual"})
        self.escribir(
            "modo-respaldo.manual",
            {
                "quien": "Shoky",
                "motivo": "ventana",
                "desde_utc": iso(AHORA),
                "expires_at": iso(AHORA + timedelta(hours=4)),
                "origen": "hermes",
            },
        )
        decision = evaluar(self.rutas, AHORA)
        self.assertEqual(decision["modo_despues"], "respaldo")
        self.assertIn("sin_latido", decision["alertas"])

    def test_dry_run_no_escribe_ni_borra(self) -> None:
        manual = {
            "quien": "Shoky",
            "motivo": "ventana",
            "desde_utc": iso(AHORA - timedelta(hours=5)),
            "expires_at": iso(AHORA - timedelta(seconds=1)),
            "origen": "cli",
        }
        self.escribir("modo-respaldo.manual", manual)
        resultado = detector_ciclo(self.rutas, AHORA, dry_run=True)
        self.assertTrue(resultado["dry_run"])
        self.assertTrue(resultado["borra_manual"])
        self.assertTrue((self.rutas.raiz / "modo-respaldo.manual").exists())
        self.assertFalse((self.rutas.raiz / "modo.json").exists())
        self.assertFalse((self.rutas.raiz / "auditoria.jsonl").exists())
        self.assertFalse((self.rutas.raiz / "alertas.jsonl").exists())
        self.assertFalse((self.rutas.raiz / "detector-ultimo.json").exists())

    def test_aplicar_escribe_auditoria_y_borra_caducado(self) -> None:
        self.escribir(
            "modo-respaldo.manual",
            {
                "quien": "Shoky",
                "motivo": "ventana",
                "desde_utc": iso(AHORA - timedelta(hours=5)),
                "expires_at": iso(AHORA - timedelta(seconds=1)),
                "origen": "cli",
            },
        )
        resultado = detector_ciclo(self.rutas, AHORA, dry_run=False)
        self.assertFalse((self.rutas.raiz / "modo-respaldo.manual").exists())
        modo = json.loads((self.rutas.raiz / "modo.json").read_text(encoding="utf-8"))
        self.assertEqual(modo["modo"], "respaldo")
        self.assertEqual(modo["motivo"], "sin_latido")
        self.assertEqual(modo["quien"], "detector")
        self.assertEqual(modo["origen"], "hermes")
        lineas = [
            json.loads(linea)
            for linea in (self.rutas.raiz / "auditoria.jsonl").read_text(encoding="utf-8").splitlines()
        ]
        for linea in lineas:
            self.assertEqual(set(linea), {"utc", "quien", "accion", "origen", "motivo"})
        acciones = [linea["accion"] for linea in lineas]
        self.assertIn("manual_expirado", acciones)
        self.assertIn("alerta_sin_latido", acciones)
        self.assertIn("modo_respaldo", acciones)
        self.assertIn("sin_latido", (self.rutas.raiz / "historial.log").read_text(encoding="utf-8"))
        self.assertTrue(resultado["estado_inicial"] or resultado["motivo"] == "sin_latido")

    def test_la_alerta_vuelve_cuando_el_latido_cae_de_nuevo(self) -> None:
        self.escribir(
            "latido-grokbot.json",
            {"estado": "ok", "utc": iso(AHORA), "quien": "emilio", "origen": "rutina"},
        )
        detector_ciclo(self.rutas, AHORA, dry_run=False)
        (self.rutas.raiz / "latido-grokbot.json").unlink()
        decision = evaluar(self.rutas, AHORA + timedelta(minutes=5))
        self.assertIn("sin_latido", decision["alertas_nuevas"])


class Interruptor(unittest.TestCase):
    def setUp(self) -> None:
        import tempfile

        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.rutas = Rutas(Path(self.tmp.name))

    def test_on_por_defecto_cuatro_horas_con_autor(self) -> None:
        self.assertEqual(MANUAL_HORAS_DEFECTO, 4.0)
        manual_on(self.rutas, quien="Shoky", motivo="prueba", origen="cli", now=AHORA, dry_run=False)
        manual = json.loads((self.rutas.raiz / "modo-respaldo.manual").read_text(encoding="utf-8"))
        self.assertEqual(manual["quien"], "Shoky")
        self.assertEqual(manual["motivo"], "prueba")
        self.assertEqual(manual["origen"], "cli")
        self.assertEqual(manual["desde_utc"], iso(AHORA))
        self.assertEqual(manual["expires_at"], iso(AHORA + timedelta(hours=4)))
        modo = json.loads((self.rutas.raiz / "modo.json").read_text(encoding="utf-8"))
        self.assertEqual(modo["modo"], "respaldo")
        linea = json.loads((self.rutas.raiz / "auditoria.jsonl").read_text(encoding="utf-8").splitlines()[0])
        self.assertEqual(linea["accion"], "manual_on")
        self.assertEqual(linea["quien"], "Shoky")
        self.assertEqual(linea["origen"], "cli")

    def test_off_borra_legado_y_pone_normal(self) -> None:
        (self.rutas.raiz / "modo-respaldo.manual").write_text("manual: Shoky/iMErvis\n", encoding="utf-8")
        manual_off(self.rutas, quien="Shoky", motivo="fin", origen="telegram", now=AHORA, dry_run=False)
        self.assertFalse((self.rutas.raiz / "modo-respaldo.manual").exists())
        modo = json.loads((self.rutas.raiz / "modo.json").read_text(encoding="utf-8"))
        self.assertEqual(modo["modo"], "normal")
        linea = json.loads((self.rutas.raiz / "auditoria.jsonl").read_text(encoding="utf-8").splitlines()[-1])
        self.assertEqual(linea["accion"], "manual_off")
        self.assertEqual(linea["origen"], "telegram")

    def test_comando_on_horas(self) -> None:
        aplicar_comando(
            self.rutas,
            "RESPALDO ON 2",
            quien="Hermes",
            origen="hermes",
            motivo="ensayo",
            now=AHORA,
            dry_run=False,
        )
        manual = json.loads((self.rutas.raiz / "modo-respaldo.manual").read_text(encoding="utf-8"))
        self.assertEqual(manual["expires_at"], iso(AHORA + timedelta(hours=2)))

    def test_origen_de_latido_y_de_manual(self) -> None:
        registrar_latido(
            self.rutas,
            estado="ok",
            quien="emilio",
            origen="emilio",
            now=AHORA,
            dry_run=False,
        )
        latido = json.loads((self.rutas.raiz / "latido-grokbot.json").read_text(encoding="utf-8"))
        self.assertEqual(latido["estado"], "ok")
        self.assertEqual(latido["origen"], "emilio")
        with self.assertRaises(OrigenInvalido):
            manual_on(self.rutas, quien="emilio", motivo="x", origen="emilio", now=AHORA, dry_run=False)
        with self.assertRaises(ValueError):
            registrar_latido(self.rutas, estado="quizas", quien="emilio", origen="rutina", now=AHORA, dry_run=False)

    def test_dry_run_del_interruptor_no_escribe(self) -> None:
        manual_on(self.rutas, quien="Shoky", motivo="prueba", origen="grok-tablon", now=AHORA, dry_run=True)
        self.assertFalse((self.rutas.raiz / "modo-respaldo.manual").exists())
        self.assertFalse((self.rutas.raiz / "modo.json").exists())

    def test_fallo_de_red_no_pierde_el_latido_ni_guarda_token(self) -> None:
        def transport(_rpc: str, _body: dict) -> dict:
            raise RuntimeError("red")

        registrar_latido(
            self.rutas,
            estado="sin_tokens",
            quien="rutina-web",
            origen="rutina",
            now=AHORA,
            dry_run=False,
            transport=transport,
            token="secreto-no-loguear",
        )
        latido = json.loads((self.rutas.raiz / "latido-grokbot.json").read_text(encoding="utf-8"))
        self.assertEqual(latido["estado"], "sin_tokens")
        texto = (self.rutas.raiz / "outbox.jsonl").read_text(encoding="utf-8")
        self.assertIn("imeia_latido_registrar", texto)
        self.assertNotIn("secreto-no-loguear", texto)
        self.assertNotIn('"token"', texto.lower())
        self.assertNotIn("p_token", texto.lower())


class Remoto(unittest.TestCase):
    def setUp(self) -> None:
        import tempfile

        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.rutas = Rutas(Path(self.tmp.name))

    def test_latido_remoto_mas_nuevo_pisa_el_local(self) -> None:
        (self.rutas.raiz / "latido-grokbot.json").write_text(
            json.dumps({"estado": "ok", "utc": iso(AHORA - timedelta(minutes=5)), "quien": "h", "origen": "hermes"}),
            encoding="utf-8",
        )
        fusionar_remoto(
            self.rutas,
            {
                "latido": {
                    "estado": "fallo",
                    "utc": iso(AHORA),
                    "quien": "emilio",
                    "origen": "grok-tablon",
                    "detalle": None,
                },
                "manual": None,
            },
            now=AHORA,
            dry_run=False,
        )
        latido = json.loads((self.rutas.raiz / "latido-grokbot.json").read_text(encoding="utf-8"))
        self.assertEqual(latido["estado"], "fallo")

    def test_no_pisa_latido_local_mas_nuevo(self) -> None:
        (self.rutas.raiz / "latido-grokbot.json").write_text(
            json.dumps({"estado": "ok", "utc": iso(AHORA), "quien": "h", "origen": "hermes"}),
            encoding="utf-8",
        )
        fusionar_remoto(
            self.rutas,
            {
                "latido": {
                    "estado": "fallo",
                    "utc": iso(AHORA - timedelta(minutes=1)),
                    "quien": "emilio",
                    "origen": "grok-tablon",
                },
                "manual": None,
            },
            now=AHORA,
            dry_run=False,
        )
        latido = json.loads((self.rutas.raiz / "latido-grokbot.json").read_text(encoding="utf-8"))
        self.assertEqual(latido["estado"], "ok")

    def test_legado_local_no_se_toca(self) -> None:
        (self.rutas.raiz / "modo-respaldo.manual").write_text("manual: Shoky/iMErvis\n", encoding="utf-8")
        resultado = fusionar_remoto(
            self.rutas,
            {
                "latido": None,
                "manual": {
                    "activo": True,
                    "quien": "Otro",
                    "motivo": "remoto",
                    "desde_utc": iso(AHORA),
                    "expires_at": iso(AHORA + timedelta(hours=4)),
                    "origen": "grok-tablon",
                },
            },
            now=AHORA,
            dry_run=False,
        )
        self.assertTrue(resultado["conservo_legado"])
        self.assertEqual(
            (self.rutas.raiz / "modo-respaldo.manual").read_text(encoding="utf-8"),
            "manual: Shoky/iMErvis\n",
        )

    def test_off_remoto_mas_nuevo_borra_manual_json(self) -> None:
        manual_on(self.rutas, quien="Shoky", motivo="local", origen="cli", now=AHORA - timedelta(hours=1), dry_run=False)
        fusionar_remoto(
            self.rutas,
            {
                "latido": None,
                "manual": {
                    "activo": False,
                    "quien": "Shoky",
                    "motivo": "fin",
                    "desde_utc": iso(AHORA - timedelta(hours=1)),
                    "updated_at": iso(AHORA),
                    "origen": "grok-tablon",
                },
            },
            now=AHORA,
            dry_run=False,
        )
        self.assertFalse((self.rutas.raiz / "modo-respaldo.manual").exists())


class Higiene(unittest.TestCase):
    def test_el_codigo_no_envia_correo_ni_arranca_emilio(self) -> None:
        prohibido = ("smtplib", "sendmail", "systemctl", "subprocess", "EmilioH", "emilioh", "smtp")
        for path in RAIZ_PKG.glob("*.py"):
            texto = path.read_text(encoding="utf-8").lower()
            for palabra in prohibido:
                self.assertNotIn(palabra.lower(), texto, f"{path.name} contiene {palabra}")


class Cli(unittest.TestCase):
    def setUp(self) -> None:
        import tempfile

        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.env = {**os.environ, "HERMES_ESTADO_DIR": self.tmp.name, "RESPALDO_QUIEN": "Shoky"}
        for clave in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "IMEIA_SUPABASE_ANON_KEY", "IMEIA_WORKER_TOKEN"):
            self.env.pop(clave, None)

    def lanzar(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            args,
            check=False,
            capture_output=True,
            text=True,
            env=self.env,
            cwd=str(RAIZ_PKG),
        )

    def test_detector_dry_run_cli(self) -> None:
        proc = self.lanzar(sys.executable, str(RAIZ_PKG / "detector.py"), "--dry-run", "--now", iso(AHORA))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        data = json.loads(proc.stdout)
        self.assertTrue(data["dry_run"])
        self.assertEqual(data["motivo"], "sin_latido")
        self.assertEqual(list(Path(self.tmp.name).iterdir()), [])

    def test_respaldo_sh_on_dry_run(self) -> None:
        proc = self.lanzar("bash", str(RAIZ_PKG / "respaldo.sh"), "on", "--dry-run", "--motivo", "ensayo", "--origen", "cli")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertFalse((Path(self.tmp.name) / "modo-respaldo.manual").exists())

    def test_comando_telegram(self) -> None:
        proc = self.lanzar(
            sys.executable,
            str(RAIZ_PKG / "comando.py"),
            "--origen",
            "telegram",
            "--quien",
            "Shoky",
            "--motivo",
            "desde telegram",
            "--now",
            iso(AHORA),
            "RESPALDO ON",
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        manual = json.loads((Path(self.tmp.name) / "modo-respaldo.manual").read_text(encoding="utf-8"))
        self.assertEqual(manual["expires_at"], iso(AHORA + timedelta(hours=4)))
        self.assertEqual(manual["origen"], "telegram")


if __name__ == "__main__":
    unittest.main()
