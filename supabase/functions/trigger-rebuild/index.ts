/**
 * Edge Function: trigger-rebuild
 * Dispara un rebuild batched desde admin. Secretos solo server-side.
 * Persiste resultado en cms_publish_log para historial admin.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';

interface RebuildRequest {
  reason?: string;
}

const REBUILD_ROLES = new Set(['owner', 'admin', 'catalogo']);

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  try {
    const supabase = getServerSupabase();
    const auth = await requireAdmin(supabase, req.headers.get('Authorization'), REBUILD_ROLES);
    if (!auth.ok) return unauthorized(origin);

    const body = (await req.json().catch(() => ({}))) as RebuildRequest;
    const reason = body.reason ?? 'admin_publish_batch';

    const logPublish = async (fields: {
      mode: string;
      ok: boolean;
      error_message?: string | null;
    }) => {
      const { error: logError } = await supabase.from('cms_publish_log').insert({
        requested_by: auth.userId ?? null,
        requested_email: auth.email ?? null,
        reason,
        mode: fields.mode,
        ok: fields.ok,
        error_message: fields.error_message ?? null,
      });
      if (logError) {
        console.error('cms_publish_log insert failed:', logError.message);
      }
    };

    const hook = Deno.env.get('CI_DEPLOY_HOOK');
    if (hook) {
      const hookRes = await fetch(hook, { method: 'POST' });
      if (!hookRes.ok) {
        await logPublish({
          mode: 'deploy_hook',
          ok: false,
          error_message: `CI_DEPLOY_HOOK error ${hookRes.status}`,
        });
        throw new Error(`CI_DEPLOY_HOOK error ${hookRes.status}`);
      }
      await logPublish({ mode: 'deploy_hook', ok: true });
      return ok(origin, { mode: 'deploy_hook', reason });
    }

    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const repository = Deno.env.get('GITHUB_REPOSITORY');
    // Must match deploy-prod.yml repository_dispatch.types (default: trigger-rebuild).
    const eventType = Deno.env.get('GITHUB_DISPATCH_EVENT') ?? 'trigger-rebuild';
    if (!githubToken || !repository) {
      await logPublish({
        mode: 'unconfigured',
        ok: false,
        error_message: 'Configurar CI_DEPLOY_HOOK o GITHUB_TOKEN + GITHUB_REPOSITORY',
      });
      return badRequest('Configurar CI_DEPLOY_HOOK o GITHUB_TOKEN + GITHUB_REPOSITORY', origin);
    }

    const dispatchRes = await fetch(`https://api.github.com/repos/${repository}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          reason,
          requested_by: auth.email ?? auth.userId ?? 'unknown',
          requested_at: new Date().toISOString(),
        },
      }),
    });
    if (!dispatchRes.ok) {
      await logPublish({
        mode: 'repository_dispatch',
        ok: false,
        error_message: `repository_dispatch error ${dispatchRes.status}`,
      });
      throw new Error(`repository_dispatch error ${dispatchRes.status}`);
    }

    await logPublish({ mode: 'repository_dispatch', ok: true });
    return ok(origin, { mode: 'repository_dispatch', event_type: eventType });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'trigger-rebuild error', origin);
  }
});

function ok(origin: string | null, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}
