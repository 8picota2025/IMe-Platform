import { readFileSync } from 'node:fs';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { format } from 'prettier';
import { afterEach, expect, it, vi } from 'vitest';
import { renderQuotePdf, type QuotePdfAnnex } from './render-quote-pdf';
import { NOTA_IMPORTES_USD_EN, NOTA_IMPORTES_USD_ES } from './cotizacion-recaudo';

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
      strings.filter(s => s === (locale === 'es' ? 'DESCRIPCIÓN' : 'DESCRIPTION')).length
    ).toBeGreaterThan(1);
    expect(strings.filter(s => s === (locale === 'es' ? 'Pendiente' : 'Pending'))).toHaveLength(
      rows.filter(row => row.precio_pendiente_validar).length * 2
    );
    expect(strings.some(s => s.endsWith('…'))).toBe(false);
    expect(strings.some(s => s.includes('reference-with-'))).toBe(true);
    for (const row of rows) {
      const indexes = text.mock.calls.flatMap(([s], i) => (s === row.nombre ? [i] : []));
      expect(indexes).toHaveLength(1);
      const idx = indexes[0]!;
      const page = text.mock.instances[idx];
      const y = text.mock.calls[idx]![1]!.y!;
      const borders = lines.mock.calls.flatMap(([opts], i) =>
        lines.mock.instances[i] === page && opts?.start.x === 40 && opts.end.x === 555.5
          ? [opts.start.y]
          : []
      );
      expect(borders.some(border => border > y)).toBe(true);
      expect(borders.some(border => border < y)).toBe(true);
      for (const x of [40, 92, 200, 391.5, 473.5, 555.5]) {
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
  expect(drawn).toContain('+57 313 724 7353');
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

it('keeps COP payment box, Contado and the peso sign by default', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'COP-DEFAULT',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 500000,
    lineas: [
      {
        slug: 'ref',
        nombre: 'Monitor',
        cantidad: 50000,
        precio_unitario: 10,
        subtotal: 500000,
        moneda: 'COP',
      },
    ],
    locale: 'es',
    bancoLineas: ['Transferencia bancaria:', '61400006521', 'Bancolombia/Ahorros'],
  });
  const strings = text.mock.calls.map(([value]) => String(value));
  const drawn = strings.join(' ');
  expect(strings).toContain('50.000');
  expect(strings.some(value => value.includes('…') && value.includes('50'))).toBe(false);
  expect(strings).toContain('Contado');
  expect(strings).toContain('Bancolombia/Ahorros');
  expect(strings).toContain('61400006521');
  expect(drawn).not.toContain(NOTA_IMPORTES_USD_ES);
  expect(drawn).not.toContain('USD ');
  expect(strings.some(value => value.startsWith('$'))).toBe(true);
});

it('prints the selected account, payment terms, USD and the currency note', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'USD-DAV',
    clienteNombre: 'Clinic',
    condiciones: 'Delivery:\n30 days.',
    moneda: 'USD',
    total: 1200,
    condicionPago: '35% / 35% / 30%',
    bancoLineas: [
      'Transferencia bancaria:',
      '0550108900697583',
      'Davivienda S.A.',
      'SWIFT: CAFECOBBXXX',
      'International Medical Enterprise IME S.A.S.',
    ],
    lineas: [
      {
        slug: 'ref',
        nombre: 'Monitor',
        cantidad: 50000,
        precio_unitario: 12,
        subtotal: 600000,
        moneda: 'USD',
      },
    ],
    locale: 'en',
  });
  const strings = text.mock.calls.map(([value]) => String(value));
  const drawn = strings.join(' ');
  expect(strings).toContain('50,000');
  expect(strings).toContain('35% / 35% / 30%');
  expect(strings).toContain('0550108900697583');
  expect(drawn).toContain('SWIFT: CAFECOBBXXX');
  expect(drawn).toContain('Davivienda S.A.');
  expect(drawn).not.toContain('Bancolombia/Ahorros');
  expect(strings.some(value => value.startsWith('$'))).toBe(false);
  expect(strings.some(value => value.startsWith('USD '))).toBe(true);
  expect(drawn).toContain(NOTA_IMPORTES_USD_EN);
});

