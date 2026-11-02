#!/usr/bin/env python3
"""Regenera el espejo Obsidian del panel vivo desde la Management API.

No envía correo, WhatsApp ni Telegram. No escribe en Twenty.
La sección 1 sale de solicitudes_cotizacion (columna numero).
Si la consulta no es fresca, no toca el panel ya escrito.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("America/Bogota")
ESTADOS_CERRADOS = frozenset(
    {
        "enviada",
        "aceptada",
        "rechazada",
        "perdida",
        "cerrada",
        "archivada",
        "cancelada",
        "facturada",
        "convertida",
    }
)
FUENTE = "supabase_management_api"
NOMBRE_PANEL = "Estado-Vivo-CMS-y-RFQs.md"
CONSULTA_ABIERTAS = """
select id::text as id,
       numero,
       estado,
       notas_internas,
       send_error,
       validez_hasta::text as validez_hasta,
       precio_total_ofertado,
       moneda,
       aprobado_por,
       aprobado_at::text as aprobado_at,
       aprobacion_tipo,
       empresa,
       nombre,
       archived_at::text as archived_at
from public.solicitudes_cotizacion
where archived_at is null
""".strip()


class ConsultaFallida(Exception):
    """La API no entregó filas frescas. El panel previo debe quedar igual."""


class ReplicaError(Exception):
    """El espejo local se escribió y la copia a perfiles Hermes falló."""


def log(mensaje: str) -> None:
    hora = datetime.now(ZONA).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{hora}] {mensaje}", file=sys.stderr)


def marca_no_enviar(texto: object) -> bool:
    plano = unicodedata.normalize("NFD", "" if texto is None else str(texto))
    plano = "".join(ch for ch in plano if unicodedata.category(ch) != "Mn")
    return re.search(r"\bNO[\s._:\-]*ENVIA", plano.upper()) is not None


def es_abierta(fila: dict) -> bool:
    if fila.get("archived_at"):
        return False
    estado = str(fila.get("estado") or "").strip().lower()
    return estado not in ESTADOS_CERRADOS


def total_de(fila: dict) -> float:
    valor = fila.get("precio_total_ofertado")
    if valor is None or valor == "":
        return float("-inf")
    try:
        return float(valor)
    except (TypeError, ValueError):
        return float("-inf")


def cotizaciones_abiertas(filas: list[dict]) -> list[dict]:
    abiertas = [fila for fila in filas if es_abierta(fila)]
    return sorted(
        abiertas,
        key=lambda fila: (-total_de(fila), str(fila.get("numero") or fila.get("id") or "")),
    )


def alertas_de(fila: dict) -> list[str]:
    alertas: list[str] = []
    if marca_no_enviar(fila.get("notas_internas")):
        alertas.append("NO ENVIAR")
    if str(fila.get("send_error") or "").strip():
        alertas.append("send_error")
    return alertas


def etiqueta_aprobacion(fila: dict) -> str:
    por = str(fila.get("aprobado_por") or "").strip()
    cuando = str(fila.get("aprobado_at") or "").strip()
    tipo = str(fila.get("aprobacion_tipo") or "").strip()
    if por and cuando:
        return " · ".join(parte for parte in (tipo, por, cuando) if parte)
    return "PENDIENTE"


def celda(valor: object) -> str:
    texto = "" if valor is None else str(valor)
    return texto.replace("|", "/").replace("\n", " ").strip()


def frontmatter(ahora: datetime) -> str:
    marca = ahora.astimezone(ZONA).isoformat(timespec="seconds")
    return f"---\nupdated: {marca}\nsource: {FUENTE}\n---\n"


def render_principal(filas: list[dict], ahora: datetime, extras: list[str]) -> str:
    abiertas = cotizaciones_abiertas(filas)
    lineas = [
        frontmatter(ahora),
        "# Estado vivo CMS y RFQs",
        "",
        "## 1. Cotizaciones abiertas",
        "",
        "| numero | empresa | estado | total | validez | aprobacion | alertas |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    if not abiertas:
        lineas.append("| | | sin filas abiertas | | | | |")
    for fila in abiertas:
        total = fila.get("precio_total_ofertado")
        moneda = str(fila.get("moneda") or "").strip()
        total_txt = "" if total is None else f"{total} {moneda}".strip()
        lineas.append(
            "| "
            + " | ".join(
                [
                    celda(fila.get("numero") or fila.get("id")),
                    celda(fila.get("empresa") or fila.get("nombre")),
                    celda(fila.get("estado")),
                    celda(total_txt),
                    celda(fila.get("validez_hasta")),
                    celda(etiqueta_aprobacion(fila)),
                    celda(", ".join(alertas_de(fila))),
                ]
            )
            + " |"
        )
    lineas.append("")
    lineas.extend(extras)
    lineas.append("")
    return "\n".join(lineas)


def render_abstract(filas: list[dict], ahora: datetime) -> str:
    abiertas = cotizaciones_abiertas(filas)
    pendientes = sum(1 for fila in abiertas if etiqueta_aprobacion(fila) == "PENDIENTE")
    con_alerta = sum(1 for fila in abiertas if alertas_de(fila))
    return "\n".join(
        [
            frontmatter(ahora),
            "# Abstract",
            "",
            f"Abiertas: {len(abiertas)}",
            f"Pendientes de aprobacion: {pendientes}",
            f"Con alerta: {con_alerta}",
            "",
        ]
    )


def render_overview(filas: list[dict], ahora: datetime) -> str:
    abiertas = cotizaciones_abiertas(filas)
    lineas = [frontmatter(ahora), "# Overview", ""]
    if not abiertas:
        lineas.append("No hay cotizaciones abiertas.")
    for fila in abiertas:
        ref = celda(fila.get("numero") or fila.get("id"))
        lineas.append(
            f"- {ref} · {celda(fila.get('estado'))} · {etiqueta_aprobacion(fila)}"
            f" · {', '.join(alertas_de(fila)) or 'sin alerta'}"
        )
    lineas.append("")
    return "\n".join(lineas)


def seccion_ruta(titulo: str, ruta: str | None, *, modo: str) -> str:
    if not ruta:
        return f"## {titulo}\n\nRuta no configurada.\n"
    path = Path(ruta)
    if not path.exists():
        return f"## {titulo}\n\nFuente ausente.\n"
    momento = datetime.fromtimestamp(path.stat().st_mtime, ZONA).isoformat(timespec="seconds")
    if modo == "lineas" and path.is_file():
        cantidad = sum(1 for _ in path.open(encoding="utf-8", errors="replace"))
        return f"## {titulo}\n\nLineas: {cantidad}. Modificado: {momento}.\n"
    if path.is_dir():
        archivos = [item for item in path.iterdir() if item.is_file()]
        return f"## {titulo}\n\nArchivos: {len(archivos)}. Modificado: {momento}.\n"
    return f"## {titulo}\n\nBytes: {path.stat().st_size}. Modificado: {momento}.\n"


def filas_desde_cuerpo(cuerpo: str) -> list[dict]:
    try:
        dato = json.loads(cuerpo)
    except json.JSONDecodeError as exc:
        raise ConsultaFallida(
            "respuesta no json; el panel no se sobrescribe"
        ) from exc
    if isinstance(dato, list):
        filas = dato
    elif isinstance(dato, dict) and isinstance(dato.get("result"), list):
        filas = dato["result"]
    elif isinstance(dato, dict) and isinstance(dato.get("rows"), list):
        filas = dato["rows"]
    else:
        raise ConsultaFallida("respuesta sin filas; el panel no se sobrescribe")
    if not all(isinstance(fila, dict) for fila in filas):
        raise ConsultaFallida("filas invalidas; el panel no se sobrescribe")
    return filas


def consultar(url: str, token: str, query: str, timeout: float = 30) -> list[dict]:
    peticion = urllib.request.Request(
        url,
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "ime-panel-sync",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
            cuerpo = respuesta.read().decode("utf-8")
            estado = getattr(respuesta, "status", 200)
    except urllib.error.HTTPError as exc:
        raise ConsultaFallida(
            f"supabase management api rechazo la consulta (HTTP {exc.code}); el panel no se sobrescribe"
        ) from exc
    except urllib.error.URLError as exc:
        raise ConsultaFallida(
            f"supabase management api inalcanzable; el panel no se sobrescribe ({exc.reason})"
        ) from exc
    if estado != 200:
        raise ConsultaFallida(
            f"supabase management api rechazo la consulta (HTTP {estado}); el panel no se sobrescribe"
        )
    return filas_desde_cuerpo(cuerpo)


def url_consulta() -> str:
    explicita = os.environ.get("IME_SUPABASE_MGMT_URL", "").strip()
    if explicita:
        return explicita
    ref = os.environ.get("IME_SUPABASE_PROJECT_REF", "").strip() or "nnfbucwiasuggyfoyydo"
    return f"https://api.supabase.com/v1/projects/{ref}/database/query"


def escribir_atomico(documentos: list[tuple[Path, str]]) -> None:
    temporales: list[Path] = []
    try:
        for destino, texto in documentos:
            destino.parent.mkdir(parents=True, exist_ok=True)
            temporal = destino.with_name(f".{destino.name}.{os.getpid()}.tmp")
            temporal.write_text(texto, encoding="utf-8")
            temporales.append(temporal)
        for temporal, (destino, _) in zip(temporales, documentos, strict=True):
            os.replace(temporal, destino)
        temporales.clear()
    finally:
        for temporal in temporales:
            temporal.unlink(missing_ok=True)


def replicar(origenes: list[Path], destinos: list[str]) -> None:
    script = Path(__file__).resolve().parent / "hermes-perfiles-aplicar.sh"
    if not script.is_file():
        raise ReplicaError("falta hermes-perfiles-aplicar.sh")
    for origen in origenes:
        proc = subprocess.run(
            ["bash", str(script), str(origen), *destinos],
            check=False,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            detalle = (proc.stderr or proc.stdout or "").strip()
            raise ReplicaError(f"replica fallo ({proc.returncode}): {detalle}")


def construir(filas: list[dict], ahora: datetime) -> dict[str, str]:
    extras = [
        seccion_ruta("2. Sent log", os.environ.get("IME_SENT_LOG", "").strip() or None, modo="lineas"),
        seccion_ruta("3. Cache CMS", os.environ.get("IME_CMS_CACHE", "").strip() or None, modo="cache"),
    ]
    base = NOMBRE_PANEL
    return {
        base: render_principal(filas, ahora, extras),
        base.replace(".md", ".abstract.md"): render_abstract(filas, ahora),
        base.replace(".md", ".overview.md"): render_overview(filas, ahora),
    }


def run() -> int:
    vault = os.environ.get("IME_VAULT", "").strip()
    if not vault:
        log("falta IME_VAULT")
        return 1
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        log("falta SUPABASE_ACCESS_TOKEN; el panel no se sobrescribe")
        return 2
    try:
        filas = consultar(url_consulta(), token, CONSULTA_ABIERTAS)
        ahora = datetime.now(ZONA)
        documentos = construir(filas, ahora)
        raiz = Path(vault)
        pares = [(raiz / nombre, texto) for nombre, texto in documentos.items()]
        escribir_atomico(pares)
        destinos = [parte for parte in os.environ.get("IME_HERMES_PROFILES", "").split(":") if parte]
        if destinos:
            replicar([ruta for ruta, _ in pares], destinos)
    except ConsultaFallida as exc:
        log(str(exc))
        return 2
    except ReplicaError as exc:
        log(str(exc))
        return 3
    except Exception as exc:
        log(f"excepcion: {type(exc).__name__}: {exc}")
        return 1
    log("panel actualizado")
    return 0


if __name__ == "__main__":
    sys.exit(run())
