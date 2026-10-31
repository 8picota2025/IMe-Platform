"""Lee cron/jobs.json. No lo reescribe salvo el rollback de ensayo."""

from __future__ import annotations

import json
from pathlib import Path


def cargar_jobs(perfil: Path) -> list[dict[str, object]]:
    path = perfil / "cron" / "jobs.json"
    dato = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(dato, dict):
        jobs = dato.get("jobs", [])
    elif isinstance(dato, list):
        jobs = dato
    else:
        raise ValueError("jobs.json no tiene lista de jobs")
    if not isinstance(jobs, list):
        raise ValueError("jobs.json no tiene lista de jobs")
    return [job for job in jobs if isinstance(job, dict)]


def job_de(jobs: list[dict[str, object]], tarea: str) -> dict[str, object] | None:
    for job in jobs:
        if job.get("id") == tarea:
            return job
    return None


def job_habilitado(job: dict[str, object] | None) -> bool:
    if job is None:
        return False
    return job.get("enabled") is True


def jobs_lanzables(jobs: list[dict[str, object]]) -> list[dict[str, object]]:
    """Los que el scheduler de Hermes dispararía al cargar el perfil.

    El scheduler obedece `enabled`. `state: paused` cubre un lector que
    mire el estado y no la bandera.
    """
    return [
        job
        for job in jobs
        if job.get("enabled") is True and job.get("state") != "paused"
    ]
