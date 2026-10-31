"""La cola de correo ya no sale por SMTP. Cada ítem queda como solicitud a Emilio."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import ime_log
import solicitud_emilio

log = ime_log.get_logger("enviar-cola")


def procesar(ruta: Path) -> int:
    if not ruta.is_file():
        log.error("accion=enviar_cola objetivo=%s resultado=ausente", ruta)
        return 1
    errores = 0
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if not linea.strip():
            continue
        try:
            item = json.loads(linea)
        except json.JSONDecodeError:
            log.exception("accion=enviar_cola resultado=json_invalido")
            errores += 1
            continue
        try:
            solicitud_emilio.solicitar(
                plantilla=str(item.get("plantilla") or ""),
                destinatario=str(item.get("destinatario") or ""),
                aprobacion=str(item.get("aprobacion") or ""),
                solicitante=str(item.get("solicitante") or "enviar-cola"),
                asunto=str(item.get("asunto") or ""),
                cuerpo=str(item.get("cuerpo") or ""),
            )
        except Exception:
            log.exception("accion=enviar_cola resultado=fallo")
            errores += 1
    return 1 if errores else 0


def main() -> int:
    crudo = sys.argv[1] if len(sys.argv) > 1 else ""
    if not crudo:
        log.error("accion=enviar_cola resultado=sin_ruta")
        return 1
    try:
        return procesar(Path(crudo))
    except Exception:
        log.exception("accion=enviar_cola resultado=error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
