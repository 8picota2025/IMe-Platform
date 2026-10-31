---
name: integrador-vigilancia
description: Comprobaciones de solo lectura del Integrador (GPU, colas, panel, n8n, Syncthing, ops-hub y modo). En sombra el informe queda en el registro.
---

# integrador-vigilancia

El job está `enabled: false`. En sombra el reloj no ejecuta `scripts/vigilancia.py`. Si se corre a mano fuera de sombra, lee y no crea las fuentes que falten.

- `~/.local/state/franja/log`
- cola de contenidos
- `~/.local/state/panel/log`
- flujos n8n `avisos-telegram`, `correo-entrante`, `cola-salida-unica` (solo GET)
- Syncthing `GET /rest/db/status?folder=ime-vault`
- ops-hub, se anota si responde 200
- `estado/modo.json`

En sombra anota que publicarías el resumen en el tablón y no lo publiques.
