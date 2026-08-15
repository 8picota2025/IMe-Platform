/**
 * Datos bancarios públicos para PDF local del comercial (mismo orden que IPS).
 * Edge usa secrets TRANSFERENCIA_*; aquí defaults del boceto.
 */

export interface DatosBancariosCliente {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
}

const DEFAULTS: DatosBancariosCliente = {
  banco: 'Bancolombia',
  tipo_cuenta: 'Ahorros',
  numero_cuenta: '61400006521',
};

export function getDatosBancariosCliente(): DatosBancariosCliente {
  return { ...DEFAULTS };
}

/** MEDIO DE PAGO boceto: Transferencia → número de cuenta → Banco/Tipo. */
export function bancoLineasCotizacion(
  d: DatosBancariosCliente = getDatosBancariosCliente()
): string[] {
  return ['Transferencia bancaria:', d.numero_cuenta, `${d.banco}/${d.tipo_cuenta}`];
}
