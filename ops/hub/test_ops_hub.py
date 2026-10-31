"""Pruebas del hub de ops. No llama a producción ni a srv1715444."""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sqlite3
import sys
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))

from acciones import AccionError, Pedido, decidir  # noqa: E402
from almacen import Almacen  # noqa: E402
from fuentes import FuenteNoDisponible, leer_cotizaciones, leer_hermes  # noqa: E402
from kanban_md import Tarjeta, fusionar, parse, render, tablero_vacio  # noqa: E402
import secretos  # noqa: E402
import sync_obsidian_kanbans as sync  # noqa: E402


def _cargar(nombre: str, archivo: str):
    spec = importlib.util.spec_from_file_location(nombre, RAIZ / archivo)
    modulo = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(modulo)
    return modulo


ime_cluster_ha = _cargar("ime_cluster_ha", "ime-cluster-ha.py")
ime_ops_hub = _cargar("ime_ops_hub", "ime-ops-hub.py")

PY = [
    "registro.py",
    "kanban_md.py",
    "almacen.py",
    "fuentes.py",
    "acciones.py",
    "sync_obsidian_kanbans.py",
    "ime-ops-hub.py",
    "ime-cluster-ha.py",
    "secretos.py",
    "contactos.py",
]


def tablero_real() -> str:
    return """---
kanban-plugin: basic
---

## Por aprobar

- [ ] Cotizacion abierta
  - id: abierta
  - origen: cotizacion
  - ref: ABIERTA
  - cotizacion_id: 11111111-1111-4111-8111-111111111111
  - bot: correo

- [ ] Tarea hermes
  - id: tarea-1
  - origen: tarea
  - bot: hermes

## Aprobados

## Ejecutados por Hermes

- [x] Ya decidida
  - id: hecha
  - origen: tarea
  - bot: hermes

## Rechazados

"""


class Fusion(unittest.TestCase):
    def test_no_pisa_una_decision_ya_tomada(self):
        existente = parse(tablero_real())
        fuentes = [
            Tarjeta(id="hecha", titulo="Ya decidida renovada", carril="", origen="tarea", bot_dueno="hermes"),
            Tarjeta(id="nueva", titulo="Entra a la bandeja", carril="", origen="tarea", bot_dueno="hermes"),
        ]
        fusion = fusionar(existente, fuentes, {})
        por_id = {tarjeta.id: tarjeta for tarjeta in fusion.tarjetas}
        self.assertEqual(por_id["hecha"].carril, "Ejecutados por Hermes")
        self.assertEqual(por_id["nueva"].carril, "Por aprobar")
        texto = render(fusion)
        self.assertNotIn("## Ejecutadas", texto)
        self.assertNotIn("## Cerradas", texto)
        self.assertIn("## Ejecutados por Hermes", texto)

    def test_la_decision_guardada_manda_sobre_la_fuente(self):
        existente = parse(tablero_real())
        decision = {
            "abierta": {
                "decision": "aprobada",
                "usuario": "shoky",
                "decidido_at": "2026-10-31T13:11:00-05:00",
                "encolado_estado": "enviado",
                "titulo": "Cotizacion abierta",
            }
        }
        fusion = fusionar(existente, [Tarjeta(id="abierta", titulo="Cotizacion abierta", carril="")], decision)
        tarjeta = next(item for item in fusion.tarjetas if item.id == "abierta")
        self.assertEqual(tarjeta.carril, "Ejecutados por Hermes")
        self.assertEqual(tarjeta.usuario, "shoky")


