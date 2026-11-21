/**
 * Reintenta la sync Twenty de una solicitud ya guardada.
 * No envía correo ni WhatsApp. Solo service role.
 *
 * POST { "id": "<solicitudes_cotizacion uuid>" }
 * Si la fila ya tiene twenty_opportunity_id, se hace PATCH de esa oportunidad.
 */
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { syncCotizacionWithTwenty } from '../_shared/twenty-crm.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jwtRole(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function isServiceRole(req: Request): boolean {
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const apikey = req.headers.get('apikey')?.trim() ?? '';
  const token = bearer || apikey;
  if (!token) return false;
  if (expected && (bearer === expected || apikey === expected)) return true;
  // Clave nueva de servicio (no es JWT). La publishable del navegador no entra.
  if (token.startsWith('sb_secret_')) return true;
  return jwtRole(token) === 'service_role';
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, error: 'POST only' }, { status: 405 });
  }
  if (!isServiceRole(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!UUID_RE.test(id)) {
    return Response.json({ ok: false, error: 'id invalido' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('solicitudes_cotizacion')
    .select(
      'id,nombre,email,telefono,empresa,mensaje,origen,tipo_solicitud,productos,total_estimado,moneda,campaign,twenty_opportunity_id,metadata'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return Response.json({ ok: false, error: 'solicitud no encontrada' }, { status: 404 });
  }

  const row = data as {
    id: string;
    nombre: string | null;
    email: string | null;
    telefono: string | null;
    empresa: string | null;
    mensaje: string | null;
    origen: string | null;
    tipo_solicitud: string | null;
    productos: unknown;
    total_estimado: number | null;
    moneda: string | null;
    campaign: string | null;
    twenty_opportunity_id: string | null;
    metadata: unknown;
  };

  const productos = Array.isArray(row.productos)
    ? row.productos.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const product = item as { nombre?: unknown; slug?: unknown; cantidad?: unknown };
        const cantidad = Number(product.cantidad);
        return [
          {
            nombre: typeof product.nombre === 'string' ? product.nombre : undefined,
            slug: typeof product.slug === 'string' ? product.slug : undefined,
            cantidad: Number.isFinite(cantidad) ? cantidad : undefined,
          },
        ];
      })
    : [];

  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as { attribution?: Record<string, unknown> })
      : {};
  const attribution = meta.attribution ?? {};
  const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

  const twenty = await syncCotizacionWithTwenty({
    nombre: (row.nombre ?? '').trim() || 'Contacto',
    email: row.email ?? undefined,
    telefono: row.telefono ?? undefined,
    empresa: row.empresa ?? undefined,
    mensaje: row.mensaje ?? undefined,
    origen: row.origen ?? undefined,
    tipoSolicitud: row.tipo_solicitud ?? undefined,
    productos,
    totalEstimado: row.total_estimado,
    moneda: row.moneda ?? undefined,
    campaign: row.campaign ?? undefined,
    twentyOpportunityId: row.twenty_opportunity_id,
    attribution: {
      landingPath: text(attribution.landing_path),
      referrer: text(attribution.referrer),
      sessionId: text(attribution.analytics_session_id),
      utmSource: text(attribution.utm_source),
      utmMedium: text(attribution.utm_medium),
      utmCampaign: text(attribution.utm_campaign),
      utmContent: text(attribution.utm_content),
      utmTerm: text(attribution.utm_term),
    },
  });

  const status = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';
  await supabase
    .from('solicitudes_cotizacion')
    .update({
      crm_sync_status: status,
      crm_sync_error: twenty.ok || twenty.skipped ? null : (twenty.error ?? 'Twenty sync failed'),
      crm_sync_last_attempt_at: new Date().toISOString(),
      twenty_person_id: twenty.data?.personId ?? null,
      twenty_company_id: twenty.data?.companyId ?? null,
      twenty_opportunity_id: twenty.data?.opportunityId ?? row.twenty_opportunity_id,
    })
    .eq('id', id);

  return Response.json({
    ok: twenty.ok,
    skipped: twenty.skipped ?? false,
    status,
    error: twenty.ok ? undefined : twenty.error,
    personId: twenty.data?.personId ?? null,
    companyId: twenty.data?.companyId ?? null,
    opportunityId: twenty.data?.opportunityId ?? row.twenty_opportunity_id,
  });
});
