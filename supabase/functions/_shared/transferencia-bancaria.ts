/**
 * Datos bancarios I-ME para pago por transferencia manual.
 * Configurar via secrets de Edge Functions / .env.
 */

export interface DatosBancariosTransferencia {
  banco: string;
  titular: string;
  nit: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  swift: string;
  instrucciones: string;
}

/** Defaults públicos del boceto IPS (cuenta visible en plantilla comercial). */
const DEFAULT_CUENTA = '61400006521';
const DEFAULT_BANCO = 'Bancolombia';
const DEFAULT_TIPO = 'Ahorros';

export function getDatosBancariosTransferencia(): DatosBancariosTransferencia {
  return {
    banco: Deno.env.get('TRANSFERENCIA_BANCO')?.trim() || DEFAULT_BANCO,
    titular:
      Deno.env.get('TRANSFERENCIA_TITULAR')?.trim() ||
      'I-ME International Medical Enterprise S.A.S.',
    nit: Deno.env.get('TRANSFERENCIA_NIT')?.trim() || '901871720',
    tipo_cuenta: Deno.env.get('TRANSFERENCIA_TIPO_CUENTA')?.trim() || DEFAULT_TIPO,
    numero_cuenta: Deno.env.get('TRANSFERENCIA_NUMERO')?.trim() || DEFAULT_CUENTA,
    swift: Deno.env.get('TRANSFERENCIA_SWIFT')?.trim() || '',
    instrucciones:
      Deno.env.get('TRANSFERENCIA_INSTRUCCIONES')?.trim() ||
      'Transfiere el valor exacto de la cotizacion e indica la referencia en el concepto. Luego sube el comprobante en el enlace del correo.',
  };
}

/** Líneas MEDIO DE PAGO del boceto IPS: transferencia → cuenta → banco/tipo. */
export function bancoLineasCotizacion(
  d: DatosBancariosTransferencia = getDatosBancariosTransferencia()
): string[] {
  return ['Transferencia bancaria:', d.numero_cuenta, `${d.banco}/${d.tipo_cuenta}`];
}

export function datosBancariosTexto(
  d: DatosBancariosTransferencia = getDatosBancariosTransferencia()
): string {
  const lines = [
    `Banco: ${d.banco}`,
    `Titular: ${d.titular}`,
    `NIT: ${d.nit}`,
    `Tipo de cuenta: ${d.tipo_cuenta}`,
    `Numero de cuenta: ${d.numero_cuenta}`,
  ];
  if (d.swift) lines.push(`SWIFT: ${d.swift}`);
  lines.push(d.instrucciones);
  return lines.join('\n');
}

export function datosBancariosHtml(
  d: DatosBancariosTransferencia = getDatosBancariosTransferencia()
): string {
  return datosBancariosTexto(d).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
