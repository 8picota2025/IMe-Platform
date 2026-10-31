"""Estado de las tarjetas de ops.i-me.com.co.

Solo interpreta sondas que ya ocurrieron. No abre red, no lee secretos y no
inventa un «UP» cuando la fuente no contestó. El equipo main (Windows .80 / GPU
.81) y noa quedan como aviso remoto: no tumban el panel de srv1715444.
"""

from __future__ import annotations

import os
import threading
from collections.abc import Callable
from typing import TypeVar

ESTADOS = ("ok", "degradado", "roto", "sin_dato")
TARJETAS = ("kanban", "boveda", "semaforo", "tokens", "precios", "documenso")

T = TypeVar("T")


def ambito_de(nombre: str) -> str:
    n = (nombre or "").lower()
    if n.startswith("main") or n.startswith("noa"):
        return "remoto"
    return "srv1715444"


def _empaquetar(filas: list[dict]) -> dict:
    up = sum(1 for fila in filas if fila.get("up"))
    total = len(filas)
    pct = round((up / total) * 100, 1) if total else None
    return {"up": up, "total": total, "health_pct": pct}


def resumen_servicios(services: list[dict]) -> dict:
    local: list[dict] = []
    remoto: list[dict] = []
    for servicio in services:
        ambito = servicio.get("ambito") or ambito_de(str(servicio.get("name", "")))
        (remoto if ambito == "remoto" else local).append(servicio)
    loc = _empaquetar(local)
    rem = _empaquetar(remoto)
    if loc["total"] == 0:
        estado = "sin_dato"
    elif loc["up"] == loc["total"]:
        estado = "ok"
    elif loc["up"] == 0:
        estado = "roto"
    else:
        estado = "degradado"
    return {
        "up": loc["up"],
        "total": loc["total"],
        "health_pct": loc["health_pct"] if loc["health_pct"] is not None else 0.0,
        "estado": estado,
        "local": loc,
        "remoto": rem,
        "depende_de_main": False,
    }


def texto_cluster(resumen: dict) -> tuple[str, str]:
    if resumen.get("estado") == "sin_dato" or not resumen.get("total"):
        return "sin dato", "aún no hay sonda de srv1715444"
    remoto = resumen.get("remoto") or {}
    pie = (
        f"main/noa {remoto.get('up', 0)}/{remoto.get('total', 0)} "
        "informativos · no bloquean el panel"
    )
    return f"{resumen['up']} / {resumen['total']} UP", pie


def estado_tokens(fuente_presente: bool, llamadas: int) -> dict:
    if not fuente_presente:
        return {"estado": "sin_dato", "motivo": "no está usage.jsonl en srv1715444"}
    if llamadas <= 0:
        return {"estado": "sin_dato", "motivo": "usage.jsonl sin llamadas"}
    return {"estado": "ok", "motivo": "usage.jsonl"}


def texto_ahorro(pct: float | None) -> str:
    if pct is None:
        return "sin dato"
    return f"~{pct}%"


def sonda_boveda(vault_dir: str) -> dict:
    if not vault_dir or not os.path.isdir(vault_dir):
        return {"existe": False, "legible": False, "notas": 0}
    return {"existe": True, "legible": os.access(vault_dir, os.R_OK), "notas": None}


def estado_boveda(info: dict | None) -> dict:
    if not info or info.get("existe") is None:
        return {"estado": "sin_dato", "motivo": "sin sonda de IME-Vault"}
    if not info.get("existe"):
        return {"estado": "roto", "motivo": "IME-Vault no está en srv1715444"}
    if not info.get("legible"):
        return {"estado": "roto", "motivo": "IME-Vault no se puede leer"}
    notas = info.get("notas")
    if notas is None:
        return {"estado": "ok", "motivo": "directorio local legible en srv1715444"}
    if notas == 0:
        return {"estado": "degradado", "motivo": "directorio local vacío"}
    return {"estado": "ok", "motivo": f"{notas} notas locales en srv1715444"}


def estado_kanban(esperados: int, presentes: int) -> dict:
    if esperados <= 0:
        return {"estado": "sin_dato", "motivo": "sin lista de tableros"}
    if presentes <= 0:
        return {"estado": "roto", "motivo": "no están los kanban en IME-Vault"}
    if presentes < esperados:
        return {"estado": "degradado", "motivo": f"{presentes}/{esperados} tableros"}
    return {"estado": "ok", "motivo": f"{presentes} tableros locales"}


def estado_precios(existe: bool) -> dict:
    if not existe:
        return {"estado": "sin_dato", "motivo": "no está price-intelligence.db"}
    return {"estado": "ok", "motivo": "sqlite local"}


def estado_documenso(svc: dict | None, error: str | None) -> dict:
    if error:
        return {"estado": "roto", "version": None, "motivo": str(error)[:180]}
    if not isinstance(svc, dict):
        return {"estado": "sin_dato", "version": None, "motivo": "sin sonda a firmas.i-me.com.co"}
    version = svc.get("version")
    http = svc.get("http_status")
    if http is None:
        if svc.get("api_ok") is True:
            return {"estado": "ok", "version": version, "motivo": "sonda api_ok"}
        return {"estado": "sin_dato", "version": version, "motivo": "la fuente no trajo http_status"}
    try:
        code = int(http)
    except (TypeError, ValueError):
        return {"estado": "sin_dato", "version": version, "motivo": "http_status ilegible"}
    if 200 <= code < 400:
        return {"estado": "ok", "version": version, "motivo": f"HTTP {code}"}
    return {"estado": "roto", "version": version, "motivo": f"HTTP {code}"}


