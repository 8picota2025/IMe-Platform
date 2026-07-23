/**
 * Registra una solicitud de cotizacion (antes insert directo desde el
 * navegador) y dispara los emails: aviso interno (root@ + ventas@) y
 * confirmacion de recepcion al cliente. Los emails son best-effort:
 * si fallan, la solicitud queda registrada igualmente.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import {
  enviarEmailPlantilla,
  DESTINATARIOS_COMPRAS,
  DESTINATARIOS_INTERNOS,
  escapeHtml,
  itemsToHtml,
} from '../_shared/email.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';

const FN_NAME = 'registrar-cotizacion';

interface CotizacionBody {
  tipo_solicitud?: string;
  origen?: string;
  locale?: string;
  nombre?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  mensaje?: string;
  consentimiento_datos?: boolean;
  productos?: Array<{
    slug?: string;
    nombre?: string;
    cantidad?: number;
    precio_unitario?: number;
    subtotal?: number;
    moneda?: string;
  }>;
  mercado?: string;
  moneda?: string;
  total_estimado?: number;
  cupon_codigo?: string;
  fiscal?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type EmailLocale = 'es' | 'en';

function cleanNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatTotal(value: number | null): string {
  if (value === null) return 'Por validar';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function normalizeLocale(locale: unknown): EmailLocale {
  return locale === 'en' ? 'en' : 'es';
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const supabase = getServerSupabase();

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'desconocida';
    const limite = await checkRateLimit(supabase, `cotizacion:ip:${ip}`, 'cotizacion');
    if (limite.limited) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Demasiadas solicitudes, intenta mas tarde.' }),
        {
          status: 429,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        }
      );
    }

    const body = (await req.json().catch(() => ({}))) as CotizacionBody;
    const tipoSolicitud =
      body.tipo_solicitud === 'compra_a_valorar' ? 'compra_a_valorar' : 'cotizacion';
    const locale = normalizeLocale(body.locale);
    const referencia = crypto.randomUUID();
    const nombre = (body.nombre ?? '').trim().slice(0, 120);
    const email = (body.email ?? '').trim().slice(0, 200);
    const telefono = (body.telefono ?? '').trim().slice(0, 40);
    const empresa = (body.empresa ?? '').trim().slice(0, 160);
    const mensaje = (body.mensaje ?? '').trim().slice(0, 2000);
    const moneda = (body.moneda ?? 'COP').trim().slice(0, 8) || 'COP';
    const mercado = (body.mercado ?? 'CO').trim().slice(0, 8) || 'CO';
    const origen = (body.origen ?? 'web').trim().slice(0, 80) || 'web';
    const cuponCodigo = body.cupon_codigo?.trim().slice(0, 80) || null;
    const totalEstimado = cleanNumber(body.total_estimado);

    if (!nombre || !mensaje) return badRequest('nombre y mensaje son obligatorios', origin);
    if (!EMAIL_RE.test(email)) return badRequest('email invalido', origin);
    if (body.consentimiento_datos !== true) {
      return badRequest('consentimiento_datos es obligatorio', origin);
    }

    const productos = (Array.isArray(body.productos) ? body.productos : []).slice(0, 50).map(p => ({
      slug: String(p.slug ?? '').slice(0, 200),
      nombre: String(p.nombre ?? '').slice(0, 300),
      cantidad: Math.max(1, Math.min(9999, Number(p.cantidad) || 1)),
      precio_unitario: cleanNumber(p.precio_unitario),
      subtotal: cleanNumber(p.subtotal),
      moneda: String(p.moneda ?? moneda).slice(0, 8),
    }));

    const { error } = await supabase.from('solicitudes_cotizacion').insert({
      nombre,
      empresa,
      email,
      telefono,
      tipo_solicitud: tipoSolicitud,
      origen,
      locale,
      mercado,
      moneda,
      total_estimado: totalEstimado,
      cupon_codigo: cuponCodigo,
      metadata: {
        fiscal: body.fiscal ?? null,
      },
      productos,
      mensaje:
        tipoSolicitud === 'compra_a_valorar'
          ? `[COMPRA_A_VALORAR ${referencia}]\n${mensaje}`
          : mensaje,
      consentimiento_datos: true,
      consentimiento_timestamp: new Date().toISOString(),
      leida: false,
    });
    if (error) {
      console.error('registrar-cotizacion: error insertando', error.message);
      return internalError('No se pudo registrar la solicitud', origin);
    }

    // Evento de negocio para el funnel semanal (docs/observabilidad.md).
    // Sin PII en detalle: solo conteo de productos, nunca email/nombre/telefono.
    void trackEvent(FN_NAME, 'cotizacion_registrada', {
      productos_count: productos.length,
      tipo_solicitud: tipoSolicitud,
    });

    const vars = {
      referencia: escapeHtml(referencia),
      cliente_nombre: escapeHtml(nombre),
      cliente_email: escapeHtml(email),
      empresa: escapeHtml(empresa),
      telefono: escapeHtml(telefono),
      mensaje: escapeHtml(mensaje),
      items_html: productos.length
        ? itemsToHtml(productos, locale)
        : locale === 'en'
          ? '<li>(no specific products)</li>'
          : '<li>(sin productos especificos)</li>',
      total: escapeHtml(formatTotal(totalEstimado)),
      moneda: escapeHtml(moneda),
      fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    };

    const plantillaInterna =
      tipoSolicitud === 'compra_a_valorar' ? 'compra_valorar_interna' : 'cotizacion_interna';
    const plantillaCliente =
      tipoSolicitud === 'compra_a_valorar'
        ? locale === 'en'
          ? 'compra_valorar_confirmacion_cliente_en'
          : 'compra_valorar_confirmacion_cliente_es'
        : locale === 'en'
          ? 'cotizacion_confirmacion_cliente_en'
          : 'cotizacion_confirmacion_cliente_es';
    const destinatariosInternos =
      tipoSolicitud === 'compra_a_valorar' ? DESTINATARIOS_COMPRAS : DESTINATARIOS_INTERNOS;

    const [interno, cliente] = await Promise.all([
      enviarEmailPlantilla(supabase, plantillaInterna, destinatariosInternos, vars, referencia),
      enviarEmailPlantilla(supabase, plantillaCliente, [email], vars, referencia),
    ]);
    if (!interno.ok) console.error('registrar-cotizacion: email interno', interno.detalle);
    if (!cliente.ok) console.error('registrar-cotizacion: email cliente', cliente.detalle);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  })
);
