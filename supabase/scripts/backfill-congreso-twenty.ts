/**
 * One-shot: sincroniza leads_comerciales de congreso (pending/failed) a Twenty.
 * Uso:
 *   set -a && source .env && set +a
 *   deno run --allow-env --allow-net supabase/scripts/backfill-congreso-twenty.ts
 */
import { syncCommercialLeadWithTwenty } from '../functions/_shared/twenty-crm.ts';

const url = Deno.env.get('PUBLIC_SUPABASE_URL')?.replace(/\/+$/, '');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('Faltan PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

type Lead = {
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
  crm_sync_status: string;
  twenty_person_id: string | null;
  twenty_company_id: string | null;
  twenty_opportunity_id: string | null;
  metadata: Record<string, unknown> | null;
  landing_path: string | null;
};

function text(meta: Lead['metadata'], key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function eventInfo(meta: Lead['metadata']): { slug?: string; nombre?: string } {
  const raw = meta?.evento;
  if (!raw || typeof raw !== 'object') return {};
  const e = raw as Record<string, unknown>;
  const out: { slug?: string; nombre?: string } = {};
  if (typeof e.slug === 'string' && e.slug.trim()) out.slug = e.slug.trim();
  if (typeof e.nombre === 'string' && e.nombre.trim()) out.nombre = e.nombre.trim();
  return out;
}

function products(meta: Lead['metadata']) {
  const raw = meta?.productos_interes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const nombre = typeof row.nombre === 'string' ? row.nombre : undefined;
      const slug = typeof row.slug === 'string' ? row.slug : undefined;
      if (!nombre && !slug) return null;
      return { nombre, slug, cantidad: 1 as const };
    })
    .filter(Boolean) as Array<{ nombre?: string; slug?: string; cantidad: number }>;
}

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: init?.method === 'PATCH' ? 'return=minimal' : 'return=representation',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → HTTP ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const leads = await sb<Lead[]>(
  'leads_comerciales?select=id,nombre,email,telefono,institucion,ciudad,necesidad,prioridad,campaign,familia_slug,horizonte,crm_sync_status,twenty_person_id,twenty_company_id,twenty_opportunity_id,metadata,landing_path&campaign=eq.evento&crm_sync_status=in.(pending,failed)&order=created_at.asc'
);

const targets = leads.filter(
  l =>
    l.landing_path === '/congreso' ||
    text(l.metadata, 'origen') === 'congreso' ||
    l.crm_sync_status === 'failed'
);

console.log(`Pendientes/failed a sincronizar: ${targets.length}`);

let ok = 0;
let fail = 0;
for (const lead of targets) {
  // Enrich missing metadata fields for older rows
  const meta = { ...(lead.metadata ?? {}) };
  if (!meta.tipo_registro) meta.tipo_registro = 'asistente_evento';
  if (!meta.origen && lead.landing_path === '/congreso') meta.origen = 'congreso';
  if (!meta.nombres || !meta.apellidos) {
    const parts = lead.nombre.trim().split(/\s+/);
    if (!meta.nombres) meta.nombres = parts[0] ?? lead.nombre;
    if (!meta.apellidos) meta.apellidos = parts.slice(1).join(' ') || 'Congreso';
  }
  if (!meta.evento || typeof meta.evento !== 'object') {
    meta.evento = { slug: 'acise2026', nombre: 'ACISE2026' };
  }

  const evento = eventInfo(meta);
  const productos = products(meta);
  const nombres = text(meta, 'nombres');
  const apellidos = text(meta, 'apellidos');
  const twenty = await syncCommercialLeadWithTwenty({
    nombre: lead.nombre,
    ...(nombres ? { nombres } : {}),
    ...(apellidos ? { apellidos } : {}),
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
    origen: text(meta, 'origen') || (lead.landing_path === '/congreso' ? 'congreso' : 'evento'),
    ...(evento.slug ? { eventSlug: evento.slug } : {}),
    ...(evento.nombre ? { eventName: evento.nombre } : {}),
    ...(productos.length ? { productos } : {}),
  });

  const status = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';
  await sb(`leads_comerciales?id=eq.${lead.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      metadata: meta,
      crm_sync_status: status,
      crm_sync_error: twenty.ok || twenty.skipped ? null : (twenty.error ?? 'Twenty sync failed'),
      crm_sync_last_attempt_at: new Date().toISOString(),
      twenty_person_id: twenty.data?.personId ?? lead.twenty_person_id,
      twenty_company_id: twenty.data?.companyId ?? lead.twenty_company_id,
      twenty_opportunity_id: twenty.data?.opportunityId ?? lead.twenty_opportunity_id,
    }),
  });

  const mark = twenty.ok ? 'OK' : twenty.skipped ? 'SKIP' : 'FAIL';
  console.log(
    `${mark} ${lead.id.slice(0, 8)} ${status}${twenty.error ? ` — ${twenty.error}` : ''} person=${twenty.data?.personId?.slice(0, 8) ?? '-'} opp=${twenty.data?.opportunityId?.slice(0, 8) ?? '-'}`
  );
  if (twenty.ok) ok++;
  else fail++;
}

console.log(`Done. synced=${ok} failed_or_skip=${fail}`);
