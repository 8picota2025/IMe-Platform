---
name: integrador-reenvio
description: Rutina de reenvío de lunes a sábado a las 08:00 COT. En sombra cuenta la cola y no reenvía.
---

# integrador-reenvio

El job está `enabled: false`. En sombra `scripts/reenvio.py` no corre por el reloj. Las órdenes `tarea: reenvio` que estén en `tablon/eventos/` las ve el barrido del despertador y no se reenvían.
