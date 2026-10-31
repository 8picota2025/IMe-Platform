"""Decisiones y cola local. No sustituye a Supabase ni al tablón."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from registro import marca


ESQUEMA = """
create table if not exists decisiones (
  tarjeta_id text primary key,
  tablero text not null,
  decision text not null,
  usuario text not null,
  decidido_at text not null,
  titulo text,
  origen text,
  bot_dueno text,
  cotizacion_id text,
  encolado_estado text not null default 'pendiente',
  encolado_error text,
  actualizado_at text not null
);
create table if not exists cola (
  id integer primary key autoincrement,
  tarjeta_id text not null,
  decision text not null,
  payload text not null,
  estado text not null,
  creado_at text not null,
  error text
);
"""


class Almacen:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._con = sqlite3.connect(path)
        self._con.row_factory = sqlite3.Row
        self._con.executescript(ESQUEMA)

    def close(self) -> None:
        self._con.close()

    def decision(self, tarjeta_id: str) -> dict | None:
        fila = self._con.execute(
            "select * from decisiones where tarjeta_id = ?", (tarjeta_id,)
        ).fetchone()
        return dict(fila) if fila else None

    def decisiones(self) -> dict[str, dict]:
        filas = self._con.execute("select * from decisiones").fetchall()
        return {fila["tarjeta_id"]: dict(fila) for fila in filas}

    def guardar_decision(self, datos: dict) -> dict:
        previa = self.decision(datos["tarjeta_id"])
        ahora = marca()
        decidido = previa["decidido_at"] if previa else ahora
        usuario = previa["usuario"] if previa and previa["decision"] == datos["decision"] else datos["usuario"]
        if previa and previa["decision"] != datos["decision"]:
            decidido = ahora
            usuario = datos["usuario"]
        self._con.execute(
            """
            insert into decisiones (
              tarjeta_id, tablero, decision, usuario, decidido_at, titulo, origen,
              bot_dueno, cotizacion_id, encolado_estado, encolado_error, actualizado_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(tarjeta_id) do update set
              tablero = excluded.tablero,
              decision = excluded.decision,
              usuario = excluded.usuario,
              decidido_at = excluded.decidido_at,
              titulo = excluded.titulo,
              origen = excluded.origen,
              bot_dueno = excluded.bot_dueno,
              cotizacion_id = excluded.cotizacion_id,
              encolado_estado = excluded.encolado_estado,
              encolado_error = excluded.encolado_error,
              actualizado_at = excluded.actualizado_at
            """,
            (
                datos["tarjeta_id"],
                datos["tablero"],
                datos["decision"],
                usuario,
                decidido,
                datos.get("titulo"),
                datos.get("origen"),
                datos.get("bot_dueno"),
                datos.get("cotizacion_id"),
                datos.get("encolado_estado", "pendiente"),
                datos.get("encolado_error"),
                ahora,
            ),
        )
        self._con.commit()
        guardada = self.decision(datos["tarjeta_id"])
        if guardada is None:
            raise RuntimeError("la decision no quedo escrita")
        return guardada

    def encolar(self, tarjeta_id: str, decision: str, payload: dict) -> int:
        cursor = self._con.execute(
            """
            insert into cola (tarjeta_id, decision, payload, estado, creado_at)
            values (?, ?, ?, 'pendiente', ?)
            """,
            (tarjeta_id, decision, json.dumps(payload, ensure_ascii=False), marca()),
        )
        self._con.commit()
        return int(cursor.lastrowid)

    def cerrar_cola(self, cola_id: int, estado: str, error: str | None = None) -> None:
        self._con.execute(
            "update cola set estado = ?, error = ? where id = ?",
            (estado, error, cola_id),
        )
        self._con.commit()
