#!/usr/bin/env python3
"""El despertador llama aquí con una orden. En sombra solo la registra."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.cli import main_entrada  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main_entrada())
