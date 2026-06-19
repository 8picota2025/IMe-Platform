/**
 * Consulta pública del estado de un pedido (páginas de resultado de pago).
 * Invoca la Edge Function consultar-pedido, que solo expone campos no
 * sensibles (estado, moneda, total) — nunca cliente, items ni metadata.
 */
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type EstadoPedido =
  | 'pendiente'
  | 'pagado'
  | 'rechazado'
  | 'expirado'
  | 'cancelado'
  | 'reembolsado'
  | 'error_verificacion';

export interface PedidoConsultado {
  encontrado: boolean;
  referencia?: string;
  estado?: EstadoPedido;
  moneda?: string;
  total?: number;
}

export type ResultadoConsultaPedido =
  | { ok: true; pedido: PedidoConsultado }
  | { ok: false; error: 'NO_DISPONIBLE' | 'ERROR' };

export async function consultarPedido(referencia: string): Promise<ResultadoConsultaPedido> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'NO_DISPONIBLE' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'NO_DISPONIBLE' };

  const { data, error } = await supabase.functions.invoke('consultar-pedido', {
    body: { referencia },
  });

  if (error || !data?.ok) return { ok: false, error: 'ERROR' };

  return { ok: true, pedido: data as PedidoConsultado };
}

/**
 * Lee el parámetro `referencia` (o `ref`) de la URL actual.
 */
export function leerReferenciaDeUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('referencia') ?? params.get('ref') ?? null;
}
