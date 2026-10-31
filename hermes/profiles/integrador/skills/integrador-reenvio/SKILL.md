---
name: integrador-reenvio
description: Rutina de reenvío de lunes a sábado a las 08:00 COT. En sombra cuenta la cola y no reenvía.
---

# integrador-reenvio

Ejecuta `scripts/reenvio.py`. Mira la cola y las órdenes `tarea: reenvio`. Deja cada pieza donde está. Al terminar, el comparador escribe `comparacion-YYYYMMDD.md` en el registro.