it('adds the Spanish USD note in the offer notes', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'USD-ES',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'USD',
    total: 10,
    lineas: [
      {
        slug: 'ref',
        nombre: 'Monitor',
        cantidad: 1,
        precio_unitario: 10,
        subtotal: 10,
        moneda: 'USD',
      },
    ],
    locale: 'es',
  });
  const drawn = text.mock.calls.map(([value]) => String(value)).join(' ');
  expect(drawn).toContain(NOTA_IMPORTES_USD_ES);
  expect(drawn).toContain('USD ');
  expect(drawn).not.toMatch(/\$\d/);
});

it('does not add VAT on top when the quote price already includes it', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'IME-Q-2026-000038',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 178900,
    impuestosIncluidos: true,
    lineas: [
      {
        slug: 'monitor',
        nombre: 'Monitor',
        cantidad: 1,
        precio_unitario: 178900,
        subtotal: 178900,
        moneda: 'COP',
        tratamiento_iva: '19',
      },
    ],
    locale: 'es',
  });
  const drawn = text.mock.calls.map(([value]) => String(value)).join('\n');
  expect(drawn).toContain('$178.900');
  expect(drawn).toContain('IVA 19% incl.');
  expect(drawn).not.toContain('212.891');
});

it('keeps a zero-VAT line at the quoted total', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'IME-Q-2026-000039',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 178900,
    impuestosIncluidos: true,
    lineas: [
      {
        slug: 'caminador-con-ruedas-de-5-en-aluminio-color-gris-ref-kp153-al-19-konfort-plus',
        nombre: 'Caminador KP153-AL-19',
        cantidad: 1,
        precio_unitario: 178900,
        subtotal: 178900,
        moneda: 'COP',
        tratamiento_iva: 'excluido',
      },
    ],
    locale: 'es',
  });
  const drawn = text.mock.calls.map(([value]) => String(value)).join('\n');
  expect(drawn).toContain('$178.900');
  expect(drawn).toContain('IVA 0%');
  expect(drawn).not.toContain('212.891');
  expect(drawn).not.toContain('150.336');
});

it('honors caller total when line IVA is catalog-default (empty tratamiento)', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  // Without tratamiento_iva, PDF desglose would invent +19% ($212.891).
  // Caller already resolved catalog excluido → total 178900.
  await renderQuotePdf({
    numero: 'IME-Q-2026-000040',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 178900,
    impuestosIncluidos: false,
    lineas: [
      {
        slug: 'producto-excluido-catalogo',
        nombre: 'Producto excluido',
        cantidad: 1,
        precio_unitario: 178900,
        subtotal: 178900,
        moneda: 'COP',
      },
    ],
    locale: 'es',
  });
  const drawn = text.mock.calls.map(([value]) => String(value)).join('\n');
  expect(drawn).toContain('$178.900');
  expect(drawn).not.toContain('212.891');
});

