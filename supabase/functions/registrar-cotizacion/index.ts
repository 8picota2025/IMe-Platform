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
  DESTINATARIOS_INTERNOS,
  escapeHtml,
  itemsToHtml,
} from '../_shared/email.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';

const FN_NAME = 'registrar-cotizacion';

interface CotizacionBody {
  nombre?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  mensaje?: string;
  consentimiento_datos?: boolean;
  productos?: Array<{ slug?: string; nombre?: string; cantidad?: number }>;
  origen?: string;
  session_id?: string;
  asesor_fase?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const nombre = (body.nombre ?? '').trim().slice(0, 120);
    const email = (body.email ?? '').trim().slice(0, 200);
    const telefono = (body.telefono ?? '').trim().slice(0, 40);
    const empresa = (body.empresa ?? '').trim().slice(0, 160);
    const mensaje = (body.mensaje ?? '').trim().slice(0, 2000);
    const origen = (body.origen ?? 'web').trim().slice(0, 40) || 'web';
    const sessionId = (body.session_id ?? '').trim().slice(0, 128);
    const asesorFase = (body.asesor_fase ?? '').trim().slice(0, 40);

    if (!nombre || !mensaje) return badRequest('nombre y mensaje son obligatorios', origin);
    if (!EMAIL_RE.test(email)) return badRequest('email invalido', origin);
    if (body.consentimiento_datos !== true) {
      return badRequest('consentimiento_datos es obligatorio', origin);
    }

    const productos = (Array.isArray(body.productos) ? body.productos : []).slice(0, 50).map(p => ({
      slug: String(p.slug ?? '').slice(0, 200),
      nombre: String(p.nombre ?? '').slice(0, 300),
      cantidad: Math.max(1, Math.min(9999, Number(p.cantidad) || 1)),
    }));

    const { error } = await supabase.from('solicitudes_cotizacion').insert({
      nombre,
      empresa,
      email,
      telefono,
      productos,
      mensaje,
      consentimiento_datos: true,
      consentimiento_timestamp: new Date().toISOString(),
      leida: false,
      origen,
      session_id: sessionId || null,
      asesor_fase: asesorFase || null,
    });
    if (error) {
      console.error('registrar-cotizacion: error insertando', error.message);
      return internalError('No se pudo registrar la solicitud', origin);
    }

    // Evento de negocio para el funnel semanal (docs/observabilidad.md).
    // Sin PII en detalle: solo conteo de productos, nunca email/nombre/telefono.
    void trackEvent(FN_NAME, 'cotizacion_registrada', {
      productos_count: productos.length,
      origen,
    });

    const vars = {
      cliente_nombre: escapeHtml(nombre),
      cliente_email: escapeHtml(email),
      empresa: escapeHtml(empresa),
      telefono: escapeHtml(telefono),
      mensaje: escapeHtml(mensaje),
      items_html: productos.length
        ? itemsToHtml(productos)
        : '<li>(sin productos especificos)</li>',
      fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    };

    const [interno, cliente] = await Promise.all([
      enviarEmailPlantilla(supabase, 'cotizacion_interna', DESTINATARIOS_INTERNOS, vars, email),
      enviarEmailPlantilla(supabase, 'cotizacion_confirmacion_cliente', [email], vars, email),
    ]);
    if (!interno.ok) console.error('registrar-cotizacion: email interno', interno.detalle);
    if (!cliente.ok) console.error('registrar-cotizacion: email cliente', cliente.detalle);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  })
);
