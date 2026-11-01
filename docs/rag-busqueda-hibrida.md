# RAG catálogo — INVIMA, búsqueda híbrida y chunks bge-m3

Migraciones (orden):

1. `20261030140000_productos_invima_rag_hibrido.sql` — columnas INVIMA, `match_productos` ampliado, `buscar_productos_hibrido` v1, cron nocturno Voyage.
2. `20261030160000_embeddings_cron_token.sql` — cron autenticado con token de cron (no service key en vault).
3. `20261030170000_producto_chunks_bge_m3.sql` — tabla `producto_chunks`, endpoint local bge-m3, `buscar_productos_hibrido` v2 (señal `chunk`).

## Estado INVIMA por producto

Columnas en `productos`: `invima_estado` (`vigente` | `sin_registro` | `pendiente` | `no_aplica`), `invima_rs`, `invima_titular`, `invima_vigencia`, `invima_verificado_at`, `invima_fuente`.

- Solo IMvima / proceso documentado cambia el estado; **no inventar** registros.
- Zuowei (9 SKU): migración marca `sin_registro` con fuente IMvima (consulta datos abiertos 2026-10-30).

`match_productos` y `buscar_productos_hibrido` devuelven `invima_estado`, `invima_rs`, `invima_vigencia` para guardrails del asesor.

## Embeddings Voyage (`productos.embedding`)

- Trigger `trg_productos_invalidar_embedding`: al cambiar nombre/descripciones/especificaciones/aplicaciones ES, `embedding := null`.
- Edge `generar-embeddings`: admin JWT o **token de cron** (`whatsapp_dispatch_auth`, paridad con WhatsApp dispatch).
- Cron `generar-embeddings-nocturno` (pg_cron, 07:00 UTC): `POST generar-embeddings` con body `{"solo_faltantes": true}`.
- `verify_jwt=false` en la función; la auth vive dentro (admin / cron token).

Reindex manual: `npm run reindex:voyage[:articles|:all]` o invoke desde `/admin`.

## Chunks locales (`producto_chunks`)

- Embeddings **bge-m3** (1024 dims) vía HTTP configurado en `rag_embed_config` (Ollama en srv1715444).
- Tabla no expuesta a `anon`/`authenticated`; indexador usa RPC con token worker:
  - `rag_chunks_pendientes` — productos activos sin chunks o con `fuente_hash` obsoleto.
  - `rag_chunks_guardar` — reemplaza chunks de un producto.
  - `rag_embed_set_endpoint` — escribe URL + token del embedder (worker).
- `rag_embed_local(texto)`: embedding de consulta síncrono; timeout ~1,5 s; **null** si falla → la búsqueda sigue sin señal `chunk`.

## RPC `buscar_productos_hibrido`

Señales fusionadas con RRF (reciprocal rank fusion):

| Señal | Origen |
| --- | --- |
| `sku` | SKU en el texto |
| `kw` | full-text OR sin acentos |
| `nombre` | palabras en el nombre |
| `trgm` | trigramas (umbral `min_trgm`, default 0.6) |
| `vec` | `productos.embedding` Voyage (opcional `query_embedding`) |
| `chunk` | `producto_chunks` + `rag_embed_local` (umbral `min_chunk`, default 0.55) |

Devuelve vacío si ninguna señal supera umbral (“no lo tenemos”). Columnas extra: `senal`, `fragmento` (extracto de spec cuando gana `chunk`).

### Uso en el widget web

En `src/lib/asesor.ts`, el fallback **sin** embedding Voyage en cliente llama:

```ts
supabase.rpc('buscar_productos_hibrido', { query_text: mensaje, match_count: 5 });
```

El RPC calcula el vector local en servidor si `rag_embed_config` está activo. El vector Voyage del mensaje **no** se mezcla con bge-m3 en el mismo espacio.

## Operación

1. Aplicar migraciones en orden (Functions + pg_cron en prod).
2. Configurar endpoint bge-m3: `rag_embed_set_endpoint` desde worker autorizado.
3. Job en srv que consuma `rag_chunks_pendientes` / `rag_chunks_guardar` (fuera de este repo si aplica).
4. Verificar cron: filas con `embedding is null` deben bajar tras la noche; logs Edge sin 401.

## Rollback

Comentarios `ROLLBACK` al final de cada migración. Deshacer chunks antes de volver a la firma de 6 argumentos de `buscar_productos_hibrido`.
