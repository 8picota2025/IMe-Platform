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
  instrucciones: string;
}

export function getDatosBancariosTransferencia(): DatosBancariosTransferencia {
  return {
    banco: Deno.env.get('TRANSFERENCIA_BANCO')?.trim() || 'Bancolombia',
    titular:
      Deno.env.get('TRANSFERENCIA_TITULAR')?.trim() ||
      'I-ME International Medical Enterprise S.A.S.',
    nit: Deno.env.get('TRANSFERENCIA_NIT')?.trim() || 'Pendiente configurar NIT',
    tipo_cuenta: Deno.env.get('TRANSFERENCIA_TIPO_CUENTA')?.trim() || 'Ahorros',
    numero_cuenta: Deno.env.get('TRANSFERENCIA_NUMERO')?.trim() || 'Pendiente configurar cuenta',
    instrucciones:
      Deno.env.get('TRANSFERENCIA_INSTRUCCIONES')?.trim() ||
      'Transfiere el valor exacto de la cotizacion e indica la referencia en el concepto. Luego sube el comprobante en el enlace del correo.',
  };
}

export function datosBancariosTexto(
  d: DatosBancariosTransferencia = getDatosBancariosTransferencia()
): string {
  return [
    `Banco: ${d.banco}`,
    `Titular: ${d.titular}`,
    `NIT: ${d.nit}`,
    `Tipo de cuenta: ${d.tipo_cuenta}`,
    `Numero de cuenta: ${d.numero_cuenta}`,
    d.instrucciones,
  ].join('\n');
}

export function datosBancariosHtml(
  d: DatosBancariosTransferencia = getDatosBancariosTransferencia()
): string {
  return datosBancariosTexto(d).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
