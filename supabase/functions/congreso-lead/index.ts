import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';

const FN_NAME = 'congreso-lead';
const ROLES = new Set(['ventas', 'admin', 'owner']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,200}$/;

interface Body {
  idempotencyKey?: string;
  eventSlug?: string;
  eventName?: string;
  productIds?: string[];
  commercialUserId?: string;
  contact?: {
    nombres?: string;
    apellidos?: string;
    cargo?: string;
    institucion?: string;
    email?: string;
    telefono?: string;
    ciudad?: string;
    pais?: string;
    notas?: string;
    consentimiento?: boolean;
  };
}

function json(body: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('57') && digits.length > 10) return `+${digits}`;
  return `+57${digits}`;
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const cors = handleCors(req);
    if (cors) return cors;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return unauthorized(origin);
    const supabase = getServerSupabase();
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return unauthorized(origin);
    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('user_id,rol,activo')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (!profile || profile.activo !== true || !ROLES.has(profile.rol)) return unauthorized(origin);

    const body = (await req.json().catch(() => ({}))) as Body;
    const key = clean(body.idempotencyKey, 200);
    if (!IDEMPOTENCY_RE.test(key)) return badRequest('idempotencyKey invalido', origin);
    const existing = await supabase
      .from('leads_comerciales')
      .select('id,prioridad,crm_sync_status')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (existing.data)
      return json(
        {
          ok: true,
          leadId: existing.data.id,
          idempotent: true,
          crmSyncStatus: existing.data.crm_sync_status,
        },
        origin
      );

    const limit = await checkRateLimit(supabase, `congreso:${auth.user.id}`, 'cotizacion');
    if (limit.limited)
      return json({ ok: false, error: 'Demasiadas solicitudes. Espera un momento.' }, origin, 429);

    const contact = body.contact ?? {};
    const nombres = clean(contact.nombres, 80);
    const apellidos = clean(contact.apellidos, 80);
    const institucion = clean(contact.institucion, 180);
    const ciudad = clean(contact.ciudad, 120);
    const email = clean(contact.email, 200).toLowerCase();
    const telefono = normalizePhone(clean(contact.telefono, 40));
    const productIds = Array.isArray(body.productIds)
      ? [...new Set(body.productIds.map(id => clean(id, 80)).filter(Boolean))].slice(0, 30)
      : [];
    if (
      !nombres ||
      !apellidos ||
      !institucion ||
      !ciudad ||
      (!email && !telefono) ||
      !contact.consentimiento
    )
      return json(
        { ok: false, error: 'Datos de contacto o consentimiento incompletos.' },
        origin,
        422
      );
    if (email && !EMAIL_RE.test(email))
      return json({ ok: false, error: 'Email invalido.' }, origin, 422);
    if (!productIds.length)
      return json({ ok: false, error: 'Selecciona al menos un producto.' }, origin, 422);
    if (productIds.length !== 1)
      return json({ ok: false, error: 'Selecciona un solo producto.' }, origin, 422);

    const { data: products, error: productsError } = await supabase
      .from('productos')
      .select(
        'id,slug,nombre_es,nombre_en,descripcion_corta_es,imagen_principal,ficha_pdf,atributos,familias(nombre_es,slug)'
      )
      .in('id', productIds)
      .eq('activo', true);
    if (productsError) return internalError(productsError.message, origin);
    if (!products || products.length !== productIds.length)
      return json(
        { ok: false, error: 'Uno o mas productos ya no estan disponibles.' },
        origin,
        422
      );
    if (
      products.some(product => {
        const attrs =
          product.atributos && typeof product.atributos === 'object'
            ? (product.atributos as Record<string, unknown>)
            : {};
        const enriched = Boolean(
          (typeof attrs['valor_es'] === 'string' && attrs['valor_es'].trim()) ||
          (Array.isArray(attrs['beneficios_es']) && attrs['beneficios_es'].length > 0) ||
          product.descripcion_corta_es?.trim()
        );
        return attrs['congreso_habilitado'] === false || !enriched || !product.ficha_pdf?.trim();
      })
    )
      return json({ ok: false, error: 'Producto no habilitado para esta campaña.' }, origin, 422);

    const productSnapshots = products.map(product => ({
      id: product.id,
      slug: product.slug,
      nombre: product.nombre_es,
      familia: product.familias?.nombre_es ?? null,
      landing: `/es/productos/${product.slug}/`,
      brochure: product.ficha_pdf,
    }));
    const payload = {
      idempotency_key: key,
      nombre: `${nombres} ${apellidos}`.slice(0, 160),
      cargo: clean(contact.cargo, 120) || null,
      institucion,
      ciudad,
      telefono: telefono || null,
      email: email || null,
      familia_slug: 'evento',
      tipo_slug: null,
      tipo_proyecto: 'registro_evento',
      horizonte: 'exploracion',
      presupuesto_estado: null,
      necesidad: clean(contact.notas, 2000) || 'Interaccion presencial en congreso',
      consentimiento_datos: true,
      consentimiento_timestamp: new Date().toISOString(),
      campaign: 'evento',
      locale: 'es',
      prioridad: 'P3',
      landing_path: '/congreso',
      metadata: {
        origen: 'congreso',
        evento: { slug: clean(body.eventSlug, 120), nombre: clean(body.eventName, 180) },
        comercial_user_id: auth.user.id,
        productos_interes: productSnapshots,
        canales_solicitados: [email ? 'email' : null, telefono ? 'whatsapp' : null].filter(Boolean),
        consentimiento_contacto: true,
        consentimiento_documentacion: true,
        consentimiento_source: 'congreso',
        ocr_confirmado: false,
      },
    };
    const inserted = await supabase
      .from('leads_comerciales')
      .insert(payload)
      .select('id,prioridad,crm_sync_status')
      .single();
    if (inserted.error || !inserted.data) {
      if (/duplicate|unique/i.test(inserted.error?.message ?? '')) {
        const raced = await supabase
          .from('leads_comerciales')
          .select('id,prioridad,crm_sync_status')
          .eq('idempotency_key', key)
          .maybeSingle();
        if (raced.data)
          return json(
            {
              ok: true,
              leadId: raced.data.id,
              idempotent: true,
              crmSyncStatus: raced.data.crm_sync_status,
            },
            origin
          );
      }
      return internalError(inserted.error?.message ?? 'No se pudo registrar lead', origin);
    }
    void trackEvent(FN_NAME, 'congreso_lead_registrado', {
      products_count: productSnapshots.length,
      has_email: Boolean(email),
      has_phone: Boolean(telefono),
    });
    return json(
      {
        ok: true,
        leadId: inserted.data.id,
        priority: inserted.data.prioridad,
        crmSyncStatus: inserted.data.crm_sync_status,
      },
      origin,
      201
    );
  })
);
