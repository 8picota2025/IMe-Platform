# ADR-0005: Ollama como proveedor LLM/embeddings local para el Asesor RAG

- Fecha: 2026-06-15
- Estado: aceptado
- Contexto: Asesor RAG / F5 — desarrollo y pruebas sin credenciales reales

## Contexto

El Asesor RAG (`supabase/functions/asesor`, `supabase/functions/generar-embeddings`)
está bloqueado para pruebas reales por falta de `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`
(chat) y `VOYAGE_API_KEY` (embeddings) — ver `PENDIENTES.md` → BLOQUEANTE_BACKEND.
`_shared/llm-gateway.ts` y `_shared/embeddings.ts` ya implementan un proveedor
intercambiable vía `LLM_PROVIDER`/`EMBEDDING_PROVIDER` (`anthropic`/`openai` para
chat, `voyage`/`openai` para embeddings), sin que ningún otro archivo dependa de
los nombres de proveedor — `asesor/index.ts` y `generar-embeddings/index.ts` solo
usan `createLlmGateway()`/`createEmbedder()` y las interfaces `LlmGateway`/`Embedder`.

## Decisión

Se añade `'ollama'` como tercer proveedor, autoalojado y sin API key, para
desarrollo local:

- **Chat/ingesta** (`OllamaGateway` en `llm-gateway.ts`): `POST
${OLLAMA_BASE_URL}/api/chat` con `{ model, messages, stream: false, options:
{ temperature, num_predict } }`. Modelo por defecto **`qwen3:8b`** (configurable
  vía `LLM_CHAT_MODEL`/`LLM_INGEST_MODEL`, igual que los demás proveedores) — es el
  modelo instalado en el servidor de desarrollo. Qwen3 devuelve razonamiento en
  `message.thinking` además de `message.content`; `OllamaGateway` solo lee
  `content`, por lo que el "thinking" no llega al usuario ni se factura.
- **Embeddings** (`OllamaEmbedder` en `embeddings.ts`): `POST
${OLLAMA_BASE_URL}/api/embed` con `{ model, input }`. Modelo por defecto
  **`mxbai-embed-large` (1024 dims)** — coincide exactamente con
  `productos.embedding vector(1024)` y el RPC `match_productos`
  (`supabase/schema.sql:886`), por lo que **no requiere migración de schema** al
  cambiar de Voyage a Ollama (sigue aplicando la regla general: re-embeber el
  catálogo al cambiar de proveedor).
- **Coste**: `estimateCost()` acepta un `provider` opcional y devuelve `0` si
  `provider === 'ollama'` (autoalojado, sin facturación por token). Ollama no
  reporta tokens de embeddings, por lo que `OllamaEmbedder` informa
  `inputTokens: 0` — coherente con coste 0.
- **Red**: nueva variable `OLLAMA_BASE_URL` (default `http://localhost:11434`).

## Red Edge Functions ↔ Ollama (Docker)

`supabase functions serve` ejecuta las Edge Functions en un contenedor Docker;
Ollama corre en el host. `http://localhost:11434` dentro del contenedor **no**
apunta al host. Opciones:

- Linux: usar la IP del gateway del bridge de Docker, normalmente
  `http://172.17.0.1:11434` (`ip addr show docker0`).
- Cualquier OS: levantar el contenedor con
  `--add-host=host.docker.internal:host-gateway` y usar
  `http://host.docker.internal:11434`.

## Cómo probar

### Chat (verificado)

El servidor de desarrollo ya tiene `qwen3:8b` instalado y corriendo como
`systemd` service (`ollama.service`). `curl http://localhost:11434/api/chat`
con `{ model: 'qwen3:8b', messages: [...], stream: false, options: {
temperature: 0.3, num_predict: 700 } }` responde correctamente con
`message.content` (texto), `message.thinking` (razonamiento, ignorado por
`OllamaGateway`), `prompt_eval_count` y `eval_count`.

```bash
# .env / .env.local
LLM_PROVIDER=ollama
LLM_CHAT_MODEL=qwen3:8b
LLM_INGEST_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434   # o el valor que aplique en tu entorno

supabase functions serve
curl -X POST http://localhost:54321/functions/v1/asesor -d '{"mensaje":"..."}'
```

Verificar en `asesor_uso`: `proveedor='ollama'`, `modelo='qwen3:8b'`,
`coste_estimado=0`.

### Embeddings (pendiente en este servidor)

`curl http://localhost:11434/api/embed` con `qwen3:8b` devuelve
`{"error":"This server does not support embeddings. Start it with
--embeddings"}` — qwen3:8b es un modelo de chat, no de embeddings. Para activar
`EMBEDDING_PROVIDER=ollama` en este servidor falta:

1. `ollama pull mxbai-embed-large` (1024 dims, compatible con
   `productos.embedding vector(1024)` sin migración).
2. Añadir `--embeddings` al `ExecStart` de `/etc/systemd/system/ollama.service`
   y `systemctl restart ollama` (requiere `sudo`, no disponible para el agente
   en este entorno).

Hasta entonces, `EMBEDDING_PROVIDER` debe seguir en `voyage`/`openai` (o el
Asesor degrada a búsqueda por palabra clave, que ya funciona sin LLM).

## Alternativas consideradas

- **`nomic-embed-text` (768 dims)**: más liviano, pero requeriría alterar
  `productos.embedding` a `vector(768)` y el RPC `match_productos`. Descartado
  para evitar una migración solo por el proveedor de desarrollo.
- **Mantener lista de precios por modelo en `PRICING_USD_POR_1M`** para modelos
  Ollama: descartado — el coste de autoalojado es siempre 0 independientemente
  del modelo, así que comprobar `provider === 'ollama'` es más robusto que
  mantener nombres de modelo.

## Consecuencias

- `LLM_PROVIDER=anthropic` y `EMBEDDING_PROVIDER=voyage` siguen siendo el default
  de producción — Ollama es opt-in vía variables de entorno, sin UI de selección.
- No requiere cambios en `schema.sql` ni en `asesor/index.ts`/
  `generar-embeddings/index.ts`.
- Chat con `OllamaGateway`/`qwen3:8b` verificado contra el Ollama del servidor de
  desarrollo (ver "Cómo probar"). Embeddings (`OllamaEmbedder`) sigue
  NO_EJECUTADO_ENTORNO — requiere `ollama pull mxbai-embed-large` y reconfigurar
  `ollama.service` con `--embeddings` (acceso `sudo`).
