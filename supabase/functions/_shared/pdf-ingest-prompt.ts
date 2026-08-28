/**
 * Prompt compartido para ingesta PDF (Edge Function ingesta-pdf).
 * Mantener alineado con src/lib/pdf-ingest-enrich.ts
 */

export function ingestJsonSchemaFragment(): string {
  return `"beneficios": [{"valor": "", "origen": "pdf|inferido|ausente", "confianza": 0, "requiere_revision": true}],
    "valor_institucional": {"valor": "", "origen": "pdf|inferido|ausente", "confianza": 0, "requiere_revision": true},
    "marca": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "seo_keywords": [{"valor": "", "origen": "pdf|inferido|ausente", "confianza": 0, "requiere_revision": true}]`;
}

export function buildIngestPrompt(pdfText: string, pdfUrl: string): string {
  const truncated = pdfText.slice(0, 12000);
  return `Fuente PDF: ${pdfUrl || 'texto pegado por admin'}

Texto disponible:
${truncated || '[No se proporciono texto extraido. Marca todos los campos como ausentes y agrega advertencia de que se requiere extraer texto/OCR del PDF antes de validar.]'}

Estructura requerida:
{
  "producto_es": {
    "nombre": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "familia_sugerida": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "tipo_sugerido": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "pdf|ausente", "confianza": 0, "requiere_revision": true},
    "especificaciones": [{"clave": "", "valor": "", "grupo": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    "aplicaciones": [{"valor": "", "origen": "pdf", "confianza": 0, "requiere_revision": true}],
    ${ingestJsonSchemaFragment()},
    "meta_seo": {"title": "", "description": ""}
  },
  "producto_en_borrador": {
    "nombre": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_corta": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "descripcion_larga": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "aplicaciones": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "beneficios": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "valor_institucional": {"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true},
    "seo_keywords": [{"valor": "", "origen": "traduccion|ausente", "confianza": 0, "requiere_revision": true}],
    "meta_seo": {"title": "", "description": ""}
  },
  "campos_confianza": [],
  "ausentes": [],
  "advertencias": [],
  "raw_model_id": ""
}

Reglas de enriquecimiento:
- Genera entre 3 y 5 beneficios comerciales ES a partir de especificaciones y texto del PDF (no inventes certificaciones).
- valor_institucional: una frase de propuesta de valor para comprador hospitalario.
- seo_keywords: 3-6 frases cortas de intención de búsqueda B2B en Colombia.
- familia_sugerida y tipo_sugerido deben usar nombres de taxonomía IME cuando sea posible (p.ej. Ventiladores).

Reglas EN:
- Traduce al ingles solo los campos presentes en producto_es.
- Conserva marcas, modelos, unidades, cifras, certificaciones y nombres tecnicos sin alterarlos.
- Si el dato fuente esta ausente en ES, deja el campo EN vacio con origen="ausente".
- Marca siempre los campos EN con requiere_revision=true.`;
}
