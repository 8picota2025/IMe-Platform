"""Correos de proveedor. No van en el código: solo en el entorno."""

from __future__ import annotations

import os

CLAVES = {
    "bbraun": "IME_CONTACTO_BBRAUN",
    "fresenius": "IME_CONTACTO_FRESENIUS",
}


def correo(proveedor: str) -> str:
    clave = CLAVES.get(proveedor, "")
    if not clave:
        return ""
    return os.environ.get(clave, "").strip()


def bombas_infusion() -> str:
    braun = correo("bbraun") or "$IME_CONTACTO_BBRAUN"
    fresenius = correo("fresenius") or "$IME_CONTACTO_FRESENIUS"
    return f"B. Braun ({braun}) y Fresenius Kabi ({fresenius})"
