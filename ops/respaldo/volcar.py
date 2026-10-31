#!/usr/bin/env python3
"""Copia el latido y el manual desde Supabase hacia los ficheros locales."""

from __future__ import annotations

import os
import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de
from respaldo_lib import fusionar_remoto, post_rpc, reintentar_salida, transport_desde_entorno


def transport_volcar():
    """Token de alcance respaldo_lectura. Si no está, vale el de worker (también puede pull y expirar)."""
    lectura = os.environ.get("IMEIA_TOKEN_LECTURA", "").strip()
    if not lectura:
        return transport_desde_entorno()
    url = os.environ.get("SUPABASE_URL", "").strip()
    anon = (os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("IMEIA_SUPABASE_ANON_KEY") or "").strip()
    if not (url and anon):
        return None

    def transport(rpc: str, body: dict) -> dict:
        return post_rpc(url, anon, lectura, rpc, body)

    return transport


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("Vuelca el tablón remoto a ~/.hermes/estado. Sin credenciales no toca nada.")
    args = parser.parse_args(argv)
    transport = transport_volcar()
    if transport is None:
        return emitir({"sync": "omitido", "motivo": "sin_credenciales", "dry_run": args.dry_run})
    if not args.dry_run:
        try:
            transport("imeia_respaldo_expirar", {"quien": "detector", "origen": "hermes"})
        except Exception as error:
            print(f"aviso: expirar remoto falló ({error.__class__.__name__})", file=sys.stderr)
    try:
        remoto = transport("imeia_respaldo_pull", {})
    except Exception as error:
        print(f"aviso: pull remoto falló ({error.__class__.__name__})", file=sys.stderr)
        return emitir({"sync": "error", "motivo": error.__class__.__name__, "dry_run": args.dry_run})
    rutas = raiz_de(args)
    fusion = fusionar_remoto(rutas, remoto if isinstance(remoto, dict) else {}, now=ahora_de(args), dry_run=args.dry_run)
    salida = {"reenviados": 0, "pendientes": 0}
    if not args.dry_run:
        salida = reintentar_salida(rutas, transport)
    return emitir({"sync": "ok", "dry_run": args.dry_run, "fusion": fusion, "salida": salida})


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
