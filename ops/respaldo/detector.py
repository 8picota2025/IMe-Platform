#!/usr/bin/env python3
"""Decide normal/respaldo a partir del latido y del manual. Cron previsto: */5."""

from __future__ import annotations

import sys

from cli_comun import ahora_de, emitir, parser_base, raiz_de, transporte_si_aplica
from respaldo_lib import LATIDO_MAX_S, detector_ciclo


def main(argv: list[str] | None = None) -> int:
    parser = parser_base("Detector de respaldo. Con --dry-run no escribe ni borra.")
    parser.add_argument("--latido-max-s", type=int, default=LATIDO_MAX_S)
    args = parser.parse_args(argv)
    decision = detector_ciclo(
        raiz_de(args),
        ahora_de(args),
        dry_run=args.dry_run,
        latido_max_s=args.latido_max_s,
    )
    transport = transporte_si_aplica(args.dry_run)
    if transport is not None and decision.get("cambia_modo"):
        try:
            transport(
                "imeia_modo_reportar",
                {
                    "modo": decision["modo_despues"],
                    "motivo": decision["motivo"],
                    "quien": decision["quien"],
                    "origen": "hermes",
                },
            )
        except Exception as error:
            print(f"aviso: no se pudo informar el modo ({error.__class__.__name__})", file=sys.stderr)
    return emitir(decision)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