it('prints a dash in the client block when the contact is empty or belongs to I-ME', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'IME-Q-2026-000042',
    clienteNombre: 'Essam Yaseen',
    empresa: '2M Trading',
    email: 'pendiente-2mtrading@i-me.com.co',
    telefono: '+573137247353',
    nitCliente: '901871720',
    direccionCliente: '',
    ciudadCliente: 'Doha',
    paisCliente: 'Qatar',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'USD',
    total: 10,
    lineas: [
      {
        slug: 'ref',
        nombre: 'Monitor',
        cantidad: 1,
        precio_unitario: 10,
        subtotal: 10,
        moneda: 'USD',
      },
    ],
    locale: 'es',
    idioma: 'es-en',
    condicionPago: '50 % anticipo OC / 50 % antes de embarque',
    bancoLineas: [
      'Transferencia bancaria:',
      '0550108900697583',
      'Davivienda S.A.',
      'SWIFT: CAFECOBBXXX',
    ],
  });
  const strings = text.mock.calls.map(([value]) => String(value));
  const drawn = strings.join('\n');
  expect(drawn).not.toContain('pendiente-2mtrading@i-me.com.co');
  expect(drawn).not.toContain('+573137247353');
  expect(strings).toContain('Correo / Email: -');
  expect(strings).toContain('Correo / Email: info@i-me.com.co');
  expect(strings).toContain('Teléfono / Phone: -');
  expect(strings).toContain('NIT / Tax ID: -');
  expect(drawn).toContain('International Medical Enterprise IME S.A.S.');
  expect(drawn).toContain('NIT: 901871720');
  expect(drawn).toContain('info@i-me.com.co');
  expect(drawn).toContain('i-me.com.co');
  expect(drawn).toContain('+57 313 724 7353');
  expect(drawn).toContain('CLIENTE / CLIENT');
  expect(drawn).toContain('EMISOR / ISSUER');
  expect(drawn).toContain('CONDICIÓN DE PAGO');
  expect(drawn).not.toContain('Web / Web');
  expect(drawn).toContain('Web: i-me.com.co');
  const baselines = text.mock.calls.map((call, index) => ({
    text: String(call[0]),
    x: call[1]?.x,
    y: call[1]?.y,
    page: text.mock.instances[index],
  }));
  const totalPagar = baselines.find(item => item.text === 'TOTAL A PAGAR');
  const totalDue = baselines.find(
    item => item.page === totalPagar?.page && item.text === 'TOTAL DUE'
  );
  const importe = baselines.find(
    item => item.page === totalPagar?.page && item.text.startsWith('USD ')
  );
  expect(totalPagar?.text).toBe('TOTAL A PAGAR');
  expect(totalDue?.text).toBe('TOTAL DUE');
  expect(Number(importe?.x)).toBeGreaterThan(Number(totalPagar?.x) + 40);
  expect(drawn).toContain('PRECIO UNIT');
  expect(drawn).toContain('UNIT PRICE');
  expect(drawn).toContain('0550108900697583');
  expect(drawn).toContain('50 % anticipo OC / 50 % antes');
  expect(drawn).not.toContain('Prepaid');
  expect(drawn).toContain(NOTA_IMPORTES_USD_ES);
  expect(drawn).toContain(NOTA_IMPORTES_USD_EN);
  expect(drawn).not.toContain('Pagar con Wompi');
});

it('keeps a national COP quote in Spanish and still links Wompi', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'IME-Q-2026-000041',
    clienteNombre: 'Clinica Norte',
    empresa: 'Clinica Norte S.A.S.',
    email: '',
    telefono: '',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 100000,
    wompiUrl: 'https://checkout.wompi.co/l/ejemplo',
    lineas: [
      {
        slug: 'ref',
        nombre: 'Monitor',
        cantidad: 1,
        precio_unitario: 100000,
        subtotal: 100000,
        moneda: 'COP',
      },
    ],
    locale: 'es',
    bancoLineas: ['Transferencia bancaria:', '61400006521', 'Bancolombia/Ahorros'],
  });
  const strings = text.mock.calls.map(([value]) => String(value));
  const drawn = strings.join('\n');
  expect(drawn).toContain('COTIZACIÓN');
  expect(drawn).not.toContain('QUOTATION');
  expect(drawn).not.toContain('UNIT PRICE');
  expect(drawn).toContain('PRECIO UNIT');
  expect(drawn).toContain('DESCRIPCIÓN');
  expect(drawn).toContain('CLIENTE');
  expect(drawn).not.toContain('CLIENTE / CLIENT');
  expect(drawn).toContain('Correo: -');
  expect(drawn).toContain('Teléfono: -');
  expect(drawn).toContain('Pagar con Wompi');
  expect(drawn).toContain('61400006521');
  expect(drawn).not.toContain(NOTA_IMPORTES_USD_ES);
  expect(drawn).toContain('Correo: info@i-me.com.co');
});

