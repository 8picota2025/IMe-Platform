import { describe, expect, it } from 'vitest';
import {
  demoteLeadingMarkdownH1,
  extraerPreguntasFrecuentes,
  renderArticleBody,
} from './conocimiento-articulo';

describe('extraerPreguntasFrecuentes', () => {
  it('extrae pares de la sección de preguntas frecuentes (ES y EN)', () => {
    const md = [
      '# Título',
      '',
      'Intro.',
      '',
      '## Lista',
      '',
      '- [ ] Paso',
      '',
      '## Preguntas frecuentes',
      '',
      '### ¿Primera?',
      '',
      'Respuesta uno.',
      '',
      '### ¿Segunda?',
      '',
      'Respuesta dos.',
      '',
      '## Fuentes oficiales',
      '',
      '- Fuente',
    ].join('\n');
    expect(extraerPreguntasFrecuentes(md)).toEqual([
      { q: '¿Primera?', a: 'Respuesta uno.' },
      { q: '¿Segunda?', a: 'Respuesta dos.' },
    ]);
    expect(extraerPreguntasFrecuentes('## Frequently asked questions\n\n### Q?\n\nA.\n')).toEqual([
      { q: 'Q?', a: 'A.' },
    ]);
  });

  it('devuelve lista vacía sin sección o sin respuestas', () => {
    expect(extraerPreguntasFrecuentes('# Solo texto\n\nPárrafo.')).toEqual([]);
    expect(extraerPreguntasFrecuentes('## Preguntas frecuentes\n\n### Sin respuesta\n')).toEqual(
      []
    );
  });
});

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
