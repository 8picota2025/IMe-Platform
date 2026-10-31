"""El webhook del tablón no se recrea. Solo se compara el id que ya tiene."""

from __future__ import annotations


def mismo_id(antes: str, despues: str) -> bool:
    izquierda = antes.strip()
    derecha = despues.strip()
    if not izquierda or not derecha:
        return False
    return izquierda == derecha
