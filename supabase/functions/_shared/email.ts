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

export const DESTINATARIOS_COMPRAS = (Deno.env.get('MAILER_COMPRAS') ?? 'compras@i-me.com.co')
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

type EmailLocale = 'es' | 'en';

function formatMoney(value: unknown, moneda: unknown, locale: EmailLocale = 'es'): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const currency = typeof moneda === 'string' && moneda ? moneda : 'COP';
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount);
}

export function itemsToHtml(
  items: Array<{
    nombre?: string;
    cantidad?: number;
    precio_unitario?: number;
    subtotal?: number;
    moneda?: string;
  }>,
  locale: EmailLocale = 'es'
): string {
  const fallbackName = locale === 'en' ? 'Product' : 'Producto';
  const unitLabel = locale === 'en' ? 'Unit' : 'Unitario';
  const totalLabel = locale === 'en' ? 'Line total' : 'Total';
  const pendingLabel = locale === 'en' ? 'to be validated' : 'por validar';

  return items
    .map(i => {
      const cantidad = Number(i.cantidad ?? 1);
      const nombre = escapeHtml(String(i.nombre ?? fallbackName));
      const precio = formatMoney(i.precio_unitario, i.moneda, locale);
      const subtotal = formatMoney(i.subtotal, i.moneda, locale);
      const valores =
        precio || subtotal
          ? ` - ${unitLabel}: ${precio || pendingLabel} · ${totalLabel}: ${subtotal || pendingLabel}`
          : '';
      return `<li>${cantidad} x ${nombre}${valores}</li>`;
    })
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
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud de presupuesto y te contactaremos en breve.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Resumen solicitado:</strong></p><ul>{{items_html}}</ul><p><strong>Mensaje recibido:</strong></p><pre>{{mensaje}}</pre><p>Equipo I-ME<br>ventas@i-me.com.co</p>',
  },
  cotizacion_confirmacion_cliente_es: {
    asunto: 'Hemos recibido tu solicitud de presupuesto - I-ME',
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu solicitud de presupuesto y te contactaremos en breve.</p><p><strong>Referencia:</strong> {{referencia}}</p><p><strong>Resumen solicitado:</strong></p><ul>{{items_html}}</ul><p><strong>Mensaje recibido:</strong></p><pre>{{mensaje}}</pre><p>Equipo I-ME<br>ventas@i-me.com.co</p>',
  },
  cotizacion_confirmacion_cliente_en: {
    asunto: 'We received your quote request - I-ME',
    html: '<h2>Hello {{cliente_nombre}}</h2><p>We received your quote request and our commercial team will contact you shortly.</p><p><strong>Reference:</strong> {{referencia}}</p><p><strong>Request summary:</strong></p><ul>{{items_html}}</ul><p><strong>Message received:</strong></p><pre>{{mensaje}}</pre><p>I-ME Team<br>ventas@i-me.com.co</p>',
  },
  compra_valorar_interna: {
    asunto: 'Compra a valorar {{referencia}} - {{total}} {{moneda}}',
    html: '<h2>Compra a valorar desde carrito</h2><p><strong>Accion requerida:</strong> validar precio unitario, disponibilidad, impuestos, envio y total final.</p><p>Referencia: <strong>{{referencia}}</strong></p><p>Cliente: {{cliente_nombre}} ({{cliente_email}})</p><p>Empresa: {{empresa}}</p><p>Telefono: {{telefono}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Productos:</p><ul>{{items_html}}</ul><p>Mensaje:</p><pre>{{mensaje}}</pre><p>Fecha: {{fecha}}</p>',
  },
  compra_valorar_confirmacion_cliente: {
    asunto: 'Recibimos tu solicitud de compra a valorar - I-ME',
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu carrito. El pago online esta temporalmente no disponible, por eso nuestro equipo validara precio unitario, disponibilidad, impuestos, envio y total final antes de confirmar.</p><p><strong>Referencia:</strong> {{referencia}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Resumen solicitado:</p><ul>{{items_html}}</ul><p>Te contactaremos con la valoracion final.</p><p>Equipo I-ME</p>',
  },
  compra_valorar_confirmacion_cliente_es: {
    asunto: 'Recibimos tu solicitud de compra a valorar - I-ME',
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Recibimos tu carrito. El pago online esta temporalmente no disponible, por eso nuestro equipo validara precio unitario, disponibilidad, impuestos, envio y total final antes de confirmar.</p><p><strong>Referencia:</strong> {{referencia}}</p><p>Total orientativo: <strong>{{total}} {{moneda}}</strong></p><p>Resumen solicitado:</p><ul>{{items_html}}</ul><p>Te contactaremos con la valoracion final.</p><p>Equipo I-ME</p>',
  },
  compra_valorar_confirmacion_cliente_en: {
    asunto: 'We received your purchase valuation request - I-ME',
    html: '<h2>Hello {{cliente_nombre}}</h2><p>We received your cart. Online payment is temporarily unavailable, so our team will validate unit prices, availability, taxes, shipping and final total before confirmation.</p><p><strong>Reference:</strong> {{referencia}}</p><p>Estimated total: <strong>{{total}} {{moneda}}</strong></p><p>Request summary:</p><ul>{{items_html}}</ul><p>We will contact you with the final valuation.</p><p>I-ME Team</p>',
  },
  pedido_estado_cliente: {
    asunto: 'Tu pedido {{referencia}} esta {{estado_label}} - I-ME',
    html: '<h2>Hola {{cliente_nombre}}</h2><p>Tu pedido <strong>{{referencia}}</strong> cambio de estado: <strong>{{estado_label}}</strong>.</p>{{tracking_html}}<p>Equipo I-ME</p>',
  },
  // CMS comercial: envio de catalogo/productos desde un comercial (rol
  // `ventas`) a un contacto externo. Vars: nombre_destinatario,
  // nombre_comercial, centro_medico, mensaje, lista_productos_html,
  // correo_comercial, telefono_comercial. `mensaje` y `lista_productos_html`
  // deben venir pre-escapados por el llamador (ver comercial-templates.ts).
  comercial_catalogo: {
    asunto: 'Catalogo I-ME para {{centro_medico}}',
    html:
      '<h2>Hola {{nombre_destinatario}}</h2>' +
      '<p>Soy <strong>{{nombre_comercial}}</strong>, asesor(a) comercial de I-ME International Medical Enterprise' +
      ' para {{centro_medico}}.</p>' +
      '<p>{{mensaje}}</p>' +
      '<p><strong>Productos compartidos:</strong></p>' +
      '<ul>{{lista_productos_html}}</ul>' +
      '<p>Quedo atento(a) a tus comentarios para coordinar una cotizacion o demostracion.</p>' +
      '<p>Saludos,<br>{{nombre_comercial}}<br>I-ME International Medical Enterprise<br>' +
      '{{correo_comercial}} · {{telefono_comercial}}</p>',
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
  const apiKey = Deno.env.get('MAILER_API_KEY') || Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return { ok: false, detalle: 'MAILER_API_KEY no configurada' };

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
