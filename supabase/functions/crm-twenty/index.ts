/**
 * CRM ↔ Twenty: reasignación, enlaces contacto-empresa, sync oportunidades.
 *
 * Auth: Bearer JWT + admin_profiles activo (ventas|admin|owner).
 *
 * GET  ?action=status
 * GET  ?action=members         — admin/owner
 * POST ?action=reassign        { ... }  — admin/owner
 * POST ?action=link            { ... }  — admin/owner
 * POST ?action=repair-links    { ... }  — admin/owner
 * POST ?action=sync-opportunity { ... } — ventas|admin|owner
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import {
  badRequest,
  errorResponse,
  internalError,
  notFound,
  unauthorized,
} from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { withTelemetry } from '../_shared/telemetry.ts';
import {
  TwentyClient,
  linkTwentyPersonCompany,
  listTwentyWorkspaceMembers,
  reassignTwentyLead,
  repairTwentyOrphanLinks,
  resolveTwentyOwnerByEmail,
  syncTwentyOpportunityFromCrm,
} from '../_shared/twenty-crm.ts';

const FN_NAME = 'crm-twenty';
type ComercialRol = 'ventas' | 'admin' | 'owner';
const ALLOWED_ROLES = new Set<ComercialRol>(['ventas', 'admin', 'owner']);

interface AdminProfileRow {
  user_id: string;
  email: string;
  rol: string;
  activo: boolean;
  nombre: string | null;
  twenty_member_id: string | null;
}

interface CrmOpportunityRow {
  id: string;
  titulo: string;
  etapa: string;
  valor_estimado: number | null;
  moneda: string;
  contact_id: string | null;
  account_id: string | null;
  source_table: string;
  source_id: string;
  twenty_opportunity_id: string | null;
  twenty_person_id: string | null;
  twenty_company_id: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
}

interface CrmContactRow {
  id: string;
  account_id: string | null;
  twenty_person_id: string | null;
  email_norm: string | null;
  nombre: string | null;
}

interface CrmAccountRow {
  id: string;
  nombre: string;
  twenty_company_id: string | null;
}

async function resolveTwentyIdsFromSource(
  supabase: ReturnType<typeof getServerSupabase>,
  sourceTable: string,
  sourceId: string
): Promise<{ personId?: string; companyId?: string; opportunityId?: string }> {
  if (sourceTable === 'leads_comerciales') {
    const { data } = await supabase
      .from('leads_comerciales')
      .select('twenty_person_id, twenty_company_id, twenty_opportunity_id')
      .eq('id', sourceId)
      .maybeSingle();
    const row = data as Record<string, string | null> | null;
    return {
      personId: row?.twenty_person_id ?? undefined,
      companyId: row?.twenty_company_id ?? undefined,
      opportunityId: row?.twenty_opportunity_id ?? undefined,
    };
  }
  if (sourceTable === 'solicitudes_cotizacion') {
    const { data } = await supabase
      .from('solicitudes_cotizacion')
      .select('twenty_person_id, twenty_company_id, twenty_opportunity_id')
      .eq('id', sourceId)
      .maybeSingle();
    const row = data as Record<string, string | null> | null;
    return {
      personId: row?.twenty_person_id ?? undefined,
      companyId: row?.twenty_company_id ?? undefined,
      opportunityId: row?.twenty_opportunity_id ?? undefined,
    };
  }
  if (sourceTable === 'pedidos') {
    const { data } = await supabase
      .from('pedidos')
      .select('twenty_opportunity_id, cliente_id')
      .eq('id', sourceId)
      .maybeSingle();
    const row = data as {
      twenty_opportunity_id?: string | null;
      cliente_id?: string | null;
    } | null;
    let personId: string | undefined;
    let companyId: string | undefined;
    if (row?.cliente_id) {
      const { data: cli } = await supabase
        .from('clientes')
        .select('twenty_person_id, twenty_company_id')
        .eq('id', row.cliente_id)
        .maybeSingle();
      const c = cli as Record<string, string | null> | null;
      personId = c?.twenty_person_id ?? undefined;
      companyId = c?.twenty_company_id ?? undefined;
    }
    return {
      personId,
      companyId,
      opportunityId: row?.twenty_opportunity_id ?? undefined,
    };
  }
  return {};
}

async function hydrateTwentyIds(
  supabase: ReturnType<typeof getServerSupabase>,
  opp: CrmOpportunityRow
): Promise<{ personId?: string; companyId?: string; opportunityId?: string }> {
  let personId = opp.twenty_person_id ?? undefined;
  let companyId = opp.twenty_company_id ?? undefined;
  let opportunityId = opp.twenty_opportunity_id ?? undefined;

  if (!opportunityId || !personId || !companyId) {
    const fromSource = await resolveTwentyIdsFromSource(supabase, opp.source_table, opp.source_id);
    opportunityId = opportunityId || fromSource.opportunityId;
    personId = personId || fromSource.personId;
    companyId = companyId || fromSource.companyId;
  }

  if (opp.contact_id && !personId) {
    const { data } = await supabase
      .from('crm_contacts')
      .select('twenty_person_id')
      .eq('id', opp.contact_id)
      .maybeSingle();
    personId = (data as CrmContactRow | null)?.twenty_person_id ?? undefined;
  }
  if (opp.account_id && !companyId) {
    const { data } = await supabase
      .from('crm_accounts')
      .select('twenty_company_id')
      .eq('id', opp.account_id)
      .maybeSingle();
    companyId = (data as CrmAccountRow | null)?.twenty_company_id ?? undefined;
  }

  return { personId, companyId, opportunityId };
}

async function persistTwentyIdsOnCrm(
  supabase: ReturnType<typeof getServerSupabase>,
  crmOpportunityId: string,
  ids: { personId?: string; companyId?: string; opportunityId?: string; ownerId?: string }
): Promise<void> {
  const patch: Record<string, string | null> = {};
  if (ids.opportunityId) patch.twenty_opportunity_id = ids.opportunityId;
  if (ids.personId) patch.twenty_person_id = ids.personId;
  if (ids.companyId) patch.twenty_company_id = ids.companyId;
  if (ids.ownerId) patch.twenty_owner_id = ids.ownerId;
  if (Object.keys(patch).length) {
    await supabase.from('crm_opportunities').update(patch).eq('id', crmOpportunityId);
  }
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;

    const supabase = getServerSupabase();
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return unauthorized(origin);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);

    const { data: profileData, error: profileError } = await supabase
      .from('admin_profiles')
      .select('user_id, email, rol, activo, nombre, twenty_member_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) return internalError(profileError.message, origin);

    const profile = profileData as AdminProfileRow | null;
    if (!profile || !profile.activo || !ALLOWED_ROLES.has(profile.rol as ComercialRol)) {
      return errorResponse(
        { code: 'FORBIDDEN', message: 'Sin permiso para operaciones CRM Twenty.' },
        403,
        origin
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? '';

    try {
      if (req.method === 'GET') {
        if (action === 'status') return await handleStatus(origin);
        if (action === 'members') {
          if (profile.rol !== 'admin' && profile.rol !== 'owner') {
            return errorResponse(
              { code: 'FORBIDDEN', message: 'Solo admin/owner puede listar miembros Twenty.' },
              403,
              origin
            );
          }
          return await handleMembers(origin);
        }
        return badRequest('action GET invalida (status|members)', origin);
      }

      if (req.method !== 'POST') {
        return badRequest('Metodo no soportado', origin);
      }

      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const isSupervisor = profile.rol === 'admin' || profile.rol === 'owner';

      switch (action) {
        case 'reassign':
          if (!isSupervisor) {
            return errorResponse(
              { code: 'FORBIDDEN', message: 'Solo admin/owner puede reasignar en Twenty.' },
              403,
              origin
            );
          }
          return await handleReassign(supabase, profile, body, origin);
        case 'link':
          if (!isSupervisor) {
            return errorResponse(
              { code: 'FORBIDDEN', message: 'Solo admin/owner puede enlazar contactos Twenty.' },
              403,
              origin
            );
          }
          return await handleLink(supabase, body, origin);
        case 'repair-links':
          if (!isSupervisor) {
            return errorResponse(
              { code: 'FORBIDDEN', message: 'Solo admin/owner puede reparar enlaces Twenty.' },
              403,
              origin
            );
          }
          return await handleRepairLinks(body, origin);
        case 'sync-opportunity':
          return await handleSyncOpportunity(supabase, profile, body, origin);
        default:
          return badRequest(
            'action POST invalida (reassign|link|repair-links|sync-opportunity)',
            origin
          );
      }
    } catch (err) {
      return internalError(
        err instanceof Error ? err.message : `${FN_NAME}: error desconocido`,
        origin
      );
    }
  })
);

async function handleStatus(origin: string | null): Promise<Response> {
  const configured = Boolean(
    Deno.env.get('TWENTY_BASE_URL')?.trim() && Deno.env.get('TWENTY_API_KEY')?.trim()
  );
  let connectivity: 'ok' | 'error' | 'skipped' = configured ? 'error' : 'skipped';
  let detail: string | undefined;
  if (configured) {
    const client = TwentyClient.fromEnv();
    if (client) {
      const probe = await client.findCompanyByName('__ime_probe__');
      connectivity = probe.ok ? 'ok' : 'error';
      if (!probe.ok) detail = probe.error;
    }
  }
  return Response.json(
    { ok: true, twenty: { configured, connectivity, detail } },
    { headers: getCorsHeaders(origin) }
  );
}

async function handleMembers(origin: string | null): Promise<Response> {
  const members = await listTwentyWorkspaceMembers();
  if (members.skipped) {
    return Response.json(
      { ok: false, skipped: true, error: members.error },
      { headers: getCorsHeaders(origin) }
    );
  }
  if (!members.ok) {
    return errorResponse({ code: 'TWENTY_ERROR', message: members.error ?? 'Error' }, 502, origin);
  }
  const list = (members.data ?? []).map(m => ({
    id: m.id,
    email: (m.userEmail as string) ?? '',
    name: (() => {
      const n = m.name as { firstName?: string; lastName?: string } | undefined;
      return [n?.firstName, n?.lastName].filter(Boolean).join(' ').trim();
    })(),
    jobTitle: (m.jobTitle as string) ?? '',
  }));
  return Response.json({ ok: true, members: list }, { headers: getCorsHeaders(origin) });
}

async function resolveOwnerId(body: Record<string, unknown>): Promise<string | null> {
  const direct = String(body.newOwnerId ?? body.ownerId ?? '').trim();
  if (direct) return direct;
  const email = String(body.newOwnerEmail ?? '')
    .trim()
    .toLowerCase();
  if (!email) return null;
  const resolved = await resolveTwentyOwnerByEmail(email);
  if (!resolved.ok) return null;
  return resolved.data ?? null;
}

async function loadCrmOpportunity(
  supabase: ReturnType<typeof getServerSupabase>,
  crmOpportunityId: string
): Promise<CrmOpportunityRow | null> {
  const { data, error } = await supabase
    .from('crm_opportunities')
    .select(
      'id, titulo, etapa, valor_estimado, moneda, contact_id, account_id, source_table, source_id, twenty_opportunity_id, twenty_person_id, twenty_company_id, next_action_at, next_action_note'
    )
    .eq('id', crmOpportunityId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CrmOpportunityRow;
}

async function handleReassign(
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  body: Record<string, unknown>,
  origin: string | null
): Promise<Response> {
  const newOwnerId = await resolveOwnerId(body);
  if (!newOwnerId) {
    return badRequest('newOwnerId o newOwnerEmail requerido', origin);
  }

  let twentyOpportunityId = String(body.twentyOpportunityId ?? '').trim();
  let personId = String(body.twentyPersonId ?? '').trim() || undefined;
  let companyId = String(body.twentyCompanyId ?? '').trim() || undefined;
  const crmOpportunityId = String(body.crmOpportunityId ?? '').trim();
  const reason = String(body.reason ?? `Reasignado por ${profile.email}`).trim();

  if (crmOpportunityId) {
    const opp = await loadCrmOpportunity(supabase, crmOpportunityId);
    if (!opp) return notFound('Oportunidad CRM no encontrada', origin);
    const ids = await hydrateTwentyIds(supabase, opp);
    twentyOpportunityId = twentyOpportunityId || ids.opportunityId || '';
    personId = personId || ids.personId;
    companyId = companyId || ids.companyId;
  }

  if (!twentyOpportunityId) {
    return badRequest('twentyOpportunityId no resuelto', origin);
  }

  const result = await reassignTwentyLead({
    opportunityId: twentyOpportunityId,
    newOwnerId,
    personId,
    companyId,
    reason,
  });

  if (result.skipped) {
    return Response.json(
      { ok: false, skipped: true, error: result.error },
      {
        headers: getCorsHeaders(origin),
      }
    );
  }
  if (!result.ok) {
    return errorResponse(
      { code: 'TWENTY_ERROR', message: result.error ?? 'Reasignacion fallo' },
      502,
      origin
    );
  }

  if (crmOpportunityId) {
    await persistTwentyIdsOnCrm(supabase, crmOpportunityId, {
      opportunityId: twentyOpportunityId,
      personId,
      companyId,
      ownerId: newOwnerId,
    });
  }

  return Response.json({ ok: true, data: result.data }, { headers: getCorsHeaders(origin) });
}

async function handleLink(
  supabase: ReturnType<typeof getServerSupabase>,
  body: Record<string, unknown>,
  origin: string | null
): Promise<Response> {
  let personId = String(body.twentyPersonId ?? '').trim();
  let companyId = String(body.twentyCompanyId ?? '').trim() || undefined;
  let companyName = String(body.companyName ?? '').trim();
  const ownerId = String(body.ownerId ?? Deno.env.get('TWENTY_OWNER_ID') ?? '').trim() || undefined;

  const crmContactId = String(body.crmContactId ?? '').trim();
  const crmAccountId = String(body.crmAccountId ?? '').trim();

  if (crmContactId && !personId) {
    const { data } = await supabase
      .from('crm_contacts')
      .select('id, account_id, twenty_person_id, email_norm, nombre')
      .eq('id', crmContactId)
      .maybeSingle();
    const contact = data as CrmContactRow | null;
    if (!contact) return notFound('Contacto CRM no encontrado', origin);
    personId = contact.twenty_person_id ?? '';
    if (!crmAccountId && contact.account_id) {
      const { data: acc } = await supabase
        .from('crm_accounts')
        .select('id, nombre, twenty_company_id')
        .eq('id', contact.account_id)
        .maybeSingle();
      const account = acc as CrmAccountRow | null;
      companyId = companyId || account?.twenty_company_id || undefined;
      companyName = companyName || account?.nombre || '';
    }
  }

  if (crmAccountId && !companyId) {
    const { data } = await supabase
      .from('crm_accounts')
      .select('id, nombre, twenty_company_id')
      .eq('id', crmAccountId)
      .maybeSingle();
    const account = data as CrmAccountRow | null;
    if (!account) return notFound('Cuenta CRM no encontrada', origin);
    companyId = account.twenty_company_id ?? undefined;
    companyName = companyName || account.nombre;
  }

  if (!personId) return badRequest('twentyPersonId o crmContactId con ID Twenty requerido', origin);
  if (!companyId && !companyName) {
    return badRequest('twentyCompanyId, crmAccountId o companyName requerido', origin);
  }

  const link = await linkTwentyPersonCompany({
    personId,
    companyId,
    companyName: companyId ? undefined : companyName,
    ownerId,
  });

  if (link.skipped) {
    return Response.json(
      { ok: false, skipped: true, error: link.error },
      {
        headers: getCorsHeaders(origin),
      }
    );
  }
  if (!link.ok || !link.data) {
    return errorResponse(
      { code: 'TWENTY_ERROR', message: link.error ?? 'Enlace fallo' },
      502,
      origin
    );
  }

  if (crmContactId) {
    await supabase
      .from('crm_contacts')
      .update({ twenty_person_id: link.data.personId, account_id: crmAccountId || undefined })
      .eq('id', crmContactId);
  }
  if (crmAccountId || link.data.companyId) {
    const accountId = crmAccountId;
    if (accountId) {
      await supabase
        .from('crm_accounts')
        .update({ twenty_company_id: link.data.companyId })
        .eq('id', accountId);
    }
  }

  return Response.json({ ok: true, data: link.data }, { headers: getCorsHeaders(origin) });
}

async function handleRepairLinks(
  body: Record<string, unknown>,
  origin: string | null
): Promise<Response> {
  const limit = Number(body.limit ?? 60);
  const ownerId = String(body.ownerId ?? Deno.env.get('TWENTY_OWNER_ID') ?? '').trim() || undefined;
  const result = await repairTwentyOrphanLinks({ limit, ownerId });
  if (result.skipped) {
    return Response.json(
      { ok: false, skipped: true, error: result.error },
      {
        headers: getCorsHeaders(origin),
      }
    );
  }
  if (!result.ok) {
    return errorResponse(
      { code: 'TWENTY_ERROR', message: result.error ?? 'Repair fallo' },
      502,
      origin
    );
  }
  return Response.json({ ok: true, data: result.data }, { headers: getCorsHeaders(origin) });
}

async function handleSyncOpportunity(
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  body: Record<string, unknown>,
  origin: string | null
): Promise<Response> {
  const crmOpportunityId = String(body.crmOpportunityId ?? '').trim();
  if (!crmOpportunityId) return badRequest('crmOpportunityId requerido', origin);

  const opp = await loadCrmOpportunity(supabase, crmOpportunityId);
  if (!opp) return notFound('Oportunidad CRM no encontrada', origin);

  const ids = await hydrateTwentyIds(supabase, opp);
  if (!ids.opportunityId) {
    return badRequest('Sin twenty_opportunity_id; sincroniza el lead primero', origin);
  }

  const etapa = String(body.etapa ?? opp.etapa).trim();
  const valorRaw = body.valor_estimado ?? opp.valor_estimado;
  const valorEstimado = valorRaw == null || valorRaw === '' ? null : Number(valorRaw);
  const isSupervisor = profile.rol === 'admin' || profile.rol === 'owner';
  const ownerId = isSupervisor
    ? (await resolveOwnerId(body)) ||
      profile.twenty_member_id ||
      Deno.env.get('TWENTY_OWNER_ID')?.trim() ||
      undefined
    : undefined;

  if (ids.personId && ids.companyId) {
    await linkTwentyPersonCompany({
      personId: ids.personId,
      companyId: ids.companyId,
      ownerId,
    });
  }

  const explicitReassign = String(body.newOwnerId ?? body.newOwnerEmail ?? '').trim();
  if (isSupervisor && explicitReassign && ownerId) {
    await reassignTwentyLead({
      opportunityId: ids.opportunityId,
      newOwnerId: ownerId,
      personId: ids.personId,
      companyId: ids.companyId,
      reason: String(body.reason ?? `Sync admin ${profile.email}`).trim(),
    });
  }

  const sync = await syncTwentyOpportunityFromCrm({
    opportunityId: ids.opportunityId,
    etapa,
    valorEstimado: Number.isFinite(valorEstimado) ? valorEstimado : null,
    moneda: String(body.moneda ?? opp.moneda ?? 'COP'),
    ownerId,
    companyId: ids.companyId,
    personId: ids.personId,
    nextActionAt: String(body.next_action_at ?? opp.next_action_at ?? '').trim() || null,
    nextActionNote: String(body.next_action_note ?? opp.next_action_note ?? '').trim() || null,
    titulo: String(body.titulo ?? opp.titulo).trim(),
  });

  if (sync.skipped) {
    return Response.json(
      { ok: false, skipped: true, error: sync.error },
      {
        headers: getCorsHeaders(origin),
      }
    );
  }
  if (!sync.ok) {
    return errorResponse(
      { code: 'TWENTY_ERROR', message: sync.error ?? 'Sync fallo' },
      502,
      origin
    );
  }

  await persistTwentyIdsOnCrm(supabase, crmOpportunityId, {
    opportunityId: ids.opportunityId,
    personId: ids.personId,
    companyId: ids.companyId,
    ownerId,
  });

  return Response.json(
    {
      ok: true,
      twenty: {
        opportunityId: ids.opportunityId,
        personId: ids.personId,
        companyId: ids.companyId,
        ownerId,
        stage: sync.data?.stage,
      },
    },
    { headers: getCorsHeaders(origin) }
  );
}
