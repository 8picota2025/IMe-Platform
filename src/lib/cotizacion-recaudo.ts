/**
 * Cuentas de recaudo y condición de pago de una cotización.
 * NULL / Bancolombia Ahorros COP conserva el PDF histórico.
 */

export const CUENTA_RECAUDO_DEFAULT = 'bancolombia_ahorros';

export const NOTA_IMPORTES_USD_ES =
  'Los importes expuestos están en dólares estadounidenses (USD).';

export const NOTA_IMPORTES_USD_EN = 'Amounts shown are in United States dollars (USD).';

const NOTAS_IMPORTES_USD = [NOTA_IMPORTES_USD_ES, NOTA_IMPORTES_USD_EN] as const;

export interface CuentaRecaudo {
  id: string;
  /** Etiqueta del selector en el editor. */
  etiqueta: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  nit: string;
  swift: string;
}

export const CUENTAS_RECAUDO: readonly CuentaRecaudo[] = [
  {
    id: CUENTA_RECAUDO_DEFAULT,
    etiqueta: 'Bancolombia · Ahorros · COP',
    banco: 'Bancolombia',
    tipo_cuenta: 'Ahorros',
    numero_cuenta: '61400006521',
    titular: 'I-ME International Medical Enterprise S.A.S.',
    nit: '901871720',
    swift: '',
  },
  {
    id: 'davivienda_sa',
    etiqueta: 'Davivienda S.A. · 0550108900697583',
    banco: 'Davivienda S.A.',
    tipo_cuenta: '',
    numero_cuenta: '0550108900697583',
    titular: 'International Medical Enterprise IME S.A.S.',
    nit: '901871720',
    swift: 'CAFECOBBXXX',
  },
];

const CUENTAS_POR_ID = new Map(CUENTAS_RECAUDO.map(cuenta => [cuenta.id, cuenta]));

export function esCuentaRecaudoDefault(value: unknown): boolean {
  const id = String(value ?? '').trim();
  return id === '' || id === CUENTA_RECAUDO_DEFAULT;
}

export function cuentaRecaudoValida(value: unknown): boolean {
  const id = String(value ?? '').trim();
  return id === '' || CUENTAS_POR_ID.has(id);
}

/** Id persistible. Vacío queda null (mismo PDF que Bancolombia por defecto). */
export function normalizarCuentaRecaudo(value: unknown): string | null {
  const id = String(value ?? '').trim();
  if (!id || id === CUENTA_RECAUDO_DEFAULT) return id === CUENTA_RECAUDO_DEFAULT ? id : null;
  return CUENTAS_POR_ID.has(id) ? id : null;
}

export function cuentaRecaudoPorId(value: unknown): CuentaRecaudo {
  const id = String(value ?? '').trim();
  return CUENTAS_POR_ID.get(id) ?? CUENTAS_RECAUDO[0]!;
}

/** Resumen visible bajo el selector del editor. */
export function resumenCuentaRecaudo(cuenta: CuentaRecaudo = cuentaRecaudoPorId(null)): string {
  const partes = [cuenta.banco];
  if (cuenta.tipo_cuenta) partes.push(cuenta.tipo_cuenta);
  partes.push(cuenta.numero_cuenta);
  if (cuenta.swift) partes.push(`SWIFT ${cuenta.swift}`);
  partes.push(cuenta.titular);
  return partes.join(' · ');
}

/**
 * Líneas del recuadro MEDIO DE PAGO.
 * Bancolombia queda en las tres líneas históricas (sin SWIFT).
 */
export function lineasPagoCuenta(cuenta: CuentaRecaudo): string[] {
  const banco = cuenta.tipo_cuenta ? `${cuenta.banco}/${cuenta.tipo_cuenta}` : cuenta.banco;
  const lineas = ['Transferencia bancaria:', cuenta.numero_cuenta, banco];
  if (cuenta.swift) lineas.push(`SWIFT: ${cuenta.swift}`);
  if (cuenta.swift && cuenta.titular) lineas.push(cuenta.titular);
  return lineas;
}

/**
 * Cuenta explícita distinta del default. Si no, se conservan las líneas
 * históricas (env en Edge, defaults del boceto en el cliente).
 */
export function lineasMedioPagoCotizacion(cuentaId: unknown, lineasPorDefecto: string[]): string[] {
  if (esCuentaRecaudoDefault(cuentaId)) return lineasPorDefecto;
  return lineasPagoCuenta(cuentaRecaudoPorId(cuentaId));
}

