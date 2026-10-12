#!/usr/bin/env python3
"""IME CMS comercial API client (same Supabase backend as /comercial).

Auth: Supabase password grant as a sales user; password from env
IME_CMS_COMERCIAL1_PASSWORD (never printed). Uses only the public anon key.
All quote reads/writes go through the Edge Function `comercial-cotizacion`
(RLS on solicitudes_cotizacion returns 0 rows to `ventas` via PostgREST).

Subcommands:
  whoami                         login + admin_profiles row
  find  <q> [--enviadas]         list quotes (equipo=1) matching q
         [--archivadas]          include archived (hidden by default)
         [--solo-archivadas]     only archived
         [--tab pendientes|enviadas|cerradas|todas]
  get   <id>                     quote detail
  save  <payload.json>           POST create/update (payload = SaveBody; include "id" to update)
                                 `estado` in the payload is IGNORED. Use `status`.
  pdf   <id> <out.pdf>           GET ?action=pdf&id=&fresh=1 (render without sending)
  status <id> <estado> --motivo  POST ?action=cambiar-estado  ** DOES NOT EMAIL THE CLIENT **
                                 estados: nueva, en_revision, respondida, enviada, convertida,
                                 expirada, perdida, declinada
  archive <id> --motivo          POST ?action=archivar (soft delete: archived_at/by/reason)
  unarchive <id> --motivo        POST ?action=desarchivar
  send  <id> [--whatsapp]        POST enviar-cotizacion {cotizacion_id, canal}  ** SENDS TO CLIENT **
                                 requires --yes-really-send
"""
import argparse, base64, json, os, sys, urllib.request, urllib.error, urllib.parse

URL = os.environ.get("IME_SUPABASE_URL", "https://nnfbucwiasuggyfoyydo.supabase.co")
ANON = os.environ.get("IME_SUPABASE_ANON_KEY", "sb_publishable_5nGmPS2W7yzG3B1NC7piCQ_Imt5f9b2")
EMAIL = os.environ.get("IME_CMS_EMAIL", "comercial1@i-me.com.co")
PW_ENV = os.environ.get("IME_CMS_PW_ENV", "IME_CMS_COMERCIAL1_PASSWORD")

ESTADOS = (
    "nueva",
    "en_revision",
    "respondida",
    "enviada",
    "convertida",
    "expirada",
    "perdida",
    "declinada",
)


def _req(method, path, token=None, body=None, timeout=120):
    h = {"apikey": ANON, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode(errors="replace")[:1000]


def login():
    pw = os.environ.get(PW_ENV)
    if not pw:
        sys.exit(f"env {PW_ENV} no definida")
    st, d = _req("POST", "/auth/v1/token?grant_type=password", body={"email": EMAIL, "password": pw})
    if st != 200:
        sys.exit(f"LOGIN FAIL {st}: {d.get('error_description') or d.get('msg') if isinstance(d, dict) else d}")
    return d["access_token"], d["user"]


def fn(token, method, name, query=None, body=None):
    q = ("?" + urllib.parse.urlencode(query)) if query else ""
    return _req(method, f"/functions/v1/{name}{q}", token, body)


def out(st, d):
    print(json.dumps({"status": st, "data": d}, ensure_ascii=False, indent=1))
    if st >= 400:
        sys.exit(1)


def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd", required=True)
    sp.add_parser("whoami")
    f = sp.add_parser("find")
    f.add_argument("q")
    f.add_argument("--enviadas", action="store_true")
    f.add_argument("--archivadas", action="store_true", help="incluye archivadas (por defecto ocultas)")
    f.add_argument("--solo-archivadas", action="store_true")
    f.add_argument("--tab", choices=["pendientes", "enviadas", "cerradas", "todas"])
    g = sp.add_parser("get")
    g.add_argument("id")
    s = sp.add_parser("save")
    s.add_argument("payload")
    pd = sp.add_parser("pdf")
    pd.add_argument("id")
    pd.add_argument("out")
    stt = sp.add_parser("status", help="cambia estado SIN enviar nada al cliente")
    stt.add_argument("id")
    stt.add_argument("estado", choices=ESTADOS)
    stt.add_argument("--motivo", required=True)
    ar = sp.add_parser("archive", help="soft delete; no borra la fila ni el PDF")
    ar.add_argument("id")
    ar.add_argument("--motivo", required=True)
    ua = sp.add_parser("unarchive")
    ua.add_argument("id")
    ua.add_argument("--motivo", required=True)
    se = sp.add_parser("send")
    se.add_argument("id")
    se.add_argument("--whatsapp", action="store_true")
    se.add_argument("--yes-really-send", action="store_true")
    a = p.parse_args()

    tok, user = login()
    if a.cmd == "whoami":
        st, d = _req("GET", f"/rest/v1/admin_profiles?select=user_id,email,rol,activo,nombre,telefono,cargo&user_id=eq.{user['id']}", tok)
        out(st, {"user_id": user["id"], "email": user["email"], "admin_profiles": d})
    elif a.cmd == "find":
        q = {"equipo": "1", "q": a.q}
        if a.tab:
            q["tab"] = a.tab
        elif a.enviadas:
            q["tab"] = "enviadas"
        if a.solo_archivadas:
            q["solo_archivadas"] = "1"
        elif a.archivadas:
            q["incluir_archivadas"] = "1"
        out(*fn(tok, "GET", "comercial-cotizacion", q))
    elif a.cmd == "get":
        out(*fn(tok, "GET", "comercial-cotizacion", {"id": a.id}))
    elif a.cmd == "save":
        body = json.load(open(a.payload))
        out(*fn(tok, "POST", "comercial-cotizacion", body=body))
    elif a.cmd == "pdf":
        st, d = fn(tok, "GET", "comercial-cotizacion", {"action": "pdf", "id": a.id, "fresh": "1"})
        if st != 200 or not isinstance(d, dict) or not d.get("pdf_base64"):
            out(st, d)
        open(a.out, "wb").write(base64.b64decode(d["pdf_base64"]))
        print(json.dumps({"status": st, "numero": d.get("numero"), "stored": d.get("stored"), "out": a.out}))
    elif a.cmd == "status":
        out(*fn(tok, "POST", "comercial-cotizacion", {"action": "cambiar-estado", "id": a.id}, {"estado": a.estado, "motivo": a.motivo}))
    elif a.cmd == "archive":
        out(*fn(tok, "POST", "comercial-cotizacion", {"action": "archivar", "id": a.id}, {"motivo": a.motivo}))
    elif a.cmd == "unarchive":
        out(*fn(tok, "POST", "comercial-cotizacion", {"action": "desarchivar", "id": a.id}, {"motivo": a.motivo}))
    elif a.cmd == "send":
        if not a.yes_really_send:
            sys.exit("send envía el correo REAL al cliente. Repite con --yes-really-send tras aprobación.")
        body = {"cotizacion_id": a.id, "canal": "whatsapp" if a.whatsapp else "email"}
        out(*fn(tok, "POST", "enviar-cotizacion", body=body))


if __name__ == "__main__":
    main()
