/**
 * Cola de Emilio, el único bot que envía correo.
 * Esta función no llama a ningún proveedor de email.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { filaColaEmilio, type SolicitudCorreo } from '../../../src/lib/cola-emilio.ts';

export function logEstructurado(evento: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...evento }));
}

export async function encolarCorreoEmilio(
  supabase: SupabaseClient,
  solicitud: SolicitudCorreo
): Promise<{ ok: true; encolado: true; colaId: string } | { ok: false; encolado: false; detalle: string }> {
  let fila;
  try {
    fila = filaColaEmilio(solicitud);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : 'solicitud invalida';
    logEstructurado({
      nivel: 'error',
      accion: 'encolar_correo',
      actor: solicitud.solicitante,
      origen: solicitud.origen,
      error: detalle,
    });
    return { ok: false, encolado: false, detalle };
  }
  const { data, error } = await supabase.from('cola_emilio').insert(fila).select('id').single();
  if (error) {
    logEstructurado({
      nivel: 'error',
      accion: 'encolar_correo',
      actor: fila.solicitante,
      origen: fila.origen,
      error: error.message,
    });
    return { ok: false, encolado: false, detalle: error.message };
  }
  const colaId = String((data as { id?: string } | null)?.id ?? '');
  logEstructurado({
    nivel: 'info',
    accion: 'encolar_correo',
    actor: fila.solicitante,
    origen: fila.origen,
    destinatarios: fila.destinatarios,
    referencia: fila.referencia,
    cola_id: colaId,
  });
  return { ok: true, encolado: true, colaId };
}
