#!/usr/bin/env python3
"""Registra el latido de Grok: ok, fallo o sin_tokens."""

from __future__ import annotations

import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de, transporte_si_aplica
from respaldo_lib import registrar_latido


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("Escribe latido-grokbot.json y, si hay credenciales, lo publica.")
    parser.add_argument("estado", choices=("ok", "fallo", "sin_tokens"))
    parser.add_argument("--quien", required=True)
    parser.add_argument("--origen", required=True)
    parser.add_argument("--detalle", default=None)
    args = parser.parse_args(argv)
    resultado = registrar_latido(
        raiz_de(args),
        estado=args.estado,
        quien=args.quien,
        origen=args.origen,
        detalle=args.detalle,
        now=ahora_de(args),
        dry_run=args.dry_run,
        transport=transporte_si_aplica(args.dry_run),
    )
    return emitir(resultado)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
