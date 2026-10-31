#!/usr/bin/env python3
"""Aplica «RESPALDO ON [horas]», «RESPALDO OFF» o «RESPALDO ESTADO»."""

from __future__ import annotations

import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de, transporte_si_aplica
from respaldo_lib import aplicar_comando


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("Interruptor manual del respaldo.")
    parser.add_argument("--quien", required=True)
    parser.add_argument("--origen", required=True)
    parser.add_argument("--motivo", default="")
    parser.add_argument("texto")
    args = parser.parse_args(argv)
    resultado = aplicar_comando(
        raiz_de(args),
        args.texto,
        quien=args.quien,
        origen=args.origen,
        motivo=args.motivo,
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