it('keeps an em dash when the embedded font can draw it', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  await renderQuotePdf({
    numero: 'RAYA',
    clienteNombre: 'Clinica',
    email: '',
    telefono: '',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 10,
    fontRegularBytes: readFileSync(
      new URL('../../public/fonts/Poppins-Regular.ttf', import.meta.url)
    ),
    fontBoldBytes: readFileSync(new URL('../../public/fonts/Poppins-Bold.ttf', import.meta.url)),
    lineas: [
      {
        slug: '',
        nombre: 'Monitor de signos',
        nombre_en: 'Vital signs monitor',
        cantidad: 1,
        precio_unitario: 10,
        subtotal: 10,
        moneda: 'COP',
      },
    ],
    locale: 'es',
    idioma: 'es-en',
  });
  const strings = text.mock.calls.map(([value]) => String(value));
  expect(strings).toContain('Correo / Email: —');
  expect(strings).toContain('Teléfono / Phone: —');
  expect(strings).not.toContain('Correo / Email: -');
  expect(strings.some(value => value.includes('Monitor de signos'))).toBe(true);
  expect(strings.some(value => value.includes('Vital signs'))).toBe(true);
  expect(strings.some(value => value.endsWith('…'))).toBe(false);
});

it('does not leave a single table row alone on the next page', async () => {
  const text = vi.spyOn(PDFPage.prototype, 'drawText');
  const nota = 'Especificacion de linea '.repeat(18).trim();
  const lineas = ['Alfa', 'Beta', 'Gamma', 'Delta'].map(nombre => ({
    slug: '',
    nombre,
    cantidad: 1,
    precio_unitario: 10,
    subtotal: 10,
    moneda: 'COP' as const,
    notas: nota,
  }));
  await renderQuotePdf({
    numero: 'HUERFANA',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 40,
    lineas,
    locale: 'es',
  });
  const porPagina = new Map<PDFPage, string[]>();
  text.mock.calls.forEach((call, index) => {
    const page = text.mock.instances[index] as PDFPage;
    const lista = porPagina.get(page) ?? [];
    lista.push(String(call[0]));
    porPagina.set(page, lista);
  });
  const conteos = [...porPagina.values()]
    .map(lista => lineas.filter(linea => lista.includes(linea.nombre)).length)
    .filter(conteo => conteo > 0);
  expect(conteos.some(conteo => conteo === 1)).toBe(false);
  expect(conteos.reduce((a, b) => a + b, 0)).toBe(lineas.length);
});

it('aligns the table header and the footer to the same content width', async () => {
  const rects = vi.spyOn(PDFPage.prototype, 'drawRectangle');
  await renderQuotePdf({
    numero: 'MARCO',
    clienteNombre: 'Clinica',
    condiciones: 'Entrega:\n30 dias.',
    moneda: 'COP',
    total: 10,
    lineas: [
      {
        slug: '',
        nombre: 'Sistema de integración de quirófano (por sala)',
        nombre_en: 'OR Integration System (per room)',
        cantidad: 1,
        precio_unitario: 10,
        subtotal: 10,
        moneda: 'COP',
      },
    ],
    locale: 'es',
    idioma: 'es-en',
  });
  const bands = rects.mock.calls
    .map(([opts]) => opts)
    .filter(opts => (opts?.width ?? 0) > 480 && (opts?.width ?? 0) < 540);
  expect(bands.length).toBeGreaterThan(1);
  for (const band of bands) {
    expect(band?.x).toBe(40);
    expect(band?.width).toBe(515.5);
  }
});
