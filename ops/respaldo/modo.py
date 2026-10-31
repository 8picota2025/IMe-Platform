#!/usr/bin/env python3
"""Lee o fija modo.json. No arranca servicios ni envía avisos fuera de la máquina."""

from __future__ import annotations

import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de
from respaldo_lib import ORIGENES_MANUAL, _auditar, _exigir_origen, _fijar_modo, _leer_modo


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("modo.json: get | set normal|respaldo")
    parser.add_argument("accion", choices=("get", "set"))
    parser.add_argument("valor", nargs="?", choices=("normal", "respaldo"))
    parser.add_argument("--quien", default=None)
    parser.add_argument("--origen", default="cli")
    parser.add_argument("--motivo", default="")
    args = parser.parse_args(argv)
    rutas = raiz_de(args)
    if args.accion == "get":
        return emitir(_leer_modo(rutas) or {"modo": None})
    if args.valor is None:
        print("falta normal o respaldo", file=sys.stderr)
        return 2
    if args.dry_run:
        return emitir({"dry_run": True, "modo": args.valor, "motivo": args.motivo})
    quien = (args.quien or "").strip()
    if not quien:
        print("falta --quien", file=sys.stderr)
        return 2
    _exigir_origen(args.origen, ORIGENES_MANUAL)
    now = ahora_de(args)
    _fijar_modo(
        rutas,
        modo=args.valor,
        motivo=args.motivo.strip()[:500],
        quien=quien,
        origen=args.origen,
        now=now,
        estado_inicial=False,
    )
    _auditar(
        rutas,
        utc=now,
        quien=quien,
        accion="modo_respaldo" if args.valor == "respaldo" else "modo_normal",
        origen=args.origen,
        motivo=args.motivo.strip()[:500],
    )
    return emitir({"modo": args.valor, "motivo": args.motivo})


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
