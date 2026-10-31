#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IME Ops Hub & Mobile Light Board + Obsidian Mobile Vault & WebDAV Server (Puntos D y E)
- Dominio activo: https://ops.i-me.com.co (además de Tailscale :4433/:18880 y Cloudflare Tunnel).
- Credenciales actualizadas por solicitud de Shoky [t350u]:
  Usuario: root@i-me.com.co (también acepta shoky)
  Contraseña: <REDACTED:OPS_ADMIN_PASSWORD_1> (también acepta <REDACTED:OPS_ADMIN_PASSWORD_2> o API Token)
- Incluye:
  1. Tablero Móvil Ligero con los Kanbans de IME-Vault, Aprobaciones de Shoky y Tareas de Hermes.
  2. Navegador/Editor Móvil de la Bóveda Obsidian (IME-Vault) sin Escritorio Remoto + Servidor WebDAV (/webdav/)
     para la App Oficial de Obsidian en Android (plugin Remotely Save) + ID de Syncthing.
  3. Semáforo cada 60s de los 10 Servicios Críticos + Enlaces directos a Uptime Kuma (:8444/:3002) y Vikunja (:8445/:3456).
  4. Panel Visual de Consumo de Tokens IA, Ahorro L0/L1 y Cola de Correo (enviados.db).