def estado_documenso_desde_state(state: dict | None, error: str | None) -> dict:
    if error and not state:
        return {"estado": "roto", "motivo": str(error)[:180]}
    if not isinstance(state, dict):
        return {"estado": "sin_dato", "motivo": "sin sonda a firmas.i-me.com.co"}
    svc = state.get("service") if isinstance(state.get("service"), dict) else {}
    est = estado_documenso(svc, None)
    envelopes = state.get("envelopes")
    counts = state.get("counts") if isinstance(state.get("counts"), dict) else None
    if est["estado"] == "sin_dato" and (counts is not None or isinstance(envelopes, list)):
        return {"estado": "ok", "motivo": "listado de sobres en vivo"}
    return {"estado": est["estado"], "motivo": est["motivo"]}


def texto_version_documenso(svc: dict | None, error: str | None) -> str:
    est = estado_documenso(svc, error)
    if est["estado"] == "sin_dato":
        return "sin dato"
    if est["estado"] == "roto":
        return "sin respuesta"
    version = est.get("version")
    if version:
        return f"{version} · vivo"
    return "vivo"


def texto_cert(svc: dict | None) -> str:
    if not isinstance(svc, dict) or "cert_p12" not in svc:
        return "certificado sin dato"
    if svc.get("cert_p12"):
        return "certificado P12 activo"
    return "certificado P12 inactivo"


def texto_equipo(svc: dict | None) -> str:
    if not isinstance(svc, dict):
        return "equipo sin dato"
    team = svc.get("team") or svc.get("team_url")
    if not team:
        return "equipo sin dato"
    return f"equipo {team}"


def texto_webhook(wh: dict | None) -> str:
    if not isinstance(wh, dict):
        return "sin dato"
    if "active" in wh:
        return "activo" if wh.get("active") else "inactivo"
    if "enabled" in wh:
        return "activo" if wh.get("enabled") else "inactivo"
    return "sin dato"


def texto_api(svc: dict | None) -> str:
    if not isinstance(svc, dict):
        return "sin dato"
    if svc.get("http_status") is not None:
        return texto_version_documenso(svc, None)
    if svc.get("api_key_configured_in_env"):
        return "clave presente en srv, sin sonda HTTP"
    return "sin clave verificada"


def _peor(estados: list[str]) -> str:
    rango = {"roto": 3, "degradado": 2, "sin_dato": 1, "ok": 0}
    if not estados:
        return "sin_dato"
    return max(estados, key=lambda estado: rango.get(estado, 1))


def ensamblar(tarjetas: dict) -> dict:
    limpias: dict[str, dict[str, str]] = {}
    for nombre in TARJETAS:
        tarjeta = tarjetas.get(nombre) or {}
        estado = tarjeta.get("estado")
        if estado not in ESTADOS:
            estado = "sin_dato"
        limpias[nombre] = {
            "estado": estado,
            "motivo": str(tarjeta.get("motivo") or "sin sonda")[:180],
        }
    return {
        "status": _peor([limpias[nombre]["estado"] for nombre in TARJETAS]),
        "tarjetas": limpias,
    }


def evaluar_healthz(payload: dict) -> list[str]:
    """Falla si /healthz dice ok mientras alguna tarjeta no lo está."""
    problemas: list[str] = []
    if payload.get("service") != "ime-ops-hub":
        problemas.append("service")
    if payload.get("status") not in ESTADOS:
        problemas.append("status")
    tarjetas = payload.get("tarjetas")
    if not isinstance(tarjetas, dict):
        return problemas + ["sin tarjetas"]
    for nombre in TARJETAS:
        tarjeta = tarjetas.get(nombre)
        if not isinstance(tarjeta, dict) or tarjeta.get("estado") not in ESTADOS:
            problemas.append(nombre)
            continue
        if not str(tarjeta.get("motivo") or "").strip():
            problemas.append(f"{nombre} sin motivo")
    if payload.get("status") == "ok":
        for nombre in TARJETAS:
            tarjeta = tarjetas.get(nombre) or {}
            if tarjeta.get("estado") != "ok":
                problemas.append(f"status no refleja {nombre}")
    return problemas


class SondaUnica:
    """Una sola sonda en vuelo. Si se cuelga, no se lanza otra encima."""

    def __init__(self) -> None:
        self._hilo: threading.Thread | None = None
        self._lock = threading.Lock()

    def lanzar(self, fn: Callable[[], T], timeout: float) -> tuple[T | None, str | None]:
        with self._lock:
            if self._hilo is not None and self._hilo.is_alive():
                return None, "timeout"
            caja: dict = {}

            def run() -> None:
                try:
                    caja["valor"] = fn()
                except Exception as exc:
                    caja["error"] = exc.__class__.__name__

            self._hilo = threading.Thread(target=run, daemon=True)
            self._hilo.start()
            hilo = self._hilo
        hilo.join(timeout)
        if hilo.is_alive():
            return None, "timeout"
        if "error" in caja:
            return None, str(caja["error"])
        return caja.get("valor"), None


def con_limite(fn: Callable[[], T], timeout: float) -> tuple[T | None, str | None]:
    return SondaUnica().lanzar(fn, timeout)
