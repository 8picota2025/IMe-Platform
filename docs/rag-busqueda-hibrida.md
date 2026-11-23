# Asesor — búsqueda híbrida de productos

Migraciones: `20261030140000_productos_invima_rag_hibrido.sql`, `20261030170000_producto_chunks_bge_m3.sql`.

## RPC principal

`public.buscar_productos_hibrido(...)` — `security definer`, expuesta a `anon`, `authenticated`, `service_role`.

Parámetros relevantes (firma v2):

| Parámetro | Rol |
| --------- | --- |
| `query_text` | Texto del usuario |
| `query_embedding` | Vector consulta Voyage (`productos.embedding`) |
| `query_embedding_local` | Vector consulta bge-m3 (opcional; si null, `rag_embed_local`) |
| `filtro` jsonb | `familia_id`, `tipo_id`, `tipo_comercial` |
| `min_trgm` / `min_vec` / `min_chunk` | Umbrales por señal |
| `usar_chunks` | Activa señal `chunk` (default `true`) |

Salida incluye `invima_estado`, `invima_rs`, `invima_vigencia`, `senal` (ej. `sku+vec+chunk`) y `fragmento` de especificación cuando aplica.

## Señales y RRF

Combinación por reciprocal rank fusion sobre:

- coincidencia de SKU en el texto
- full-text (`kw`), nombre (`nm`), trigram (`tg`)
- vector Voyage (`vec`)
- chunks bge-m3 (`chunk`)

## INVIMA en catálogo

Columnas en `productos`: `invima_estado` (`vigente` \| `sin_registro` \| `pendiente` \| `no_aplica`), `invima_rs`, `invima_vigencia`. Zuowei: `sin_registro` + `disponible = false` (ver `catalogo-zuowei-y-robotica.md`).

El asesor debe leer `invima_estado`; no inventar registro (`src/lib/asesor-knowledge.ts`).

## Chunks `producto_chunks`

- Tabla con embeddings **1024 dims**, modelo default `bge-m3`.
- Generación vía Edge `generar-embeddings` y RPCs `rag_chunks_pendientes` / `rag_chunks_guardar`.
- Embedding de consulta local: `rag_embed_local` (Ollama en infra documentada en migración; timeout corto → `null` si falla).

## Cron nocturno

`pg_cron` → POST a `generar-embeddings` con body `{"solo_faltantes": true}` y token de cron en BD (`20261030160000_embeddings_cron_token.sql`). Solo rellena faltantes, no reindex masivo.

## Operación

```bash
# Reindex manual Voyage (productos/artículos)
npm run reindex:voyage[:articles|:all]
```

Edge: `generar-embeddings` acepta `producto_id`, `producto_ids`, `todos`, `solo_faltantes` (admin o token cron).

## ROLLBACK

Comentarios al final de cada migración listan drops manuales (recrear firma antigua de `buscar_productos_hibrido`, tabla `producto_chunks`, etc.).