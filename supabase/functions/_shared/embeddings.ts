/**
 * Embeddings para el Asesor RAG.
 * Proveedor default: Voyage voyage-3 (1024 dims).
 * Alternativas: OpenAI text-embedding-3-small (1536 dims), Ollama
 * mxbai-embed-large (1024 dims, ver docs/decisions/0005-ollama-asesor-local.md).
 *
 * REGLA: cambiar EMBEDDING_PROVIDER o EMBEDDING_DIM implica re-embeber todo
 * el catalogo (productos.embedding queda con dimension mezclada si no).
 */

export type EmbeddingProvider = 'voyage' | 'openai' | 'ollama';

export interface EmbedResult {
  vectors: number[][];
  inputTokens: number;
  model: string;
  provider: EmbeddingProvider;
}

export interface Embedder {
  readonly provider: EmbeddingProvider;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<EmbedResult>;
}

export function createEmbedder(): Embedder {
  const provider = (Deno.env.get('EMBEDDING_PROVIDER') ?? 'voyage') as EmbeddingProvider;
  if (provider === 'openai') return new OpenAiEmbedder();
  if (provider === 'ollama') return new OllamaEmbedder();
  return new VoyageEmbedder();
}

interface VoyageResponse {
  data?: Array<{ embedding?: number[] }>;
  model?: string;
  usage?: { total_tokens?: number };
}

class VoyageEmbedder implements Embedder {
  readonly provider = 'voyage' as const;
  readonly model = Deno.env.get('EMBEDDING_MODEL') ?? 'voyage-3';
  readonly dimensions = Number(Deno.env.get('EMBEDDING_DIM') ?? 1024);

  async embed(texts: string[]): Promise<EmbedResult> {
    const apiKey = Deno.env.get('VOYAGE_API_KEY');
    if (!apiKey) throw new Error('VOYAGE_API_KEY requerido');

    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        input_type: 'document',
      }),
    });
    if (!res.ok) throw new Error(`Voyage error ${res.status}`);

    const json = (await res.json()) as VoyageResponse;
    return {
      vectors: (json.data ?? []).map(item => item.embedding ?? []),
      inputTokens: json.usage?.total_tokens ?? 0,
      model: json.model ?? this.model,
      provider: this.provider,
    };
  }
}

interface OpenAiEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  model?: string;
  usage?: { total_tokens?: number; prompt_tokens?: number };
}

class OpenAiEmbedder implements Embedder {
  readonly provider = 'openai' as const;
  readonly model = Deno.env.get('EMBEDDING_MODEL') ?? 'text-embedding-3-small';
  readonly dimensions = Number(Deno.env.get('EMBEDDING_DIM') ?? 1536);

  async embed(texts: string[]): Promise<EmbedResult> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY requerido');

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);

    const json = (await res.json()) as OpenAiEmbeddingResponse;
    return {
      vectors: (json.data ?? []).map(item => item.embedding ?? []),
      inputTokens: json.usage?.total_tokens ?? json.usage?.prompt_tokens ?? 0,
      model: json.model ?? this.model,
      provider: this.provider,
    };
  }
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
  model?: string;
}

/**
 * Proveedor local autoalojado (sin API key), vía OLLAMA_BASE_URL.
 * Modelo por defecto `mxbai-embed-large` (1024 dims) coincide con
 * productos.embedding vector(1024) — sin migración de schema.
 * Ver docs/decisions/0005-ollama-asesor-local.md.
 */
class OllamaEmbedder implements Embedder {
  readonly provider = 'ollama' as const;
  readonly model = Deno.env.get('EMBEDDING_MODEL') ?? 'mxbai-embed-large';
  readonly dimensions = Number(Deno.env.get('EMBEDDING_DIM') ?? 1024);

  async embed(texts: string[]): Promise<EmbedResult> {
    const baseUrl = Deno.env.get('OLLAMA_BASE_URL') ?? 'http://localhost:11434';

    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);

    const json = (await res.json()) as OllamaEmbedResponse;
    return {
      vectors: json.embeddings ?? [],
      inputTokens: 0,
      model: json.model ?? this.model,
      provider: this.provider,
    };
  }
}

/** Tope de longitud del texto fuente por producto (salvaguarda de coste/latencia). */
const MAX_CHARS = 6000;

export interface ProductoEmbeddingInput {
  nombre_es: string;
  nombre_en?: string | null;
  descripcion_corta_es?: string | null;
  descripcion_corta_en?: string | null;
  descripcion_larga_es?: string | null;
  descripcion_larga_en?: string | null;
  especificaciones?: Array<{ clave?: string; valor?: string; grupo?: string }> | null;
  aplicaciones_es?: string[] | null;
  aplicaciones_en?: string[] | null;
  familia_nombre_es?: string | null;
  familia_nombre_en?: string | null;
  tipo_nombre_es?: string | null;
  tipo_nombre_en?: string | null;
}

/**
 * Construye el texto fuente para embeber un producto:
 * nombre + familia/tipo + descripciones es/en + especificaciones + aplicaciones.
 * Solo usa datos reales del producto, nunca inventa contenido.
 */
export function normalizeEmbeddingInput(producto: ProductoEmbeddingInput): string {
  const partes: Array<string | null | undefined> = [
    producto.nombre_es,
    producto.nombre_en,
    producto.familia_nombre_es,
    producto.familia_nombre_en,
    producto.tipo_nombre_es,
    producto.tipo_nombre_en,
    producto.descripcion_corta_es,
    producto.descripcion_corta_en,
    producto.descripcion_larga_es,
    producto.descripcion_larga_en,
  ];

  for (const spec of producto.especificaciones ?? []) {
    const clave = spec?.clave?.trim();
    const valor = spec?.valor?.trim();
    if (clave || valor) partes.push(`${clave ?? ''}: ${valor ?? ''}`.trim());
  }

  for (const aplicacion of producto.aplicaciones_es ?? []) partes.push(aplicacion);
  for (const aplicacion of producto.aplicaciones_en ?? []) partes.push(aplicacion);

  const texto = partes
    .filter((parte): parte is string => Boolean(parte && parte.trim().length > 0))
    .join('\n');

  return texto.length > MAX_CHARS ? texto.slice(0, MAX_CHARS) : texto;
}
