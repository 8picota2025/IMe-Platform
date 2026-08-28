/**
 * Captura publica de leads consultivos B2B.
 * Persiste primero; Twenty/telemetria son best-effort. Nunca devuelve exito
 * si el registro fuente no existe.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { syncCommercialLeadWithTwenty } from '../_shared/twenty-crm.ts';
import { enviarEmailPlantilla, escapeHtml, DESTINATARIOS_INTERNOS } from '../_shared/email.ts';
import {
  classifyLead,
  isTurnstileOptionalCampaign,
  validateCommercialLead,
  type CommercialLeadInput,
  type HorizonteCompra,
} from '../../../src/lib/comercial-leads.ts';

const FN_NAME = 'registrar-lead-comercial';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{16,200}$/;
const CAMPAIGNS = new Set([
  'torres_laparoscopia',
  'esterilizacion',
  'imagenologia',
  'robotica_rehabilitacion',
  'proyectos',
  'pdf_descarga',
  'evento',
  'fab_tuttnauer',
  'fab_saikang',
  'fab_angell',
  'fab_northern',
  'fab_ilumitec',
  'fab_perlong',
  'fab_bm',
  'fab_advanced',
  'fab_m',
]);
const HORIZONTES = new Set<HorizonteCompra>(['0-3', '4-12', 'exploracion']);

interface LeadBody extends Partial<CommercialLeadInput> {
  nombres?: string;
  apellidos?: string;
  idempotencyKey?: string;
  turnstileToken?: string;
  website?: string;
  landing_path?: string;
  referrer?: string;
  analytics_session_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

type CrmSyncStatus = 'pending' | 'synced' | 'failed' | 'skipped';

interface LeadRow {
  id: string;
  prioridad: 'P1' | 'P2' | 'P3';
  crm_sync_status: CrmSyncStatus;
  campaign: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  institucion: string;
  ciudad: string;
  familia_slug: string;
  horizonte: string;
  necesidad: string;
  metadata: Record<string, unknown> | null;
  twenty_person_id: string | null;
  twenty_company_id: string | null;
  twenty_opportunity_id: string | null;
}

const LEAD_SELECT = [
  'id',
  'prioridad',
  'crm_sync_status',
  'campaign',
  'nombre',
  'email',
  'telefono',
  'institucion',
  'ciudad',
  'familia_slug',
  'horizonte',
  'necesidad',
  'metadata',
  'twenty_person_id',
  'twenty_company_id',
  'twenty_opportunity_id',
].join(',');

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function metadataText(metadata: LeadRow['metadata'], key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function syncLeadWithTwenty(
  supabase: ReturnType<typeof getServerSupabase>,
  lead: LeadRow
): Promise<CrmSyncStatus> {
  if (lead.crm_sync_status === 'synced') return 'synced';

  const eventFirstNames = metadataText(lead.metadata, 'nombres');
  const eventLastNames = metadataText(lead.metadata, 'apellidos');
  const eventoRaw = lead.metadata?.evento;
  const evento =
    eventoRaw && typeof eventoRaw === 'object' ? (eventoRaw as Record<string, unknown>) : null;
  const eventSlug = typeof evento?.slug === 'string' ? evento.slug.trim() : undefined;
  const eventName = typeof evento?.nombre === 'string' ? evento.nombre.trim() : undefined;
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
    ...(metadataText(lead.metadata, 'origen')
      ? { origen: metadataText(lead.metadata, 'origen') }
      : {}),
    ...(eventSlug ? { eventSlug } : {}),
    ...(eventName ? { eventName } : {}),
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
    void trackEvent(FN_NAME, 'lead_comercial_crm_status_update_failed', {
      campaign: lead.campaign,
    });
    return lead.crm_sync_status;
  }

  if (twenty.ok && twenty.data) {
    const { data: leadRow } = await supabase
      .from('leads_comerciales')
      .select('crm_opportunity_id, crm_contact_id, crm_account_id')
      .eq('id', lead.id)
      .maybeSingle();
    const bridge = leadRow as {
      crm_opportunity_id?: string | null;
      crm_contact_id?: string | null;
      crm_account_id?: string | null;
    } | null;
    if (bridge?.crm_opportunity_id) {
      await supabase
        .from('crm_opportunities')
        .update({
          twenty_opportunity_id: twenty.data.opportunityId,
          twenty_person_id: twenty.data.personId,
          twenty_company_id: twenty.data.companyId ?? null,
        })
        .eq('id', bridge.crm_opportunity_id);
    }
    if (bridge?.crm_contact_id && twenty.data.personId) {
      await supabase
        .from('crm_contacts')
        .update({ twenty_person_id: twenty.data.personId })
        .eq('id', bridge.crm_contact_id);
    }
    if (bridge?.crm_account_id && twenty.data.companyId) {
      await supabase
        .from('crm_accounts')
        .update({ twenty_company_id: twenty.data.companyId })
        .eq('id', bridge.crm_account_id);
    }
  }
  if (!twenty.ok && !twenty.skipped) {
    void trackEvent(FN_NAME, 'lead_comercial_twenty_failed', {
      priority: lead.prioridad,
      campaign: lead.campaign,
    });
  }
  return crmSyncStatus;
}

async function sendEventConfirmation(
  supabase: ReturnType<typeof getServerSupabase>,
  lead: Pick<LeadRow, 'id' | 'campaign' | 'nombre' | 'email'>
): Promise<boolean | undefined> {
  if (lead.campaign !== 'evento') return undefined;
  if (!lead.email) return false;

  try {
    const result = await enviarEmailPlantilla(
      supabase,
      'evento_confirmacion_cliente',
      [lead.email],
      { cliente_nombre: escapeHtml(lead.nombre) },
      lead.id,
      [],
      {
        failOnInactive: true,
        idempotencyKey: `evento-confirmacion:${lead.id}`,
      }
    );
    return result.ok;
  } catch {
    return false;
  }
}

async function sendCommercialLeadEmails(
  supabase: ReturnType<typeof getServerSupabase>,
  lead: Pick<
    LeadRow,
    'id' | 'campaign' | 'nombre' | 'email' | 'telefono' | 'institucion' | 'necesidad' | 'metadata'
  > & { locale?: string | null }
): Promise<{ interno: boolean; cliente: boolean } | undefined> {
  if (lead.campaign === 'evento') return undefined;

  const locale = lead.locale === 'en' ? 'en' : 'es';
  const referencia = lead.id;
  const vars = {
    referencia: escapeHtml(referencia),
    cliente_nombre: escapeHtml(lead.nombre),
    cliente_email: escapeHtml(lead.email ?? ''),
    empresa: escapeHtml(lead.institucion),
    telefono: escapeHtml(lead.telefono ?? ''),
    mensaje: escapeHtml(lead.necesidad),
    items_html:
      locale === 'en'
        ? `<li>${escapeHtml(lead.campaign)} lead</li>`
        : `<li>Lead comercial (${escapeHtml(lead.campaign)})</li>`,
    total: 'Por validar',
    moneda: 'COP',
    fecha: new Date().toLocaleString(locale === 'en' ? 'en-US' : 'es-CO', {
      timeZone: 'America/Bogota',
    }),
  };
  const plantillaCliente =
    locale === 'en' ? 'cotizacion_confirmacion_cliente_en' : 'cotizacion_confirmacion_cliente_es';
  const destinatariosCliente = lead.email ? [lead.email] : [];
  const [interno, cliente] = await Promise.all([
    enviarEmailPlantilla(supabase, 'cotizacion_interna', DESTINATARIOS_INTERNOS, vars, referencia),
    destinatariosCliente.length
      ? enviarEmailPlantilla(supabase, plantillaCliente, destinatariosCliente, vars, referencia)
      : Promise.resolve({ ok: true as const }),
  ]);
  if (!interno.ok) console.error('registrar-lead-comercial: email interno', interno.detalle);
  if (!cliente.ok) console.error('registrar-lead-comercial: email cliente', cliente.detalle);
  return { interno: interno.ok, cliente: destinatariosCliente.length ? cliente.ok : false };
}

function jsonResponse(
  body: Record<string, unknown>,
  origin: string | null,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'desconocida'
  );
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const cors = handleCors(req);
    if (cors) return cors;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    const body = (await req.json().catch(() => ({}))) as LeadBody;
    if (cleanText(body.website, 200)) return badRequest('Solicitud invalida', origin);

    const idempotencyKey = cleanText(body.idempotencyKey, 200);
    if (!idempotencyKey || !IDEMPOTENCY_RE.test(idempotencyKey)) {
      return badRequest('idempotencyKey invalido', origin);
    }

    const supabase = getServerSupabase();
    const existing = await supabase
      .from('leads_comerciales')
      .select(LEAD_SELECT)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing.data) {
      const lead = existing.data as LeadRow;
      const crmSyncStatus =
        lead.campaign === 'evento'
          ? await syncLeadWithTwenty(supabase, lead)
          : lead.crm_sync_status;
      const emailSent = await sendEventConfirmation(supabase, lead);
      if (emailSent === false) {
        void trackEvent(FN_NAME, 'lead_evento_email_failed', { campaign: lead.campaign });
      }
      return jsonResponse(
        {
          ok: true,
          leadId: lead.id,
          priority: lead.prioridad,
          crmSyncStatus,
          ...(emailSent !== undefined ? { emailSent } : {}),
          idempotent: true,
        },
        origin
      );
    }

    const ip = clientIp(req);
    const limit = await checkRateLimit(supabase, `lead-comercial:ip:${ip}`, 'cotizacion');
    if (limit.limited) {
      return jsonResponse(
        { ok: false, error: 'Demasiadas solicitudes. Intenta mas tarde.' },
        origin,
        429
      );
    }

    const campaign = cleanText(body.campaign, 80);
    if (!campaign || !CAMPAIGNS.has(campaign)) return badRequest('campaign invalida', origin);

    const eventFirstNames = cleanText(body.nombres, 60);
    const eventLastNames = cleanText(body.apellidos, 60);
    if (campaign === 'evento' && (!eventFirstNames || !eventLastNames)) {
      return jsonResponse({ ok: false, error: 'Indica nombre y apellidos.' }, origin, 422);
    }

    const horizonte = (
      campaign === 'evento' ? 'exploracion' : cleanText(body.horizonte, 24)
    ) as HorizonteCompra | null;
    if (!horizonte || !HORIZONTES.has(horizonte)) return badRequest('horizonte invalido', origin);

    // Evento y descargas de fichas ya tienen formulario obligatorio, honeypot y
    // rate-limit por IP. Turnstile puede entrar en loop 600* en navegadores o
    // redes legítimas; no bloquear el registro por un challenge no resuelto.
    const turnstile = await verifyTurnstile(body.turnstileToken, ip);
    if (
      !isTurnstileOptionalCampaign(campaign) &&
      !turnstile.success &&
      turnstile.reason !== 'not_configured'
    ) {
      return jsonResponse(
        { ok: false, error: 'Verificacion de seguridad requerida.' },
        origin,
        400
      );
    }

    const eventFullName =
      campaign === 'evento' && eventFirstNames && eventLastNames
        ? `${eventFirstNames} ${eventLastNames}`.slice(0, 120)
        : null;
    const lead: CommercialLeadInput = {
      nombre: eventFullName ?? cleanText(body.nombre, 120) ?? '',
      cargo: cleanText(body.cargo, 120) ?? undefined,
      institucion: cleanText(body.institucion, 180) ?? '',
      ciudad: cleanText(body.ciudad, 120) ?? '',
      telefono: cleanText(body.telefono, 40) ?? undefined,
      email: cleanText(body.email, 200)?.toLowerCase() ?? undefined,
      familia_slug: campaign === 'evento' ? 'evento' : (cleanText(body.familia_slug, 120) ?? ''),
      tipo_slug: campaign === 'evento' ? undefined : (cleanText(body.tipo_slug, 120) ?? undefined),
      tipo_proyecto:
        campaign === 'evento' ? 'registro_evento' : (cleanText(body.tipo_proyecto, 180) ?? ''),
      horizonte,
      presupuesto_estado:
        campaign === 'evento' ? undefined : (cleanText(body.presupuesto_estado, 80) ?? undefined),
      necesidad:
        campaign === 'evento'
          ? 'Registro de asistente al evento'
          : (cleanText(body.necesidad, 2000) ?? ''),
      consentimiento: body.consentimiento === true,
      campaign: campaign as CommercialLeadInput['campaign'],
      locale: body.locale === 'en' ? 'en' : 'es',
    };
    const validation = validateCommercialLead(lead);
    if (!validation.valid) {
      return jsonResponse(
        { ok: false, error: Object.values(validation.errors)[0] ?? 'Datos invalidos' },
        origin,
        422
      );
    }
    if (lead.email && !EMAIL_RE.test(lead.email)) return badRequest('email invalido', origin);

    const priority = classifyLead(lead.horizonte);
    const payload = {
      idempotency_key: idempotencyKey,
      nombre: lead.nombre,
      cargo: lead.cargo ?? null,
      institucion: lead.institucion,
      ciudad: lead.ciudad,
      telefono: lead.telefono ?? null,
      email: lead.email ?? null,
      familia_slug: lead.familia_slug,
      tipo_slug: lead.tipo_slug ?? null,
      tipo_proyecto: lead.tipo_proyecto,
      horizonte: lead.horizonte,
      presupuesto_estado: lead.presupuesto_estado ?? null,
      necesidad: lead.necesidad,
      consentimiento_datos: true,
      consentimiento_timestamp: new Date().toISOString(),
      campaign,
      locale: lead.locale ?? 'es',
      prioridad: priority,
      landing_path: cleanText(body.landing_path, 500),
      referrer: cleanText(body.referrer, 500),
      analytics_session_id: cleanText(body.analytics_session_id, 80),
      utm_source: cleanText(body.utm_source, 120),
      utm_medium: cleanText(body.utm_medium, 120),
      utm_campaign: cleanText(body.utm_campaign, 160),
      utm_content: cleanText(body.utm_content, 160),
      utm_term: cleanText(body.utm_term, 160),
      metadata: {
        turnstile: turnstile.success
          ? 'verified'
          : isTurnstileOptionalCampaign(campaign)
            ? `optional_${campaign}`
            : 'not_configured',
        ...(campaign === 'evento'
          ? {
              nombres: eventFirstNames,
              apellidos: eventLastNames,
              tipo_registro: 'asistente_evento',
            }
          : {}),
      },
    };

    const inserted = await supabase
      .from('leads_comerciales')
      .insert(payload)
      .select(LEAD_SELECT)
      .maybeSingle();
    if (inserted.error || !inserted.data) {
      if (/duplicate|unique/i.test(inserted.error?.message ?? '')) {
        const raced = await supabase
          .from('leads_comerciales')
          .select(LEAD_SELECT)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (raced.data) {
          const saved = raced.data as LeadRow;
          const crmSyncStatus =
            saved.campaign === 'evento'
              ? await syncLeadWithTwenty(supabase, saved)
              : saved.crm_sync_status;
          const emailSent = await sendEventConfirmation(supabase, saved);
          if (emailSent === false) {
            void trackEvent(FN_NAME, 'lead_evento_email_failed', { campaign: saved.campaign });
          }
          return jsonResponse(
            {
              ok: true,
              leadId: saved.id,
              priority: saved.prioridad,
              crmSyncStatus,
              ...(emailSent !== undefined ? { emailSent } : {}),
              idempotent: true,
            },
            origin
          );
        }
      }
      return internalError(inserted.error?.message ?? 'No se pudo registrar el lead', origin);
    }

    const saved = inserted.data as LeadRow;
    void trackEvent(FN_NAME, 'lead_comercial_registrado', {
      priority,
      campaign,
      family_slug: lead.familia_slug,
      purchase_horizon: lead.horizonte,
    });

    const crmSyncStatus = await syncLeadWithTwenty(supabase, saved);

    const emailSent = await sendEventConfirmation(supabase, saved);
    if (emailSent === false) {
      void trackEvent(FN_NAME, 'lead_evento_email_failed', { campaign });
    }
    const emails = await sendCommercialLeadEmails(supabase, {
      ...saved,
      locale: lead.locale ?? 'es',
    });

    return jsonResponse(
      {
        ok: true,
        leadId: saved.id,
        priority,
        crmSyncStatus,
        ...(emailSent !== undefined ? { emailSent } : {}),
        ...(emails ? { emails } : {}),
      },
      origin,
      201
    );
  })
);
