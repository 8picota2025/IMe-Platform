# Landings CMS (Fase 3B, ADR-0015)

Runbook para editores (admin) y desarrolladores (build, migraciones, validación).

Plan de producto y tandas de migración: [`docs/growth-engine/fase3b-plan.md`](growth-engine/fase3b-plan.md).  
Decisión de arquitectura: [`docs/decisions/0015-autoria-landing-factory.md`](decisions/0015-autoria-landing-factory.md).

## Qué resuelve

Unas **88 landings** (campaña, fabricante, ciudad, familia) vivían solo en TypeScript (`src/data/*-landings.ts`, `familia-seo.ts`). Cualquier cambio de copy exigía PR y deploy.

La Fase 3B mueve el **texto y las fotos** a Supabase; **rutas, slugs, hreflang, productos enlazados y diseño** siguen en código.

| Tanda | Estado (2026-09-26) | Tipos                                                           |
| ----- | ------------------- | --------------------------------------------------------------- |
| 0     | Hecha               | Tabla, RLS, loaders, tests                                      |
| 1     | Hecha               | 12 landings de **campaña** en CMS + seed                        |
| 2–3   | Pendiente           | Fabricante (9), ciudad (3), familia (21)                        |
| 4–5   | Parcial             | Editor admin (campaña); borrar copy TS tras estabilidad en prod |

## Modelo de datos

Migración: `supabase/migrations/20260926200000_landings_cms.sql`.

| Tabla                 | Uso                                                       |
| --------------------- | --------------------------------------------------------- |
| `landings`            | Versión **publicada** (la lee la build con clave anónima) |
| `landings_borradores` | Edición en curso desde el admin                           |
| `landings_historial`  | Copia de cada versión publicada (rollback)                |

Campos clave en `landings`: `tipo` (`campana` \| `fabricante` \| `ciudad` \| `familia`), `clave` (id en código, p. ej. `imagenologia`), `contenido_es` / `contenido_en` (jsonb), `version`.

**RLS**

- `landings`: lectura pública (`anon`, `authenticated`).
- Escritura en tablas publicadas: **no** hay políticas directas; solo vía RPC.
- `landings_borradores`: `is_admin(ARRAY['catalogo', 'ventas'])` (incluye `owner` y `admin`).

**RPC (solo `authenticated`)**

- `publicar_landing(p_landing_id)` — copia borrador → publicado, incrementa versión, historial, borra borrador.
- `restaurar_version_landing(p_landing_id, p_version)` — copia una fila del historial al borrador (hay que publicar de nuevo).

Seed tanda 1: `supabase/migrations/20260926200100_seed_landings_campana.sql` (`ON CONFLICT DO NOTHING`).

## Build: de dónde sale el copy

Páginas de campaña (p. ej. `src/pages/es/imagenologia.astro`) llaman a `getCampaignLandingCms(id, locale)` en `src/lib/landings-cms.ts`:

1. Parte del objeto completo en `getCampaignLanding()` (TypeScript).
2. Si existe fila publicada en `landings` para esa `clave`, **mezcla** el jsonb editable (`mezclarLandingCampana`).
3. Los campos en `CAMPOS_BLOQUEADOS` (`src/lib/landings-cms-schema.ts`) **nunca** se sustituyen desde el CMS: `id`, rutas, `productSlugs`, `catalogFilter`, etc.

Comportamiento ante fallos de Supabase:

- Tabla inexistente → warning y copy solo desde TS.
- Otro error → warning y fallback a TS, salvo `REQUIRE_LIVE_DATA=true` (CI/prod estricto), que **rompe la build**.

Validación en build: `indexarFilasCampana()` valida cada fila de campaña; un jsonb inválido lanza error con landing y campo — no se publica HTML roto ni se ignora en silencio.

## Esquema editable

Fuente única de verdad del formulario y de la validación: `src/lib/landings-cms-schema.ts` (`CAMPOS_CAMPANA`, `validarCopyCampana`, `copyEditableDesdeTs`).

El admin, la build y `scripts/landings-cms-seed.mjs` comparten ese módulo.

Índice ligero de todas las landings (nombre + ruta, sin cargar copy): `src/data/landings-indice.ts` (generado con `node scripts/landings-indice.mjs`).

## Admin (`#/landings`)

Módulo: `src/admin/landings-admin.ts`. Resumen operativo: sección **Landings** en [`ADMIN_GUIDE.md`](../ADMIN_GUIDE.md).

Flujo:

1. **Guardar borrador** — upsert en `landings_borradores`; la web pública no cambia.
2. **Publicar** — confirmación → `publicar_landing` → `trigger-rebuild` (mismo flujo que artículos/productos).
3. **Descartar borrador** — delete en `landings_borradores`.
4. **Restaurar versión** — historial → borrador → revisar → publicar.

Edición por locale (ES/EN). Al cambiar `heroImage`, el admin intenta rellenar `heroImageWidth` / `heroImageHeight` desde el navegador.

Landings aún solo en código aparecen como «En código (sin migrar)» sin botón Editar.

## Desarrollo local

1. Aplicar migraciones (o `schema.sql` actualizado) en el proyecto Supabase de dev.
2. `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` en `.env`.
3. Usuario con rol `catalogo`, `ventas`, `owner` o `admin`.
4. Tras publicar desde admin, hace falta rebuild local (`npm run build`) o el hook de CI si está configurado.

Regenerar seed desde TS (no editar SQL a mano):

```bash
node scripts/landings-cms-seed.mjs supabase/migrations/<timestamp>_seed_landings_campana.sql
```

## Tests

```bash
npm run test -- src/lib/landings-cms.test.ts src/lib/landings-indice.test.ts
```

Cubren: paridad TS ↔ copy editable, campos bloqueados, indexación de filas CMS, coherencia del índice.

## Errores frecuentes

| Síntoma                                              | Causa probable                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Admin: «¿Está aplicada la migración 20260926200000?» | Migración no aplicada en ese proyecto Supabase                       |
| Build: `[landings-cms] Contenido inválido…`          | Jsonb en `landings` no pasa `validarCopyCampana`                     |
| Build falla con Supabase pero local OK               | `REQUIRE_LIVE_DATA=true` y error de red/RLS                          |
| Publicar sin efecto en web                           | Rebuild no completado; revisar `trigger-rebuild` / `cms_publish_log` |
| «Sin permiso para publicar landings»                 | Usuario sin rol `catalogo`/`ventas`/`owner`/`admin`                  |

## Seguridad de contenido

Todo el copy del CMS se renderiza **escapado** en Astro; no hay `set:html` en campos editables. Cambiar URL o slug sigue siendo PR en rutas Astro + índice.

## Próximos pasos (código)

- Tanda 2: seed + editor para landings **fabricante**.
- Tanda 3: **ciudad** y **familia** (`FamiliaSeoContent`).
- Comparación HTML/JSON-LD entre TS y CMS por tanda antes de merge (ver plan Fase 3B).
