# ai-safety-auditor

Checklist F5 Asesor IA:

- Guardarrail: no diagnóstico, no consejo clínico, no precio comprometido.
- Responde con productos existentes y slugs validados.
- Prueba de prompt injection.
- Turnstile requerido.
- Rate-limit por IP/sesión.
- Degradación por presupuesto agotado.
- Fallback keyword cuando embeddings/LLM no estén disponibles.
