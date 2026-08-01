/**
 * Envia al cliente el email de cambio de estado de su pedido.
 * Invocable desde el admin (JWT de usuario con perfil admin activo)
 * o server-to-server con la service_role key.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, unauthorized, notFound } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { enviarEmailPlantilla, escapeHtml, itemsToHtml } from '../_shared/email.ts';

interface NotificarClienteBody {
  pedido_id?: string;
  a_estado?: string;
  de_estado?: string;
  tracking_number?: string;
  tracking_url?: string;
}

const ROLES_PERMITIDOS = new Set(['owner', 'admin', 'ventas', 'operaciones']);
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://i-me.com.co').replace(/\/+$/, '');

const ESTADOS: Record<
  string,
  {
    es: { label: string; message: string; cta: string };
    en: { label: string; message: string; cta: string };
  }
> = {
  pendiente: {
    es: {
      label: 'pendiente de pago',
      message: 'Tu pedido fue creado y estamos esperando la confirmacion del pago.',
      cta: 'Completar pago',
    },
    en: {
      label: 'awaiting payment',
      message: 'Your order was created and is awaiting payment confirmation.',
      cta: 'Complete payment',
    },
  },
  pendiente_validacion: {
    es: {
      label: 'comprobante en validacion',
      message: 'Recibimos tu comprobante. Nuestro equipo esta verificando la transferencia.',
      cta: 'Consultar estado',
    },
    en: {
      label: 'receipt under review',
      message: 'We received your receipt. Our team is verifying the bank transfer.',
      cta: 'Check status',
    },
  },
  pagado: {
    es: {
      label: 'pagado',
      message: 'Confirmamos tu pago. El pedido pasa a preparacion.',
      cta: 'Consultar pedido',
    },
    en: {
      label: 'paid',
      message: 'Your payment is confirmed. Your order now moves to preparation.',
      cta: 'View order',
    },
  },
  procesando: {
    es: {
      label: 'en preparacion',
      message: 'Estamos preparando tu pedido para despacho.',
      cta: 'Consultar pedido',
    },
    en: {
      label: 'being prepared',
      message: 'We are preparing your order for dispatch.',
      cta: 'View order',
    },
  },
  preparando: {
    es: {
      label: 'en preparacion',
      message: 'El proveedor esta preparando tu pedido para despacho.',
      cta: 'Consultar pedido',
    },
    en: {
      label: 'being prepared',
      message: 'The supplier is preparing your order for dispatch.',
      cta: 'View order',
    },
  },
  enviado: {
    es: {
      label: 'enviado',
      message: 'Tu pedido fue despachado. Usa la informacion de guia para seguirlo.',
      cta: 'Rastrear envio',
    },
    en: {
      label: 'shipped',
      message: 'Your order has shipped. Use the tracking information to follow it.',
      cta: 'Track shipment',
    },
  },
  entregado: {
    es: {
      label: 'entregado',
      message: 'El transportador reporto tu pedido como entregado.',
      cta: 'Ver pedido',
    },
    en: {
      label: 'delivered',
      message: 'The carrier reported your order as delivered.',
      cta: 'View order',
    },
  },
  retrasado: {
    es: {
      label: 'retrasado',
      message: 'Tu pedido presenta una demora. Nuestro equipo trabaja para resolverla.',
      cta: 'Contactar soporte',
    },
    en: {
      label: 'delayed',
      message: 'Your order is delayed. Our team is working to resolve it.',
      cta: 'Contact support',
    },
  },
  rechazado: {
    es: {
      label: 'rechazado',
      message:
        'No pudimos continuar con el pedido. Revisa el correo con instrucciones o contactanos.',
      cta: 'Contactar soporte',
    },
    en: {
      label: 'rejected',
      message: 'We could not continue with your order. Review the instructions or contact us.',
      cta: 'Contact support',
    },
  },
  expirado: {
    es: {
      label: 'expirado',
      message:
        'El plazo para completar este pedido termino. Podemos preparar una nueva cotizacion.',
      cta: 'Solicitar nueva cotizacion',
    },
    en: {
      label: 'expired',
      message: 'The time to complete this order has ended. We can prepare a new quote.',
      cta: 'Request a new quote',
    },
  },
  cancelado: {
    es: {
      label: 'cancelado',
      message: 'Tu pedido fue cancelado. Si no solicitaste este cambio, contactanos.',
      cta: 'Contactar soporte',
    },
    en: {
      label: 'cancelled',
      message: 'Your order was cancelled. Contact us if you did not request this change.',
      cta: 'Contact support',
    },
  },
  reembolsado: {
    es: {
      label: 'reembolsado',
      message: 'Procesamos el reembolso. El abono puede tardar segun tu entidad financiera.',
      cta: 'Ver pedido',
    },
    en: {
      label: 'refunded',
      message: 'We processed your refund. Posting time depends on your financial institution.',
      cta: 'View order',
    },
  },
  error_verificacion: {
    es: {
      label: 'con error de verificacion',
      message: 'No pudimos verificar el pago. Intenta nuevamente o contactanos para ayudarte.',
      cta: 'Reintentar pago',
    },
    en: {
      label: 'payment verification issue',
      message: 'We could not verify the payment. Please retry or contact us for help.',
      cta: 'Retry payment',
    },
  },
};

function actionUrl(
  estado: string,
  locale: 'es' | 'en',
  checkoutUrl: string | null,
  trackingUrl: string
): string {
  if (estado === 'pendiente' || estado === 'error_verificacion') {
    return checkoutUrl || `${SITE_URL}/${locale}/${locale === 'es' ? 'carrito' : 'cart'}/`;
  }
  if (estado === 'enviado' && trackingUrl) return trackingUrl;
  if (estado === 'expirado') {
    return `${SITE_URL}/${locale}/${locale === 'es' ? 'contacto' : 'contact'}/`;
  }
  if (estado === 'retrasado' || estado === 'rechazado' || estado === 'cancelado') {
    return `mailto:ventas@i-me.com.co`;
  }
  return `${SITE_URL}/${locale}/${locale === 'es' ? 'seguimiento' : 'order-status'}/`;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return unauthorized(origin);

  const supabase = getServerSupabase();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (token !== serviceKey) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);
    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('rol, activo')
      .eq('user_id', user.id)
      .maybeSingle();
    const p = profile as { rol?: string; activo?: boolean } | null;
    if (!p?.activo || !ROLES_PERMITIDOS.has(p.rol ?? '')) return unauthorized(origin);
  }

  const body = (await req.json().catch(() => ({}))) as NotificarClienteBody;
  const pedidoId = (body.pedido_id ?? '').trim();
  const aEstado = (body.a_estado ?? '').trim();
  if (!pedidoId || !aEstado) return badRequest('pedido_id y a_estado son obligatorios', origin);
  if (!ESTADOS[aEstado]) {
    return badRequest(
      `a_estado sin notificacion definida. Validos: ${Object.keys(ESTADOS).join(', ')}`,
      origin
    );
  }

  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, cliente, items, total, moneda, mercado, referencia_pasarela, checkout_url, metadata'
    )
    .eq('id', pedidoId)
    .maybeSingle();
  if (error || !data) return notFound(origin);

  const pedido = data as {
    id: string;
    cliente: { nombre?: string; apellido?: string; email?: string } | null;
    items: Array<{
      nombre?: string;
      cantidad?: number;
      precio_unitario?: number | null;
      subtotal?: number | null;
      moneda?: string;
    }> | null;
    total: number | string | null;
    moneda: string | null;
    mercado: string | null;
    referencia_pasarela: string | null;
    checkout_url: string | null;
    metadata: Record<string, unknown> | null;
  };
  const emailCliente = pedido.cliente?.email ?? '';
  if (!emailCliente) {
    return new Response(JSON.stringify({ ok: false, error: 'Pedido sin email de cliente' }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const referencia = pedido.referencia_pasarela ?? pedido.id;
  const nombre =
    `${pedido.cliente?.nombre ?? ''} ${pedido.cliente?.apellido ?? ''}`.trim() || 'Cliente';
  const locale: 'es' | 'en' =
    pedido.metadata?.locale === 'en' || pedido.mercado === 'INTL' ? 'en' : 'es';
  const config = ESTADOS[aEstado]![locale];
  let trackingHtml = '';
  if (body.tracking_number || body.tracking_url) {
    const num = escapeHtml(body.tracking_number ?? '');
    const url = body.tracking_url ? escapeHtml(body.tracking_url) : '';
    trackingHtml = url
      ? `<p>Guia de envio: <a href="${url}">${num || url}</a></p>`
      : `<p>Guia de envio: ${num}</p>`;
  }
  const targetUrl = actionUrl(aEstado, locale, pedido.checkout_url, body.tracking_url ?? '');
  const actionHtml = `<p><a href="${escapeHtml(targetUrl)}" style="display:inline-block;padding:12px 20px;background:#0b3d4a;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(config.cta)}</a></p>`;

  const resultado = await enviarEmailPlantilla(
    supabase,
    `pedido_estado_${aEstado}_${locale}`,
    [emailCliente],
    {
      referencia: escapeHtml(referencia),
      cliente_nombre: escapeHtml(nombre),
      estado_anterior: escapeHtml(body.de_estado ?? ''),
      estado_label: escapeHtml(config.label),
      mensaje_estado: escapeHtml(config.message),
      total: escapeHtml(String(pedido.total ?? '')),
      moneda: escapeHtml(pedido.moneda ?? 'COP'),
      items_html: itemsToHtml(pedido.items ?? [], locale),
      tracking_html: trackingHtml,
      action_html: actionHtml,
    },
    referencia
  );

  return new Response(JSON.stringify({ ok: resultado.ok, detalle: resultado.detalle }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
});