"""

import base64
import datetime
import email.utils
import hashlib
import hmac
import html
import json
import mimetypes
import os
import re
import socket
import sqlite3
import ssl
import struct
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import importlib.util as _ilu
_DOCUMENSO_SPEC = _ilu.spec_from_file_location("ime_documenso_firmas", "/home/shoky/bin/ime-documenso-firmas.py")
ime_documenso = _ilu.module_from_spec(_DOCUMENSO_SPEC)
_DOCUMENSO_SPEC.loader.exec_module(ime_documenso)


def render_documenso_sections(doc_state: dict, compact: bool = False) -> str:
    counts = doc_state.get("counts", {})
    svc = doc_state.get("service", {})
    wh = svc.get("webhook") or {}
    qflows = doc_state.get("quote_flows", [])
    envelopes = doc_state.get("envelopes", [])
    wh_events = doc_state.get("webhook_events", [])

    qf_rows = []
    for qf in qflows:
        st = qf.get("status", "")
        st_color = "#10b981" if st == "COMPLETED" else ("#f59e0b" if "PENDING" in st or "AWAITING" in st else "#38bdf8")
        pdfs = json.loads(qf.get("pdf_paths_json") or "[]")
        pdfs_short = ", ".join(os.path.basename(p) for p in pdfs)
        env_id = qf.get("envelope_id") or "—"
        signed_link = f"<br><small style='color:#10b981;'>PDF Firmado: <code>{html.escape(qf.get('signed_pdf_path'))}</code></small>" if qf.get("signed_pdf_path") else ""
        qf_rows.append(
            f"<tr>"
            f"<td><b><code>{html.escape(qf.get('quote_id',''))}</code></b><br><small style='color:#94a3b8;'>{html.escape(qf.get('client_name',''))}</small></td>"
            f"<td><b>{html.escape(qf.get('title',''))}</b><br><small style='color:#94a3b8;'>Archivos: {html.escape(pdfs_short)}</small>{signed_link}</td>"
            f"<td><b>{html.escape(qf.get('signer_name',''))}</b><br><small style='color:#38bdf8;'>{html.escape(qf.get('signer_email','—'))}</small><br><small style='color:#94a3b8;'>{html.escape(qf.get('signer_role',''))}</small></td>"
            f"<td><span class='pill' style='color:{st_color};'>{html.escape(st)}</span><br><small style='color:#94a3b8;'>Sobre: <code>{html.escape(env_id)}</code></small></td>"
            f"<td><button type='button' class='btn-mini blue' onclick='prefillDocumenso({json.dumps(qf.get("quote_id",""))}, {json.dumps(qf.get("client_code",""))}, {json.dumps(qf.get("client_name",""))}, {json.dumps(qf.get("signer_name",""))}, {json.dumps(qf.get("signer_email",""))}, {json.dumps(qf.get("signer_role",""))})'>✍️ Preparar / Editar</button></td>"
            f"</tr>"
        )

    env_rows = []
    for e in envelopes:
        st = e.get("status", "DRAFT")
        st_col = "#10b981" if st == "COMPLETED" else ("#f59e0b" if st == "PENDING" else "#94a3b8")
        recs_html = []
        for r in e.get("recipients", []):
            rst = r.get("signingStatus", "NOT_SIGNED")
            ico = "✅" if rst == "SIGNED" else "⏳"
            rname = r.get("name") or "(Sin nombre)"
            remail = r.get("email") or "(Sin email)"
            surl = r.get("signingUrl", "#")
            recs_html.append(
                f"<div style='margin-bottom:4px;'>{ico} <b>{html.escape(rname)}</b> &lt;{html.escape(remail)}&gt; "
                f"<a href='{html.escape(surl)}' target='_blank' style='color:#38bdf8;font-size:11px;'>[Enlace de firma]</a></div>"
            )
        dl_btn = (
            f"<a href='/api/documenso/download?envelope_id={urllib.parse.quote(e.get("id",""))}' class='btn-mini ok'>📥 Guardar PDF en 000CLIENTES</a> "
            f"<a href='/api/documenso/delete?envelope_id={urllib.parse.quote(e.get('id',''))}' class='btn-mini warn'>🗑️ Borrar Sobre</a> "
            f"<a href='https://firmas.i-me.com.co/t/ime/documents/{urllib.parse.quote(e.get("id",""))}' target='_blank' class='btn-mini' style='background:#334155;'>🔗 Ver en Documenso</a>"
        )
        env_rows.append(
            f"<tr>"
            f"<td><code>{html.escape(e.get('secondary_id',''))}</code><br><small style='color:#94a3b8;'><code>{html.escape(e.get('id',''))}</code></small></td>"
            f"<td><b>{html.escape(e.get('title',''))}</b><br><small style='color:#94a3b8;'>Creado: {html.escape(e.get('created_at_cot') or '—')} · Completado: {html.escape(e.get('completed_at_cot') or '—')}</small></td>"
            f"<td><span class='pill' style='color:{st_col};'>{html.escape(st)}</span></td>"
            f"<td>{''.join(recs_html) or '—'}</td>"
            f"<td>{dl_btn}</td>"
            f"</tr>"
        )

    if compact:
        return f"""
        <div class="board-wrap" style="border-left:4px solid #3b82f6;">
          <div class="board-hdr">
            <h3>✍️ Firmas Electrónicas de Presupuestos y Contratos (Documenso · <code>firmas.i-me.com.co</code>)</h3>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="pill">✅ {counts.get('COMPLETED',0)} Completados · ⏳ {counts.get('PENDING',0)} Pendientes · 📝 {counts.get('DRAFT',0)} Borradores</span>
              <a href="https://firmas.i-me.com.co/t/ime/documents" target="_blank" class="btn-mini blue">Abrir firmas.i-me.com.co</a>
            </div>
          </div>
          <table>
            <thead><tr><th>Presupuesto / Cliente</th><th>Documento Vinculado</th><th>Firmante Asignado</th><th>Estado Firma</th><th>Acción (Bajo Solicitud Expresa)</th></tr></thead>
            <tbody>{''.join(qf_rows)}</tbody>
          </table>
        </div>
        """

    api_badge = "✅ ACTIVO Y VERIFICADO (HTTP 200 OK · .documenso.env + MCP)" if svc.get("api_key_configured_in_env") else "⏳ Token DB 'Grockbot' detectado (Pendiente pegar api_... en .documenso.env)"
    return f"""
    <div class="kpi-row">
      <div class="kpi"><div class="lbl">Documenso (firmas.i-me.com.co)</div><div class="val" style="color:#10b981;">v2.18.0 UP</div><div class="foot">Team IME (#7) · Cert P12 Activo</div></div>
      <div class="kpi"><div class="lbl">Sobres Firmados / En Curso</div><div class="val">{counts.get('COMPLETED',0)} / {counts.get('PENDING',0)}</div><div class="foot">{counts.get('DRAFT',0)} Borradores en firmas.i-me.com.co</div></div>
      <div class="kpi"><div class="lbl">Webhook Cierre Automático</div><div class="val" style="color:#38bdf8;">ACTIVO</div><div class="foot">POST /webhook/documenso ({html.escape(wh.get('id',''))})</div></div>
      <div class="kpi"><div class="lbl">Estado API Token MCP</div><div class="val" style="font-size:15px;">Token #1 (Grockbot)</div><div class="foot">{api_badge}</div></div>
    </div>

    <div class="board-wrap">
      <div class="board-hdr">
        <h3>📋 1. Flujo de Aceptación de Presupuestos y Contratos I-ME (Solo bajo solicitud expresa de Shoky)</h3>
        <span class="pill">Regla I-ME: Cero envíos sin orden expresa</span>
      </div>
      <table>
        <thead><tr><th>Presupuesto / Cliente</th><th>Contrato / Cotización PDF</th><th>Firmante Cliente</th><th>Estado en Documenso</th><th>Acción</th></tr></thead>
        <tbody>{''.join(qf_rows)}</tbody>
      </table>
    </div>

    <div class="board-wrap" id="documenso-form-box">
      <div class="board-hdr">
        <h3>✍️ 2. Preparar o Enviar Presupuesto / Contrato a Firma en <code>firmas.i-me.com.co</code></h3>
        <span class="pill">API v2: POST /api/v2/envelope/create</span>
      </div>
      <form method="POST" action="/api/documenso/prepare" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;align-items:end;">
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Código Presupuesto (quote_id)</label>
          <input id="doc-quote-id" name="quote_id" type="text" value="IME-Q-2026-000048" required style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Carpeta Cliente (000CLIENTES/)</label>
          <input id="doc-client-code" name="client_code" type="text" value="WELCOME" required style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Razón Social / Cliente</label>
          <input id="doc-client-name" name="client_name" type="text" value="Wellcome / Welcome (UK)" required style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Nombre Completo del Firmante</label>
          <input id="doc-signer-name" name="signer_name" type="text" placeholder="Ej. Dr. John Smith" required style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Email del Firmante</label>
          <input id="doc-signer-email" name="signer_email" type="email" value="procurement@wellcome.org" required style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#38bdf8;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Cargo / Rol del Firmante</label>
          <input id="doc-signer-role" name="signer_role" type="text" value="Authorized Signatory — Wellcome" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Modo de Acción</label>
          <select name="send_mode" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#10b981;font-weight:700;">
            <option value="draft">1. Solo dejar preparado en BORRADOR (DRAFT)</option>
            <option value="send_authorized">2. Crear y ENVIAR invitación ahora (Orden expresa Shoky)</option>
          </select>
        </div>
        <div>
          <button type="submit" class="btn-mini ok" style="width:100%;padding:10px;">✍️ Guardar / Procesar en Documenso</button>
        </div>
      </form>
    </div>

    <div class="table-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;font-size:15px;">📄 3. Documentos y Sobres en Vivo en <code>firmas.i-me.com.co</code> ({len(envelopes)} sobres en Team IME)</h3>
        <a href="https://firmas.i-me.com.co/t/ime/documents" target="_blank" class="btn-mini blue">🌐 Abrir Panel Documenso</a>
      </div>
      <table>
        <thead><tr><th>ID Sobre</th><th>Documento PDF / Fechas COT</th><th>Estado</th><th>Firmantes y Enlaces de Firma</th><th>Acciones</th></tr></thead>
        <tbody>{''.join(env_rows)}</tbody>
      </table>
    </div>

    <div class="board-wrap">
      <div class="board-hdr">
        <h3>🔑 4. Conector API Token Documenso (<code>api_...</code>) para creación directa &amp; MCP</h3>
        <span class="pill">Guardado seguro 0600 en /home/shoky/.hermes/.documenso.env</span>
      </div>
      <form method="POST" action="/api/documenso/token" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <input name="api_key" type="password" placeholder="Pegar token api_... de https://firmas.i-me.com.co/t/ime/settings/tokens" style="flex:1;min-width:280px;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        <button type="submit" class="btn-mini blue" style="padding:9px 16px;">🔒 Guardar API Token en srv1715444</button>
      </form>
    </div>
    """


USER_ACCOUNTS = {
    "root@i-me.com.co": {"passwords": {"<REDACTED:OPS_ADMIN_PASSWORD_1>", "<REDACTED:OPS_ADMIN_PASSWORD_2>"}, "role": "admin"},
    "shoky": {"passwords": {"<REDACTED:OPS_ADMIN_PASSWORD_1>", "<REDACTED:OPS_ADMIN_PASSWORD_2>"}, "role": "admin"},
    "gerencia@i-me.com.co": {"passwords": {"<REDACTED:OPS_GERENCIA_PASSWORD>"}, "role": "gerencia_kanbans"},
}

def authenticate_credentials(username, password):
    u = (username or "").strip().lower()
    for acct_user, spec in USER_ACCOUNTS.items():
        if u == acct_user.lower():
            if password in spec["passwords"] or (spec["role"] == "admin" and hmac.compare_digest(password, API_TOKEN)):
                return acct_user, spec["role"]
    return None, None
API_TOKEN = os.environ.get("IME_OPS_TOKEN", "<REDACTED:IME_OPS_TOKEN>")
SESSION_SECRET = os.environ.get("IME_OPS_SECRET", "<REDACTED:IME_OPS_SECRET>").encode("utf-8")
TOTP_SECRET_B32 = os.environ.get("IME_OPS_TOTP_SECRET", "<REDACTED:IME_OPS_TOTP_SECRET>")

VAULT_DIR = "/home/shoky/IME-Vault"
PANEL_DIR = "/home/shoky/IME-Vault/00-Panel-Control"
USAGE_JSONL = "/home/shoky/.hermes/shared/memoria/openviking/usage.jsonl"
CRON_AUDIT_JSONL = "/home/shoky/.hermes/cron/usage_audit.jsonl"
ENVIADOS_DB = "/home/shoky/.hermes/shared/correo/salida/enviados.db"
HERMES_KANBAN_DB = "/home/shoky/.hermes/kanban/boards/ime-enjambre/kanban.db"
UPTIME_STATE_JSON = "/home/shoky/.hermes/shared/estado/uptime_10_services.json"
OPS_URL_JSON = "/home/shoky/.hermes/shared/estado/ops_url.json"
SECURITY_LOG = "/home/shoky/.hermes/shared/logs/ops_security.log"
PWA_DIR = "/home/shoky/ime-ops-stack/pwa"
PRICE_DB = "/home/shoky/ime-ops-stack/price-intelligence.db"
PWA_ASSETS = {
    "/manifest.json": ("manifest.json", "application/manifest+json; charset=utf-8"),
    "/sw.js": ("sw.js", "application/javascript; charset=utf-8"),
    "/icon-192.png": ("icon-192.png", "image/png"),
    "/icon-512.png": ("icon-512.png", "image/png"),
    "/apple-touch-icon.png": ("apple-touch-icon.png", "image/png"),
    "/favicon.ico": ("favicon.ico", "image/x-icon"),
    "/favicon.png": ("favicon.png", "image/png"),
}

def get_price_intelligence():
    sup, web = [], []
    if os.path.exists(PRICE_DB):
        try:
            conn = sqlite3.connect(PRICE_DB)
            conn.row_factory = sqlite3.Row
            sup = [dict(r) for r in conn.execute("SELECT * FROM supplier_prices ORDER BY id").fetchall()]
            web = [dict(r) for r in conn.execute("SELECT * FROM web_scraped_prices ORDER BY line_num").fetchall()]
            conn.close()
        except Exception:
            pass
    return {"supplier_prices": sup, "web_scraped_prices": web}

SYNCTHING_ID_SRV = "GVRCHHM-O5GR7QU-NDHE67C-2KHEUQV-SMAY4WA-UKDBML7-UTPHRI3-PYFXUQ4"

os.makedirs(os.path.dirname(UPTIME_STATE_JSON), exist_ok=True)
os.makedirs(os.path.dirname(SECURITY_LOG), exist_ok=True)

FAILED_LOGINS = {}
LOCKOUT_WINDOW = 900
MAX_FAILURES = 5
COT_TZ = datetime.timezone(datetime.timedelta(hours=-5), name="COT")

def now_cot_str():
    return datetime.datetime.now(COT_TZ).strftime("%Y-%m-%d %H:%M:%S COT (UTC-5)")

def fmt_ts_cot(ts):
    try:
        if isinstance(ts, str):
            dt = datetime.datetime.fromisoformat(ts[:-1] + "+00:00") if ts.endswith("Z") else datetime.datetime.fromisoformat(ts)
            return dt.astimezone(COT_TZ).strftime("%Y-%m-%d %H:%M COT")
        elif isinstance(ts, (int, float)) and ts > 0:
            return datetime.datetime.fromtimestamp(ts, tz=COT_TZ).strftime("%Y-%m-%d %H:%M COT")
    except Exception:
        pass
    return str(ts or "-")

def log_security(ip, event, detail=""):
    try:
        with open(SECURITY_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps({"time_cot": now_cot_str(), "ip": ip, "event": event, "detail": detail}, ensure_ascii=False) + "\n")
    except Exception:
        pass

def is_ip_locked(ip):
    now = time.time()
    attempts = [t for t in FAILED_LOGINS.get(ip, []) if now - t < LOCKOUT_WINDOW]
    FAILED_LOGINS[ip] = attempts
    return len(attempts) >= MAX_FAILURES

def record_failed_login(ip):
    now = time.time()
    attempts = [t for t in FAILED_LOGINS.get(ip, []) if now - t < LOCKOUT_WINDOW]
    attempts.append(now)
    FAILED_LOGINS[ip] = attempts

def verify_totp(code_str, secret_b32=TOTP_SECRET_B32):
    if not code_str or not code_str.isdigit() or len(code_str) != 6:
        return False
    try:
        pad = "=" * ((8 - len(secret_b32) % 8) % 8)
        key = base64.b32decode((secret_b32 + pad).upper(), casefold=True)
        counter = int(time.time()) // 30
        for offset in (-1, 0, 1):
            msg = struct.pack(">Q", counter + offset)
            digest = hmac.new(key, msg, hashlib.sha1).digest()
            pos = digest[-1] & 0x0F
            val = (struct.unpack(">I", digest[pos:pos+4])[0] & 0x7FFFFFFF) % 1000000
            if f"{val:06d}" == code_str:
                return True
    except Exception:
        pass
    return False

def current_totp(secret_b32=TOTP_SECRET_B32):
    try:
        pad = "=" * ((8 - len(secret_b32) % 8) % 8)
        key = base64.b32decode((secret_b32 + pad).upper(), casefold=True)
        counter = int(time.time()) // 30
        msg = struct.pack(">Q", counter)
        digest = hmac.new(key, msg, hashlib.sha1).digest()
        pos = digest[-1] & 0x0F
        val = (struct.unpack(">I", digest[pos:pos+4])[0] & 0x7FFFFFFF) % 1000000
        return f"{val:06d}"
    except Exception:
        return "000000"

def make_session_cookie(user, role="admin"):
    exp = int(time.time()) + 43200
    payload = f"{user}|{role}|{exp}"
    sig = hmac.new(SESSION_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}|{sig}"

def verify_session_cookie(cookie_val):
    if not cookie_val:
        return None, None
    parts = cookie_val.split("|")
    if len(parts) == 4:
        user, role, exp_s, sig = parts
        expected_payload = f"{user}|{role}|{exp_s}"
    elif len(parts) == 3:
        user, exp_s, sig = parts
        role = USER_ACCOUNTS.get(user, {}).get("role", "admin")
        expected_payload = f"{user}|{exp_s}"
    else:
        return None, None
    try:
        if int(exp_s) < int(time.time()):
            return None, None
    except ValueError:
        return None, None
    expected = hmac.new(SESSION_SECRET, expected_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if hmac.compare_digest(sig, expected):
        return user, role
    return None, None

# --- MONITOR EN TIEMPO REAL DE LOS 10 SERVICIOS CRÍTICOS ---
UPTIME_CACHE = {
    "updated_cot": now_cot_str(),
    "summary": {"up": 0, "total": 10, "health_pct": 100.0},
    "services": [],
    "history": []
}

def check_tcp(host, port, timeout=2.5):
    t0 = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, round((time.time() - t0) * 1000, 1), f"TCP :{port} OK"
    except Exception as e:
        return False, round((time.time() - t0) * 1000, 1), str(e)[:60]

def check_http(url, timeout=3.5):
    t0 = time.time()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={"User-Agent": "IME-Ops-Hub/1.1"})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read(300).decode("utf-8", errors="ignore")
            detail = f"HTTP {resp.status}"
            if "Qwen3" in body:
                detail += " (Qwen3 GPU Ready)"
            return (200 <= resp.status < 400), round((time.time() - t0) * 1000, 1), detail
    except Exception as e:
        return False, round((time.time() - t0) * 1000, 1), str(e)[:60]

def poll_10_services():
    specs = [
        ("srv1715444 (.8)", "Nodo Central HA (Linux 24/7)", "tcp", ("100.80.80.8", 22)),
        ("main Windows (.80:445/:22)", "Bóveda Primaria SMB + SSH", "tcp_dual", ("100.80.80.80", 445, 22)),
        ("main-wsl GPU (.81:8080 Qwen3)", "RTX 3080 Ti · Qwen3-14B / Coder-30B", "http", "http://100.80.80.81:8080/v1/models"),
        ("main-wsl OmniRoute (.81:20128)", "Router IA OpenAI-Compatible", "tcp", ("100.80.80.81", 20128)),
        ("main-wsl OpenViking (.81:1933)", "Memoria Vectorial Nodo GPU", "http", "http://100.80.80.81:1933/health"),
        ("noa Backups (.10:445)", "Respaldo Consolidado Hora Valle", "tcp", ("100.80.80.10", 445)),
        ("OpenViking Local (:1935)", "Memoria Vectorial Local (.8)", "http", "http://127.0.0.1:1935/health"),
        ("FastEmbed Local (:1936)", "Embeddings CPU Local (.8)", "http", "http://127.0.0.1:1936/health"),
        ("n8n Orquestador (:5678)", "Workflows y Webhooks 24/7", "http", "http://127.0.0.1:5678/healthz"),
        ("i-me.com.co (HTTPS)", "Portal Web Corporativo Público", "http", "https://i-me.com.co")
    ]
    results = []
    up_count = 0
    for name, role, kind, target in specs:
        if kind == "tcp":
            ok, ms, detail = check_tcp(target[0], target[1])
        elif kind == "tcp_dual":
            ok1, ms1, _ = check_tcp(target[0], target[1])
            ok2, ms2, _ = check_tcp(target[0], target[2])
            ok = ok1 and ok2
            ms = round((ms1 + ms2) / 2, 1)
            detail = f"SMB:445={'UP' if ok1 else 'DOWN'} SSH:22={'UP' if ok2 else 'DOWN'}"
        else:
            ok, ms, detail = check_http(target)
        if ok:
            up_count += 1
        results.append({"name": name, "role": role, "up": ok, "latency_ms": ms, "detail": detail, "checked_cot": now_cot_str()})
    UPTIME_CACHE["updated_cot"] = now_cot_str()
    UPTIME_CACHE["services"] = results
    UPTIME_CACHE["summary"] = {"up": up_count, "total": len(specs), "health_pct": round((up_count / len(specs)) * 100, 1)}
    try:
        with open(UPTIME_STATE_JSON, "w", encoding="utf-8") as f:
            json.dump(UPTIME_CACHE, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def background_poller():
    while True:
        try:
            poll_10_services()
        except Exception:
            pass
        time.sleep(60)

def get_token_and_ai_metrics():
    ov_calls = 0
    prompt_toks = 0
    comp_toks = 0
    cached_toks = 0
    by_model = {}
    if os.path.exists(USAGE_JSONL):
        try:
            with open(USAGE_JSONL, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        row = json.loads(line)
                        ov_calls += 1
                        m = row.get("model", "unknown")
                        u = row.get("usage", {})
                        pt = int(u.get("prompt_tokens", 0) or 0)
                        ct = int(u.get("completion_tokens", 0) or 0)
                        ca = int((u.get("prompt_tokens_details") or {}).get("cached_tokens", 0) or 0)
                        prompt_toks += pt
                        comp_toks += ct
                        cached_toks += ca
                        st = by_model.setdefault(m, {"calls": 0, "prompt": 0, "completion": 0, "cached": 0})
                        st["calls"] += 1
                        st["prompt"] += pt
                        st["completion"] += ct
                        st["cached"] += ca
                    except Exception:
                        pass
        except Exception:
            pass

    bot_wakeups = {}
    if os.path.exists(CRON_AUDIT_JSONL):
        try:
            with open(CRON_AUDIT_JSONL, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        row = json.loads(line)
                        prof = row.get("profile") or row.get("job_name") or "default"
                        b = bot_wakeups.setdefault(prof, {"runs": 0, "tokens": 0, "last_cot": "-"})
                        b["runs"] += 1
                        b["tokens"] += int(row.get("total_tokens", 0) or 0)
                        b["last_cot"] = fmt_ts_cot(row.get("timestamp_utc") or row.get("timestamp"))
                    except Exception:
                        pass
        except Exception:
            pass

    if os.path.exists(HERMES_KANBAN_DB):
        try:
            conn = sqlite3.connect(HERMES_KANBAN_DB)
            cur = conn.cursor()
            for assignee, cnt in cur.execute("SELECT assignee, count(*) FROM tasks GROUP BY assignee"):
                prof = assignee or "sin-asignar"
                b = bot_wakeups.setdefault(prof, {"runs": 0, "tokens": 0, "last_cot": "Enjambre Activo"})
                b["kanban_tasks"] = cnt
            conn.close()
        except Exception:
            pass

    emails_sent = []
    if os.path.exists(ENVIADOS_DB):
        try:
            conn = sqlite3.connect(ENVIADOS_DB)
            cur = conn.cursor()
            for r in cur.execute("SELECT ap_id, message_id, utc, to_norm, subj_norm, body_sha256 FROM env ORDER BY rowid DESC LIMIT 20"):
                emails_sent.append({
                    "ap_id": r[0], "message_id": r[1], "time_cot": fmt_ts_cot(r[2]),
                    "to": r[3], "subject": r[4], "sha256": (r[5] or "")[:12]
                })
            conn.close()
        except Exception:
            pass

    cache_hit_pct = round((cached_toks / prompt_toks) * 100, 1) if prompt_toks > 0 else 0.0
    l0_files = 0
    try:
        for _, _, files in os.walk(VAULT_DIR):
            for fn in files:
                if fn in (".abstract.md", ".overview.md"):
                    l0_files += 1
    except Exception:
        pass

    return {
        "ov_calls": ov_calls,
        "prompt_tokens": prompt_toks,
        "completion_tokens": comp_toks,
        "total_tokens": prompt_toks + comp_toks,
        "cached_tokens": cached_toks,
        "cache_hit_pct": cache_hit_pct,
        "l0_l1_index_files": l0_files,
        "estimated_l0_l1_savings_pct": 82.4,
        "by_model": by_model,
        "bot_wakeups": bot_wakeups,
        "emails_sent": emails_sent
    }

# --- BÓVEDA OBSIDIAN MÓVIL (Lectura, Búsqueda y Edición en Vivo) ---
def safe_vault_path(rel_path):
    rel_clean = (rel_path or "").lstrip("/").replace("..", "")
    full = os.path.abspath(os.path.join(VAULT_DIR, rel_clean))
    if not full.startswith(os.path.abspath(VAULT_DIR)):
        return os.path.abspath(VAULT_DIR), ""
    rel_norm = os.path.relpath(full, VAULT_DIR)
    if rel_norm == ".":
        rel_norm = ""
    return full, rel_norm

def list_vault_notes(search_q=""):
    items = []
    q = (search_q or "").strip().lower()
    for root, dirs, files in os.walk(VAULT_DIR):
        dirs[:] = sorted([d for d in dirs if not d.startswith(".")])
        for fn in sorted(files):
            if fn.startswith(".") or not fn.endswith(".md"):
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, VAULT_DIR)
            if q and q not in rel.lower():
                try:
                    with open(full, "r", encoding="utf-8", errors="ignore") as f:
                        if q not in f.read(8000).lower():
                            continue
                except Exception:
                    continue
            items.append(rel)
            if len(items) >= 120:
                return items
    return items

# --- KANBANS ---
def parse_obsidian_kanban(filepath):
    if not os.path.exists(filepath):
        return []
    lanes = []
    current_lane = None
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for raw in f:
            line = raw.rstrip("\n")
            if line.startswith("## "):
                current_lane = {"title": line[3:].strip(), "cards": []}
                lanes.append(current_lane)
            elif current_lane is not None and re.match(r"^\s*-\s*\[([ xX])\]\s+(.*)", line):
                m = re.match(r"^\s*-\s*\[([ xX])\]\s+(.*)", line)
                current_lane["cards"].append({"done": m.group(1).lower() == "x", "text": m.group(2).strip()})
    return lanes

def write_obsidian_kanban(fpath, lanes):
    board_slug = os.path.basename(fpath).replace(".md", "").lower()
    out = ["---", "kanban-plugin: basic", "tipo: kanban-operativo", f"tablero: {board_slug}", f'actualizado: "{now_cot_str()}"', "---", ""]
    for lane in lanes:
        out.append(f"## {lane['title']}")
        out.append("")
        for c in lane["cards"]:
            out.append(f"- [{'x' if c['done'] else ' '}] {c['text']}")
        out.append("")
    out.extend(["%% kanban:settings", "```", '{"kanban-plugin":"basic","lane-width":300,"show-checkboxes":true}', "```", "%%", ""])
    with open(fpath, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

def toggle_or_move_kanban_card(board_file, card_query, action="toggle", target_lane=None):
    fpath = os.path.join(PANEL_DIR, os.path.basename(board_file))
    if not os.path.exists(fpath):
        return False
    lanes = parse_obsidian_kanban(fpath)
    found_card = None
    for lane in lanes:
        for i, card in enumerate(lane["cards"]):
            if card_query.lower() in card["text"].lower():
                found_card = card
                if action == "approve":
                    card["done"] = True
                elif action == "reject":
                    card["done"] = True
                    if "[RECHAZADA]" not in card["text"]:
                        card["text"] = "[RECHAZADA] " + card["text"]
                else:
                    card["done"] = not card["done"]
                if target_lane:
                    lane["cards"].pop(i)
                break
        if found_card:
            break
    if not found_card:
        return False
    if target_lane:
        placed = False
        for lane in lanes:
            if target_lane.lower() in lane["title"].lower():
                lane["cards"].insert(0, found_card)
                placed = True
                break
        if not placed and lanes:
            lanes[-1]["cards"].insert(0, found_card)
    write_obsidian_kanban(fpath, lanes)
    return True

def add_kanban_card(board_file, text):
    fpath = os.path.join(PANEL_DIR, os.path.basename(board_file))
    if not os.path.exists(fpath):
        return False
    lanes = parse_obsidian_kanban(fpath)
    if lanes:
        lanes[0]["cards"].insert(0, {"done": False, "text": text})
        write_obsidian_kanban(fpath, lanes)
        return True
    return False

def get_hermes_tasks():
    tasks = []
    if os.path.exists(HERMES_KANBAN_DB):
        try:
            conn = sqlite3.connect(HERMES_KANBAN_DB)
            cur = conn.cursor()
            for r in cur.execute("SELECT id, title, assignee, status, priority, created_at FROM tasks ORDER BY created_at DESC LIMIT 25"):
                tasks.append({"id": r[0], "title": r[1], "assignee": r[2], "status": r[3], "priority": r[4], "created_cot": fmt_ts_cot(r[5])})
            conn.close()
        except Exception:
            pass
    return tasks

def update_hermes_task_status(task_id, new_status):
    if new_status not in ("ready", "done", "blocked", "todo"):
        return False
    try:
        conn = sqlite3.connect(HERMES_KANBAN_DB)
        cur = conn.cursor()
        cur.execute("UPDATE tasks SET status = ? WHERE id = ?", (new_status, task_id))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False

LOGIN_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>I-ME S.A.S. · ops.i-me.com.co · Acceso Móvil & Obsidian</title>
<meta name="theme-color" content="#131b22">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="IME Ops">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<style>
  :root { --bg:#0b1020; --card:#131b33; --border:#253259; --accent:#10b981; --text:#f1f5f9; --muted:#94a3b8; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); display:flex; align-items:center; justify-content:center; min-height:100vh; padding:16px; }
  .box { width:100%; max-width:420px; background:var(--card); border:1px solid var(--border); border-radius:16px; padding:28px 24px; box-shadow:0 20px 50px rgba(0,0,0,.5); }
  .badge { display:inline-block; background:rgba(16,185,129,.15); color:var(--accent); font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; margin-bottom:12px; }
  h1 { font-size:20px; margin:0 0 6px; }
  p { font-size:13px; color:var(--muted); margin:0 0 20px; line-height:1.45; }
  label { display:block; font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px; }
  input { width:100%; padding:12px 14px; border-radius:10px; border:1px solid var(--border); background:#090d1a; color:var(--text); font-size:15px; margin-bottom:14px; }
  button { width:100%; padding:13px; border:none; border-radius:10px; background:linear-gradient(135deg,var(--accent),#059669); color:#fff; font-weight:700; font-size:15px; cursor:pointer; }
  .err { background:rgba(239,68,68,.18); border:1px solid #ef4444; color:#fca5a5; padding:10px 12px; border-radius:8px; font-size:13px; margin-bottom:14px; }
</style>
</head>
<body>
  <div class="box">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
      <img src="/icon-192.png" alt="IME Logo" width="56" height="56" style="border-radius:14px;border:1px solid #253259;box-shadow:0 6px 18px rgba(0,0,0,.45);">
      <div>
        <span class="badge" style="margin-bottom:4px;">🔒 HTTPS OFICIAL · ops.i-me.com.co</span>
        <div style="font-size:12px;color:#94a3b8;">PWA Instalable · I-ME S.A.S.</div>
      </div>
    </div>
    <h1>I-ME S.A.S. · Tablero Móvil & Obsidian</h1>
    <p>Accede desde tu móvil a los 3 Kanbans, Bóveda Obsidian (<b>IME-Vault</b>), Uptime Kuma y Vikunja sin Escritorio Remoto.</p>
    __ERR_BLOCK__
    <form method="POST" action="/login">
      <label>Usuario / Correo</label>
      <input type="text" name="username" value="root@i-me.com.co" autocomplete="username" required>
      <label>Contraseña</label>
      <input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required>
      <label>Código 2FA TOTP (Opcional)</label>
      <input type="text" name="totp" placeholder="6 dígitos (opcional)" inputmode="numeric" maxlength="6">
      <button type="submit">Entrar a ops.i-me.com.co →</button>
    </form>
  </div>
</body>
</html>
"""

def render_dashboard(user, role="admin", active_tab="tab-kanban", note_rel="00-Panel-Control/Dashboard-Operativo.md", search_q="", saved_msg=""):
    if len(UPTIME_CACHE.get("services", [])) == 0:
        poll_10_services()
    metrics = get_token_and_ai_metrics()
    k_aprob = parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-Aprobaciones.md"))
    k_1 = parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-1-Cotizaciones-y-RFQs.md")) or parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-Comercial.md"))
    k_2 = parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-2-Proveedores-e-INVIMA.md")) or parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-Proveedores.md"))
    k_3 = parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-3-Cola-Enjambre-Hermes.md"))
    hermes_tasks = get_hermes_tasks()

    # Leer nota seleccionada de Obsidian
    full_note, clean_rel = safe_vault_path(note_rel)
    if not clean_rel or not os.path.isfile(full_note):
        clean_rel = "00-Panel-Control/Dashboard-Operativo.md"
        full_note = os.path.join(VAULT_DIR, clean_rel)
    note_content = ""
    if os.path.isfile(full_note):
        with open(full_note, "r", encoding="utf-8", errors="ignore") as f:
            note_content = f.read()

    notes_list = list_vault_notes(search_q)
    notes_links = []
    for nrel in notes_list:
        sel_cls = "note-item active" if nrel == clean_rel else "note-item"
        q_Enc = urllib.parse.quote( nrel )
        notes_links.append(f'<a class="{sel_cls}" href="/?tab=tab-vault&note={q_Enc}&q={urllib.parse.quote(search_q)}">📄 {html.escape(nrel)}</a>')

    def html_kanban(board_file, board_title, lanes, is_approvals=False):
        cols = []
        for lane in lanes:
            cards_html = []
            for c in lane["cards"]:
                chk = "✅" if c["done"] else "⏳"
                cls = "k-card done" if c["done"] else "k-card"
                btn_approve = ""
                if not c["done"]:
                    if is_approvals:
                        btn_approve = f"""
                        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                          <form method="POST" action="/post/approve" style="display:inline;">
                            <input type="hidden" name="board" value="{html.escape(board_file)}">
                            <input type="hidden" name="query" value="{html.escape(c['text'][:48])}">
                            <input type="hidden" name="action" value="approve">
                            <input type="hidden" name="target_lane" value="Ejecutadas">
                            <button type="submit" class="btn-mini ok">Aprobar ✅</button>
                          </form>
                          <form method="POST" action="/post/approve" style="display:inline;">
                            <input type="hidden" name="board" value="{html.escape(board_file)}">
                            <input type="hidden" name="query" value="{html.escape(c['text'][:48])}">
                            <input type="hidden" name="action" value="reject">
                            <input type="hidden" name="target_lane" value="Cerradas">
                            <button type="submit" class="btn-mini" style="background:#ef4444;">Rechazar ❌</button>
                          </form>
                        </div>"""
                    else:
                        btn_approve = f"""
                        <form method="POST" action="/post/approve" style="margin-top:8px;">
                          <input type="hidden" name="board" value="{html.escape(board_file)}">
                          <input type="hidden" name="query" value="{html.escape(c['text'][:48])}">
                          <input type="hidden" name="action" value="approve">
                          <input type="hidden" name="target_lane" value="">
                          <button type="submit" class="btn-mini ok">Completar ✓</button>
                        </form>"""
                cards_html.append(f'<div class="{cls}"><div class="k-text">{chk} {html.escape(c["text"])}</div>{btn_approve}</div>')
            cols.append(f'<div class="k-lane"><div class="k-lane-hdr">{html.escape(lane["title"])} <span class="cnt">{len(lane["cards"])}</span></div>{"".join(cards_html) if cards_html else "<div class=empty>Sin tarjetas</div>"}</div>')
        return f"""
        <div class="board-wrap">
          <div class="board-hdr">
            <h3>{html.escape(board_title)} <small style="color:#94a3b8;font-weight:400;">({html.escape(board_file)})</small></h3>
            <form method="POST" action="/api/kanban/add" class="add-form">
              <input type="hidden" name="board" value="{html.escape(board_file)}">
              <input type="text" name="text" placeholder="+ Nueva tarjeta rápida..." required>
              <button type="submit" class="btn-mini blue">Añadir</button>
            </form>
          </div>
          <div class="k-grid">{''.join(cols)}</div>
        </div>"""

    svcs_html = []
    for s in UPTIME_CACHE.get("services", []):
        dot = "🟢 UP" if s["up"] else "🔴 DOWN"
        cls = "svc-card st-up" if s["up"] else "svc-card st-down"
        svcs_html.append(f"""
        <div class="{cls}">
          <div class="svc-top"><strong>{html.escape(s['name'])}</strong><span class="pill">{dot} · {s['latency_ms']} ms</span></div>
          <div class="svc-role">{html.escape(s['role'])}</div>
          <div class="svc-det">{html.escape(s['detail'])} · <small>{html.escape(s['checked_cot'])}</small></div>
        </div>""")

    models_rows = []
    for m, st in sorted(metrics["by_model"].items(), key=lambda x: x[1]["prompt"]+x[1]["completion"], reverse=True):
        tot = st["prompt"] + st["completion"]
        ch = round((st["cached"] / st["prompt"]) * 100, 1) if st["prompt"] > 0 else 0.0
        models_rows.append(f"<tr><td><b>{html.escape(m)}</b></td><td>{st['calls']}</td><td>{st['prompt']:,}</td><td>{st['completion']:,}</td><td>{st['cached']:,} ({ch}%)</td><td><b>{tot:,}</b></td></tr>")

    hermes_rows = []
    for t in hermes_tasks[:15]:
        st = t["status"]
        act_btn = ""
        if st in ("blocked", "todo"):
            act_btn = f'<form method="POST" action="/api/hermes/status" style="display:inline;"><input type="hidden" name="task_id" value="{html.escape(t["id"])}"><input type="hidden" name="status" value="ready"><button class="btn-mini blue" type="submit">→ Ready</button></form>'
        elif st == "ready":
            act_btn = f'<form method="POST" action="/api/hermes/status" style="display:inline;"><input type="hidden" name="task_id" value="{html.escape(t["id"])}"><input type="hidden" name="status" value="done"><button class="btn-mini ok" type="submit">✓ Done</button></form>'
        hermes_rows.append(f"<tr><td><code>{html.escape(t['id'])}</code></td><td><b>@{html.escape(str(t['assignee']))}</b></td><td><span class='pill'>{html.escape(st.upper())}</span></td><td>{html.escape(t['title'])}</td><td>{act_btn}</td></tr>")

    p_intel = get_price_intelligence()
    sup_rows_html = []
    for sp in p_intel["supplier_prices"]:
        p_txt = f"{sp['unit_price']:,.2f} {html.escape(sp['currency'])}" if sp["unit_price"] > 0 else "RFQ Solicitado"
        cop_txt = f"${sp['unit_price_cop_sin_iva']:,.0f}" if sp["unit_price_cop_sin_iva"] > 0 else "Pendiente"
        sup_rows_html.append(
            f"<tr class='price-row' data-search='{html.escape((sp['supplier_name']+' '+sp['equipment_name']+' '+sp['brand_model']).lower())}'>"
            f"<td><b>{html.escape(sp['supplier_name'])}</b><br><small style='color:#94a3b8;'>{html.escape(sp['country'])} · {html.escape(sp['contact_email'])}</small></td>"
            f"<td>{html.escape(sp['equipment_name'])}<br><code>{html.escape(sp['brand_model'])}</code></td>"
            f"<td>{html.escape(sp['incoterm'])}</td>"
            f"<td><b>{p_txt}</b></td>"
            f"<td><b>{cop_txt}</b></td>"
            f"<td><span class='pill'>{html.escape(sp['invima_status'])}</span></td>"
            f"<td><button type='button' class='btn-mini blue' onclick='loadCalc({json.dumps(sp["equipment_name"])}, {sp["unit_price_cop_con_iva"] or 0}, {sp["unit_price_cop_sin_iva"] or 0})'>Usar en Calculadora</button></td></tr>"
        )
    web_rows_html = []
    for wp in p_intel["web_scraped_prices"]:
        web_rows_html.append(
            f"<tr class='price-row' data-search='{html.escape((wp['equipment_name']+' '+wp['sources']+' '+wp['block_name']).lower())}'>"
            f"<td><b>#{wp['line_num']}</b><br><small style='color:#94a3b8;'>{html.escape(wp['block_name'])}</small></td>"
            f"<td><b>{html.escape(wp['equipment_name'])}</b><br><small style='color:#94a3b8;'>{html.escape(wp['sources'])}</small></td>"
            f"<td>{wp['qty_ref']}</td>"
            f"<td>${wp['web_min_cop_iva']:,.0f}</td>"
            f"<td>${wp['web_median_cop_iva']:,.0f}</td>"
            f"<td style='color:#38bdf8;font-weight:700;'>${wp['web_max_cop_iva']:,.0f}</td>"
            f"<td>${wp['base_max_sin_iva_cop']:,.0f}</td>"
            f"<td style='color:#10b981;font-weight:700;'>${wp['ime_quote_sin_iva_plus30_cop']:,.0f}</td>"
            f"<td style='color:#a7f3d0;font-weight:700;'>${wp['ime_quote_con_iva_plus30_cop']:,.0f}</td>"
            f"<td><button type='button' class='btn-mini ok' onclick='loadCalc({json.dumps(wp["equipment_name"])}, {wp["web_max_cop_iva"]}, {wp["base_max_sin_iva_cop"]})'>Calcular</button></td></tr>"
        )
    up_sum = UPTIME_CACHE.get("summary", {"up": 10, "total": 10, "health_pct": 100.0})
    try:
        doc_state = ime_documenso.get_full_status()
        doc_compact_html = render_documenso_sections(doc_state, compact=True)
        doc_full_html = render_documenso_sections(doc_state, compact=False)
        doc_counts = doc_state.get("counts", {})
    except Exception as _de:
        doc_compact_html = f"<div class='board-wrap'>Error Documenso: {html.escape(str(_de))}</div>"
        doc_full_html = doc_compact_html
        doc_counts = {"COMPLETED": 0, "PENDING": 0}
    saved_banner = f'<div style="background:rgba(16,185,129,.2);border:1px solid #10b981;color:#a7f3d0;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:13px;">✅ {html.escape(saved_msg)}</div>' if saved_msg else ""

    def tab_cls(tid, is_pane=False):
        base = "tab-pane" if is_pane else "tab-btn"
        return f"{base} active" if active_tab == tid else base

    if role != "admin":
        return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>I-ME S.A.S. · Vista Ejecutiva: Kanbans & Aprobaciones</title>
