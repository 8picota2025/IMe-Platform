/**
 * Convierte una sesión anónima de IMEIA en un lead CRM únicamente después de
 * validar contacto y consentimiento explícito. Nunca persiste el transcript.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { normalizeDiscoveryProfile } from '../../../src/lib/imeia-conversation.ts';

const CONSENT_VERSION = 'imeia-quote-followup-2026-07-18-v1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{6,23}$/;

type Locale = 'es' | 'en';
type PreferredChannel = 'email' | 'telefono' | 'whatsapp';
type HandoffType = 'whatsapp' | 'cotizacion';

interface LeadBody {
  session_id?: string;
  locale?: Locale;
  nombre?: string;
  institucion?: string;
  email?: string;
  telefono?: string;
  canal_preferido?: PreferredChannel;
  perfil?: unknown;
  resumen?: string;
  productos?: unknown;
  tipo_handoff?: HandoffType;
  consentimiento_datos?: boolean;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string'
    ? [...value]
        .map(character => {
          const code = character.charCodeAt(0);
          return code >= 32 && code !== 127 ? character : ' ';
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';
}

function cleanSessionId(value: unknown): string {
  const sessionId = cleanText(value, 128);
  return /^[a-zA-Z0-9_-]{8,128}$/.test(sessionId) ? sessionId : '';
}

function cleanPhone(value: unknown): string {
  const raw = cleanText(value, 24);
  if (!raw || !PHONE_RE.test(raw)) return '';
  const prefix = raw.trim().startsWith('+') ? '+' : '';
  return `${prefix}${raw.replace(/\D/g, '')}`;
}

function redactSummary(value: unknown): string {
  return cleanText(value, 1000)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[contacto omitido]')
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[contacto omitido]');
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'desconocida';
  const limite = await checkRateLimit(supabase, `imeia-lead:ip:${ip}`, 'cotizacion');
  if (limite.limited) {
    return new Response(JSON.stringify({ ok: false, error: 'Demasiadas solicitudes' }), {
      status: 429,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => ({}))) as LeadBody;
  const sessionId = cleanSessionId(body.session_id);
  const locale: Locale = body.locale === 'en' ? 'en' : 'es';
  const nombre = cleanText(body.nombre, 120);
  const institucion = cleanText(body.institucion, 180) || null;
  const email = cleanText(body.email, 254).toLowerCase();
  const telefono = cleanPhone(body.telefono);
  const canal = body.canal_preferido;
  const tipoHandoff: HandoffType = body.tipo_handoff === 'whatsapp' ? 'whatsapp' : 'cotizacion';

  if (!sessionId || !nombre) return badRequest('sesion y nombre son obligatorios', origin);
  if (body.consentimiento_datos !== true) {
    return badRequest('consentimiento_datos es obligatorio', origin);
  }
  if (email && !EMAIL_RE.test(email)) return badRequest('email invalido', origin);
  if (body.telefono && !telefono) return badRequest('telefono invalido', origin);
  if (!email && !telefono) return badRequest('email o telefono es obligatorio', origin);
  if (!canal || !['email', 'telefono', 'whatsapp'].includes(canal)) {
    return badRequest('canal_preferido invalido', origin);
  }
  if (canal === 'email' && !email) return badRequest('email requerido para este canal', origin);
  if ((canal === 'telefono' || canal === 'whatsapp') && !telefono) {
    return badRequest('telefono requerido para este canal', origin);
  }

  const perfil = normalizeDiscoveryProfile(body.perfil);
  const requestedSlugs = Array.isArray(body.productos)
    ? [
        ...new Set(
          body.productos
            .map(value => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
            .filter(value => /^[a-z0-9-]{2,120}$/.test(value))
        ),
      ].slice(0, 8)
    : [];

  let productos: Array<{ slug: string; nombre: string }> = [];
  if (requestedSlugs.length > 0) {
    const { data } = await supabase
      .from('productos')
      .select('slug, nombre_es, nombre_en')
      .in('slug', requestedSlugs)
      .eq('activo', true);
    const bySlug = new Map((data ?? []).map(product => [String(product.slug), product]));
    productos = requestedSlugs
      .filter(slug => bySlug.has(slug))
      .map(slug => {
        const product = bySlug.get(slug)!;
        return {
          slug,
          nombre:
            locale === 'en'
              ? String(product.nombre_en ?? product.nombre_es ?? slug)
              : String(product.nombre_es ?? slug),
        };
      });
  }

  const now = new Date().toISOString();
  const { data: lead, error } = await supabase
    .from('imeia_leads')
    .upsert(
      {
        session_id: sessionId,
        locale,
        nombre,
        institucion,
        email: email || null,
        telefono: telefono || null,
        canal_preferido: canal,
        perfil,
        resumen: redactSummary(body.resumen),
        productos,
        tipo_handoff: tipoHandoff,
        consentimiento_datos: true,
        consentimiento_version: CONSENT_VERSION,
        consentimiento_locale: locale,
        consentimiento_timestamp: now,
      },
      { onConflict: 'session_id' }
    )
    .select('id')
    .single();

  if (error || !lead) {
    console.error('[registrar-imeia-lead] upsert fallo:', error?.message ?? 'sin fila');
    return internalError('No se pudo registrar el contacto', origin);
  }

  return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
});
