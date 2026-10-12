/**
 * Retencion de asesor_agent_turns — ADR-0017. Borra turnos mas viejos que
 * ASESOR_RETENTION_DIAS (default 90). El mensaje/historial ya viajan
 * redactados (ver _shared/pii-redact.ts, aplicado en asesor/index.ts antes
 * de insertar), pero conservar conversaciones indefinidamente sigue siendo
 * riesgo innecesario sin beneficio operativo mas alla de una ventana de
 * soporte/depuracion razonable.
 *
 * Auth: Bearer service_role JWT, SUPABASE_SERVICE_ROLE_KEY, o
 * x-purga-asesor-secret. Mismo patron que reporte-semanal/index.ts.
 * Cron: GitHub Actions (.github/workflows/purgar-asesor-agent-turns.yml),
 * reutiliza el secret SUPABASE_SERVICE_ROLE_KEY ya existente — sin
 * credenciales nuevas.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { cutoffIso, retentionDias } from '../_shared/asesor-retention.ts';

const FN_NAME = 'purgar-asesor-agent-turns';

function jwtRole(bearer: string): string | null {
  try {
    const part = bearer.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { role?: string };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function authorized(req: Request): boolean {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  const secret = Deno.env.get('PURGA_ASESOR_SECRET')?.trim() ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-purga-asesor-secret') ?? '';
  if (secret && (headerSecret === secret || bearer === secret)) return true;
  if (bearer && jwtRole(bearer) === 'service_role') return true;
  if (service && bearer && bearer === service) return true;
  return false;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (!authorized(req)) return unauthorized(origin);

  try {
    const supabase = getServerSupabase();
    const dias = retentionDias();
    const cutoff = cutoffIso(new Date(), dias);

    const { data, error } = await supabase
      .from('asesor_agent_turns')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) return internalError(error.message, origin);

    const borrados = data?.length ?? 0;
    console.log(FN_NAME, { dias, cutoff, borrados });

    return new Response(JSON.stringify({ ok: true, dias, cutoff, borrados }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  } catch (err) {
    console.error(FN_NAME, err);
    return internalError(err instanceof Error ? err.message : 'purga fallo', origin);
  }
});
