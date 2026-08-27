import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import { syncCommercialLeadWithTwenty } from '../_shared/twenty-crm.ts';

const FN_NAME = 'congreso-lead';
const ROLES = new Set(['ventas', 'admin', 'owner']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,200}$/;

type CrmSyncStatus = 'pending' | 'synced' | 'failed' | 'skipped';

interface Body {
  idempotencyKey?: string;
  eventSlug?: string;
  eventName?: string;
  productIds?: string[];
  channels?: Array<'email' | 'whatsapp'>;
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

interface LeadRow {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  institucion: string;
  ciudad: string;
  necesidad: string;
  prioridad: 'P1' | 'P2' | 'P3';
  campaign: string;
  familia_slug: string;
  horizonte: string;
  crm_sync_status: CrmSyncStatus;
  twenty_person_id: string | null;
  twenty_company_id: string | null;
  twenty_opportunity_id: string | null;
  metadata: Record<string, unknown> | null;
}

const LEAD_SELECT = [
  'id',
  'nombre',
  'email',
  'telefono',
  'institucion',
  'ciudad',
  'necesidad',
  'prioridad',
  'campaign',
  'familia_slug',
  'horizonte',
  'crm_sync_status',
  'twenty_person_id',
  'twenty_company_id',
  'twenty_opportunity_id',
  'metadata',
].join(',');

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

function metadataText(metadata: LeadRow['metadata'], key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function metadataEvent(metadata: LeadRow['metadata']): { slug?: string; nombre?: string } {
  const raw = metadata?.evento;
  if (!raw || typeof raw !== 'object') return {};
  const evento = raw as Record<string, unknown>;
  return {
    slug: typeof evento.slug === 'string' ? evento.slug.trim() : undefined,
    nombre: typeof evento.nombre === 'string' ? evento.nombre.trim() : undefined,
  };
}

function metadataProducts(
  metadata: LeadRow['metadata']
): Array<{ nombre?: string; slug?: string; cantidad?: number }> {
  const raw = metadata?.productos_interes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const nombre = typeof row.nombre === 'string' ? row.nombre : undefined;
      const slug = typeof row.slug === 'string' ? row.slug : undefined;
      if (!nombre && !slug) return null;
      return { nombre, slug, cantidad: 1 };
    })
    .filter((row): row is { nombre?: string; slug?: string; cantidad: number } => Boolean(row));
}

async function syncLeadWithTwenty(
  supabase: ReturnType<typeof getServerSupabase>,
  lead: LeadRow
): Promise<CrmSyncStatus> {
  if (lead.crm_sync_status === 'synced') return 'synced';

  const event = metadataEvent(lead.metadata);
  const eventFirstNames = metadataText(lead.metadata, 'nombres');
  const eventLastNames = metadataText(lead.metadata, 'apellidos');
  const productos = metadataProducts(lead.metadata);

  const twenty = await syncCommercialLeadWithTwenty({
    nombre: lead.nombre,
    ...(eventFirstNames ? { nombres: eventFirstNames } : {}),
    ...(eventLastNames ? { apellidos: eventLastNames } : {}),
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.telefono ? { telefono: lead.telefono } : {}),
    empresa: lead.institucion,
    mensaje: lead.necesidad,
    priority: lead.prioridad,
    campaign: lead.campaign,
    familySlug: lead.familia_slug,
    purchaseHorizon: lead.horizonte,
    ciudad: lead.ciudad,
    leadReference: lead.id,
    twentyOpportunityId: lead.twenty_opportunity_id,
    origen: metadataText(lead.metadata, 'origen') || 'congreso',
    ...(event.slug ? { eventSlug: event.slug } : {}),
    ...(event.nombre ? { eventName: event.nombre } : {}),
    ...(productos.length ? { productos } : {}),
  });

  const crmSyncStatus: CrmSyncStatus = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';
  const update = await supabase
    .from('leads_comerciales')
    .update({
      crm_sync_status: crmSyncStatus,
      crm_sync_error: twenty.ok || twenty.skipped ? null : (twenty.error ?? 'Twenty sync failed'),
      crm_sync_last_attempt_at: new Date().toISOString(),
      twenty_person_id: twenty.data?.personId ?? lead.twenty_person_id,
      twenty_company_id: twenty.data?.companyId ?? lead.twenty_company_id,
      twenty_opportunity_id: twenty.data?.opportunityId ?? lead.twenty_opportunity_id,
    })
    .eq('id', lead.id);

  if (update.error) {
    void trackEvent(FN_NAME, 'congreso_lead_crm_status_update_failed', {});
    return lead.crm_sync_status;
  }
  if (!twenty.ok && !twenty.skipped) {
    void trackEvent(FN_NAME, 'congreso_lead_twenty_failed', { priority: lead.prioridad });
  }
  return crmSyncStatus;
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
      .select(LEAD_SELECT)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (existing.data) {
      const lead = existing.data as LeadRow;
      const crmSyncStatus = await syncLeadWithTwenty(supabase, lead);
      return json(
        {
          ok: true,
          leadId: lead.id,
          idempotent: true,
          crmSyncStatus,
        },
        origin
      );
    }

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
    const eventSlug = clean(body.eventSlug, 120) || 'acise2026';
    const eventName = clean(body.eventName, 180) || 'ACISE2026';
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
    const channels = Array.isArray(body.channels)
      ? [...new Set(body.channels.filter(channel => channel === 'email' || channel === 'whatsapp'))]
      : [];

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
      prioridad: 'P3' as const,
      landing_path: '/congreso',
      metadata: {
        origen: 'congreso',
        nombres,
        apellidos,
        tipo_registro: 'asistente_evento',
        evento: { slug: eventSlug, nombre: eventName },
        comercial_user_id: auth.user.id,
        productos_interes: productSnapshots,
        canales_solicitados: channels.length
          ? channels
          : [email ? 'email' : null, telefono ? 'whatsapp' : null].filter(Boolean),
        consentimiento_contacto: true,
        consentimiento_documentacion: true,
        consentimiento_source: 'congreso',
        ocr_confirmado: false,
      },
    };
    const inserted = await supabase
      .from('leads_comerciales')
      .insert(payload)
      .select(LEAD_SELECT)
      .single();
    if (inserted.error || !inserted.data) {
      if (/duplicate|unique/i.test(inserted.error?.message ?? '')) {
        const raced = await supabase
          .from('leads_comerciales')
          .select(LEAD_SELECT)
          .eq('idempotency_key', key)
          .maybeSingle();
        if (raced.data) {
          const lead = raced.data as LeadRow;
          const crmSyncStatus = await syncLeadWithTwenty(supabase, lead);
          return json(
            {
              ok: true,
              leadId: lead.id,
              idempotent: true,
              crmSyncStatus,
            },
            origin
          );
        }
      }
      return internalError(inserted.error?.message ?? 'No se pudo registrar lead', origin);
    }

    const saved = inserted.data as LeadRow;
    void trackEvent(FN_NAME, 'congreso_lead_registrado', {
      products_count: productSnapshots.length,
      has_email: Boolean(email),
      has_phone: Boolean(telefono),
      event_slug: eventSlug,
    });

    const crmSyncStatus = await syncLeadWithTwenty(supabase, saved);

    return json(
      {
        ok: true,
        leadId: saved.id,
        priority: saved.prioridad,
        crmSyncStatus,
      },
      origin,
      201
    );
  })
);
