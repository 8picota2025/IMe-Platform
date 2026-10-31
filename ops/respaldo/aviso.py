#!/usr/bin/env python3
"""Deja una alerta en alertas.jsonl y en la auditoría.

No abre red, no llama a un MTA y no arranca ningún servicio. El correo queda
fuera hasta un OK aparte de Shoky.
"""

from __future__ import annotations

import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de
from respaldo_lib import ORIGENES_LATIDO, _append_jsonl, _auditar, _exigir_origen, _exigir_quien


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("Registra una alerta local.")
    parser.add_argument("--codigo", required=True)
    parser.add_argument("--motivo", required=True)
    parser.add_argument("--quien", required=True)
    parser.add_argument("--origen", required=True)
    args = parser.parse_args(argv)
    _exigir_quien(args.quien)
    _exigir_origen(args.origen, ORIGENES_LATIDO)
    if args.dry_run:
        return emitir(
            {
                "dry_run": True,
                "accion": f"alerta_{args.codigo}",
                "motivo": args.motivo,
                "quien": args.quien,
                "origen": args.origen,
            }
        )
    rutas = raiz_de(args)
    linea = _auditar(
        rutas,
        utc=ahora_de(args),
        quien=args.quien,
        accion=f"alerta_{args.codigo}",
        origen=args.origen,
        motivo=args.motivo,
    )
    _append_jsonl(rutas.alertas, linea)
    return emitir(linea)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
