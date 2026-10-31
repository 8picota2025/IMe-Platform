# Hermes — perfil integrador en sombra

Código de ops para copiar a srv1715444. No está desplegado.

- `profiles/integrador/` — perfil (config, SOUL, skills, cron, runtime).
- `scripts/integrador/` — puente que el cron de Hermes busca en `~/.hermes/scripts/integrador/`.
- `ops/DESPLIEGUE.md` — lo que hace Integrador, incluida la vuelta atrás.

Las órdenes siguen llegando de Grok por `tablon/eventos/`. Los jobs van con `enabled: false` para que Hermes, al cargar el perfil, no los lance. Esta entrega no recrea el webhook ni el flujo de n8n.