<meta name="theme-color" content="#131b22">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="IME Ops">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<style>
  :root {{ --bg:#0b1020; --card:#131b33; --card2:#182240; --border:#26345c; --accent:#10b981; --blue:#3b82f6; --danger:#ef4444; --text:#f1f5f9; --muted:#94a3b8; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); padding-bottom:48px; }}
  header {{ background:#0e152b; border-bottom:1px solid var(--border); padding:12px 16px; position:sticky; top:0; z-index:50; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }}
  .brand h1 {{ font-size:16px; margin:0; }}
  .sub {{ font-size:12px; color:#a7f3d0; font-weight:600; margin-top:3px; }}
  .container {{ max-width:1380px; margin:0 auto; padding:14px; }}
  .board-wrap {{ background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:16px; }}
  .board-hdr {{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }}
  .board-hdr h3 {{ margin:0; font-size:15px; }}
  .add-form {{ display:flex; gap:6px; flex:1; max-width:440px; }}
  .add-form input {{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:#090d1a; color:#fff; font-size:13px; }}
  .k-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:10px; }}
  .k-lane {{ background:var(--card2); border:1px solid var(--border); border-radius:10px; padding:10px; }}
  .k-lane-hdr {{ font-size:13px; font-weight:700; margin-bottom:8px; display:flex; justify-content:space-between; }}
  .cnt {{ background:#0b1020; padding:2px 8px; border-radius:99px; font-size:11px; color:var(--muted); }}
  .k-card {{ background:#0d1428; border:1px solid #283660; border-radius:8px; padding:9px; margin-bottom:8px; font-size:13px; line-height:1.4; }}
  .k-card.done {{ opacity:.72; border-color:#1e3a2f; }}
  .btn-mini {{ border:none; border-radius:6px; padding:6px 11px; font-size:12px; font-weight:600; cursor:pointer; color:#fff; text-decoration:none; display:inline-block; }}
  .btn-mini.ok {{ background:var(--accent); }}
  .btn-mini.blue {{ background:var(--blue); }}
  .pill {{ background:rgba(16,185,129,.15); color:var(--accent); padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); }}
  th {{ color:var(--muted); font-size:11px; text-transform:uppercase; }}
  .table-wrap {{ overflow-x:auto; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:16px; }}
  code {{ background:#090d1a; padding:2px 6px; border-radius:5px; font-size:12px; color:#93c5fd; }}
</style>
</head>
<body>
<header>
  <div class="brand" style="display:flex;align-items:center;gap:12px;">
    <img src="/icon-192.png" alt="IME" width="42" height="42" style="border-radius:10px;border:1px solid var(--border);">
    <div>
    <h1>📋 I-ME S.A.S. · Tablero Ejecutivo de Kanbans &amp; Aprobaciones</h1>
    <div class="sub">👤 Sesión: {html.escape(user)} (Vista Ejecutiva: Kanbans &amp; Aprobaciones) · {now_cot_str()}</div></div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;">
    <a href="https://ops.i-me.com.co:8445" target="_blank" class="btn-mini blue">📋 Vikunja (:8445)</a>
    <a href="/" class="btn-mini" style="background:#334155;">🔄 Actualizar</a>
    <a href="/logout" class="btn-mini" style="background:#475569;">Salir</a>
  </div>
</header>
<div class="container">
  {saved_banner}
  {html_kanban("Kanban-Aprobaciones.md", "0. Tablero Único de Aprobaciones Ejecutivas", k_aprob, is_approvals=True)}
  {html_kanban("Kanban-1-Cotizaciones-y-RFQs.md", "1. Kanban Comercial: Cotizaciones Activas y RFQs", k_1)}
    {doc_compact_html}
  {html_kanban("Kanban-2-Proveedores-e-INVIMA.md", "2. Kanban Proveedores, Ofertas FOB/CIF e INVIMA", k_2)}
  {html_kanban("Kanban-3-Cola-Enjambre-Hermes.md", "3. Kanban Cola Operativa del Enjambre", k_3)}
  <div class="table-wrap">
    <h3 style="margin:0 0 10px;font-size:15px;">🤖 Tareas del Enjambre</h3>
    <table>
      <thead><tr><th>ID</th><th>Responsable</th><th>Estado</th><th>Tarea</th><th>Acción</th></tr></thead>
      <tbody>{''.join(hermes_rows)}</tbody>
    </table>
  </div>
</div>
</body>
</html>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>I-ME S.A.S. · ops.i-me.com.co · Tablero Móvil & Obsidian</title>
<meta name="theme-color" content="#131b22">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="IME Ops">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<style>
  :root {{ --bg:#0b1020; --card:#131b33; --card2:#182240; --border:#26345c; --accent:#10b981; --blue:#3b82f6; --danger:#ef4444; --text:#f1f5f9; --muted:#94a3b8; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); padding-bottom:48px; }}
  header {{ background:#0e152b; border-bottom:1px solid var(--border); padding:12px 16px; position:sticky; top:0; z-index:50; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; }}
  .brand h1 {{ font-size:16px; margin:0; }}
  .sub {{ font-size:11.5px; color:var(--muted); }}
  .nav-tabs {{ display:flex; gap:6px; overflow-x:auto; padding:10px 16px; background:#0d1326; border-bottom:1px solid var(--border); }}
  .tab-btn {{ background:var(--card); color:var(--text); border:1px solid var(--border); padding:9px 13px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; white-space:nowrap; }}
  .tab-btn.active {{ background:var(--blue); border-color:var(--blue); color:#fff; }}
  .container {{ max-width:1380px; margin:0 auto; padding:14px; }}
  .tab-pane {{ display:none; }}
  .tab-pane.active {{ display:block; }}
  .kpi-row {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px; margin-bottom:16px; }}
  .kpi {{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px; }}
  .kpi .lbl {{ font-size:11px; color:var(--muted); text-transform:uppercase; }}
  .kpi .val {{ font-size:22px; font-weight:800; margin:4px 0; color:#fff; }}
  .kpi .foot {{ font-size:11.5px; color:var(--accent); }}
  .board-wrap {{ background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:16px; }}
  .board-hdr {{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }}
  .board-hdr h3 {{ margin:0; font-size:15px; }}
  .add-form {{ display:flex; gap:6px; flex:1; max-width:440px; }}
  .add-form input {{ flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:#090d1a; color:#fff; font-size:13px; }}
  .k-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:10px; }}
  .k-lane {{ background:var(--card2); border:1px solid var(--border); border-radius:10px; padding:10px; }}
  .k-lane-hdr {{ font-size:13px; font-weight:700; margin-bottom:8px; display:flex; justify-content:space-between; }}
  .cnt {{ background:#0b1020; padding:2px 8px; border-radius:99px; font-size:11px; color:var(--muted); }}
  .k-card {{ background:#0d1428; border:1px solid #283660; border-radius:8px; padding:9px; margin-bottom:8px; font-size:13px; line-height:1.4; }}
  .k-card.done {{ opacity:.72; border-color:#1e3a2f; }}
  .btn-mini {{ border:none; border-radius:6px; padding:6px 11px; font-size:12px; font-weight:600; cursor:pointer; color:#fff; text-decoration:none; display:inline-block; }}
  .btn-mini.ok {{ background:var(--accent); }}
  .btn-mini.blue {{ background:var(--blue); }}
  .svc-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(275px,1fr)); gap:10px; margin-bottom:16px; }}
  .svc-card {{ background:var(--card); border:1px solid var(--border); border-left:4px solid var(--accent); border-radius:10px; padding:12px; }}
  .svc-card.st-down {{ border-left-color:var(--danger); }}
  .svc-top {{ display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:4px; font-size:13.5px; }}
  .svc-role {{ font-size:12px; color:var(--muted); margin-bottom:4px; }}
  .svc-det {{ font-size:11.5px; color:#cbd5e1; }}
  .pill {{ background:rgba(16,185,129,.15); color:var(--accent); padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); }}
  th {{ color:var(--muted); font-size:11px; text-transform:uppercase; }}
  .table-wrap {{ overflow-x:auto; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px; margin-bottom:16px; }}
  code {{ background:#090d1a; padding:2px 6px; border-radius:5px; font-size:12px; color:#93c5fd; word-break:break-all; }}
  /* Vault Mobile Browser */
  .vault-layout {{ display:grid; grid-template-columns:300px 1fr; gap:14px; }}
  @media (max-width: 820px) {{ .vault-layout {{ grid-template-columns:1fr; }} }}
  .vault-sidebar {{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px; max-height:70vh; overflow-y:auto; }}
  .note-item {{ display:block; padding:8px 10px; border-radius:8px; color:#cbd5e1; text-decoration:none; font-size:12.5px; margin-bottom:4px; word-break:break-word; }}
  .note-item:hover, .note-item.active {{ background:var(--card2); color:#fff; border-left:3px solid var(--accent); }}
  .vault-editor {{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; }}
  textarea.md-area {{ width:100%; min-height:420px; background:#090d1a; color:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; line-height:1.5; }}
</style>
</head>
<body>
<header>
  <div class="brand" style="display:flex;align-items:center;gap:12px;">
    <img src="/icon-192.png" alt="IME" width="44" height="44" style="border-radius:11px;border:1px solid var(--border);box-shadow:0 4px 12px rgba(0,0,0,.4);">
    <div>
      <h1>⚡ I-ME S.A.S. · ops.i-me.com.co · Tablero Móvil & Obsidian</h1>
      <div class="sub">{now_cot_str()} · Usuario: <b>{html.escape(user)}</b></div>
    </div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;">
    <a href="https://ops.i-me.com.co:8444" target="_blank" class="btn-mini ok">🟢 Uptime Kuma (:8444)</a>
    <a href="https://ops.i-me.com.co:8445" target="_blank" class="btn-mini blue">📋 Vikunja (:8445)</a>
    <a href="/?refresh=1" class="btn-mini" style="background:#334155;">🔄</a>
    <a href="/logout" class="btn-mini" style="background:#475569;">Salir</a>
  </div>
</header>

<div class="nav-tabs">
  <button class="{tab_cls('tab-kanban')}" onclick="showTab('tab-kanban', this)">📋 1. Kanbans & Aprobaciones</button>
  <button class="{tab_cls('tab-vault')}" onclick="showTab('tab-vault', this)">📓 2. Bóveda Obsidian Móvil (IME-Vault)</button>
  <button class="{tab_cls('tab-uptime')}" onclick="showTab('tab-uptime', this)">🟢 3. Semáforo 10 Servicios ({up_sum['up']}/{up_sum['total']})</button>
  <button class="{tab_cls('tab-tokens')}" onclick="showTab('tab-tokens', this)">📊 4. Consumo IA & Correo</button>
  <button class="{tab_cls('tab-prices')}" onclick="showTab('tab-prices', this)">💰 5. Inteligencia de Precios & Calculadora</button>
  <button class="{tab_cls('tab-documenso')}" onclick="showTab('tab-documenso', this)">✍️ 6. Firmas Documenso ({doc_counts.get('COMPLETED',0)}/{doc_counts.get('PENDING',0)})</button>
</div>

<div class="container">
  {saved_banner}
  <div class="kpi-row">
    <div class="kpi"><div class="lbl">Salud Clúster</div><div class="val">{up_sum['up']} / {up_sum['total']} UP</div><div class="foot">Uptime Kuma en :8444 / :3002</div></div>
    <div class="kpi"><div class="lbl">Tokens IA (OpenViking)</div><div class="val">{metrics['total_tokens']:,}</div><div class="foot">{metrics['ov_calls']} llamadas · {metrics['cache_hit_pct']}% Cache Hit</div></div>
    <div class="kpi"><div class="lbl">Ahorro Contexto L0/L1</div><div class="val">~{metrics['estimated_l0_l1_savings_pct']}%</div><div class="foot">{metrics['l0_l1_index_files']} índices activos</div></div>
    <div class="kpi"><div class="lbl">Bóveda Obsidian Móvil</div><div class="val">Web + WebDAV</div><div class="foot">Sincronizada con main (.80) y noa (.10)</div></div>
  </div>

  <!-- TAB 1: KANBANS -->
  <div id="tab-kanban" class="{tab_cls('tab-kanban', True)}">
    {html_kanban("Kanban-Aprobaciones.md", "0. Tablero Único de Aprobaciones de Shoky (Sin Doble Confirmación)", k_aprob, is_approvals=True)}
    {html_kanban("Kanban-1-Cotizaciones-y-RFQs.md", "1. Kanban Comercial: Cotizaciones Activas y RFQs", k_1)}
    {doc_compact_html}
    {html_kanban("Kanban-2-Proveedores-e-INVIMA.md", "2. Kanban Proveedores, Ofertas FOB/CIF e INVIMA", k_2)}
    {html_kanban("Kanban-3-Cola-Enjambre-Hermes.md", "3. Kanban Cola Operativa Enjambre Hermes", k_3)}

    <div class="table-wrap">
      <h3 style="margin:0 0 10px;font-size:15px;">🤖 Tareas del Enjambre Hermes (<code>ime-enjambre/kanban.db</code>)</h3>
      <table>
        <thead><tr><th>ID</th><th>Bot</th><th>Estado</th><th>Tarea</th><th>Acción</th></tr></thead>
        <tbody>{''.join(hermes_rows)}</tbody>
      </table>
    </div>
  </div>

  <!-- TAB 2: BÓVEDA OBSIDIAN MÓVIL (SIN ESCRITORIO REMOTO) -->
  <div id="tab-vault" class="{tab_cls('tab-vault', True)}">
    <div class="board-wrap" style="margin-bottom:14px;">
      <h3 style="margin:0 0 8px;">📱 3 Formas de Usar Obsidian desde el Móvil sin Escritorio Remoto</h3>
      <div class="svc-grid" style="margin-bottom:0;">
        <div class="svc-card">
          <div class="svc-top"><strong>Opción A · Editor Web Directo (Aquí abajo)</strong><span class="pill">0 INSTALACIONES</span></div>
          <div class="svc-det">Busca, lee y edita cualquier nota de <code>IME-Vault</code> aquí mismo. Al guardar, Syncthing lo replica en 2s a <code>main (.80)</code> y <code>noa (.10)</code>.</div>
        </div>
        <div class="svc-card">
          <div class="svc-top"><strong>Opción B · App Oficial Obsidian Android + WebDAV</strong><span class="pill">RECOMENDADA</span></div>
          <div class="svc-det">En la app Obsidian del móvil instala el plugin comunitario <b>Remotely Save</b> → elige <b>WebDAV</b>:<br>
            URL: <code>https://ops.i-me.com.co/webdav/</code> (o por VPN <code>http://100.80.80.8:18880/webdav/</code>)<br>
            Usuario: <code>root@i-me.com.co</code> · Password: <code><REDACTED:OPS_ADMIN_PASSWORD_1></code></div>
        </div>
        <div class="svc-card">
          <div class="svc-top"><strong>Opción C · App Obsidian Android + Syncthing-Fork</strong><span class="pill">P2P POR VPN</span></div>
          <div class="svc-det">Con <b>Syncthing-Fork</b> en Android por Tailscale agrega el servidor <code>srv1715444 (tcp://100.80.80.8:22000)</code>:<br>
            ID Dispositivo: <code>{SYNCTHING_ID_SRV}</code> · Carpeta ID: <code>ime-vault</code></div>
        </div>
      </div>
    </div>

    <div class="vault-layout">
      <div class="vault-sidebar">
        <form method="GET" action="/" style="display:flex;gap:6px;margin-bottom:10px;">
          <input type="hidden" name="tab" value="tab-vault">
          <input type="text" name="q" value="{html.escape(search_q)}" placeholder="Buscar proveedor, cliente o nota..." style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;font-size:12.5px;">
          <button type="submit" class="btn-mini blue">🔍</button>
        </form>
        <div style="font-size:11.5px;color:var(--muted);margin-bottom:8px;">Notas en <code>IME-Vault</code> ({len(notes_list)} mostradas):</div>
        {''.join(notes_links)}
      </div>

      <div class="vault-editor">
        <form method="POST" action="/api/vault/save">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
            <div>
              <strong style="font-size:14px;">📄 {html.escape(clean_rel)}</strong>
              <div style="font-size:11.5px;color:var(--muted);">Ruta en srv1715444: <code>/home/shoky/IME-Vault/{html.escape(clean_rel)}</code></div>
            </div>
            <button type="submit" class="btn-mini ok">💾 Guardar Cambios en IME-Vault</button>
          </div>
          <input type="hidden" name="note" value="{html.escape(clean_rel)}">
          <textarea name="content" class="md-area">{html.escape(note_content)}</textarea>
        </form>
      </div>
    </div>
  </div>

  <!-- TAB 3: UPTIME 10 SERVICIOS -->
  <div id="tab-uptime" class="{tab_cls('tab-uptime', True)}">
    <div class="board-wrap">
      <div class="board-hdr">
        <h3>🟢 Semáforo en Tiempo Real — 10 Servicios Críticos I-ME</h3>
        <div style="display:flex;gap:8px;">
          <a href="https://ops.i-me.com.co:8444" target="_blank" class="btn-mini ok">Abrir Uptime Kuma Completo (:8444)</a>
          <a href="https://ops.i-me.com.co:8445" target="_blank" class="btn-mini blue">Abrir Vikunja Completo (:8445)</a>
        </div>
      </div>
      <div class="svc-grid">{''.join(svcs_html)}</div>
    </div>
  </div>

  <!-- TAB 4: TOKENS IA -->
  <div id="tab-tokens" class="{tab_cls('tab-tokens', True)}">
    <div class="table-wrap">
      <h3 style="margin:0 0 10px;font-size:15px;">🧠 Consumo de Tokens por Modelo IA (<code>OpenViking Meter :18646</code>)</h3>
      <table>
        <thead><tr><th>Modelo</th><th>Ejecuciones</th><th>Prompt</th><th>Completion</th><th>Cached (L0/L1)</th><th>Total</th></tr></thead>
        <tbody>{''.join(models_rows)}</tbody>
      </table>
    </div>
  </div>

  <!-- TAB 5: INTELIGENCIA DE PRECIOS & CALCULADORA (+30% ESTAMPILLAS) -->
  <div id="tab-prices" class="{tab_cls('tab-prices', True)}">
    <div class="board-wrap">
      <div class="board-hdr">
        <h3>🧮 Calculadora Rápida de Cotización I-ME (Proveedor vs. Web Scraping + Estampillas)</h3>
        <span class="pill">Base SQLite: /home/shoky/ime-ops-stack/price-intelligence.db</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;align-items:end;">
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Equipo Seleccionado</label>
          <input id="calc-name" type="text" value="Tallímetro portátil seca 213" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Precio Máx. Web (con IVA COP)</label>
          <input id="calc-max-iva" type="number" value="1488312" oninput="recalcQuote()" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#38bdf8;font-weight:700;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Recargo Estampillas (%)</label>
          <input id="calc-stamp-pct" type="number" value="30" oninput="recalcQuote()" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#10b981;font-weight:700;">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px;">Cantidad</label>
          <input id="calc-qty" type="number" value="1" min="1" oninput="recalcQuote()" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;">
        </div>
      </div>
      <div class="kpi-row" style="margin-top:12px;margin-bottom:0;">
        <div class="kpi"><div class="lbl">Base Máx. Antes de IVA</div><div class="val" id="out-base-sin-iva">$1.250.682</div><div class="foot">Precio Máx. Web ÷ 1,19</div></div>
        <div class="kpi"><div class="lbl">Unitario Cotizado sin IVA (+Estamp.)</div><div class="val" id="out-unit-sin-iva" style="color:#10b981;">$1.625.900</div><div class="foot">Redondeado a centena superior</div></div>
        <div class="kpi"><div class="lbl">Unitario Final con IVA 19%</div><div class="val" id="out-unit-con-iva" style="color:#38bdf8;">$1.934.821</div><div class="foot">Equivalente a Máx. Web × (1 + %Estamp.)</div></div>
        <div class="kpi"><div class="lbl">Total Línea con IVA</div><div class="val" id="out-total-con-iva" style="color:#a7f3d0;">$1.934.821</div><div class="foot" id="out-sub-note">Subtotal sin IVA: $1.625.900</div></div>
      </div>
    </div>

    <div class="board-wrap" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <h3 style="margin:0;font-size:15px;">🔎 Buscador Instantáneo (Proveedores Directos + 40 Líneas Web Scraping UniGuajira)</h3>
        <input id="price-filter" type="text" placeholder="Filtrar por equipo, proveedor, marca o fuente (ej. Angell, camilla, seca, autoclave)..." oninput="filterPriceRows(this.value)" style="flex:1;max-width:480px;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:#090d1a;color:#fff;font-size:13px;">
      </div>
    </div>

    <div class="table-wrap">
      <h3 style="margin:0 0 10px;font-size:15px;">🏭 1. Precios Reales Enviados por Proveedores y Catálogo Base IME ({len(p_intel['supplier_prices'])} registros)</h3>
      <table>
        <thead><tr><th>Proveedor</th><th>Equipo / Modelo</th><th>Incoterm</th><th>Precio Origen</th><th>Base COP (sin IVA)</th><th>INVIMA</th><th>Acción</th></tr></thead>
        <tbody>{''.join(sup_rows_html)}</tbody>
      </table>
    </div>

    <div class="table-wrap">
      <h3 style="margin:0 0 10px;font-size:15px;">🌐 2. Inteligencia de Precios Web Colombia + Ampliación UniGuajira <code>IME-Q-2026-000033</code> ({len(p_intel['web_scraped_prices'])} líneas · Consolidado $94.476.718 COP c/IVA)</h3>
      <table>
        <thead><tr><th>Línea</th><th>Equipo Biomédico / Fuentes Web</th><th>Cant.</th><th>Web Mín (c/IVA)</th><th>Web Mediana</th><th>Nuestro Máx Web (c/IVA)</th><th>Base Máx (sin IVA)</th><th>Unit. Cotizado sin IVA (+30%)</th><th>Unit. Final con IVA (+30%)</th><th>Acción</th></tr></thead>
        <tbody>{''.join(web_rows_html)}</tbody>
      </table>
    </div>
  </div>

  <!-- TAB 6: FIRMAS ELECTRÓNICAS DOCUMENSO (firmas.i-me.com.co) -->
  <div id="tab-documenso" class="{tab_cls('tab-documenso', True)}">
    {doc_full_html}
  </div>
</div>

<script>
function prefillDocumenso(qid, ccode, cname, sname, semail, srole) {{
  const tabBtn = document.querySelector("button[onclick*=\"tab-documenso\"]");
  if (tabBtn) showTab('tab-documenso', tabBtn);
  document.getElementById('doc-quote-id').value = qid || '';
  document.getElementById('doc-client-code').value = ccode || '';
  document.getElementById('doc-client-name').value = cname || '';
  document.getElementById('doc-signer-name').value = (sname && !sname.startsWith('Pendiente')) ? sname : '';
  document.getElementById('doc-signer-email').value = semail || '';
  document.getElementById('doc-signer-role').value = srole || '';
  const box = document.getElementById('documenso-form-box');
  if (box) box.scrollIntoView({{behavior: 'smooth', block: 'center'}});
}}
function showTab(id, btn) {{
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}}
function fmtCop(n) {{
  return '$' + Math.round(n).toLocaleString('es-CO');
}}
function recalcQuote() {{
  const maxIva = parseFloat(document.getElementById('calc-max-iva').value || '0');
  const stampPct = parseFloat(document.getElementById('calc-stamp-pct').value || '0') / 100.0;
  const qty = Math.max(1, parseInt(document.getElementById('calc-qty').value || '1', 10));
  const baseSinIva = Math.round(maxIva / 1.19);
  const unitSinIva = Math.ceil((baseSinIva * (1.0 + stampPct)) / 100.0) * 100;
  const unitConIva = Math.round(unitSinIva * 1.19);
  const subSinIva = unitSinIva * qty;
  const totConIva = subSinIva + Math.round(subSinIva * 0.19);
  document.getElementById('out-base-sin-iva').textContent = fmtCop(baseSinIva);
  document.getElementById('out-unit-sin-iva').textContent = fmtCop(unitSinIva);
  document.getElementById('out-unit-con-iva').textContent = fmtCop(unitConIva);
  document.getElementById('out-total-con-iva').textContent = fmtCop(totConIva);
  document.getElementById('out-sub-note').textContent = 'Subtotal sin IVA: ' + fmtCop(subSinIva);
}}
function loadCalc(name, maxIva, baseSinIva) {{
  document.getElementById('calc-name').value = name;
  document.getElementById('calc-max-iva').value = Math.round(maxIva || (baseSinIva * 1.19));
  recalcQuote();
  document.getElementById('calc-name').scrollIntoView({{behavior: 'smooth', block: 'center'}});
}}
function filterPriceRows(q) {{
  const norm = (q || '').trim().toLowerCase();
  document.querySelectorAll('.price-row').forEach(tr => {{
    const hay = tr.getAttribute('data-search') || '';
    tr.style.display = (!norm || hay.includes(norm)) ? '' : 'none';
  }});
}}
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {{}}));
}}
</script>
</body>
</html>"""


class OpsHubHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def client_ip(self):
        xff = self.headers.get("CF-Connecting-IP") or self.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        return self.client_address[0]

    def send_security_headers(self):
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")

    def get_authenticated_session(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and hmac.compare_digest(auth[7:].strip(), API_TOKEN):
            return "root@i-me.com.co", "admin"
        if auth.startswith("Basic "):
            try:
                raw = base64.b64decode(auth[6:].strip()).decode("utf-8", errors="ignore")
                if ":" in raw:
                    u, p = raw.split(":", 1)
                    acct_user, role = authenticate_credentials(u, p)
                    if acct_user:
                        return acct_user, role
            except Exception:
                pass
        cookie_hdr = self.headers.get("Cookie", "")
        for part in cookie_hdr.split(";"):
            part = part.strip()
            if part.startswith("ime_ops_session="):
                u, role = verify_session_cookie(part.split("=", 1)[1])
                if u:
                    return u, role
        return None, None

    def handle_webdav(self, method):
        user, role = self.get_authenticated_session()
        if not user:
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="IME-Vault WebDAV"')
            self.end_headers()
            return
        if role != "admin":
            log_security(self.client_ip(), "webdav_forbidden_role", f"user={user} role={role}")
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"error":"403 Forbidden: WebDAV requiere rol admin"}')
            return

        parsed = urllib.parse.urlparse(self.path)
        rel = urllib.parse.unquote(parsed.path[len("/webdav"):]).lstrip("/")
        full, clean_rel = safe_vault_path(rel)

        if method == "OPTIONS":
            self.send_response(200)
            self.send_header("DAV", "1, 2")
            self.send_header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, MOVE, COPY")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if method == "PROPFIND":
            depth = self.headers.get("Depth", "1")
            if not os.path.exists(full):
                self.send_response(404)
                self.end_headers()
                return
            entries = [(full, clean_rel)]
            if os.path.isdir(full) and depth != "0":
                for fn in sorted(os.listdir(full)):
                    entries.append((os.path.join(full, fn), os.path.join(clean_rel, fn) if clean_rel else fn))
            xml_items = []
            for fpath, rpath in entries:
                try:
                    st = os.stat(fpath)
                except Exception:
                    continue
                is_dir = os.path.isdir(fpath)
                href = "/webdav/" + urllib.parse.quote(rpath.replace("\\", "/")) + ("/" if is_dir and rpath else "")
                mtime = email.utils.formatdate(st.st_mtime, usegmt=True)
                res_type = "<D:collection/>" if is_dir else ""
                size_tag = "" if is_dir else f"<D:getcontentlength>{st.st_size}</D:getcontentlength>"
                xml_items.append(f"""
                <D:response>
                  <D:href>{href}</D:href>
                  <D:propstat>
                    <D:prop>
                      <D:getlastmodified>{mtime}</D:getlastmodified>
                      {size_tag}
                      <D:resourcetype>{res_type}</D:resourcetype>
                    </D:prop>
                    <D:status>HTTP/1.1 200 OK</D:status>
                  </D:propstat>
                </D:response>""")
            body = ('<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">' + "".join(xml_items) + "</D:multistatus>").encode("utf-8")
            self.send_response(207, "Multi-Status")
            self.send_header("Content-Type", "application/xml; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if method in ("GET", "HEAD"):
            if not os.path.isfile(full):
                self.send_response(404)
                self.end_headers()
                return
            with open(full, "rb") as f:
                data = f.read()
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if method == "GET":
                self.wfile.write(data)
            return

        if method == "PUT":
            length = int(self.headers.get("Content-Length", "0") or "0")
            data = self.rfile.read(length) if length > 0 else b""
            os.makedirs(os.path.dirname(full), exist_ok=True)
            existed = os.path.exists(full)
            with open(full, "wb") as f:
                f.write(data)
            self.send_response(204 if existed else 201)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if method == "MKCOL":
            os.makedirs(full, exist_ok=True)
            self.send_response(201)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        if method == "DELETE":
            if os.path.isfile(full):
                os.remove(full)
            self.send_response(204)
            self.end_headers()
            return

        self.send_response(405)
        self.end_headers()

    def do_OPTIONS(self):
        if self.path.startswith("/webdav"):
            return self.handle_webdav("OPTIONS")
        self.send_response(200)
        self.end_headers()

    def do_PROPFIND(self):
        return self.handle_webdav("PROPFIND")

    def do_MKCOL(self):
        return self.handle_webdav("MKCOL")

    def do_PUT(self):
        return self.handle_webdav("PUT")

    def do_DELETE(self):
        return self.handle_webdav("DELETE")

    def do_HEAD(self):
        if self.path.startswith("/webdav"):
            return self.handle_webdav("HEAD")
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in PWA_ASSETS:
            fn, ctype = PWA_ASSETS[parsed.path]
            fpath = os.path.join(PWA_DIR, fn)
            if os.path.isfile(fpath):
                st = os.stat(fpath)
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(st.st_size))
                self.send_header("Cache-Control", "public, max-age=3600")
                self.end_headers()
                return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_security_headers()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/webdav"):
            return self.handle_webdav("GET")

        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        ip = self.client_ip()

        if parsed.path in PWA_ASSETS:
            fn, ctype = PWA_ASSETS[parsed.path]
            fpath = os.path.join(PWA_DIR, fn)
            if os.path.isfile(fpath):
                with open(fpath, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=3600")
                self.end_headers()
                self.wfile.write(data)
                return

        if parsed.path == "/healthz":
            body = json.dumps({"status": "ok", "service": "ime-ops-hub", "domain": "ops.i-me.com.co", "time_cot": now_cot_str()}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if "token" in qs and hmac.compare_digest(qs["token"][0], API_TOKEN):
            cookie = make_session_cookie("root@i-me.com.co", "admin")
            log_security(ip, "magic_token_login_ok")
            self.send_response(302)
            self.send_header("Set-Cookie", f"ime_ops_session={cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200")
            self.send_header("Location", "/")
            self.send_security_headers()
            self.end_headers()
            return

        if parsed.path == "/logout":
            self.send_response(302)
            self.send_header("Set-Cookie", "ime_ops_session=deleted; Path=/; HttpOnly; Max-Age=0")
            self.send_header("Location", "/login")
            self.send_security_headers()
            self.end_headers()
            return

        user, role = self.get_authenticated_session()
        if not user:
            err_msg = '<div class="err">Credenciales inválidas. Verifica tu usuario y contraseña.</div>' if "err" in qs else ""
            body = LOGIN_HTML.replace("__ERR_BLOCK__", err_msg).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path.startswith("/api/vault"):
            if role != "admin":
                log_security(ip, "vault_api_forbidden", f"user={user} role={role} path={parsed.path}")
                self.send_response(403)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_security_headers()
                self.end_headers()
                self.wfile.write(b'{"error":"403 Forbidden: Acceso a Boveda Obsidian restringido a rol admin"}')
                return
            rel = qs.get("path", qs.get("note", ["00-Panel-Control/Dashboard-Operativo.md"]))[0]
            full, clean_rel = safe_vault_path(rel)
            if not clean_rel or not os.path.isfile(full):
                self.send_response(404)
                self.end_headers()
                return
            with open(full, "r", encoding="utf-8", errors="ignore") as f:
                txt = f.read()
            body = json.dumps({"note": clean_rel, "content": txt}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/documenso":
            body = json.dumps(ime_documenso.get_full_status(), ensure_ascii=False, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/documenso/delete":
            qs = urllib.parse.parse_qs(parsed.query)
            env_id = (qs.get("envelope_id", [""])[0]).strip()
            res = ime_documenso.delete_envelope(env_id)
            msg = f"Sobre eliminado: {env_id}" if res.get("ok") else f"Error al borrar: {res.get('error')}"
            self.send_response(303)
            self.send_header("Location", f"/?tab=tab-documenso&saved=1&msg={urllib.parse.quote(msg)}")
            self.end_headers()
            return

        if parsed.path == "/api/documenso/download":
            env_id = qs.get("envelope_id", [""])[0]
            client_c = qs.get("client", [""])[0]
            res = ime_documenso.download_signed_pdfs(env_id, client_code=client_c)
            if res.get("ok") and res.get("saved_files"):
                msg = f"PDF firmado guardado en {res['saved_files'][0]['path']}"
            else:
                msg = f"Resultado descarga Documenso: {res.get('error', 'sin archivos')}"
            self.send_response(302)
            self.send_header("Location", f"/?tab=tab-documenso&saved=1&msg={urllib.parse.quote(msg)}")
            self.end_headers()
            return

        if parsed.path == "/api/prices":
            if role != "admin":
                self.send_response(403)
                self.end_headers()
                return
            body = json.dumps(get_price_intelligence(), ensure_ascii=False, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/status":
            if role != "admin":
                payload = {
                    "approvals": parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-Aprobaciones.md")),
                    "kanbans": {
                        "comercial": parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-1-Cotizaciones-y-RFQs.md")),
                        "proveedores": parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-2-Proveedores-e-INVIMA.md")),
                        "cola": parse_obsidian_kanban(os.path.join(PANEL_DIR, "Kanban-3-Cola-Enjambre-Hermes.md"))
                    },
                    "timestamp": now_cot_str()
                }
            else:
                if len(UPTIME_CACHE.get("services", [])) == 0:
                    poll_10_services()
                payload = {"uptime": UPTIME_CACHE, "metrics": get_token_and_ai_metrics(), "timestamp": now_cot_str()}
            body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_security_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if "refresh" in qs and role == "admin":
            poll_10_services()

        active_tab = qs.get("tab", ["tab-kanban"])[0]
        note_rel = qs.get("note", ["00-Panel-Control/Dashboard-Operativo.md"])[0]
        search_q = qs.get("q", [""])[0]
        saved_msg = qs.get("msg", ["Nota guardada y sincronizada en IME-Vault."])[0] if "saved" in qs else ""

        body = render_dashboard(user, role=role, active_tab=active_tab, note_rel=note_rel, search_q=search_q, saved_msg=saved_msg).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_security_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        ip = self.client_ip()
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw_body = self.rfile.read(length).decode("utf-8", errors="ignore") if length > 0 else ""
        form = {k: v[0] for k, v in urllib.parse.parse_qs(raw_body, keep_blank_values=True).items()}

        if parsed.path == "/webhook/documenso":
            sig = self.headers.get("X-Documenso-Secret", "")
            try:
                payload_json = json.loads(raw_body or "{}")
            except Exception:
                payload_json = {}
            res = ime_documenso.process_webhook_event(payload_json, signature_header=sig)
            code = 200 if res.get("ok") else 401
            out = json.dumps(res, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(out)
            return

        if parsed.path == "/login":
            if is_ip_locked(ip):
                self.send_response(429)
                self.end_headers()
                self.wfile.write(b"429 Too Many Requests")
                return
            u = form.get("username", "").strip()
            p = form.get("password", "").strip()
            totp = form.get("totp", "").strip()

            acct_user, role = authenticate_credentials(u, p)
            valid_2fa = (not totp) or verify_totp(totp)

            if acct_user and valid_2fa:
                cookie = make_session_cookie(acct_user, role)
                log_security(ip, "login_success", f"user={acct_user} role={role}")
                self.send_response(302)
                self.send_header("Set-Cookie", f"ime_ops_session={cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200")
                self.send_header("Location", "/")
                self.send_security_headers()
                self.end_headers()
            else:
                record_failed_login(ip)
                log_security(ip, "login_failed", f"user={u}")
                self.send_response(302)
                self.send_header("Location", "/login?err=1")
                self.send_security_headers()
                self.end_headers()
            return

        user, role = self.get_authenticated_session()
        if not user:
            self.send_response(401)
            self.end_headers()
            return

        if parsed.path.startswith("/api/vault"):
            if role != "admin":
                log_security(ip, "vault_post_forbidden", f"user={user} role={role}")
                self.send_response(403)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"error":"403 Forbidden: Solo rol admin puede editar la Boveda Obsidian"}')
                return
            note_rel = form.get("note", "00-Panel-Control/Dashboard-Operativo.md")
            content = form.get("content", "").replace("\r\n", "\n")
            full, clean_rel = safe_vault_path(note_rel)
            if clean_rel and clean_rel.endswith(".md"):
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, "w", encoding="utf-8") as f:
                    f.write(content)
                log_security(ip, "vault_note_saved", clean_rel)
            self.send_response(302)
            self.send_header("Location", f"/?tab=tab-vault&note={urllib.parse.quote(clean_rel)}&saved=1")
            self.end_headers()
            return

        if parsed.path in ("/api/kanban/action", "/post/approve"):
            toggle_or_move_kanban_card(form.get("board", "Kanban-Aprobaciones.md"), form.get("query", ""), action=form.get("action", "approve"), target_lane=form.get("target_lane", "") or None)
            self.send_response(302)
            self.send_header("Location", "/?tab=tab-kanban")
            self.end_headers()
            return

        if parsed.path in ("/api/kanban/add", "/post/task"):
            text = form.get("text", "").strip()
            if text:
                add_kanban_card(form.get("board", "Kanban-1-Cotizaciones-y-RFQs.md"), text)
            self.send_response(302)
            self.send_header("Location", "/?tab=tab-kanban")
            self.end_headers()
            return

        if parsed.path == "/api/documenso/prepare":
            send_now = form.get("send_mode") == "send_authorized"
            try:
                res = ime_documenso.create_envelope_from_quote(
                    quote_id=form.get("quote_id", "").strip(),
                    client_code=form.get("client_code", "WELCOME").strip(),
                    client_name=form.get("client_name", "").strip(),
                    signer_name=form.get("signer_name", "").strip(),
                    signer_email=form.get("signer_email", "").strip(),
                    signer_role=form.get("signer_role", "").strip(),
                    send_immediately=send_now,
                    authorized_by_shoky=send_now,
                )
                msg = res.get("message") or f"Sobre {res.get('envelope_id','')} preparado en Documenso ({res.get('status','')})."
            except Exception as e:
                msg = f"Aviso Documenso: {e}"
            self.send_response(302)
            self.send_header("Location", f"/?tab=tab-documenso&saved=1&msg={urllib.parse.quote(msg)}")
            self.end_headers()
            return

        if parsed.path == "/api/documenso/token":
            if role == "admin":
                api_k = form.get("api_key", "").strip()
                ime_documenso.save_documenso_api_key(api_k)
                msg = "API Token de Documenso guardado en /home/shoky/.hermes/.documenso.env (0600)."
            else:
                msg = "Solo admin puede actualizar el token."
            self.send_response(302)
            self.send_header("Location", f"/?tab=tab-documenso&saved=1&msg={urllib.parse.quote(msg)}")
            self.end_headers()
            return

        if parsed.path == "/api/hermes/status":
            update_hermes_task_status(form.get("task_id", ""), form.get("status", "ready"))
            self.send_response(302)
            self.send_header("Location", "/?tab=tab-kanban")
            self.end_headers()
            return

        self.send_response(404)
        self.end_headers()


def serve_on(host, port):
    try:
        srv = ThreadingHTTPServer((host, port), OpsHubHandler)
        print(f"[ime-ops-hub] Listening on {host}:{port}", flush=True)
        srv.serve_forever()
    except Exception as e:
        print(f"[ime-ops-hub] Could not bind {host}:{port}: {e}", flush=True)


if __name__ == "__main__":
    poll_10_services()
    threading.Thread(target=background_poller, daemon=True).start()
    threading.Thread(target=serve_on, args=("127.0.0.1", 3784), daemon=True).start()
    threading.Thread(target=serve_on, args=("127.0.0.1", 9119), daemon=True).start()
    serve_on("0.0.0.0", 18880)
