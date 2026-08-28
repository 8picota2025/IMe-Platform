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
import { rateLimitIdentificador } from '../_shared/canary.ts';
import {
  enviarEmailPlantilla,
  DESTINATARIOS_COMPRAS,
  DESTINATARIOS_INTERNOS,
  escapeHtml,
  itemsToHtml,
} from '../_shared/email.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import { syncCotizacionWithTwenty } from '../_shared/twenty-crm.ts';

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
  lead_id?: string;
  campaign?: string;
  landing_path?: string;
  referrer?: string;
  analytics_session_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

interface DbErrorLike {
  code?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function shouldRetryLegacyInsert(error: DbErrorLike | null): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (message.includes('column') && message.includes('solicitudes_cotizacion')) ||
    message.includes('schema cache')
  );
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const supabase = getServerSupabase();

    const body = (await req.json().catch(() => ({}))) as CotizacionBody;
    const tipoSolicitud =
      body.tipo_solicitud === 'compra_a_valorar' ? 'compra_a_valorar' : 'cotizacion';
    const locale = normalizeLocale(body.locale);
    const referencia = crypto.randomUUID();
    const nombre = (body.nombre ?? '').trim().slice(0, 120);
    const email = (body.email ?? '').trim().slice(0, 200);
    const telefono = (body.telefono ?? '').trim().slice(0, 40);
    const empresa = (body.empresa ?? '').trim().slice(0, 160);
    let mensaje = (body.mensaje ?? '').trim().slice(0, 2000);
    const moneda = (body.moneda ?? 'COP').trim().slice(0, 8) || 'COP';
    const mercado = (body.mercado ?? 'CO').trim().slice(0, 8) || 'CO';
    const origen = (body.origen ?? 'web').trim().slice(0, 80) || 'web';
    const cuponCodigo = body.cupon_codigo?.trim().slice(0, 80) || null;
    const totalEstimado = cleanNumber(body.total_estimado);
    let leadComercialId: string | null = null;
    const requestedLeadId = cleanText(body.lead_id, 80);
    if (requestedLeadId && UUID_RE.test(requestedLeadId)) {
      const { data: linkedLead } = await supabase
        .from('leads_comerciales')
        .select('id')
        .eq('id', requestedLeadId)
        .maybeSingle();
      leadComercialId = (linkedLead as { id?: string } | null)?.id ?? null;
    }
    const attribution = {
      campaign: cleanText(body.campaign, 80),
      landing_path: cleanText(body.landing_path, 500),
      referrer: cleanText(body.referrer, 500),
      analytics_session_id: cleanText(body.analytics_session_id, 80),
      utm_source: cleanText(body.utm_source, 120),
      utm_medium: cleanText(body.utm_medium, 120),
      utm_campaign: cleanText(body.utm_campaign, 160),
      utm_content: cleanText(body.utm_content, 160),
      utm_term: cleanText(body.utm_term, 160),
    };

    const productos = (Array.isArray(body.productos) ? body.productos : []).slice(0, 50).map(p => ({
      slug: String(p.slug ?? '').slice(0, 200),
      nombre: String(p.nombre ?? '').slice(0, 300),
      cantidad: Math.max(1, Math.min(9999, Number(p.cantidad) || 1)),
      precio_unitario: cleanNumber(p.precio_unitario),
      subtotal: cleanNumber(p.subtotal),
      moneda: String(p.moneda ?? moneda).slice(0, 8),
    }));

    if (!mensaje && productos.length > 0) {
      const lineas = productos.map(
        p => `- ${p.nombre}${p.cantidad > 1 ? ` (x${p.cantidad})` : ''}`
      );
      mensaje =
        locale === 'en'
          ? `Quote request for:\n${lineas.join('\n')}`
          : `Solicitud de cotización para:\n${lineas.join('\n')}`;
    }

    if (!nombre || !mensaje) return badRequest('nombre y mensaje son obligatorios', origin);
    if (!EMAIL_RE.test(email)) return badRequest('email invalido', origin);
    if (body.consentimiento_datos !== true) {
      return badRequest('consentimiento_datos es obligatorio', origin);
    }

    // Rate limit solo tras validar: intentos inválidos no queman cuota de hospitales/NAT.
    const ip =
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'desconocida';
    const limite = await checkRateLimit(
      supabase,
      rateLimitIdentificador(req, 'cotizacion', ip),
      'cotizacion'
    );
    if (limite.limited) {
      const retry = limite.retryAfterSeconds ?? 3600;
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: 'RATE_LIMIT',
            message:
              locale === 'en'
                ? 'Too many quote requests. Please wait a few minutes and try again.'
                : 'Demasiadas solicitudes de cotización. Espera unos minutos e intenta de nuevo.',
            retry_after_seconds: retry,
          },
        }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json',
            'Retry-After': String(retry),
          },
        }
      );
    }

    const solicitudBase = {
      nombre,
      empresa,
      email,
      telefono,
      productos,
      mensaje:
        tipoSolicitud === 'compra_a_valorar'
          ? `[COMPRA_A_VALORAR ${referencia}]\n${mensaje}`
          : mensaje,
      consentimiento_datos: true,
      consentimiento_timestamp: new Date().toISOString(),
      leida: false,
    };

    const solicitudEnriquecida = {
      ...solicitudBase,
      tipo_solicitud: tipoSolicitud,
      origen,
      locale,
      mercado,
      moneda,
      total_estimado: totalEstimado,
      cupon_codigo: cuponCodigo,
      lead_comercial_id: leadComercialId,
      ...attribution,
      metadata: {
        fiscal: body.fiscal ?? null,
        attribution,
      },
    };

    let solicitudId: string | null;
    {
      const inserted = await supabase
        .from('solicitudes_cotizacion')
        .insert(solicitudEnriquecida)
        .select('id')
        .maybeSingle();
      if (shouldRetryLegacyInsert(inserted.error)) {
        console.warn(
          'registrar-cotizacion: esquema legacy detectado, reintentando insert compatible',
          inserted.error?.message
        );
        const legacy = await supabase
          .from('solicitudes_cotizacion')
          .insert(solicitudBase)
          .select('id')
          .maybeSingle();
        if (legacy.error) {
          console.error('registrar-cotizacion: error insertando', legacy.error.message);
          return internalError('No se pudo registrar la solicitud', origin);
        }
        solicitudId = (legacy.data as { id?: string } | null)?.id ?? null;
      } else if (inserted.error) {
        console.error('registrar-cotizacion: error insertando', inserted.error.message);
        return internalError('No se pudo registrar la solicitud', origin);
      } else {
        solicitudId = (inserted.data as { id?: string } | null)?.id ?? null;
      }
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

    let emails = { interno: false, cliente: false };
    try {
      const [interno, cliente] = await Promise.all([
        enviarEmailPlantilla(supabase, plantillaInterna, destinatariosInternos, vars, referencia),
        enviarEmailPlantilla(supabase, plantillaCliente, [email], vars, referencia),
      ]);
      emails = { interno: interno.ok, cliente: cliente.ok };
      if (!interno.ok) console.error('registrar-cotizacion: email interno', interno.detalle);
      if (!cliente.ok) console.error('registrar-cotizacion: email cliente', cliente.detalle);
    } catch (err) {
      console.error(
        'registrar-cotizacion: email exception',
        err instanceof Error ? err.message : err
      );
    }

    // Twenty CRM: best-effort. No bloquea respuesta al cliente.
    const twenty = await syncCotizacionWithTwenty({
      nombre,
      email,
      telefono,
      empresa,
      mensaje,
      origen,
      tipoSolicitud,
      productos: productos.map(p => ({
        nombre: p.nombre,
        slug: p.slug,
        cantidad: p.cantidad,
      })),
      totalEstimado,
      moneda,
    });
    if (twenty.skipped) {
      console.warn('registrar-cotizacion: Twenty skipped (secrets ausentes)');
    } else if (!twenty.ok) {
      console.error('registrar-cotizacion: Twenty sync failed', twenty.error);
      void trackEvent(FN_NAME, 'cotizacion_twenty_failed', {
        tipo_solicitud: tipoSolicitud,
      });
    } else {
      void trackEvent(FN_NAME, 'cotizacion_twenty_synced', {
        tipo_solicitud: tipoSolicitud,
        productos_count: productos.length,
      });
    }
    if (solicitudId) {
      await supabase
        .from('solicitudes_cotizacion')
        .update({
          crm_sync_status: twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed',
          crm_sync_error:
            twenty.ok || twenty.skipped ? null : (twenty.error ?? 'Twenty sync failed'),
          crm_sync_last_attempt_at: new Date().toISOString(),
          twenty_person_id: twenty.data?.personId ?? null,
          twenty_company_id: twenty.data?.companyId ?? null,
          twenty_opportunity_id: twenty.data?.opportunityId ?? null,
        })
        .eq('id', solicitudId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        emails,
        twenty: twenty.skipped
          ? { status: 'skipped' }
          : twenty.ok
            ? {
                status: 'synced',
                opportunityId: twenty.data?.opportunityId,
                personId: twenty.data?.personId,
                companyId: twenty.data?.companyId,
              }
            : { status: 'failed' },
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      }
    );
  })
);
