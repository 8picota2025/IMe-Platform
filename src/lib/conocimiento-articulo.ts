import { renderMarkdown } from './markdown';

/**
 * Article pages already render the title in the page hero. Demote the first
 * markdown H1 (if any) so the body does not duplicate the hero heading.
 */
export function demoteLeadingMarkdownH1(html: string): string {
  return html.replace(/<h1(\s[^>]*)?>/i, '<h2$1>').replace(/<\/h1>/i, '</h2>');
}

export function renderArticleBody(markdown: string, fallback: string): string {
  const source = (markdown || '').trim() || fallback;
  return demoteLeadingMarkdownH1(renderMarkdown(source));
}

const TITULO_FAQ = /^##\s+(preguntas frecuentes|frequently asked questions)\s*$/i;

/**
 * Pares pregunta/respuesta de la sección «Preguntas frecuentes» del markdown
 * (`### pregunta` + párrafos hasta el siguiente `##`). Alimenta el JSON-LD
 * FAQPage sin duplicar el contenido en la plantilla.
 */
export function extraerPreguntasFrecuentes(markdown: string): Array<{ q: string; a: string }> {
  const lineas = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const inicio = lineas.findIndex(linea => TITULO_FAQ.test(linea.trim()));
  if (inicio < 0) return [];

  const pares: Array<{ q: string; a: string }> = [];
  let pregunta: string | null = null;
  let respuesta: string[] = [];
  const cerrarPar = () => {
    const a = respuesta.join(' ').replace(/\s+/g, ' ').trim();
    if (pregunta && a) pares.push({ q: pregunta, a });
  };

  for (const linea of lineas.slice(inicio + 1)) {
    if (/^##\s/.test(linea)) break;
    const encabezado = linea.match(/^###\s+(.+?)\s*$/);
    if (encabezado) {
      cerrarPar();
      pregunta = encabezado[1] ?? null;
      respuesta = [];
    } else if (pregunta && linea.trim()) {
      respuesta.push(linea.trim());
    }
  }
  cerrarPar();
  return pares;
}
