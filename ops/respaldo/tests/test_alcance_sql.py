"""Alcance de tokens IMEia sobre un Postgres 16 desechable. No toca Supabase."""

from __future__ import annotations

import atexit
import os
import shutil
import socket
import subprocess
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
TESTS = Path(__file__).resolve().parent
MIGRACIONES = RAIZ / "supabase" / "migrations"
BIN = Path(os.environ.get("PG16_BIN", "/usr/lib/postgresql/16/bin"))
CLUSTER: dict[str, str] = {}


def _ejecutar(cmd: list[str]) -> None:
    run = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if run.returncode != 0:
        raise AssertionError(f"{cmd[0]} fallo ({run.returncode})\n{run.stdout}\n{run.stderr}")


def _puerto_libre() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _parar() -> None:
    datadir = CLUSTER.get("datadir")
    if not datadir:
        return
    pg_ctl = BIN / "pg_ctl"
    if pg_ctl.exists():
        subprocess.run([str(pg_ctl), "-D", datadir, "-m", "immediate", "stop"], check=False, capture_output=True)
    shutil.rmtree(datadir, ignore_errors=True)
    socket_dir = CLUSTER.get("socket")
    if socket_dir:
        shutil.rmtree(socket_dir, ignore_errors=True)
    CLUSTER.clear()


atexit.register(_parar)


def _psql(*args: str, sql: str | None = None, archivo: Path | None = None) -> str:
    cmd = [
        str(BIN / "psql"),
        "-h",
        CLUSTER["socket"],
        "-p",
        CLUSTER["port"],
        "-U",
        "postgres",
        "-d",
        "alcance",
        "-v",
        "ON_ERROR_STOP=1",
        "-X",
    ]
    cmd.extend(args)
    if archivo is not None:
        cmd.extend(["--single-transaction", "-f", str(archivo)])
    elif sql is not None:
        cmd.extend(["-At", "-c", sql])
    else:
        cmd.extend(["--single-transaction", "-f", "-"])
    run = subprocess.run(cmd, input=None if archivo or sql else None, text=True, capture_output=True, check=False)
    if run.returncode != 0:
        raise AssertionError(f"psql fallo ({run.returncode})\n{run.stdout}\n{run.stderr}")
    return run.stdout


def _aplicar(path: Path) -> None:
    _psql(archivo=path)


def _aplicar_sql(sql: str) -> None:
    cmd = [
        str(BIN / "psql"),
        "-h",
        CLUSTER["socket"],
        "-p",
        CLUSTER["port"],
        "-U",
        "postgres",
        "-d",
        "alcance",
        "-v",
        "ON_ERROR_STOP=1",
        "-X",
        "--single-transaction",
        "-f",
        "-",
    ]
    run = subprocess.run(cmd, input=sql, text=True, capture_output=True, check=False)
    if run.returncode != 0:
        raise AssertionError(f"psql fallo ({run.returncode})\n{run.stdout}\n{run.stderr}")


def _extraer_rollback(sql: str) -> str:
    lines = sql.splitlines()
    start = lines.index("-- ROLLBACK_BEGIN")
    end = lines.index("-- ROLLBACK_END")
    out: list[str] = []
    for line in lines[start + 1 : end]:
        if line.startswith("-- "):
            out.append(line[3:])
        elif line == "--":
            out.append("")
        else:
            raise AssertionError(f"linea de rollback sin prefijo: {line}")
    return "\n".join(out) + "\n"


class AlcanceSql(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not (BIN / "initdb").exists():
            raise AssertionError(f"no esta Postgres 16 en {BIN}")
        datadir = tempfile.mkdtemp(prefix="pg16-alcance-")
        port = str(_puerto_libre())
        socket_dir = tempfile.mkdtemp(prefix="pg16-socket-")
        _ejecutar([str(BIN / "initdb"), "-D", datadir, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C.UTF-8"])
        CLUSTER["datadir"] = datadir
        CLUSTER["port"] = port
        CLUSTER["socket"] = socket_dir
        _ejecutar(
            [str(BIN / "pg_ctl"), "-D", datadir, "-l", str(Path(datadir) / "server.log"), "-w", "start", "-o", f"-p {port} -k {socket_dir} -c listen_addresses="]
        )
        _ejecutar([str(BIN / "createdb"), "-h", socket_dir, "-p", port, "-U", "postgres", "alcance"])

    @classmethod
    def tearDownClass(cls) -> None:
        _parar()

    def test_alcance_worker_lectura_latido_y_rollback(self) -> None:
        migracion = MIGRACIONES / "20261031230000_imeia_worker_token_alcance.sql"
        self.assertTrue(migracion.is_file())
        _aplicar(TESTS / "alcance_fixture.sql")
        _aplicar(MIGRACIONES / "20261030150000_imeia_failover_hermes.sql")
        _aplicar(MIGRACIONES / "20261031190000_imeia_respaldo_latido_manual.sql")
        _aplicar_sql(
            "insert into public.imeia_worker_tokens (nombre, token_sha256) "
            "values ('legacy', encode(extensions.digest('token-legacy-prueba-alcance-0001','sha256'),'hex'));"
        )
        ruta_antes = _psql(
            sql=(
                "select coalesce(target,'') || '|' || coalesce(motivo,'') || '|' || "
                "coalesce(hold_until::text,'') || '|' || since::text || '|' || updated_at::text "
                "|| '|' || (select count(*)::text from public.imeia_failover_log) "
                "from public.imeia_routing where id;"
            )
        ).strip()
        _aplicar(migracion)
        ruta_despues = _psql(
            sql=(
                "select coalesce(target,'') || '|' || coalesce(motivo,'') || '|' || "
                "coalesce(hold_until::text,'') || '|' || since::text || '|' || updated_at::text "
                "|| '|' || (select count(*)::text from public.imeia_failover_log) "
                "from public.imeia_routing where id;"
            )
        ).strip()
        self.assertEqual(ruta_antes, ruta_despues)
        self.assertEqual(_psql(sql="select alcance from public.imeia_worker_tokens where nombre = 'legacy';").strip(), "worker")
        _aplicar(TESTS / "alcance_comprobar.sql")
        antes = _psql(sql="select nombre || '=' || alcance from public.imeia_worker_tokens order by nombre;").strip()
        _aplicar(migracion)
        despues = _psql(sql="select nombre || '=' || alcance from public.imeia_worker_tokens order by nombre;").strip()
        self.assertEqual(antes, despues)
        self.assertIn("lectura=respaldo_lectura", despues.splitlines())
        self.assertIn("latido=respaldo_latido", despues.splitlines())
        self.assertIn("legacy=worker", despues.splitlines())
        _aplicar_sql(_extraer_rollback(migracion.read_text()))
        _aplicar(TESTS / "alcance_rollback_comprobar.sql")


if __name__ == "__main__":
    unittest.main()
