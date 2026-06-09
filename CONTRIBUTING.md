# Contributing — Flujo de ramas y git

## Estructura de ramas

| Rama                                | Propósito                   | Protección                                    |
| ----------------------------------- | --------------------------- | --------------------------------------------- |
| `main`                              | Producción (raíz Hostinger) | Merge solo por PR + 1 aprobación              |
| `preprod`                           | Pre-producción (staging)    | Merge solo por PR                             |
| `develop`                           | Integración diaria          | Rama base para feature branches               |
| `feature/fase-0` … `feature/fase-5` | Una rama por fase           | Se crea al iniciar, merge a develop al cerrar |

## Flujo de trabajo

```bash
# 1. Partir siempre de develop actualizado
git checkout develop && git pull

# 2. Crear rama de fase
git checkout -b feature/fase-X

# 3. Trabajar con el agente IA
# Antes de cambiar de agente o sesión: commitear siempre

# 4. Commit + push al terminar tarea
git add <archivos>
git commit -m "feat(fase-X): descripción"
git push

# 5. PR feature/fase-X → develop → revisión → merge
# 6. Al cerrar F5: PR develop → preprod → auditoría → PR preprod → main
```

## Convención de commits (Conventional Commits)

```
<tipo>(<scope>): <mensaje>
```

Tipos: `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `perf` | `style`

Ejemplos:

```
feat(catalogo): agregar filtros por especificaciones
fix(asesor): corregir guardarraíl de diagnóstico clínico
chore(deps): actualizar astro a 6.5.0
docs(agents): actualizar estado fase-2 a completado
```

## Protocolo de handoff entre agentes

```bash
git add -A
git commit -m "chore(agente): handoff a [claude-code|codex] — descripción breve"
git push
# Luego iniciar el otro agente: "Continúa desde el último commit. Lee AGENTS.md."
```

## Reglas críticas

- **Nunca commitear `.env` con valores reales**
- **Nunca forzar push a `main` o `preprod`**
- **Actualizar `AGENTS.md` > "Estado de fases"** al cerrar cada fase
- **`npm run validate` debe pasar antes de crear PR**
