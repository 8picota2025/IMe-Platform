# AGENTS_GUIDE — División de trabajo entre agentes IA

## Claude Code (agente principal)

Preferido para tareas que requieren razonamiento arquitectónico y contexto largo:

- Decisiones de arquitectura y schema de Supabase
- Edge Functions (lógica de negocio, webhooks, pagos, RAG, ingesta PDF)
- Sistema i18n, SEO técnico y JSON-LD
- Layout, design system y fundaciones de F1
- CMS y flujos complejos de F3
- Asesor conversacional RAG (Fase Asesor)
- Auditoría y documentación de F5
- Cualquier tarea que requiera leer múltiples archivos y mantener coherencia global

## Codex CLI (agente secundario, opcional)

Preferido para generación de código repetitivo y calidad:

- Componentes UI estáticos (cards, badges, skeletons, botones, formularios)
- Tests unitarios y de integración
- Refactors de código existente (renombrar, extraer, reorganizar)
- Generación de datos mock desde esquemas
- Revisión y corrección de código generado
- Scripts de utilidad (generate-sitemap, validate, etc.)

## Regla universal para ambos agentes

1. **ANTES de empezar**: `git pull`, verificar rama activa, leer AGENTS.md
2. **AL TERMINAR UNA TAREA**: commit + push. Nunca cambiar de agente con cambios sin commitear
3. **Conflicto entre agentes**: gana el último commit; resolver en PR si hay conflicto en el mismo archivo
4. **Ningún agente toca `.env` con valores reales ni commitea secretos**

## Protocolo de handoff

```bash
git add -A
git commit -m "chore(agente): handoff a [claude-code|codex] — [descripción breve]"
git push
```

Luego iniciar el otro agente en la misma rama con:

> "Continúa desde el último commit. Lee AGENTS.md."

## Por qué AGENTS.md es crítico

Cada sesión nueva de un agente empieza desde cero. AGENTS.md contiene el estado
de fases, las decisiones inamovibles y el modelo comercial. Cuanto más actualizado
esté (especialmente el estado de fases y los pendientes clave), menos tiempo
pierde el agente reorientándose. Tratar AGENTS.md como un log vivo, no un doc estático.

## Conexión oficial a ime-comercio

Los agentes remotos usan Streamable HTTP en
`https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/mcp-comercio`, con el bearer
`IME_MCP_COMERCIO_TOKEN` desde el almacén de secretos del agente. No requieren
Supabase service role ni contraseñas comerciales. Configuración y rotación:
[docs/mcp-ime-comercio-http.md](docs/mcp-ime-comercio-http.md).

El token identifica a la plataforma. Para enviar una cotización se conserva
`actor_email` de un asesor activo, preparar → aprobar en CMS → confirmar.
`npm run mcp:comercio` sigue siendo la alternativa stdio local.
