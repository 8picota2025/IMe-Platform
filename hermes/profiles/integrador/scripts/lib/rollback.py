"""Los tres pasos de vuelta atrás, solo en un árbol de ensayo."""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .contexto import afirmar_ensayo

COT = ZoneInfo("America/Bogota")


def rollback(raiz: Path, ahora: datetime | None = None) -> dict[str, str]:
    afirmar_ensayo(raiz)
    momento = ahora or datetime.now(COT)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=COT)
    sello = momento.astimezone(COT).strftime("%Y%m%d")
    perfil = raiz / "profiles" / "integrador"
    if not perfil.is_dir():
        raise FileNotFoundError("no está el perfil de ensayo")
    bots = raiz / "tablon" / "bots.txt"
    despertador = raiz / "tablon" / "despertador.sh"
    crontab = raiz / "crontab.txt"
    for origen in (bots, despertador, crontab):
        if not origen.is_file():
            raise FileNotFoundError(f"falta {origen.name} para respaldar")
        copia = origen.with_name(f"{origen.name}.bak-{sello}")
        shutil.copy2(origen, copia)
    jobs_path = perfil / "cron" / "jobs.json"
    dato = json.loads(jobs_path.read_text(encoding="utf-8"))
    jobs = dato["jobs"] if isinstance(dato, dict) else dato
    if not isinstance(jobs, list):
        raise ValueError("jobs.json de ensayo sin lista")
    for job in jobs:
        if isinstance(job, dict):
            job["enabled"] = False
            job["state"] = "paused"
    jobs_path.write_text(json.dumps({"jobs": jobs}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lineas = [
        linea
        for linea in bots.read_text(encoding="utf-8").splitlines()
        if linea.strip() != "integrador"
    ]
    bots.write_text("\n".join(lineas) + ("\n" if lineas else ""), encoding="utf-8")
    destino = perfil.with_name("integrador.disabled")
    if destino.exists():
        raise FileExistsError("integrador.disabled ya existe")
    perfil.rename(destino)
    return {"sello": sello, "perfil": str(destino)}
