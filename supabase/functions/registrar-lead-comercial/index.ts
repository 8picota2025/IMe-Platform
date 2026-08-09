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
import {
  classifyLead,
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

interface LeadRow {
  id: string;
  prioridad: 'P1' | 'P2' | 'P3';
  crm_sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
  twenty_opportunity_id?: string | null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
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
      .select('id,prioridad,crm_sync_status,twenty_opportunity_id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing.data) {
      const lead = existing.data as LeadRow;
      return jsonResponse(
        {
          ok: true,
          leadId: lead.id,
          priority: lead.prioridad,
          crmSyncStatus: lead.crm_sync_status,
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

    const turnstile = await verifyTurnstile(body.turnstileToken, ip);
    if (!turnstile.success && turnstile.reason !== 'not_configured') {
      return jsonResponse(
        { ok: false, error: 'Verificacion de seguridad requerida.' },
        origin,
        400
      );
    }

    const campaign = cleanText(body.campaign, 80);
    const horizonte = cleanText(body.horizonte, 24) as HorizonteCompra | null;
    if (!campaign || !CAMPAIGNS.has(campaign)) return badRequest('campaign invalida', origin);
    if (!horizonte || !HORIZONTES.has(horizonte)) return badRequest('horizonte invalido', origin);

    const lead: CommercialLeadInput = {
      nombre: cleanText(body.nombre, 120) ?? '',
      cargo: cleanText(body.cargo, 120) ?? undefined,
      institucion: cleanText(body.institucion, 180) ?? '',
      ciudad: cleanText(body.ciudad, 120) ?? '',
      telefono: cleanText(body.telefono, 40) ?? undefined,
      email: cleanText(body.email, 200)?.toLowerCase() ?? undefined,
      familia_slug: cleanText(body.familia_slug, 120) ?? '',
      tipo_slug: cleanText(body.tipo_slug, 120) ?? undefined,
      tipo_proyecto: cleanText(body.tipo_proyecto, 180) ?? '',
      horizonte,
      presupuesto_estado: cleanText(body.presupuesto_estado, 80) ?? undefined,
      necesidad: cleanText(body.necesidad, 2000) ?? '',
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
      metadata: { turnstile: turnstile.success ? 'verified' : 'not_configured' },
    };

    const inserted = await supabase
      .from('leads_comerciales')
      .insert(payload)
      .select('id,prioridad,crm_sync_status')
      .maybeSingle();
    if (inserted.error || !inserted.data) {
      if (/duplicate|unique/i.test(inserted.error?.message ?? '')) {
        const raced = await supabase
          .from('leads_comerciales')
          .select('id,prioridad,crm_sync_status')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (raced.data) {
          const saved = raced.data as LeadRow;
          return jsonResponse(
            {
              ok: true,
              leadId: saved.id,
              priority: saved.prioridad,
              crmSyncStatus: saved.crm_sync_status,
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

    const twenty = await syncCommercialLeadWithTwenty({
      nombre: lead.nombre,
      ...(lead.email ? { email: lead.email } : {}),
      ...(lead.telefono ? { telefono: lead.telefono } : {}),
      empresa: lead.institucion,
      mensaje: lead.necesidad,
      priority,
      campaign,
      familySlug: lead.familia_slug,
      purchaseHorizon: lead.horizonte,
    });
    const crmSyncStatus = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';
    await supabase
      .from('leads_comerciales')
      .update({
        crm_sync_status: crmSyncStatus,
        crm_sync_error: twenty.ok || twenty.skipped ? null : (twenty.error ?? 'Twenty sync failed'),
        crm_sync_last_attempt_at: new Date().toISOString(),
        twenty_person_id: twenty.data?.personId ?? null,
        twenty_company_id: twenty.data?.companyId ?? null,
        twenty_opportunity_id: twenty.data?.opportunityId ?? null,
      })
      .eq('id', saved.id);

    if (!twenty.ok && !twenty.skipped) {
      void trackEvent(FN_NAME, 'lead_comercial_twenty_failed', { priority, campaign });
    }

    return jsonResponse(
      {
        ok: true,
        leadId: saved.id,
        priority,
        crmSyncStatus,
      },
      origin,
      201
    );
  })
);
