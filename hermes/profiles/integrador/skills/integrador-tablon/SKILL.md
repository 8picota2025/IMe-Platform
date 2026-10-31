---
name: integrador-tablon
description: Consumir tablon/eventos/*.json con para integrador. El despertador ya existe; no se recrea el webhook ni el flujo.
---

# integrador-tablon

La orden está en `tablon/eventos/`, con `para: integrador`. El script `scripts/tablon.py` la barre. Toma el lock de la tarea y, si el id es nuevo, añade una línea a `decisiones.jsonl` con hora de Colombia, orden, fuente, acción que tomaría y resultado esperado. No lee `tablon/entrada/`.

No des de alta otro webhook. No edites el flujo de n8n.