const INSTRUCCIONES_TRANSFERENCIA =
  'Transfiere el valor exacto de la cotizacion e indica la referencia en el concepto. Luego sube el comprobante en el enlace del correo.';

/** Texto de datos bancarios (email y página de formalizar) para una cuenta del catálogo. */
export function textoBancarioCuenta(cuenta: CuentaRecaudo): string {
  const lineas = [`Banco: ${cuenta.banco}`, `Titular: ${cuenta.titular}`, `NIT: ${cuenta.nit}`];
  if (cuenta.tipo_cuenta) lineas.push(`Tipo de cuenta: ${cuenta.tipo_cuenta}`);
  lineas.push(`Numero de cuenta: ${cuenta.numero_cuenta}`);
  if (cuenta.swift) lineas.push(`SWIFT: ${cuenta.swift}`);
  lineas.push(INSTRUCCIONES_TRANSFERENCIA);
  return lineas.join('\n');
}

const INSTRUCCIONES_TRANSFERENCIA_EN =
  'Transfer the exact quoted amount and put the quote reference in the description. Then upload the receipt from the link in the email. Confirm any change of bank details in writing and by phone with I-ME.';

/**
 * Mismos datos de la cuenta elegida. En es-en las etiquetas fijas van en los dos idiomas.
 * No cambia la cuenta (`bancolombia_ahorros` / `davivienda_sa`) ni los números.
 */
export function textoBancarioCuentaIdioma(
  cuenta: CuentaRecaudo,
  idioma: 'es' | 'en' | 'es-en' = 'es'
): string {
  if (idioma === 'es') return textoBancarioCuenta(cuenta);
  const banco = idioma === 'es-en' ? `Banco / Bank: ${cuenta.banco}` : `Bank: ${cuenta.banco}`;
  const titular =
    idioma === 'es-en' ? `Titular / Account name: ${cuenta.titular}` : `Account name: ${cuenta.titular}`;
  const nit = idioma === 'es-en' ? `NIT / Tax ID: ${cuenta.nit}` : `Tax ID: ${cuenta.nit}`;
  const lineas = [banco, titular, nit];
  if (cuenta.tipo_cuenta) {
    lineas.push(
      idioma === 'es-en'
        ? `Tipo de cuenta / Account type: ${cuenta.tipo_cuenta}`
        : `Account type: ${cuenta.tipo_cuenta}`
    );
  }
  lineas.push(
    idioma === 'es-en'
      ? `Número de cuenta / Account number: ${cuenta.numero_cuenta}`
      : `Account number: ${cuenta.numero_cuenta}`
  );
  if (cuenta.swift) lineas.push(`SWIFT: ${cuenta.swift}`);
  lineas.push(
    idioma === 'es-en'
      ? `${INSTRUCCIONES_TRANSFERENCIA}\n${INSTRUCCIONES_TRANSFERENCIA_EN}`
      : INSTRUCCIONES_TRANSFERENCIA_EN
  );
  return lineas.join('\n');
}

/** Prefill solo en cotizaciones nuevas. Las antiguas conservan lo guardado (null = Contado). */
export const CONDICION_PAGO_DEFAULT_NUEVA =
  '50 % al formalizar el pedido y 50 % a la entrega del mismo.';

export function normalizarCondicionPago(value: unknown): string | null {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return text || null;
}

export function notaImportesUsd(locale: 'es' | 'en'): string {
  return locale === 'en' ? NOTA_IMPORTES_USD_EN : NOTA_IMPORTES_USD_ES;
}

export function tieneNotaImportesUsd(text: string): boolean {
  return NOTAS_IMPORTES_USD.some(note => text.includes(note));
}

export function quitarNotaImportesUsd(text: string): string {
  let next = text;
  let removed = false;
  for (const note of NOTAS_IMPORTES_USD) {
    if (!next.includes(note)) continue;
    next = next.replaceAll(note, '');
    removed = true;
  }
  if (!removed) return text;
  return next
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** En USD añade la nota de moneda; en COP la retira si se había insertado sola. */
export function aplicarNotaImportesUsd(
  condiciones: string,
  moneda: string,
  locale: 'es' | 'en' = 'es'
): string {
  const base = quitarNotaImportesUsd(condiciones);
  if (moneda !== 'USD') return base;
  const note = notaImportesUsd(locale);
  const trimmed = base.trim();
  return trimmed ? `${trimmed}\n${note}` : note;
}
