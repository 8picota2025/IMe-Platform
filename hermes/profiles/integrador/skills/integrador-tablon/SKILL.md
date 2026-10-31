---
name: integrador-tablon
description: Consumir una entrada del tablón con para integrador. El despertador ya existe; no se recrea el webhook ni el flujo.
---

# integrador-tablon

La orden llega con `para: integrador`. El script `scripts/despertar.py` toma el lock de la tarea y, si el id es nuevo, añade una línea a `decisiones.jsonl` con hora de Colombia, orden, fuente, acción que tomaría y resultado esperado.

No des de alta otro webhook. No edites el flujo de n8n.