class Decisiones(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.md = self.dir / "Kanban-Aprobaciones.md"
        self.md.write_text(tablero_real(), encoding="utf-8")
        self.db = Almacen(self.dir / "ops-hub.db")
        self.llamadas: list[tuple[str, dict]] = []

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def transporte(self):
        def encolar(payload):
            self.llamadas.append(("webhook", payload))

        def marcar(pedido):
            self.llamadas.append(("rpc", {"id": pedido.cotizacion_id, "por": pedido.usuario, "tipo": pedido.aprobacion_tipo, "ref": pedido.ref}))

        return {"encolar_webhook": encolar, "marcar_cotizacion": marcar}

    def test_aprobar_tarea_guarda_usuario_hora_y_carril_real(self):
        resultado = decidir(
            self.md,
            self.db,
            Pedido("tarea-1", "aprobada", "shoky", "Kanban-Aprobaciones.md"),
            self.transporte(),
        )
        self.assertFalse(resultado.idempotente)
        fila = self.db.decision("tarea-1")
        self.assertEqual(fila["usuario"], "shoky")
        self.assertEqual(fila["decision"], "aprobada")
        self.assertTrue(fila["decidido_at"])
        texto = self.md.read_text(encoding="utf-8")
        self.assertIn("## Ejecutados por Hermes", texto)
        self.assertLess(texto.index("## Ejecutados por Hermes"), texto.index("- [x] Tarea hermes"))
        self.assertEqual(self.llamadas[0][0], "webhook")
        self.assertEqual(self.llamadas[0][1]["envia"], False)
        self.assertNotIn("rpc", [nombre for nombre, _ in self.llamadas])
        otra = decidir(
            self.md,
            self.db,
            Pedido("tarea-1", "aprobada", "otra-persona", "Kanban-Aprobaciones.md"),
            self.transporte(),
        )
        self.assertTrue(otra.idempotente)
        self.assertEqual(len([nombre for nombre, _ in self.llamadas if nombre == "webhook"]), 1)
        self.assertEqual(self.db.decision("tarea-1")["usuario"], "shoky")

    def test_rechazar_no_llama_al_rpc(self):
        decidir(
            self.md,
            self.db,
            Pedido("tarea-1", "rechazada", "shoky", "Kanban-Aprobaciones.md"),
            self.transporte(),
        )
        self.assertEqual([nombre for nombre, _ in self.llamadas], ["webhook"])
        self.assertEqual(self.llamadas[0][1]["decision"], "rechazada")
        self.assertIn("## Rechazados", self.md.read_text(encoding="utf-8"))

    def test_aprobar_cotizacion_usa_el_rpc_y_no_el_webhook(self):
        decidir(
            self.md,
            self.db,
            Pedido(
                "abierta",
                "aprobada",
                "shoky",
                "Kanban-Aprobaciones.md",
                aprobacion_tipo="ok_shoky",
                ref="chat-ok",
            ),
            self.transporte(),
        )
        self.assertEqual([nombre for nombre, _ in self.llamadas], ["rpc", "webhook"])
        self.assertEqual(self.llamadas[1][1]["ejecutor"], "emilio")
        self.assertEqual(self.llamadas[1][1]["envia"], False)

    def test_si_el_tablon_falla_no_mueve_la_tarjeta(self):
        antes = self.md.read_text(encoding="utf-8")

        def falla(_payload):
            raise AccionError(502, "tablon HTTP 500")

        with self.assertRaises(AccionError):
            decidir(
                self.md,
                self.db,
                Pedido("tarea-1", "aprobada", "shoky", "Kanban-Aprobaciones.md"),
                {"encolar_webhook": falla, "marcar_cotizacion": lambda _pedido: None},
            )
        self.assertEqual(self.md.read_text(encoding="utf-8"), antes)
        self.assertEqual(self.db.decision("tarea-1")["encolado_estado"], "error")
        self.assertEqual(self.db.decision("tarea-1")["usuario"], "shoky")

    def test_carriles_viejos_no_sirven_de_destino(self):
        self.md.write_text(
            "## Por aprobar\n\n- [ ] Tarea\n  - id: tarea-1\n  - bot: hermes\n\n## Ejecutadas\n\n## Cerradas\n",
            encoding="utf-8",
        )
        antes = self.md.read_bytes()
        with self.assertRaises(AccionError) as ctx:
            decidir(
                self.md,
                self.db,
                Pedido("tarea-1", "aprobada", "shoky", "Kanban-Aprobaciones.md"),
                self.transporte(),
            )
        self.assertEqual(ctx.exception.status, 409)
        self.assertEqual(self.md.read_bytes(), antes)
        self.assertIsNone(self.db.decision("tarea-1"))


class Sync(unittest.TestCase):
    def test_fuente_caida_no_reescribe(self):
        import tempfile

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                self.send_response(401)
                self.end_headers()

            def log_message(self, fmt, *args):
                return

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        hilo = threading.Thread(target=server.serve_forever, daemon=True)
        hilo.start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                raiz = Path(tmp)
                path = raiz / "Kanban-Aprobaciones.md"
                path.write_text(tablero_real(), encoding="utf-8")
                (raiz / "Kanban-Comercial.md").write_text("comercial intacto\n", encoding="utf-8")
                antes = path.read_bytes()
                codigo = sync.sincronizar(
                    raiz,
                    raiz / "ops-hub.db",
                    None,
                    (f"http://127.0.0.1:{server.server_port}", "llave-de-prueba"),
                )
                self.assertEqual(codigo, 2)
                self.assertEqual(path.read_bytes(), antes)
                self.assertEqual((raiz / "Kanban-Comercial.md").read_text(encoding="utf-8"), "comercial intacto\n")
        finally:
            server.shutdown()
            server.server_close()

    def test_hermes_no_pisa_otro_tablero_sin_filas(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            (raiz / "Kanban-Aprobaciones.md").write_text(tablero_real(), encoding="utf-8")
            comercial = raiz / "Kanban-Comercial.md"
            comercial.write_text("## Ejecutados por Hermes\n\n- [x] Trato\n  - id: trato\n", encoding="utf-8")
            uno = raiz / "Kanban-1.md"
            uno.write_text("uno\n", encoding="utf-8")
            db = raiz / "hermes.db"
            con = sqlite3.connect(db)
            con.execute("create table cards (id text, titulo text, tablero text, bot_dueno text)")
            con.execute("insert into cards values ('nueva-com', 'Nueva', 'comercial', 'hermes')")
            con.commit()
            con.close()
            codigo = sync.sincronizar(raiz, raiz / "ops-hub.db", db, None)
            self.assertEqual(codigo, 0)
            self.assertEqual((raiz / "Kanban-Aprobaciones.md").read_text(encoding="utf-8"), tablero_real())
            self.assertIn("id: trato", comercial.read_text(encoding="utf-8"))
            self.assertIn("Nueva", comercial.read_text(encoding="utf-8"))
            self.assertEqual(uno.read_text(encoding="utf-8"), "uno\n")
            self.assertEqual(leer_hermes(db)[0].tablero, "comercial")


class Fuente(unittest.TestCase):
    def test_cotizaciones_abiertas_por_numero(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                cuerpo = json.dumps(
                    [
                        {"id": "1", "numero": "ABIERTA", "estado": "en_revision", "archived_at": None},
                        {"id": "2", "numero": "CERRADA", "estado": "enviada", "archived_at": None},
                    ]
                ).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(cuerpo)

            def log_message(self, fmt, *args):
                return

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        hilo = threading.Thread(target=server.serve_forever, daemon=True)
        hilo.start()
        try:
            tarjetas = leer_cotizaciones(f"http://127.0.0.1:{server.server_port}", "llave")
        finally:
            server.shutdown()
            server.server_close()
        self.assertEqual([tarjeta.id for tarjeta in tarjetas], ["ABIERTA"])

    def test_hermes_ausente(self):
        with self.assertRaises(FuenteNoDisponible):
            leer_hermes(Path("/tmp/no-existe-kanban-hermes.db"))


class Proceso(unittest.TestCase):
    def test_no_hay_except_pass_ni_seccion_fija(self):
        for nombre in PY:
            texto = (RAIZ / nombre).read_text(encoding="utf-8")
            self.assertIsNone(re.search(r"except[^:\n]*:\s*pass", texto), nombre)
            self.assertIsNone(re.search(r"except[^:\n]*:\s*\n\s*pass\b", texto), nombre)
        sync_texto = (RAIZ / "sync_obsidian_kanbans.py").read_text(encoding="utf-8")
        self.assertNotIn("## 1. Cotizaciones", sync_texto)
        self.assertNotIn("cod" + "igo", sync_texto.lower())
        fuentes = (RAIZ / "fuentes.py").read_text(encoding="utf-8")
        self.assertIn("mode=ro", fuentes)
        self.assertNotIn("insert into", fuentes.lower())
        self.assertNotIn("update ", fuentes.lower())
        for path in RAIZ.rglob("*.py"):
            texto = path.read_text(encoding="utf-8").lower()
            self.assertNotIn("bbraun" + ".com", texto, path.name)
            self.assertNotIn("fresenius-kabi" + ".com", texto, path.name)


class Login(unittest.TestCase):
    def test_la_pagina_no_muestra_la_contrasena(self):
        import tempfile

        clave = "clave-que-no-puede-verse"
        os.environ["OPS_ADMIN_PASSWORD"] = clave
        os.environ["IME_OPS_SECRET"] = "semilla-hmac-de-prueba"
        os.environ.pop("IME_OPS_TOTP_SECRET", None)
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["IME_OPS_KANBAN_DIR"] = tmp
            servidor = ime_ops_hub.ThreadingHTTPServer(("127.0.0.1", 0), ime_ops_hub.Hub)
            hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
            hilo.start()
            try:
                puerto = servidor.server_address[1]
                with urllib.request.urlopen(f"http://127.0.0.1:{puerto}/") as respuesta:
                    cuerpo = respuesta.read().decode()
                self.assertNotIn(clave, cuerpo)
                self.assertNotIn("REDACTED", cuerpo)
                self.assertIn("type='password'", cuerpo)
                self.assertIn("no se muestra", cuerpo)
                self.assertIsNone(secretos.autenticar("shoky", "<REDACTED:OPS_ADMIN_PASSWORD_1>"))
                self.assertEqual(secretos.autenticar("shoky", clave)[1], "admin")
            finally:
                servidor.shutdown()
                servidor.server_close()
                for nombre in ("OPS_ADMIN_PASSWORD", "IME_OPS_SECRET", "IME_OPS_KANBAN_DIR"):
                    os.environ.pop(nombre, None)

    def test_cluster_no_reescribe(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "Kanban-Aprobaciones.md"
            path.write_text("intacto\n", encoding="utf-8")
            antes = path.read_bytes()
            os.environ["IME_OPS_KANBAN_DIR"] = tmp
            try:
                self.assertEqual(ime_cluster_ha.main(), 0)
            finally:
                os.environ.pop("IME_OPS_KANBAN_DIR", None)
            self.assertEqual(path.read_bytes(), antes)


class Http(unittest.TestCase):
    def test_post_approve(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            (raiz / "Kanban-Aprobaciones.md").write_text(tablero_real(), encoding="utf-8")
            os.environ["IME_OPS_KANBAN_DIR"] = str(raiz)
            os.environ["IME_OPS_DB"] = str(raiz / "ops-hub.db")
            os.environ["IME_LOG_DIR"] = str(raiz / "logs")
            os.environ.pop("IME_OPS_TOKEN", None)
            servidor = ime_ops_hub.ThreadingHTTPServer(("127.0.0.1", 0), ime_ops_hub.Hub)
            hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
            hilo.start()
            llamadas = []

            def encolar(payload):
                llamadas.append(payload)

            original = ime_ops_hub.decidir

            def decidir_con_mock(path, almacen, pedido, transporte=None):
                return original(path, almacen, pedido, {"encolar_webhook": encolar, "marcar_cotizacion": lambda _p: None})

            ime_ops_hub.decidir = decidir_con_mock
            try:
                puerto = servidor.server_address[1]
                datos = "id=tarea-1&usuario=shoky".encode()
                peticion = urllib.request.Request(
                    f"http://127.0.0.1:{puerto}/post/approve",
                    data=datos,
                    method="POST",
                )
                with urllib.request.urlopen(peticion) as respuesta:
                    cuerpo = json.loads(respuesta.read().decode())
                self.assertEqual(respuesta.status, 200)
                self.assertTrue(cuerpo["ok"])
                self.assertEqual(llamadas[0]["usuario"], "shoky")
                self.assertEqual(llamadas[0]["envia"], False)
                texto = (raiz / "logs" / "ime-ops-hub.log").read_text(encoding="utf-8")
                self.assertIn("usuario=shoky", texto)
                self.assertIn("accion=aprobada", texto)
                self.assertRegex(texto, r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} COT")
            finally:
                ime_ops_hub.decidir = original
                servidor.shutdown()
                servidor.server_close()
                os.environ.pop("IME_OPS_KANBAN_DIR", None)
                os.environ.pop("IME_OPS_DB", None)
                os.environ.pop("IME_LOG_DIR", None)


if __name__ == "__main__":
    unittest.main()
