# Fase 3B — Landing Factory en el CMS (ADR-0015): plan

> Estado: **GO del usuario (2026-09-26)** con las tres propuestas: editan `catalogo`, `ventas`,
> `owner` y `admin`; borrador + «Publicar»; empezar por las tandas 0 y 1. Pedido añadido: un
> editor en el admin que liste todas las landings y edite texto y fotos, no diseño. **Tandas 0
> y 1 en producción** el 2026-09-26 (paridad 26/26 páginas idénticas antes y después).
> **Tanda 2 implementada** (9 landings de fabricante; paridad por Postgres 18/18).

## Qué se migra (inventario del 2026-09-26)

| Tipo                  | Fuente hoy                        | Contenidos | Páginas (ES+EN) | Forma                                          |
| --------------------- | --------------------------------- | ---------- | --------------- | ---------------------------------------------- |
| Landings de campaña   | `src/data/comercial-landings.ts`  | 12         | 24              | `CampaignLandingContent` (≈45 campos, rica)    |
| Landings fabricante   | `src/data/fabricante-landings.ts` | 9          | 18              | `CampaignLandingContent` + perfil de marca     |
| Landings de ciudad    | `src/data/city-landings.ts`       | 3          | 6               | `CityLanding` (título, lead, cuerpo, familias) |
| Textos SEO de familia | `src/data/familia-seo.ts`         | 21         | 42 (+ paginado) | `FamiliaSeoContent` + guías + hub links        |

Unas 6.900 líneas de copy en TypeScript; hoy cualquier cambio de texto exige PR + deploy.

**Corrección a la ADR-0015:** las migraciones SQL de «enriquecimiento» que cita
(`20260904140000`, `20260904150000`, …) no escriben landings sino **productos**
(`productos`), que ya se editan en el CMS. No hay tercera vía de landings que migrar.

## Diseño propuesto

1. **Tabla `landings`** en Supabase:
   - `tipo` (`campana` | `fabricante` | `ciudad` | `familia`) y `clave` (el id actual),
     únicos juntos.
   - `contenido_es` y `contenido_en` (jsonb con la misma forma que hoy), `meta` (jsonb:
     familia, productos, filtro de catálogo), `publicado`, `version`, `actualizado_por`,
     `updated_at`.
   - **`landings_historial`** guarda cada versión publicada, para volver atrás en un clic.
   - RLS: lectura pública sólo de lo publicado (la build usa la clave anónima); escritura con
     los mismos roles que los artículos del blog: `catalogo` y `ventas` (más `owner` y `admin`,
     que `is_admin` ya incluye).
2. **Build:** los loaders (`getCampaignLanding`, `getFabricanteLanding`, …) pasan a leer de
   Supabase. El contenido se **valida contra el tipo** al cargar: si una fila no cumple, la
   build falla con el campo exacto, nunca publica una landing rota ni cae en silencio a otro
   texto. Mientras dura la migración, lo que aún no esté en la tabla sigue saliendo del
   TypeScript.
3. **Admin → «Landings»:**
   - Lista por tipo y formulario por campo (textos, listas, FAQ, productos), vista previa y
     guardar como borrador.
   - «Publicar» guarda la versión en el historial y lanza el rebuild (`trigger-rebuild`, el
     mismo flujo que los artículos).
4. **Fuera del CMS a propósito:** slugs, rutas, pares ES/EN, hreflang y sitemap siguen en el
   código. Cambiar una URL es una decisión SEO y va por PR. En el admin esos campos se ven
   pero no se editan.

## Migración por tandas (cada una: PR, build de producción con datos reales, merge)

| Tanda | Qué                                                     | Control de paridad                                                                                                                                      |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Tabla, RLS, loaders con validación y respaldo TS, tests | Ninguna página cambia: todo sigue saliendo del TS.                                                                                                      |
| 1     | 12 landings de campaña                                  | Script que construye cada página con las dos fuentes y compara **HTML, `<title>`, meta, canonical, hreflang y JSON-LD**: diferencia cero para fusionar. |
| 2     | 9 de fabricante                                         | Igual.                                                                                                                                                  |
| 3     | 3 de ciudad y 21 de familia                             | Igual.                                                                                                                                                  |
| 4     | Admin «Landings»                                        | QA en navegador: editar, previsualizar, publicar, volver a una versión anterior.                                                                        |
| 5     | Borrar el copy del TypeScript                           | Sólo cuando las tandas 1–3 lleven una semana en producción sin incidencias.                                                                             |

El seed de cada tanda se genera con un script desde el TypeScript actual (no a mano), así el
contenido migrado es idéntico por construcción y la comparación lo confirma.

## Riesgos y cómo se cubren

| Riesgo                                          | Mitigación                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Perder posiciones SEO por cambios involuntarios | Diferencia cero de HTML/JSON-LD por tanda; slugs y rutas fuera del CMS.                    |
| Una edición rompe una landing                   | Validación por tipo en la build (falla en vez de publicar); historial para volver atrás.   |
| La build depende de Supabase                    | Ya depende (productos, artículos); mismo patrón con reintentos y lectura por lotes (#125). |
| Inyección de HTML desde el CMS                  | Todo el copy se renderiza escapado por Astro; ningún campo usa `set:html`.                 |

## Decisiones que necesito del usuario

1. **¿Quién edita landings?** No existe un rol `marketing` (hay `owner`, `admin`, `catalogo`,
   `ventas`, `operaciones`, `lectura`). Propuesta: los mismos que editan el blog, `catalogo` y
   `ventas`, además de `owner` y `admin`.
2. **¿Publicación directa o borrador + publicar?** Propuesta: borrador y botón «Publicar» (lanza
   el rebuild), como los artículos.
3. **¿Empezar por las tandas 0 y 1?** Son las que prueban el diseño completo con las landings
   de más tráfico comercial; el resto repite el patrón.

## Fuera de alcance

Crear landings nuevas desde el admin (seguirá siendo PR mientras las rutas estén en el
código), A/B testing, cambiar el diseño del renderer.
