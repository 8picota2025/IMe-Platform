"""Árbol de ensayo. No apunta a /home/shoky."""

from __future__ import annotations

import hashlib
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PERFIL_REPO = RAIZ / "profiles" / "integrador"
SCRIPTS = PERFIL_REPO / "scripts"
sys.path.insert(0, str(SCRIPTS))

from lib.contexto import cargar  # noqa: E402
from lib.contexto import Contexto  # noqa: E402


def copiar_perfil(tmp: Path) -> Path:
    destino = tmp / "profiles" / "integrador"
    shutil.copytree(PERFIL_REPO / "cron", destino / "cron")
    shutil.copy2(PERFIL_REPO / ".env.example", destino / ".env.example")
    return destino


def mundo(tmp: Path) -> dict[str, Path]:
    perfil = copiar_perfil(tmp)
    tablon = tmp / "tablon"
    (tablon / "entrada").mkdir(parents=True)
    (tablon / "bots.txt").write_text("enlace\nintegrador\n", encoding="utf-8")
    (tablon / "despertador.sh").write_text("#!/bin/sh\n# despertador de ensayo\n", encoding="utf-8")
    estado = tmp / "estado"
    estado.mkdir()
    modo = estado / "modo.json"
    modo.write_text('{"modo": "normal"}\n', encoding="utf-8")
    latido = estado / "latido-grokbot.json"
    latido.write_text(
        '{"ultimo_ok": "2026-10-31T18:00:00-05:00", "fallos_seguidos": 0, "disponible": true}\n',
        encoding="utf-8",
    )
    (tmp / "crontab.txt").write_text("*/5 /bin/true # despertador\n", encoding="utf-8")
    (tmp / "supabase.sql").write_text("-- no tocar\n", encoding="utf-8")
    (tmp / "n8n.json").write_text('{"id": "webhook-vivo-123"}\n', encoding="utf-8")
    enlace = tmp / "profiles" / "enlace"
    enlace.mkdir()
    (enlace / "SOUL.md").write_text("enlace\n", encoding="utf-8")
    (tmp / "webhook-id.txt").write_text("webhook-vivo-123\n", encoding="utf-8")
    (tmp / "ENTORNO-DE-PRUEBA").write_text("ensayo\n", encoding="utf-8")
    return {
        "tmp": tmp,
        "perfil": perfil,
        "logs": tmp / "logs",
        "tablon": tablon,
        "modo": modo,
        "latido": latido,
    }


def contexto(datos: dict[str, Path]) -> Contexto:
    tmp = datos["tmp"]
    return cargar(
        perfil=datos["perfil"],
        logs=datos["logs"],
        tablon=datos["tablon"],
        modo_json=datos["modo"],
        latido=datos["latido"],
        cola=tmp / "cola-que-no-existe",
        franja_log=tmp / "franja-que-no-existe",
        panel_log=tmp / "panel-que-no-existe",
    )


def huella(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def orden(**cambios: object) -> dict[str, object]:
    base: dict[str, object] = {
        "id": "ORDEN-PRUEBA-1",
        "para": "integrador",
        "tarea": "tablon",
        "fuente": "grok",
        "autorizado_por": "Shoky",
        "cita": "integrador se puede trasladar entero a hermes aunque las órdenes salgan de grok",
        "texto": "orden de prueba",
    }
    base.update(cambios)
    return base
