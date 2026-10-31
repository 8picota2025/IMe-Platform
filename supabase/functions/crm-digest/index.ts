/**
 * Digest comercial diario → comercial1@i-me.com.co (root@ sigue en la lista por defecto).
 * Usa TWENTY_* + MAILER_* (Resend) ya configurados en Edge secrets.
 *
 * Auth: Authorization Bearer = SUPABASE_SERVICE_ROLE_KEY o header x-crm-digest-secret
 * Cron externo: twenty-daily-crm.py o GitHub scheduled workflow.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { encolarCorreoEmilio } from '../_shared/cola-emilio.ts';

const FN_NAME = 'crm-digest';
const OWNER_ID = Deno.env.get('TWENTY_OWNER_ID')?.trim() || '';
const DIGEST_TO = (Deno.env.get('CRM_DIGEST_TO') ?? 'comercial1@i-me.com.co,root@i-me.com.co')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function twentyBase(): string | null {
  const base = Deno.env.get('TWENTY_BASE_URL')?.trim().replace(/\/+$/, '');
  const key = Deno.env.get('TWENTY_API_KEY')?.trim();
  if (!base || !key) return null;
  return base;
}

async function twentyGet(path: string): Promise<unknown> {
  const base = twentyBase();
  const key = Deno.env.get('TWENTY_API_KEY')!.trim();
  const res = await fetch(`${base}/rest${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Twenty HTTP ${res.status}`);
  return res.json();
}

function extractList(raw: unknown, key: string): Record<string, unknown>[] {
  const root = raw as Record<string, unknown>;
  const data = root?.data as Record<string, unknown> | undefined;
  const list = data?.[key] ?? root?.[key];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

async function pedirAEmilio(asunto: string, html: string, referencia: string) {
  return encolarCorreoEmilio(getServerSupabase(), {
    solicitante: 'crm-digest',
    origen: 'crm-digest',
    destinatarios: DIGEST_TO,
    asunto,
    html,
    referencia,
    remitente: Deno.env.get('MAILER_FROM') ?? 'comercial1@i-me.com.co',
  });
}

function authorized(req: Request): boolean {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const digestSecret = Deno.env.get('CRM_DIGEST_SECRET')?.trim();
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-crm-digest-secret') ?? '';
  if (service && bearer && bearer === service) return true;
  if (digestSecret && (headerSecret === digestSecret || bearer === digestSecret)) return true;
  return false;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return badRequest('POST only', origin);
  if (!authorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
  if (!twentyBase()) {
    return internalError('TWENTY_* not configured', origin);
  }

  try {
    const tasksRaw = await twentyGet('/tasks?limit=100');
    const tasks = extractList(tasksRaw, 'tasks');
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const items: string[] = [];
    for (const t of tasks) {
      if (t.status !== 'TODO') continue;
      if (OWNER_ID && t.assigneeId && t.assigneeId !== OWNER_ID) continue;
      const title = String(t.title ?? '(sin título)');
      if (title.startsWith('Agenda comercial HOY')) continue;
      const due = t.dueAt ? String(t.dueAt).slice(0, 10) : null;
      let flag = 'ABIERTA';
      if (!due) flag = 'SIN FECHA';
      else if (due < todayStr) flag = 'VENCIDA';
      else if (due === todayStr) flag = 'HOY';
      else flag = 'PROXIMA';
      items.push(
        `<li><strong>[${flag}]</strong> ${title.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string)}</li>`
      );
    }

    const subject = `I-ME Agenda comercial ${todayStr} (${items.length} tareas)`;
    const html = `
      <h2>Agenda comercial I-ME</h2>
      <p>Fecha: <strong>${todayStr}</strong> · Tareas abiertas: <strong>${items.length}</strong></p>
      <p><a href="https://crm.i-me.com.co">Abrir Twenty CRM</a></p>
      <ul>${items.slice(0, 80).join('') || '<li>(sin tareas TODO)</li>'}</ul>
      <p style="color:#666;font-size:12px">Generado por ${FN_NAME}</p>
    `;

    const pedido = await pedirAEmilio(subject, html, `crm-digest:${todayStr}`);
    const results: Record<string, string> = {};
    for (const to of DIGEST_TO) {
      results[to] = pedido.ok ? 'encolado_emilio' : pedido.detalle;
    }
    return new Response(
      JSON.stringify({
        ok: pedido.ok,
        encolado: pedido.ok,
        items: items.length,
        results,
      }),
      {
        status: pedido.ok ? 202 : 502,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error(FN_NAME, err);
    return internalError(err instanceof Error ? err.message : 'digest failed', origin);
  }
});
