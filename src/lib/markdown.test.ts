import { describe, expect, it } from 'vitest';
import { renderMarkdown, stripMarkdown } from './markdown';

describe('renderMarkdown · enlaces', () => {
  it('enlaces externos abren en pestaña nueva', () => {
    expect(renderMarkdown('[INVIMA](https://www.invima.gov.co)')).toBe(
      '<p><a href="https://www.invima.gov.co" target="_blank" rel="noreferrer noopener">INVIMA</a></p>'
    );
  });

  it('enlaces internos del sitio se convierten, en la misma pestaña', () => {
    expect(renderMarkdown('Vea la [familia monitores](/es/familias/monitores/).')).toBe(
      '<p>Vea la <a href="/es/familias/monitores/">familia monitores</a>.</p>'
    );
  });

  it('no trata "//host" como enlace interno', () => {
    expect(renderMarkdown('[x](//evil.example)')).toBe('<p>[x](//evil.example)</p>');
  });

  it('no genera enlaces javascript:', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
  });

  it('un enlace interno no puede inyectar atributos', () => {
    const html = renderMarkdown('[x](/es/"onmouseover="alert(1))');
    // Las comillas llegan escapadas (&quot;) dentro del href: la etiqueta
    // sigue teniendo un único atributo y no se crea ningún manejador.
    expect(html).not.toContain('"onmouseover');
    expect(html).toMatch(/^<p><a href="[^"]*">x<\/a>/);
  });
});

describe('renderMarkdown · tablas', () => {
  it('renderiza una tabla GFM con cabecera y filas', () => {
    const md = [
      '| Criterio | Por qué |',
      '| --- | --- |',
      '| Alarmas | Fatiga |',
      '| **Red** | Central |',
    ].join('\n');
    expect(renderMarkdown(md)).toBe(
      '<div class="md-table"><table><thead><tr><th scope="col">Criterio</th><th scope="col">Por qué</th></tr></thead>' +
        '<tbody><tr><td>Alarmas</td><td>Fatiga</td></tr><tr><td><strong>Red</strong></td><td>Central</td></tr></tbody></table></div>'
    );
  });

  it('acepta el separador sin barra inicial', () => {
    const md = ['| A | B |', '--- | ---', '| 1 | 2 |'].join('\n');
    expect(renderMarkdown(md)).toContain('<td>1</td><td>2</td>');
  });

  it('la tabla termina en la primera línea que no empieza por "|"', () => {
    const md = ['| A |', '| --- |', '| 1 |', 'Texto después.'].join('\n');
    expect(renderMarkdown(md)).toMatch(/<\/table><\/div><p>Texto después\.<\/p>$/);
  });

  it('una línea con "|" sin separador sigue siendo párrafo', () => {
    expect(renderMarkdown('a | b')).toBe('<p>a | b</p>');
  });
});

describe('renderMarkdown · checklist', () => {
  it('convierte "- [ ]" y "- [x]" en casillas de sólo lectura', () => {
    expect(renderMarkdown('- [ ] Pendiente\n- [x] Hecho')).toBe(
      '<ul><li class="md-task"><span class="md-task__box" aria-hidden="true">☐</span> Pendiente</li>' +
        '<li class="md-task"><span class="md-task__box" aria-hidden="true">☑</span> Hecho</li></ul>'
    );
  });

  it('un ítem normal no cambia', () => {
    expect(renderMarkdown('- Normal')).toBe('<ul><li>Normal</li></ul>');
  });
});

describe('stripMarkdown', () => {
  it('quita barras de tabla y marcas de enlace', () => {
    expect(stripMarkdown('| A | [B](/es/x) |')).toBe('A B');
  });
});
