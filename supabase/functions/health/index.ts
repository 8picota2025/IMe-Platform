import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { withTelemetry } from '../_shared/telemetry.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

const FN_NAME = 'health';

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Metodo no soportado' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        }
      );
    }

    const supabase = getServerSupabase();
    const startedAt = performance.now();
    const { error } = await supabase.from('pedidos').select('id', { head: true, count: 'exact' }).limit(1);
    const dbLatencyMs = Math.round(performance.now() - startedAt);

    if (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          db: false,
          error: error.message,
          ts: new Date().toISOString(),
          db_latency_ms: dbLatencyMs,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        db: true,
        ts: new Date().toISOString(),
        db_latency_ms: dbLatencyMs,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  })
);
