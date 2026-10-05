import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderQuotePdf, type QuotePdfSnapshot } from './render-quote-pdf';

const fixture = (count: number, locale: 'es' | 'en', summaries: boolean): QuotePdfSnapshot => ({
  numero: 'IME-Q-2026-TEST',
  clienteNombre: 'Cliente de prueba — datos sintéticos',
  empresa: 'Ejemplo de verificación de PDF',
  nombreComercial: 'Asesor de prueba',
  condiciones: 'Ejemplo de prueba sin validez comercial.',
  validezHasta: '2026-12-31',
  fecha: '05/10/2026',
  moneda: 'COP',
  total: 0,
  locale,
  lineas: Array.from({ length: count }, (_, i) => ({
    slug: i === 0 ? 'referencia-muy-larga-para-comprobar-la-elipsis-en-columna' : `REF-${i + 1}`,
    nombre: `Equipo de prueba ${String(i + 1).padStart(3, '0')}`,
    cantidad: 2,
    precio_unitario: 1000,
    subtotal: 2000,
    moneda: 'COP',
    precio_pendiente_validar: i % 3 === 0,
    notas: summaries
      ? 'Característica A: ejemplo\nCaracterística B: ejemplo\nCaracterística C: ejemplo'
      : '',
  })),
});

async function extract(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
  const pages: Array<Array<{ str: string; transform: number[] }>> = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(
      content.items.filter(
        (item): item is (typeof content.items)[number] & { str: string; transform: number[] } =>
          'str' in item
      )
    );
  }
  await pdf.cleanup();
  return pages;
}

describe('quote PDF table pagination', () => {
  for (const locale of ['es', 'en'] as const) {
    for (const summaries of [false, true]) {
      for (const count of [0, 1, 9, 15, 20, 60]) {
        it(`${locale}: ${count} rows, summaries=${summaries}`, async () => {
          const snapshot = fixture(count, locale, summaries);
          const pages = await extract(await renderQuotePdf(snapshot));
          const text = pages
            .flat()
            .map(item => item.str)
            .join(' ');
          expect(text).not.toMatch(/Continuación de líneas|Continued lines/);
          const tables = pages.filter(page =>
            page.some(item => item.str.includes(locale === 'es' ? 'DESCRIPCION' : 'DESCRIPTION'))
          );
          expect(tables.length).toBeGreaterThanOrEqual(count >= 15 ? 2 : 1);
          const rows = tables.flat().filter(item => /^Equipo de prueba \d{3}$/.test(item.str));
          expect(rows).toHaveLength(count);
          expect(new Set(rows.map(item => item.str)).size).toBe(count);
          expect(pages[0]!.some(item => item.str === 'Asesor: Asesor de prueba')).toBe(true);
          if (count > 0) expect(text).toContain('…'); // long REF and other fitted text
          expect(
            tables.flat().filter(item => item.str === (locale === 'es' ? 'Pendiente' : 'Pending'))
          ).toHaveLength(Math.ceil(count / 3) * 2);
          const totalLabel = locale === 'es' ? 'TOTAL A PAGAR' : 'TOTAL DUE';
          expect(
            tables
              .slice(0, -1)
              .flat()
              .some(item => item.str === totalLabel)
          ).toBe(false);
          const last = tables.at(-1)!;
          const total = last.find(item => item.str === totalLabel)!;
          expect(total).toBeDefined();
          const lastRow = last.filter(item => /^Equipo de prueba \d{3}$/.test(item.str)).at(-1);
          if (lastRow) expect(total.transform[5]).toBeLessThan(lastRow.transform[5]!);
          expect(total.transform[5]).toBeGreaterThan(62);
          const pricedRows = count - Math.ceil(count / 3);
          expect(
            last.some(
              item =>
                item.str ===
                `$${new Intl.NumberFormat(locale === 'es' ? 'es-CO' : 'en-US').format(pricedRows * 2000 * 1.19)}`
            )
          ).toBe(true);
        });
      }
    }
  }
  it('renders with production Poppins fonts and writes a review example on request', async () => {
    const snapshot = fixture(20, 'es', true);
    snapshot.fontRegularBytes = readFileSync('public/fonts/Poppins-Regular.ttf');
    snapshot.fontBoldBytes = readFileSync('public/fonts/Poppins-Bold.ttf');
    const bytes = await renderQuotePdf(snapshot);
    expect(
      (await extract(bytes)).flat().filter(item => /^Equipo de prueba \d{3}$/.test(item.str))
    ).toHaveLength(20);
    if (process.env.QUOTE_PDF_EXAMPLE_DIR) {
      mkdirSync(process.env.QUOTE_PDF_EXAMPLE_DIR, { recursive: true });
      writeFileSync(`${process.env.QUOTE_PDF_EXAMPLE_DIR}/after.pdf`, bytes);
    }
  });
});
