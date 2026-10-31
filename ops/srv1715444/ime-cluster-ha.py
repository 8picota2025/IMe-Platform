#!/usr/bin/env python3
"""IME Store-and-Forward Cluster HA Manager (srv1715444 <-> main .80 / main-wsl .81 <-> noa .10).

Objetivo (Directriz Shoky [t344u]):
- Bascular el cómputo pesado (GPU RTX 3080 Ti, llama.cpp Qwen3, OmniRoute, OpenViking, Obsidian)
  hacia main (100.80.80.80) y su WSL (100.80.80.81) cuando están en línea.
- Cero dependencia de punto único de fallo: si main (.80/.81) pierde conexión temporal a internet,
  srv1715444 sigue operando al 100% con su OpenViking local (127.0.0.1:1935), su bóveda /home/shoky/IME-Vault
  y su cola transaccional, encolando los deltas en /home/shoky/.hermes/shared/cluster-spool/ para
  sincronizarlos automáticamente en cuanto vuelva el ping.
"""
import os
import sys
import json
import time
import glob
import socket
import tarfile
import datetime
import urllib.request

import sys as _ime_sys
from pathlib import Path as _ImePath
_ime_sys.path.insert(0, str(_ImePath(__file__).resolve().parent))
import ime_log
log = ime_log.get_logger("ime-cluster-ha")

STATE_DIR = "/home/shoky/.hermes/shared/estado"
SPOOL_DIR = "/home/shoky/.hermes/shared/cluster-spool"
STATE_FILE = f"{STATE_DIR}/cluster_ha.json"
LOG_FILE = "/home/shoky/.hermes/shared/logs/cluster_ha.log"
SEED_BUNDLE = "/home/shoky/.hermes/shared/memoria/openviking/wsl81-seed-bundle.jsonl"
SYNCED_MARKER = f"{SPOOL_DIR}/wsl81_openviking_seeded.stamp"

def check_tcp(host: str, port: int, timeout: float = 1.8):
    t0 = time.time()
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        return True, round((time.time() - t0) * 1000, 1)
    except Exception:
        log.exception("ime-cluster-ha")
        return False, None

def check_http_json(url: str, timeout: float = 2.0):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ime-cluster-ha/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(1024).decode("utf-8", errors="ignore")
            return r.status == 200, body[:200]
    except Exception as exc:
        log.exception("ime-cluster-ha")
        return False, str(exc)[:120]

