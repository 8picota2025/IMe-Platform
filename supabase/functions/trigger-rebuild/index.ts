/**
 * Edge Function: trigger-rebuild
 * Dispara un rebuild batched desde admin. Secretos solo server-side.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

interface RebuildRequest {
  reason?: string;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return unauthorized(origin);

  try {
    const supabase = getServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return unauthorized(origin);

    const body = (await req.json().catch(() => ({}))) as RebuildRequest;
    const hook = Deno.env.get('CI_DEPLOY_HOOK');
    if (hook) {
      const hookRes = await fetch(hook, { method: 'POST' });
      if (!hookRes.ok) throw new Error(`CI_DEPLOY_HOOK error ${hookRes.status}`);
      return ok(origin, { mode: 'deploy_hook', reason: body.reason ?? 'admin_publish_batch' });
    }

    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const repository = Deno.env.get('GITHUB_REPOSITORY');
    const eventType = Deno.env.get('GITHUB_DISPATCH_EVENT') ?? 'cms_publish';
    if (!githubToken || !repository) {
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
          reason: body.reason ?? 'admin_publish_batch',
          requested_by: user.email ?? user.id,
          requested_at: new Date().toISOString(),
        },
      }),
    });
    if (!dispatchRes.ok) throw new Error(`repository_dispatch error ${dispatchRes.status}`);

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
