"""Respaldo Grok → Hermes.

El detector lee ficheros locales. Grok no necesita SSH: escribe en Supabase y
`volcar.py` copia el resultado a `latido-grokbot.json`. Este módulo no arranca
servicios ni envía correo; la alerta queda en `alertas.jsonl` y en la auditoría.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

MANUAL_HORAS_DEFECTO = 4.0
MANUAL_HORAS_MAX = 72.0
LATIDO_MAX_S = 900
ORIGENES_MANUAL = frozenset({"grok-tablon", "hermes", "telegram", "cli"})
ORIGENES_LATIDO = ORIGENES_MANUAL | frozenset({"emilio", "rutina"})
ESTADOS_LATIDO = frozenset({"ok", "fallo", "sin_tokens"})
MODOS = frozenset({"normal", "respaldo"})

_COMANDO = re.compile(
    r"^\s*RESPALDO(?:\s+(ON|OFF|ESTADO)(?:\s+([0-9]+(?:[.,][0-9]+)?)H?)?)?\s*$",
    re.IGNORECASE,
)


class OrigenInvalido(ValueError):
    """El origen no está en la lista cerrada de ese acto."""


class Rutas:
    def __init__(self, raiz: Path | str) -> None:
        self.raiz = Path(raiz)

    @property
    def modo(self) -> Path:
        return self.raiz / "modo.json"

    @property
    def manual(self) -> Path:
        return self.raiz / "modo-respaldo.manual"

    @property
    def latido(self) -> Path:
        return self.raiz / "latido-grokbot.json"

    @property
    def auditoria(self) -> Path:
        return self.raiz / "auditoria.jsonl"

    @property
    def alertas(self) -> Path:
        return self.raiz / "alertas.jsonl"

    @property
    def historial(self) -> Path:
        return self.raiz / "historial.log"

    @property
    def ultimo(self) -> Path:
        return self.raiz / "detector-ultimo.json"

    @property
    def outbox(self) -> Path:
        return self.raiz / "outbox.jsonl"


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str) -> datetime:
    texto = value.strip()
    if texto.endswith("Z"):
        texto = texto[:-1] + "+00:00"
    parsed = datetime.fromisoformat(texto)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_comando(texto: str) -> dict | None:
    """Devuelve {accion, horas} o None si el texto no es un comando RESPALDO."""
    if not re.match(r"\s*RESPALDO\b", texto, re.IGNORECASE):
        return None
    match = _COMANDO.fullmatch(texto)
    if not match or match.group(1) is None:
        raise ValueError("comando RESPALDO invalido")
    accion = match.group(1).lower()
    horas_txt = match.group(2)
    if horas_txt is not None and accion != "on":
        raise ValueError("las horas solo valen en RESPALDO ON")
    horas: float | None = None
    if horas_txt is not None:
        horas = float(horas_txt.replace(",", "."))
        if horas <= 0 or horas > MANUAL_HORAS_MAX:
            raise ValueError("horas fuera de rango")
    return {"accion": accion, "horas": horas}


def resolver_raiz(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit)
    if os.environ.get("HERMES_ESTADO_DIR"):
        return Path(os.environ["HERMES_ESTADO_DIR"])
    home = os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))
    return Path(home) / "estado"


def _leer_json(path: Path) -> object | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _escribir_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporal = path.with_name(path.name + ".tmp")
    temporal.write_text(json.dumps(obj, ensure_ascii=False) + "\n", encoding="utf-8")
    os.chmod(temporal, 0o600)
    os.replace(temporal, path)


def _append_jsonl(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(obj, ensure_ascii=False) + "\n")
    os.chmod(path, 0o600)


def _auditar(rutas: Rutas, *, utc: datetime, quien: str, accion: str, origen: str, motivo: str) -> dict:
    linea = {
        "utc": iso(utc),
        "quien": quien,
        "accion": accion,
        "origen": origen,
        "motivo": motivo,
    }
    _append_jsonl(rutas.auditoria, linea)
    return linea


def _historial(rutas: Rutas, *, utc: datetime, modo: str, motivo: str, quien: str, origen: str) -> None:
    rutas.raiz.mkdir(parents=True, exist_ok=True)
    with rutas.historial.open("a", encoding="utf-8") as handle:
        handle.write(f"{iso(utc)} {modo} {motivo} quien={quien} origen={origen}\n")


def _exigir_quien(quien: str) -> str:
    limpio = quien.strip()
    if not limpio:
        raise ValueError("quien requerido")
    return limpio[:200]


def _exigir_origen(origen: str, permitidos: frozenset[str]) -> str:
    if origen not in permitidos:
        raise OrigenInvalido(f"origen invalido: {origen}")
    return origen


def _leer_modo(rutas: Rutas) -> dict | None:
    data = _leer_json(rutas.modo)
    if isinstance(data, dict) and data.get("modo") in MODOS:
        return data
    return None


def _clasificar_manual(rutas: Rutas, now: datetime) -> dict:
    if not rutas.manual.exists():
        return {"clase": "ausente"}
    data = _leer_json(rutas.manual)
    if not isinstance(data, dict) or "expires_at" not in data:
        return {"clase": "legado"}
    try:
        expira = parse_iso(str(data["expires_at"]))
        desde = parse_iso(str(data["desde_utc"])) if data.get("desde_utc") else None
    except (TypeError, ValueError):
        return {"clase": "legado"}
    clase = "caducado" if expira <= now else "vigente"
    return {"clase": clase, "data": data, "expires_at": expira, "desde": desde}


def _clasificar_latido(rutas: Rutas, now: datetime, latido_max_s: int) -> dict:
    data = _leer_json(rutas.latido)
    if not isinstance(data, dict):
        return {"clase": "ausente"}
    estado = data.get("estado")
    if estado not in ESTADOS_LATIDO or not data.get("utc"):
        return {"clase": "ausente"}
    try:
        marca = parse_iso(str(data["utc"]))
    except (TypeError, ValueError):
        return {"clase": "ausente"}
    if (now - marca).total_seconds() > latido_max_s:
        return {"clase": "caducado", "data": data}
    return {"clase": str(estado), "data": data}


def _alertas_previas(rutas: Rutas) -> set[str]:
    data = _leer_json(rutas.ultimo)
    if isinstance(data, dict) and isinstance(data.get("alertas"), list):
        return {str(item) for item in data["alertas"]}
    return set()


def evaluar(rutas: Rutas, now: datetime, *, latido_max_s: int = LATIDO_MAX_S) -> dict:
    modo = _leer_modo(rutas)
    manual = _clasificar_manual(rutas, now)
    latido = _clasificar_latido(rutas, now, latido_max_s)
    manual_efectivo = "ausente" if manual["clase"] == "caducado" else manual["clase"]

    alertas: list[str] = []
    if latido["clase"] == "ausente":
        alertas.append("sin_latido")
    elif latido["clase"] == "caducado":
        alertas.append("latido_caducado")
    elif latido["clase"] in {"fallo", "sin_tokens"}:
        alertas.append(f"latido_{latido['clase']}")
    if manual_efectivo == "legado":
        alertas.append("manual_sin_caducidad")

    if manual_efectivo == "vigente":
        datos = manual["data"]
        motivo = "manual"
        destino = "respaldo"
        quien = str(datos.get("quien") or "sin_quien")
        origen_manual = str(datos.get("origen") or "")
        origen = origen_manual if origen_manual in ORIGENES_MANUAL else "hermes"
    elif manual_efectivo == "legado":
        motivo = "manual_legado"
        destino = "respaldo"
        quien = "detector"
        origen = "hermes"
    elif latido["clase"] == "ok":
        motivo = "latido_ok"
        destino = "normal"
        quien = "detector"
        origen = "hermes"
    elif latido["clase"] == "ausente":
        motivo = "sin_latido"
        destino = "respaldo"
        quien = "detector"
        origen = "hermes"
    elif latido["clase"] == "caducado":
        motivo = "latido_caducado"
        destino = "respaldo"
        quien = "detector"
        origen = "hermes"
    elif latido["clase"] == "fallo":
        motivo = "latido_fallo"
        destino = "respaldo"
        quien = "detector"
        origen = "hermes"
    else:
        motivo = "latido_sin_tokens"
        destino = "respaldo"
        quien = "detector"
        origen = "hermes"

    modo_antes = str(modo["modo"]) if modo else None
    motivo_antes = str(modo.get("motivo")) if modo and modo.get("motivo") else None
    previas = _alertas_previas(rutas)
    return {
        "modo_antes": modo_antes,
        "modo_despues": destino,
        "motivo": motivo,
        "latido": latido["clase"],
        "manual": manual["clase"],
        "alertas": alertas,
        "alertas_nuevas": [codigo for codigo in alertas if codigo not in previas],
        "cambia_modo": modo_antes != destino or motivo_antes != motivo,
        "borra_manual": manual["clase"] == "caducado",
        "estado_inicial": modo is None,
        "quien": quien,
        "origen": origen,
    }


def _fijar_modo(
    rutas: Rutas,
    *,
    modo: str,
    motivo: str,
    quien: str,
    origen: str,
    now: datetime,
    estado_inicial: bool,
) -> None:
    cuerpo: dict = {
        "modo": modo,
        "motivo": motivo,
        "quien": quien,
        "origen": origen,
        "desde_utc": iso(now),
    }
    if estado_inicial:
        cuerpo["estado_inicial"] = True
    _escribir_json(rutas.modo, cuerpo)
    _historial(rutas, utc=now, modo=modo, motivo=motivo, quien=quien, origen=origen)


def detector_ciclo(
    rutas: Rutas,
    now: datetime,
    *,
    dry_run: bool,
    latido_max_s: int = LATIDO_MAX_S,
) -> dict:
    decision = evaluar(rutas, now, latido_max_s=latido_max_s)
    decision["dry_run"] = dry_run
    if dry_run:
        return decision
    if decision["borra_manual"]:
        rutas.manual.unlink(missing_ok=True)
        _auditar(
            rutas,
            utc=now,
            quien="detector",
            accion="manual_expirado",
            origen="hermes",
            motivo="caducó el manual",
        )
    for codigo in decision["alertas_nuevas"]:
        linea = _auditar(
            rutas,
            utc=now,
            quien="detector",
            accion=f"alerta_{codigo}",
            origen="hermes",
            motivo=str(decision["motivo"]),
        )
        _append_jsonl(rutas.alertas, linea)
    if decision["cambia_modo"]:
        _fijar_modo(
            rutas,
            modo=str(decision["modo_despues"]),
            motivo=str(decision["motivo"]),
            quien=str(decision["quien"]),
            origen=str(decision["origen"]),
            now=now,
            estado_inicial=bool(decision["estado_inicial"]),
        )
        _auditar(
            rutas,
            utc=now,
            quien=str(decision["quien"]),
            accion="modo_respaldo" if decision["modo_despues"] == "respaldo" else "modo_normal",
            origen=str(decision["origen"]),
            motivo=str(decision["motivo"]),
        )
    _escribir_json(rutas.ultimo, {"alertas": decision["alertas"], "utc": iso(now)})
    return decision


def _encolar(rutas: Rutas, rpc: str, body: dict) -> None:
    _append_jsonl(rutas.outbox, {"rpc": rpc, "body": body})


def _intentar_envio(rutas: Rutas, rpc: str, body: dict, transport) -> None:
    if transport is None:
        return
    try:
        transport(rpc, body)
    except Exception:
        _encolar(rutas, rpc, body)


def registrar_latido(
    rutas: Rutas,
    *,
    estado: str,
    quien: str,
    origen: str,
    now: datetime,
    detalle: str | None = None,
    dry_run: bool = False,
    transport=None,
    token: str | None = None,
) -> dict:
    del token  # el secreto solo viaja en el transporte, nunca en el fichero
    if estado not in ESTADOS_LATIDO:
        raise ValueError("estado de latido invalido")
    quien_ok = _exigir_quien(quien)
    origen_ok = _exigir_origen(origen, ORIGENES_LATIDO)
    cuerpo = {
        "estado": estado,
        "utc": iso(now),
        "quien": quien_ok,
        "origen": origen_ok,
        "detalle": detalle,
    }
    if dry_run:
        return {"dry_run": True, "latido": cuerpo}
    _escribir_json(rutas.latido, cuerpo)
    _auditar(rutas, utc=now, quien=quien_ok, accion="latido", origen=origen_ok, motivo=estado)
    _intentar_envio(rutas, "imeia_latido_registrar", cuerpo, transport)
    return cuerpo


def _horas_efectivas(horas: float | None) -> float:
    valor = MANUAL_HORAS_DEFECTO if horas is None else float(horas)
    if valor <= 0 or valor > MANUAL_HORAS_MAX:
        raise ValueError("horas fuera de rango")
    return valor


def manual_on(
    rutas: Rutas,
    *,
    quien: str,
    motivo: str,
    origen: str,
    now: datetime,
    horas: float | None = None,
    dry_run: bool = False,
    transport=None,
) -> dict:
    quien_ok = _exigir_quien(quien)
    origen_ok = _exigir_origen(origen, ORIGENES_MANUAL)
    horas_ok = _horas_efectivas(horas)
    manual = {
        "quien": quien_ok,
        "motivo": motivo.strip()[:500],
        "desde_utc": iso(now),
        "expires_at": iso(now + timedelta(hours=horas_ok)),
        "origen": origen_ok,
    }
    if dry_run:
        return {"dry_run": True, "manual": manual}
    _escribir_json(rutas.manual, manual)
    _fijar_modo(
        rutas,
        modo="respaldo",
        motivo="manual",
        quien=quien_ok,
        origen=origen_ok,
        now=now,
        estado_inicial=False,
    )
    _auditar(rutas, utc=now, quien=quien_ok, accion="manual_on", origen=origen_ok, motivo=manual["motivo"])
    _intentar_envio(
        rutas,
        "imeia_respaldo_set",
        {
            "accion": "on",
            "quien": quien_ok,
            "motivo": manual["motivo"],
            "origen": origen_ok,
            "horas": horas_ok,
        },
        transport,
    )
    return manual


def manual_off(
    rutas: Rutas,
    *,
    quien: str,
    motivo: str,
    origen: str,
    now: datetime,
    dry_run: bool = False,
    transport=None,
) -> dict:
    quien_ok = _exigir_quien(quien)
    origen_ok = _exigir_origen(origen, ORIGENES_MANUAL)
    motivo_ok = motivo.strip()[:500]
    if dry_run:
        return {"dry_run": True, "accion": "manual_off"}
    rutas.manual.unlink(missing_ok=True)
    _fijar_modo(
        rutas,
        modo="normal",
        motivo="manual_off",
        quien=quien_ok,
        origen=origen_ok,
        now=now,
        estado_inicial=False,
    )
    _auditar(rutas, utc=now, quien=quien_ok, accion="manual_off", origen=origen_ok, motivo=motivo_ok)
    _intentar_envio(
        rutas,
        "imeia_respaldo_set",
        {"accion": "off", "quien": quien_ok, "motivo": motivo_ok, "origen": origen_ok},
        transport,
    )
    return {"accion": "manual_off", "modo": "normal"}


def aplicar_comando(
    rutas: Rutas,
    texto: str,
    *,
    quien: str,
    origen: str,
    motivo: str,
    now: datetime,
    dry_run: bool = False,
    transport=None,
) -> dict:
    parsed = parse_comando(texto)
    if parsed is None:
        raise ValueError("no es un comando RESPALDO")
    if parsed["accion"] == "on":
        return manual_on(
            rutas,
            quien=quien,
            motivo=motivo,
            origen=origen,
            now=now,
            horas=parsed["horas"],
            dry_run=dry_run,
            transport=transport,
        )
    if parsed["accion"] == "off":
        return manual_off(
            rutas,
            quien=quien,
            motivo=motivo,
            origen=origen,
            now=now,
            dry_run=dry_run,
            transport=transport,
        )
    decision = evaluar(rutas, now)
    decision["comando"] = "estado"
    return decision


def _marca(data: dict | None, *claves: str) -> datetime | None:
    if not data:
        return None
    for clave in claves:
        if data.get(clave):
            try:
                return parse_iso(str(data[clave]))
            except (TypeError, ValueError):
                return None
    return None


def _es_manual_legado(rutas: Rutas) -> bool:
    if not rutas.manual.exists():
        return False
    data = _leer_json(rutas.manual)
    if not isinstance(data, dict) or "expires_at" not in data:
        return True
    try:
        parse_iso(str(data["expires_at"]))
    except (TypeError, ValueError):
        return True
    return False


def fusionar_remoto(rutas: Rutas, remoto: dict, *, now: datetime, dry_run: bool = False) -> dict:
    resultado = {"conservo_legado": False, "latido": "igual", "manual": "igual", "dry_run": dry_run}
    latido = remoto.get("latido")
    if isinstance(latido, dict) and latido.get("utc"):
        local = _leer_json(rutas.latido)
        local_utc = _marca(local if isinstance(local, dict) else None, "utc")
        remoto_utc = _marca(latido, "utc")
        if remoto_utc and (local_utc is None or remoto_utc > local_utc):
            resultado["latido"] = "actualizado"
            if not dry_run:
                _escribir_json(
                    rutas.latido,
                    {
                        "estado": latido.get("estado"),
                        "utc": iso(remoto_utc),
                        "quien": latido.get("quien"),
                        "origen": latido.get("origen"),
                        "detalle": latido.get("detalle"),
                    },
                )
    if _es_manual_legado(rutas):
        resultado["conservo_legado"] = True
        return resultado
    manual = remoto.get("manual")
    if not isinstance(manual, dict):
        return resultado
    local_manual = _clasificar_manual(rutas, now)
    if manual.get("activo") and manual.get("expires_at"):
        try:
            expira = parse_iso(str(manual["expires_at"]))
        except (TypeError, ValueError):
            return resultado
        if expira <= now:
            return resultado
        desde_remoto = _marca(manual, "desde_utc")
        desde_local = local_manual.get("desde") if local_manual["clase"] in {"vigente", "caducado"} else None
        if local_manual["clase"] == "ausente" or (
            desde_remoto is not None and (desde_local is None or desde_remoto > desde_local)
        ):
            resultado["manual"] = "on"
            if not dry_run:
                _escribir_json(
                    rutas.manual,
                    {
                        "quien": manual.get("quien"),
                        "motivo": manual.get("motivo") or "",
                        "desde_utc": manual.get("desde_utc"),
                        "expires_at": manual.get("expires_at"),
                        "origen": manual.get("origen"),
                    },
                )
        return resultado
    marca_off = _marca(manual, "updated_at", "desde_utc")
    desde_local = local_manual.get("desde")
    if local_manual["clase"] in {"vigente", "caducado"} and marca_off and desde_local and marca_off > desde_local:
        resultado["manual"] = "off"
        if not dry_run:
            rutas.manual.unlink(missing_ok=True)
    return resultado


def reintentar_salida(rutas: Rutas, transport) -> dict:
    if transport is None or not rutas.outbox.exists():
        return {"reenviados": 0, "pendientes": 0}
    pendientes = []
    reenviados = 0
    for linea in rutas.outbox.read_text(encoding="utf-8").splitlines():
        if not linea.strip():
            continue
        item = json.loads(linea)
        try:
            transport(item["rpc"], item["body"])
            reenviados += 1
        except Exception:
            pendientes.append(item)
    if pendientes:
        rutas.outbox.write_text(
            "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in pendientes),
            encoding="utf-8",
        )
    else:
        rutas.outbox.unlink(missing_ok=True)
    return {"reenviados": reenviados, "pendientes": len(pendientes)}


def cuerpo_rpc(rpc: str, body: dict, worker: str) -> dict:
    if rpc == "imeia_latido_registrar":
        return {
            "p_token": worker,
            "p_estado": body["estado"],
            "p_quien": body["quien"],
            "p_origen": body["origen"],
            "p_detalle": body.get("detalle"),
            "p_utc": body["utc"],
        }
    if rpc == "imeia_respaldo_set":
        payload = {
            "p_token": worker,
            "p_accion": body["accion"],
            "p_quien": body["quien"],
            "p_motivo": body.get("motivo") or "",
            "p_origen": body["origen"],
        }
        if body.get("horas") is not None:
            payload["p_horas"] = body["horas"]
        return payload
    if rpc == "imeia_respaldo_expirar":
        return {"p_token": worker, "p_quien": body["quien"], "p_origen": body["origen"]}
    if rpc == "imeia_modo_reportar":
        return {
            "p_token": worker,
            "p_modo": body["modo"],
            "p_motivo": body.get("motivo") or "",
            "p_quien": body["quien"],
            "p_origen": body["origen"],
        }
    if rpc == "imeia_respaldo_pull":
        return {"p_token": worker}
    raise ValueError(f"rpc desconocida: {rpc}")


def post_rpc(url: str, anon: str, worker: str, rpc: str, body: dict) -> dict:
    payload = cuerpo_rpc(rpc, body, worker)
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/rpc/{rpc}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        detalle = error.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"rpc {rpc} http {error.code}: {detalle}") from None
    if not raw:
        return {}
    data = json.loads(raw)
    return data if isinstance(data, dict) else {"data": data}


def transport_desde_entorno():
    url = os.environ.get("SUPABASE_URL", "").strip()
    anon = (os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("IMEIA_SUPABASE_ANON_KEY") or "").strip()
    worker = os.environ.get("IMEIA_WORKER_TOKEN", "").strip()
    if not (url and anon and worker):
        return None

    def transport(rpc: str, body: dict) -> dict:
        return post_rpc(url, anon, worker, rpc, body)

    return transport


def credenciales_presentes() -> bool:
    return transport_desde_entorno() is not None
