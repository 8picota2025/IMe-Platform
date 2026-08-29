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
