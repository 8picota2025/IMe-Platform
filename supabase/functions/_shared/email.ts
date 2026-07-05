/**
 * Envio de emails transaccionales via Resend con plantillas editables
 * (tabla email_templates) y fallback a defaults en codigo.
 * Todos los envios se registran en email_log (best-effort).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const DESTINATARIOS_INTERNOS = (
  Deno.env.get('MAILER_INTERNAL') ?? 'root@i-me.com.co,ventas@i-me.com.co'
)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function itemsToHtml(items: Array<{ nombre?: string; cantidad?: number }>): string {
  return items
    .map(i => `<li>${Number(i.cantidad ?? 1)} x ${escapeHtml(String(i.nombre ?? 'Producto'))}</li>`)
    .join('');
}

const DEFAULTS: Record<string, { asunto: string; html: string }> = {
  venta_interna: {
    asunto: 'Nueva venta {{referencia}} - {{total}} COP',
    html: '<h2>Nueva venta confirmada</h2><p>Pedido: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><ul>{{items_html}}</ul><p>Fecha: {{fecha}}</p>',
  },
  cotizacion_interna: {
    asunto: 'Nueva cotizacion de {{cliente_nombre}} - I-ME',
    html: '<h2>Nueva solicitud de cotizacion</h2><p>Nombre: {{cliente_nombre}}</p><p>Empresa: {{empresa}}</p><p>Email: {{cliente_email}}</p><p>Telefono: {{telefono}}</p><ul>{{items_html}}</ul><p>Mensaje: {{mensaje}}</p>',
  },
  pedido_confirmacion_cliente: {
    asunto: 'Confirmacion de tu pedido {{referencia}} - I-ME',
    html: '<h2>Gracias por tu compra, {{cliente_nombre}}</h2><p>Hemos recibido el pago de tu pedido <strong>{{referencia}}</strong>.</p><p>Total: <strong>{{total}} {{moneda}}</strong></p><ul>{{items_html}}</ul><p>Equipo I-ME</p>',
  },
  cotizacion_confirmacion_cliente: {
    asunto: 'Hemos recibido tu solicitud de cotizacion - I-ME',
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud y te contactaremos en breve.</p><ul>{{items_html}}</ul><p>Equipo I-ME</p>',
  },
  pedido_estado_cliente: {
    asunto: 'Tu pedido {{referencia}} esta {{estado_label}} - I-ME',
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Tu pedido <strong>{{referencia}}</strong> cambio de estado: <strong>{{estado_label}}</strong>.</p>{{tracking_html}}<p>Equipo I-ME</p>',
  },
};

function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
}

export interface EnvioResultado {
  ok: boolean;
  detalle?: string;
}

/**
 * Renderiza la plantilla `clave` (DB con fallback a defaults) y la envia a
 * cada destinatario. `vars` deben venir ya escapadas si contienen input de
 * usuario (usar escapeHtml / itemsToHtml).
 */
export async function enviarEmailPlantilla(
  supabase: SupabaseClient,
  clave: string,
  destinatarios: string[],
  vars: Record<string, string>,
  referencia?: string
): Promise<EnvioResultado> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { ok: false, detalle: 'RESEND_API_KEY no configurada' };

  let asunto: string;
  let html: string;
  const { data } = await supabase
    .from('email_templates')
    .select('asunto, html, activo')
    .eq('clave', clave)
    .maybeSingle();
  const row = data as { asunto: string; html: string; activo: boolean } | null;
  if (row) {
    if (!row.activo) return { ok: true, detalle: `plantilla ${clave} desactivada` };
    asunto = row.asunto;
    html = row.html;
  } else if (DEFAULTS[clave]) {
    asunto = DEFAULTS[clave].asunto;
    html = DEFAULTS[clave].html;
  } else {
    return { ok: false, detalle: `plantilla desconocida: ${clave}` };
  }

  const from = Deno.env.get('MAILER_FROM') ?? 'pedidos@i-me.com.co';
  const subject = render(asunto, vars);
  const body = render(html, vars);
  const resultados: string[] = [];
  let todosOk = true;

  for (const to of destinatarios) {
    let status: 'enviado' | 'fallido' = 'enviado';
    let errorTxt: string | null = null;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html: body }),
      });
      if (!res.ok) {
        status = 'fallido';
        errorTxt = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      }
    } catch (err) {
      status = 'fallido';
      errorTxt = err instanceof Error ? err.message : 'error desconocido';
    }
    if (status === 'fallido') {
      todosOk = false;
      resultados.push(`${to}: ${errorTxt}`);
    }
    try {
      await supabase.from('email_log').insert({
        destinatario: to,
        plantilla: clave,
        referencia: referencia ?? null,
        status,
        error: errorTxt,
      });
    } catch {
      // log best-effort
    }
  }

  return { ok: todosOk, detalle: resultados.join('; ') || undefined };
}

export const ESTADO_LABELS: Record<string, string> = {
  pagado: 'pagado',
  procesando: 'en preparacion',
  enviado: 'enviado',
  entregado: 'entregado',
  retrasado: 'retrasado por disponibilidad',
  cancelado: 'cancelado',
  reembolsado: 'reembolsado',
};
