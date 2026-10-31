---
name: integrador-sombra
description: Usar en cada despertar del perfil integrador. Obliga a registrar la decisión y a no ejecutar efectos mientras el modo efectivo sea sombra.
---

# integrador-sombra

1. Lee `INTEGRADOR_MODO`, `estado/modo.json`, el latido de Grok y si existe `ACTIVO_AUTORIZADO`.
2. Si el modo efectivo es sombra, la única escritura permitida es `~/logs/integrador/` y el lock `~/.hermes/shared/tablon/locks/<tarea>.lock`.
3. Una orden ya registrada no se vuelve a ejecutar.
4. No lances servicios, no toques crontab y no abras un canal de salida.
