/**
 * Envia el recordatorio de carrito abandonado (plantilla
 * carrito_abandonado_cliente) a carritos 'activo' sin actividad en 24h.
 * Invocacion: cron (pg_cron + pg_net, ver schema.sql) o manual con
 * service_role. Cada carrito se recuerda una sola vez.
 */

import { unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { enviarEmailPlantilla, escapeHtml, itemsToHtml } from '../_shared/email.ts';

const HORAS_ESPERA = Number(Deno.env.get('CARRITO_RECORDATORIO_HORAS') ?? 24);
const MAX_POR_EJECUCION = 50;

Deno.serve(async req => {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!token || token !== serviceKey) return unauthorized(null);

  const supabase = getServerSupabase();
  const limite = new Date(Date.now() - HORAS_ESPERA * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('carritos_abandonados')
    .select('id, email, nombre, items, subtotal')
    .eq('estado', 'activo')
    .lt('updated_at', limite)
    .limit(MAX_POR_EJECUCION);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  const carritos = (data ?? []) as Array<{
    id: string;
    email: string;
    nombre: string | null;
    items: Array<{ nombre?: string; cantidad?: number }>;
    subtotal: number | string;
  }>;

  let enviados = 0;
  for (const carrito of carritos) {
    const resultado = await enviarEmailPlantilla(
      supabase,
      'carrito_abandonado_cliente',
      [carrito.email],
      {
        cliente_nombre: escapeHtml(carrito.nombre || 'Cliente'),
        items_html: itemsToHtml(carrito.items ?? []),
        total: Number(carrito.subtotal).toLocaleString('es-CO'),
      },
      carrito.email
    );
    await supabase
      .from('carritos_abandonados')
      .update({
        estado: 'recordado',
        recordatorio_enviado_at: new Date().toISOString(),
      })
      .eq('id', carrito.id);
    if (resultado.ok) enviados += 1;
    else console.error('recordatorio-carritos:', carrito.email, resultado.detalle);
  }

  return new Response(JSON.stringify({ ok: true, procesados: carritos.length, enviados }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