def sync_openviking_to_wsl81(ov_port: int):
    """Cuando OpenViking en 100.80.80.81 levante en :1935 o :1933, hidrata automáticamente el bundle L0/L1."""
    if not os.path.exists(SEED_BUNDLE):
        return "no_seed_bundle"
    role_keys_path = "/home/shoky/.hermes/shared/memoria/openviking/role-keys.json"
    root_key = None
    if os.path.exists(role_keys_path):
        try:
            rk = json.load(open(role_keys_path, "r", encoding="utf-8"))
            root_key = rk.get("roles", {}).get("main-ime", {}).get("api_key")
        except Exception:
            log.exception("ime-cluster-ha")
    # Also check openviking.conf root_api_key if needed
    ov_conf = "/home/shoky/.hermes/shared/memoria/openviking/openviking.conf"
    if not root_key and os.path.exists(ov_conf):
        try:
            root_key = json.load(open(ov_conf, "r", encoding="utf-8")).get("server", {}).get("root_api_key")
        except Exception:
            log.exception("ime-cluster-ha")

    sent = 0
    with open(SEED_BUNDLE, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            uri = f"viking://user/main-ime/memories/patterns/{rec['uri_slug']}.md"
            payload = json.dumps({
                "uri": uri,
                "content": f"<!-- L0: {rec['abstract']} -->\n\n{rec['overview']}",
                "Author": "ime-cluster-ha-sync",
                "processing_mode": "vectors_only",
                "wait": False
            }).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if root_key:
                headers["X-API-Key"] = root_key
            try:
                req = urllib.request.Request(
                    f"http://100.80.80.81:{ov_port}/api/v1/content/write",
                    data=payload,
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=4) as resp:
                    if resp.status in (200, 201):
                        sent += 1
            except Exception:
                log.exception("ime-cluster-ha")
                break
    if sent > 0:
        with open(SYNCED_MARKER, "w", encoding="utf-8") as mf:
            mf.write(f"seeded {sent} items at {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n")
    return f"seeded_{sent}"

def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    os.makedirs(SPOOL_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_cot = now_utc - datetime.timedelta(hours=5)

    # Probe main (100.80.80.80)
    main_smb_ok, main_smb_ms = check_tcp("100.80.80.80", 445)
    main_ssh_ok, main_ssh_ms = check_tcp("100.80.80.80", 22)
    main_rdp_ok, main_rdp_ms = check_tcp("100.80.80.80", 3389)

    # Probe main-wsl (100.80.80.81)
    wsl_omni_ok, wsl_omni_ms = check_tcp("100.80.80.81", 20128)
    wsl_llama_ok, wsl_llama_ms = check_tcp("100.80.80.81", 8080)
    wsl_voice_ok, wsl_voice_ms = check_tcp("100.80.80.81", 8000)
    wsl_ov1935_ok, wsl_ov1935_ms = check_tcp("100.80.80.81", 1935)
    wsl_ov1933_ok, wsl_ov1933_ms = check_tcp("100.80.80.81", 1933)

    # Probe noa (100.80.80.10)
    noa_smb_ok, noa_smb_ms = check_tcp("100.80.80.10", 445)
    noa_ssh_ok, noa_ssh_ms = check_tcp("100.80.80.10", 22)

    # Probe local srv1715444 services
    loc_ov_ok, loc_ov_ms = check_tcp("127.0.0.1", 1935)
    loc_emb_ok, loc_emb_ms = check_tcp("127.0.0.1", 1936)
    loc_n8n_ok, loc_n8n_ms = check_tcp("127.0.0.1", 5678)
    loc_hermes_ok, loc_hermes_ms = check_tcp("127.0.0.1", 8642)

    wsl_online = bool(wsl_omni_ok or wsl_llama_ok or wsl_voice_ok)
    main_online = bool(main_smb_ok or main_ssh_ok or main_rdp_ok)
    wsl_ov_port = 1935 if wsl_ov1935_ok else (1933 if wsl_ov1933_ok else None)

    ov_sync_status = "standby_local_primary"
    if wsl_ov_port and not os.path.exists(SYNCED_MARKER):
        ov_sync_status = sync_openviking_to_wsl81(wsl_ov_port)
    elif wsl_ov_port:
        ov_sync_status = f"active_wsl81_port_{wsl_ov_port}"

    # Determine active compute routing (Store-and-Forward HA)
    routing = {
        "mode": "hybrid_offload_to_main" if (main_online and wsl_online) else "autonomous_local_fallback",
        "llm_gateway_primary": "http://100.80.80.81:20128/v1" if wsl_omni_ok else "http://127.0.0.1:8642/v1",
        "llm_local_gpu": "http://100.80.80.81:8080/v1" if wsl_llama_ok else None,
        "gpu_models_available": ["Qwen3-14B-Q4_K_M", "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M"] if wsl_llama_ok else [],
        "voice_pilot_endpoint": "http://100.80.80.81:8000" if wsl_voice_ok else None,
        "openviking_read_endpoint": f"http://100.80.80.81:{wsl_ov_port}" if wsl_ov_port else "http://127.0.0.1:1935",
        "openviking_write_endpoints": (
            [f"http://100.80.80.81:{wsl_ov_port}", "http://127.0.0.1:1935"]
            if wsl_ov_port else ["http://127.0.0.1:1935"]
        ),
        "openviking_wsl81_sync": ov_sync_status,
        "obsidian_vault_local": "/home/shoky/IME-Vault",
        "obsidian_spool_archive": f"{SPOOL_DIR}/ime-vault-latest.tar.gz",
        "backup_target_noa": "100.80.80.10" if noa_smb_ok else "spool_local_until_noa_online"
    }

    status_payload = {
        "timestamp_utc": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timestamp_cot": now_cot.strftime("%Y-%m-%d %H:%M:%S COT"),
        "nodes": {
            "srv1715444_100_80_80_8": {
                "online": True,
                "openviking_1935": {"up": loc_ov_ok, "ms": loc_ov_ms},
                "embedding_1936": {"up": loc_emb_ok, "ms": loc_emb_ms},
                "n8n_5678": {"up": loc_n8n_ok, "ms": loc_n8n_ms},
                "hermes_8642": {"up": loc_hermes_ok, "ms": loc_hermes_ms}
            },
            "main_100_80_80_80": {
                "online": main_online,
                "smb_445": {"up": main_smb_ok, "ms": main_smb_ms},
                "ssh_22": {"up": main_ssh_ok, "ms": main_ssh_ms},
                "rdp_3389": {"up": main_rdp_ok, "ms": main_rdp_ms}
            },
            "main_wsl_100_80_80_81": {
                "online": wsl_online,
                "omniroute_20128": {"up": wsl_omni_ok, "ms": wsl_omni_ms},
                "llama_gpu_8080": {"up": wsl_llama_ok, "ms": wsl_llama_ms},
                "voice_pilot_8000": {"up": wsl_voice_ok, "ms": wsl_voice_ms},
                "openviking_1935": {"up": wsl_ov1935_ok, "ms": wsl_ov1935_ms},
                "openviking_1933": {"up": wsl_ov1933_ok, "ms": wsl_ov1933_ms}
            },
            "noa_100_80_80_10": {
                "online": bool(noa_smb_ok or noa_ssh_ok),
                "smb_445": {"up": noa_smb_ok, "ms": noa_smb_ms},
                "ssh_22": {"up": noa_ssh_ok, "ms": noa_ssh_ms}
            }
        },
        "routing": routing
    }

    tmp_file = f"{STATE_FILE}.tmp"
    with open(tmp_file, "w", encoding="utf-8") as f:
        json.dump(status_payload, f, indent=2, ensure_ascii=False)
    os.replace(tmp_file, STATE_FILE)

    # Sync Obsidian Kanban-3 from Hermes kanban.db before refreshing spool archive
    log.info("accion=sync_obsidian_kanbans resultado=desactivado")

    # Refresh lightweight Markdown snapshot archive in spool if missing or >15 min old
    spool_tar = f"{SPOOL_DIR}/ime-vault-latest.tar.gz"
    if os.path.isdir("/home/shoky/IME-Vault"):
        need_tar = (not os.path.exists(spool_tar)) or ((time.time() - os.path.getmtime(spool_tar)) > 900)
        if need_tar:
            tmp_tar = f"{spool_tar}.tmp"
            with tarfile.open(tmp_tar, "w:gz") as tf:
                tf.add("/home/shoky/IME-Vault", arcname="IME-Vault")
            os.replace(tmp_tar, spool_tar)

    with open(LOG_FILE, "a", encoding="utf-8") as lf:
        lf.write(
            f"{status_payload['timestamp_cot']} | mode={routing['mode']} | "
            f"main80={'UP' if main_online else 'DOWN'}({main_smb_ms}ms) | "
            f"wsl81={'UP' if wsl_online else 'DOWN'}(llama={wsl_llama_ms}ms,omni={wsl_omni_ms}ms,ov={wsl_ov_port}) | "
            f"noa10={'UP' if noa_smb_ok else 'DOWN'}({noa_smb_ms}ms)\n"
        )

    if "--print" in sys.argv:
        print(json.dumps(status_payload, indent=2, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
