@AGENTS.md

## Notas específicas para Claude Code

- Al iniciar sesión: verifica que AGENTS.md está cargado con `/memory`.
- Si el contexto se perdió: ejecuta `/init` para recargar.
- El auto-memory puede generar notas en `.claude/memory/` — son válidas.
- Si hay conflicto entre estas instrucciones y el prompt de fase activo, gana el prompt de fase.
- Antes de commitear: `npm run validate` debe pasar sin errores.
