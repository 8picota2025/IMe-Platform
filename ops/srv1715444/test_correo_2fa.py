"""Código por correo: un solo uso, 10 min, 5 intentos y tope de envío."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import correo_2fa


class Reloj:
    def __init__(self) -> None:
        self.ahora = 1_000_000.0

    def __call__(self) -> float:
        return self.ahora


class Bitacora:
    def __init__(self) -> None:
        self.lineas: list[str] = []

    def info(self, mensaje: str, *args) -> None:
        self.lineas.append(mensaje % args if args else mensaje)


class Correo(unittest.TestCase):
    def setUp(self) -> None:
        self.reloj = Reloj()
        self.enviados: list[tuple[str, str]] = []
        self.gestor = correo_2fa.Gestor(
            ahora=self.reloj,
            enviar=self._enviar,
            pepper=b"pimienta-de-prueba",
            destinatario="ops@example.com",
        )

    def _enviar(self, destino: str, codigo: str) -> None:
        self.enviados.append((destino, codigo))

    def test_el_envio_simulado_no_guarda_el_codigo(self):
        reto = self.gestor.pedir("shoky", "admin")
        self.assertEqual(len(self.enviados), 1)
        self.assertEqual(self.enviados[0][0], "ops@example.com")
        codigo = self.enviados[0][1]
        self.assertEqual(len(codigo), 6)
        self.assertTrue(codigo.isdigit())
        guardado = self.gestor._retos[reto]
        self.assertNotIn(codigo, guardado.values())
        self.assertNotEqual(guardado["hash"], codigo)
        usuario, rol, motivo = self.gestor.verificar(reto, codigo)
        self.assertEqual((usuario, rol, motivo), ("shoky", "admin", "ok"))

    def test_caduca_a_los_diez_minutos_y_es_de_un_solo_uso(self):
        reto = self.gestor.pedir("shoky", "admin")
        codigo = self.enviados[0][1]
        self.reloj.ahora += 10 * 60 + 1
        self.assertEqual(self.gestor.verificar(reto, codigo)[2], "caducado")
        self.reloj.ahora += 61
        otro = self.gestor.pedir("shoky", "admin")
        bueno = self.enviados[-1][1]
        self.assertEqual(self.gestor.verificar(otro, bueno)[2], "ok")
        self.assertEqual(self.gestor.verificar(otro, bueno)[2], "usado")

    def test_cinco_intentos_y_el_sexto_no_entra(self):
        reto = self.gestor.pedir("shoky", "admin")
        codigo = self.enviados[0][1]
        for _ in range(4):
            self.assertEqual(self.gestor.verificar(reto, "000000")[2], "incorrecto")
        self.assertEqual(self.gestor.verificar(reto, codigo)[2], "ok")

        self.reloj.ahora += 61
        reto = self.gestor.pedir("shoky", "admin")
        codigo = self.enviados[-1][1]
        motivos = [self.gestor.verificar(reto, "111111")[2] for _ in range(5)]
        self.assertEqual(motivos[-1], "agotado")
        self.assertNotEqual(self.gestor.verificar(reto, codigo)[2], "ok")

    def test_rate_limit_un_minuto_y_cinco_por_hora(self):
        self.gestor.pedir("shoky", "admin")
        with self.assertRaises(correo_2fa.LimiteEnvio) as minuto:
            self.gestor.pedir("shoky", "admin")
        self.assertEqual(minuto.exception.motivo, "limite_minuto")
        self.assertEqual(len(self.enviados), 1)
        for n in range(4):
            self.reloj.ahora += 61
            self.gestor.pedir("shoky", "admin")
        self.assertEqual(len(self.enviados), 5)
        self.reloj.ahora += 61
        with self.assertRaises(correo_2fa.LimiteEnvio) as hora:
            self.gestor.pedir("shoky", "admin")
        self.assertEqual(hora.exception.motivo, "limite_hora")
        self.assertEqual(len(self.enviados), 5)

    def test_smtp_exige_tls_y_el_log_no_lleva_el_codigo(self):
        vistos: list[str] = []

        class Falso:
            def __init__(self) -> None:
                self.tiene_tls = True
                self.login_tras_tls = False
                self._tls = False

            def ehlo(self) -> None:
                return None

            def has_extn(self, nombre: str) -> bool:
                return nombre == "starttls" and self.tiene_tls

            def starttls(self, context=None) -> None:
                self._tls = context is not None

            def login(self, user: str, password: str) -> None:
                self.login_tras_tls = self._tls
                vistos.append(password)

            def send_message(self, mensaje) -> None:
                vistos.append(mensaje.get_content())

            def quit(self) -> None:
                return None

        falso = Falso()
        bitacora = Bitacora()
        correo_2fa.enviar_smtp(
            "ops@example.com",
            "654321",
            host="smtp.example",
            port=587,
            user="usuario",
            password="clave-smtp",
            remitente="ops@example.com",
            logger=bitacora,
            smtp_factory=lambda host, port, contexto: falso,
        )
        self.assertTrue(falso.login_tras_tls)
        self.assertIn("654321", vistos[1])
        self.assertNotIn("654321", " ".join(bitacora.lineas))
        self.assertNotIn("clave-smtp", " ".join(bitacora.lineas))
        self.assertEqual(bitacora.lineas, ["2fa correo enviado"])

        class SinTls(Falso):
            def __init__(self) -> None:
                super().__init__()
                self.tiene_tls = False

        with self.assertRaises(correo_2fa.EnvioError) as error:
            correo_2fa.enviar_smtp(
                "ops@example.com",
                "111111",
                host="smtp.example",
                port=587,
                user="usuario",
                password="clave-smtp",
                remitente="ops@example.com",
                logger=bitacora,
                smtp_factory=lambda host, port, contexto: SinTls(),
            )
        self.assertEqual(error.exception.tipo, "sin_starttls")
        self.assertNotIn("111111", " ".join(bitacora.lineas))

    def test_el_interruptor_viene_apagado_y_on_pide_smtp(self):
        self.assertEqual(correo_2fa.interruptor({}), "off")
        self.assertEqual(correo_2fa.interruptor({"IME_OPS_2FA": "off"}), "off")
        self.assertEqual(correo_2fa.interruptor({"IME_OPS_2FA": "ON"}), "on")
        self.assertEqual(correo_2fa.interruptor({"IME_OPS_2FA": "si"}), "invalido")
        self.assertFalse(correo_2fa.activo({}))
        self.assertEqual(correo_2fa.variables_faltantes({}), [])
        self.assertEqual(
            correo_2fa.variables_faltantes({"IME_OPS_2FA": "on"}),
            [
                "IME_OPS_2FA_EMAIL",
                "IME_OPS_SMTP_HOST",
                "IME_OPS_SMTP_PORT",
                "IME_OPS_SMTP_USER",
                "IME_OPS_SMTP_PASS",
                "IME_OPS_SMTP_FROM",
            ],
        )
        self.assertNotIn("IME_OPS_TOTP_SECRET", correo_2fa.variables_faltantes({"IME_OPS_2FA": "on"}))


if __name__ == "__main__":
    unittest.main()
