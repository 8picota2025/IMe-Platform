#!/usr/bin/env python3
"""Copia el latido y el manual desde Supabase hacia los ficheros locales."""

from __future__ import annotations

import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de
from respaldo_lib import fusionar_remoto, reintentar_salida, transport_desde_entorno


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("Vuelca el tablón remoto a ~/.hermes/estado. Sin credenciales no toca nada.")
    args = parser.parse_args(argv)
    transport = transport_desde_entorno()
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
