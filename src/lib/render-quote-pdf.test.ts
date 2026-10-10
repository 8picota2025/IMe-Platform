import { readFileSync } from 'node:fs';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { format } from 'prettier';
import { afterEach, expect, it, vi } from 'vitest';
import { renderQuotePdf, type QuotePdfAnnex } from './render-quote-pdf';

afterEach(() => vi.restoreAllMocks());

it.each(['es', 'en'] as const)(
  'keeps all 20 mixed-price rows in table grids (%s)',
  async locale => {
    const text = vi.spyOn(PDFPage.prototype, 'drawText');
    const lines = vi.spyOn(PDFPage.prototype, 'drawLine');
    const rows = Array.from({ length: 20 }, (_, i) => ({
      slug: `reference-with-a-long-name-${i}`,
      nombre: `Fixture row ${i}`,
      cantidad: 1,
      precio_unitario: 100,
      subtotal: 100,
      moneda: 'COP',
      notas:
        i % 2 === 0
          ? 'Fixture specification A\nFixture specification B\nFixture specification C'
          : '',
      precio_pendiente_validar: i % 3 === 0,
    }));
    await renderQuotePdf({
      numero: 'TEST',
      clienteNombre: 'Test',
      condiciones: '',
      moneda: 'COP',
      total: 1300,
      lineas: rows,
      locale,
    });
    const strings = text.mock.calls.map(([s]) => s);
    expect(strings.join('\n')).not.toMatch(/Continuación de líneas|Continued lines/);
    expect(
      strings.filter(s => s === (locale === 'es' ? 'DESCRIPCION' : 'DESCRIPTION')).length
    ).toBeGreaterThan(1);
    expect(strings.filter(s => s === (locale === 'es' ? 'Pendiente' : 'Pending'))).toHaveLength(
      rows.filter(row => row.precio_pendiente_validar).length * 2
    );
    expect(strings.some(s => s.endsWith('…'))).toBe(true);
    for (const row of rows) {
      const indexes = text.mock.calls.flatMap(([s], i) => (s === row.nombre ? [i] : []));
      expect(indexes).toHaveLength(1);
      const idx = indexes[0]!;
      const page = text.mock.instances[idx];
      const y = text.mock.calls[idx]![1]!.y!;
      const borders = lines.mock.calls.flatMap(([opts], i) =>
        lines.mock.instances[i] === page && opts?.start.x === 27 && opts.end.x === 568
          ? [opts.start.y]
          : []
      );
      expect(borders.some(border => border > y)).toBe(true);
      expect(borders.some(border => border < y)).toBe(true);
      for (const x of [27, 65, 175, 372, 462, 568]) {
        expect(
          lines.mock.calls.some(
            ([opts], i) =>
              lines.mock.instances[i] === page &&
              opts?.start.x === x &&
              opts.end.x === x &&
              opts.start.y < y &&
              opts.end.y > y
          )
        ).toBe(true);
      }
    }
    const lastRow = strings.lastIndexOf(rows[19]!.nombre);
    expect(
      strings.findIndex(s => s === (locale === 'es' ? 'TOTAL BRUTO' : 'GROSS TOTAL'))
    ).toBeGreaterThan(lastRow);
  }
);

it('omits annex pages that have no long description and no specs', async () => {
  const lineas = Array.from({ length: 40 }, (_, i) => ({
    slug: i < 7 ? `ficha-${i}` : '',
    nombre: `Linea ${i}`,
    cantidad: 1,
    precio_unitario: 10,
    subtotal: 10,
    moneda: 'COP',
  }));
  const annexes: QuotePdfAnnex[] = lineas.map((linea, i) => {
    const useful = i < 7;
    const withDescription = useful && i % 2 === 0;
    return {
      slug: linea.slug,
      nombre: useful ? `Ficha ${i}` : `Vacio ${i}`,
      resumen: linea.nombre,
      descripcion: withDescription
        ? `Detalle tecnico de la ficha ${i} con texto suficiente.`
        : i % 2 === 0
          ? `Vacio ${i}`
          : '',
      caracteristicas: useful && !withDescription ? [`Parametro: ${i}`] : [],
    };
  });
  const snapshot = {
    numero: 'IME-Q-2026-000033',
    clienteNombre: 'Clinica',
    condiciones: '',
    moneda: 'COP',
    total: 400,
    lineas,
    locale: 'es' as const,
  };
  const withoutAnnexes = await renderQuotePdf({ ...snapshot, annexes: [] });
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  const withAnnexes = await renderQuotePdf({ ...snapshot, annexes });
  const pagesWith = (await PDFDocument.load(withAnnexes)).getPageCount();
  const pagesWithout = (await PDFDocument.load(withoutAnnexes)).getPageCount();
  expect(pagesWith - pagesWithout).toBe(7);

  const strings = text.mock.calls.map(([value]) => String(value));
  const drawn = strings.join('\n');
  for (let i = 0; i < 40; i += 1) expect(strings).toContain(`Linea ${i}`);
  for (let i = 0; i < 7; i += 1) expect(strings).toContain(`FICHA ${i}`);
  for (let i = 7; i < 40; i += 1)
    expect(strings.some(value => value.includes(`VACIO ${i}`))).toBe(false);
  expect(drawn).toContain('Detalle tecnico de la ficha 0 con texto suficiente.');
  expect(drawn).toContain('Parametro: 1');
  expect(drawn).toContain('Características Inteligentes:');
  expect(drawn).toContain('TOTAL BRUTO');
  expect(drawn).toContain('Consideraciones de la oferta');
  expect(drawn).toContain('+57 3137247353');
  expect(drawn).not.toMatch(/300[\s-]*717[\s-]*2757/);
  const lastRow = strings.lastIndexOf('Linea 39');
  expect(strings.findIndex(value => value === 'TOTAL BRUTO')).toBeGreaterThan(lastRow);
});

it('keeps the Edge mirror synchronized with the source', async () => {
  const source = readFileSync(new URL('./render-quote-pdf.ts', import.meta.url), 'utf8');
  const edge = readFileSync(
    new URL('../../supabase/functions/_shared/render-quote-pdf.ts', import.meta.url),
    'utf8'
  )
    .replace('/**\n * Edge mirror of src/lib/render-quote-pdf.ts — keep in sync.\n */\n', '')
    .replaceAll('npm:pdf-lib@1.17.1', 'pdf-lib')
    .replaceAll('npm:@pdf-lib/fontkit', '@pdf-lib/fontkit')
    .replaceAll(/\.\.\/\.\.\/\.\.\/src\/lib\/([\w-]+)\.ts/g, './$1');
  // Prettier wraps the Edge imports because the Deno specifiers are longer.
  // Formatting both copies after rewriting those specifiers compares the logic.
  const [formattedSource, formattedEdge] = await Promise.all([
    format(source, { parser: 'typescript' }),
    format(edge, { parser: 'typescript' }),
  ]);
  expect(formattedEdge).toBe(formattedSource);
});
