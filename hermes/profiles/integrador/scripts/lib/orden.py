"""Atiende una orden del tablón. En sombra solo registra."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .avisos import aviso_interno
from .bitacora import configurar
from .candado import candado_tarea
from .comparador import comparar
from .contexto import Contexto
from .decisiones import anexar, ids_registrados, marcar_tiempo
from .modo import ahora_cot, modo_efectivo
from .vigilancia import guardar_informe, informe

TAREAS_CONOCIDAS = {"reenvio", "tablon", "vigilancia", "comparador", "caducidades", "search-console"}


def perfil_despierto(ctx: Contexto) -> bool:
    if not ctx.perfil.is_dir() or ctx.perfil.name != "integrador":
        return False
    bots = ctx.tablon / "bots.txt"
    if not bots.is_file():
        return False
    nombres = {
        linea.strip()
        for linea in bots.read_text(encoding="utf-8").splitlines()
        if linea.strip() and not linea.strip().startswith("#")
    }
    return "integrador" in nombres


def procesar_orden(ctx: Contexto, orden: dict[str, Any], ahora: datetime | None = None) -> str:
    log = configurar(ctx)
    if orden.get("para") != "integrador":
        log.info("orden ajena, no se registra")
        return "ajena"
    if not perfil_despierto(ctx):
        log.info("perfil apagado o fuera de bots.txt, no se despierta")
        return "apagado"
    orden_id = orden.get("id")
    if not isinstance(orden_id, str) or not orden_id.strip():
        raise ValueError("la orden no trae id")
    tarea = orden.get("tarea") if isinstance(orden.get("tarea"), str) else "tablon"
    if tarea not in TAREAS_CONOCIDAS:
        tarea = "tablon"
    momento = ahora or ahora_cot()
    with candado_tarea(ctx, tarea):
        with candado_tarea(ctx, "idempotencia"):
            if orden_id in ids_registrados(ctx):
                log.info("orden %s ya registrada", orden_id)
                return "duplicada"
            modo = modo_efectivo(ctx, momento)
            accion, esperado = _plan(ctx, orden, tarea, modo, momento)
            if modo == "activo":
                aviso = aviso_interno(str(orden.get("texto") or ""), modo)
                if aviso.get("enviado") is True:
                    raise RuntimeError("el perfil intentó emitir")
                _publicar_salida(ctx, orden_id, accion, esperado)
                log.info("modo activo: sin emisión; salida local del tablón")
            else:
                log.info("modo sombra: orden %s registrada sin efectos", orden_id)
            anexar(
                ctx,
                {
                    "ts": marcar_tiempo(momento),
                    "orden": orden_id,
                    "fuente": str(orden.get("fuente") or "tablon"),
                    "accion": accion,
                    "resultado_esperado": esperado,
                    "modo": modo,
                    "tarea": tarea,
                },
            )
    return "registrada"


def barrer_eventos(ctx: Contexto, tarea: str | None = None, ahora: datetime | None = None) -> list[str]:
    """Lee tablon/eventos/*.json. La carpeta entrada/ no es el tablón vivo."""
    log = configurar(ctx)
    resultados: list[str] = []
    for path in _eventos(ctx):
        try:
            bruto = _leer_orden(path)
        except (OSError, ValueError) as exc:
            log.warning("evento ilegible %s: %s", path.name, type(exc).__name__)
            resultados.append("ilegible")
            continue
        orden = normalizar_evento(bruto, path)
        if tarea is not None and orden.get("tarea") not in {tarea, None}:
            continue
        resultados.append(procesar_orden(ctx, orden, ahora))
    return resultados


def rutina_reenvio(ctx: Contexto, ahora: datetime | None = None) -> list[str]:
    if _cron_en_sombra(ctx, ahora):
        return []
    resultados = barrer_eventos(ctx, "reenvio", ahora)
    momento = ahora or ahora_cot()
    dia = momento.strftime("%Y%m%d")
    resumen = {
        "id": f"reenvio-{dia}",
        "para": "integrador",
        "tarea": "reenvio",
        "fuente": "cron",
        "texto": _resumen_cola(ctx),
    }
    resultados.append(procesar_orden(ctx, resumen, momento))
    comparar(ctx, momento)
    comparacion = {
        "id": f"comparador-{dia}",
        "para": "integrador",
        "tarea": "comparador",
        "fuente": "cron",
        "texto": f"comparacion-{dia}.md",
    }
    resultados.append(procesar_orden(ctx, comparacion, momento))
    return resultados


def rutina_vigilancia(ctx: Contexto, ahora: datetime | None = None) -> str:
    if _cron_en_sombra(ctx, ahora):
        return "no_lanzada"
    momento = ahora or ahora_cot()
    texto = informe(ctx, ahora=momento)
    guardar_informe(ctx, texto, momento)
    orden = {
        "id": f"vigilancia-{momento.strftime('%Y%m%d')}",
        "para": "integrador",
        "tarea": "vigilancia",
        "fuente": "cron",
        "texto": texto,
    }
    return procesar_orden(ctx, orden, momento)


def rutina_comparador(ctx: Contexto, ahora: datetime | None = None) -> str:
    if _cron_en_sombra(ctx, ahora):
        return "no_lanzada"
    momento = ahora or ahora_cot()
    destino = comparar(ctx, momento)
    orden = {
        "id": f"comparador-{momento.strftime('%Y%m%d')}",
        "para": "integrador",
        "tarea": "comparador",
        "fuente": "cron",
        "texto": destino.name,
    }
    return procesar_orden(ctx, orden, momento)


def _plan(
    ctx: Contexto,
    orden: dict[str, Any],
    tarea: str,
    modo: str,
    momento: datetime,
) -> tuple[str, str]:
    if tarea == "reenvio":
        return (
            "Observaría la cola de reenvío y no reenviaría nada.",
            _resumen_cola(ctx),
        )
    if tarea == "vigilancia":
        return (
            "Publicaría el informe resumido en el tablón.",
            "informe de vigilancia del día, sin escrituras fuera del registro",
        )
    if tarea == "comparador":
        return (
            "Escribiría la comparación diaria con lo reportado por Grok.",
            f"comparacion-{momento.strftime('%Y%m%d')}.md",
        )
    if tarea in {"caducidades", "search-console"}:
        return ("No ejecutaría el job: está apagado.", "enabled false")
    texto = str(orden.get("texto") or "").strip()
    accion = "Registraría la orden del tablón y no ejecutaría efectos."
    if modo == "activo":
        accion = "Atendería la orden en modo activo sin emitir ni escribir en Twenty."
    return accion, texto or "sin texto"


def _resumen_cola(ctx: Contexto) -> str:
    if not ctx.cola.exists():
        return "cola ausente, no se crea"
    if ctx.cola.is_file():
        return "cola presente como archivo, no se modifica"
    nombres = sorted(item.name for item in ctx.cola.iterdir() if not item.name.startswith("."))
    return f"{len(nombres)} entradas en la cola, no se mueven"


def _publicar_salida(ctx: Contexto, orden_id: str, accion: str, esperado: str) -> None:
    from .candado import sanear
    from .contexto import afirmar_escritura

    destino_dir = ctx.tablon / "salida"
    afirmar_escritura(ctx, destino_dir / "aviso.json")
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / f"{sanear(orden_id)}.json"
    afirmar_escritura(ctx, destino)
    destino.write_text(
        json.dumps(
            {"orden": orden_id, "accion": accion, "resultado_esperado": esperado, "emitido": False},
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def _cron_en_sombra(ctx: Contexto, ahora: datetime | None) -> bool:
    """El reloj no corre en sombra. El despertador sí puede barrer eventos."""
    if modo_efectivo(ctx, ahora) != "sombra":
        return False
    configurar(ctx).info("cron no se lanza en sombra")
    return True


def normalizar_evento(bruto: dict[str, Any], path: Path) -> dict[str, Any]:
    crudo_id = bruto.get("id") if isinstance(bruto.get("id"), str) else bruto.get("orden")
    if not isinstance(crudo_id, str) or not crudo_id.strip():
        crudo_id = path.stem
    para = bruto.get("para", bruto.get("destinatario"))
    if isinstance(para, list):
        textos = [str(item) for item in para]
        para = "integrador" if "integrador" in textos else ""
    elif not isinstance(para, str):
        para = ""
    texto = bruto.get("texto", bruto.get("mensaje", bruto.get("cuerpo", "")))
    if not isinstance(texto, str):
        texto = json.dumps(texto, ensure_ascii=False)
    fuente = bruto.get("fuente", bruto.get("de", bruto.get("origen", "tablon")))
    if not isinstance(fuente, str) or not fuente.strip():
        fuente = "tablon"
    tarea = bruto.get("tarea")
    if not isinstance(tarea, str) or not tarea.strip():
        tarea = "tablon"
    autorizado = bruto.get("autorizado_por")
    cita = bruto.get("cita")
    return {
        "id": crudo_id.strip(),
        "para": para.strip(),
        "tarea": tarea.strip(),
        "fuente": fuente.strip(),
        "texto": texto,
        "autorizado_por": autorizado if isinstance(autorizado, str) else "",
        "cita": cita if isinstance(cita, str) else "",
    }


def _eventos(ctx: Contexto) -> list[Path]:
    carpeta = ctx.tablon / "eventos"
    if not carpeta.is_dir():
        return []
    return sorted(path for path in carpeta.glob("*.json") if path.is_file() and not path.name.startswith("."))


def _leer_orden(path: Path) -> dict[str, Any]:
    try:
        dato = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"orden ilegible: {path.name}") from exc
    if not isinstance(dato, dict):
        raise ValueError(f"orden no es un objeto: {path.name}")
    return dato
