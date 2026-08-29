import { describe, expect, it } from 'vitest';
import { demoteLeadingMarkdownH1, renderArticleBody } from './conocimiento-articulo';

describe('conocimiento-articulo', () => {
  it('demoteLeadingMarkdownH1 converts only the first h1', () => {
    const html = '<h1 id="a">Título</h1><p>Texto</p><h1>Otro</h1>';
    expect(demoteLeadingMarkdownH1(html)).toBe('<h2 id="a">Título</h2><p>Texto</p><h1>Otro</h1>');
  });

  it('renderArticleBody renders markdown and demotes hero duplicate h1', () => {
    const html = renderArticleBody('# Guía biomédica\n\nPárrafo.', 'Vacío');
    expect(html).toContain('<h2>Guía biomédica</h2>');
    expect(html).not.toMatch(/<h1[^>]*>Guía biomédica<\/h1>/);
    expect(html).toContain('<p>Párrafo.</p>');
  });
});
