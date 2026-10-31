import { esTokenWorkerHermes } from '../_shared/imeia-route.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

const COMANDO =
  /^\s*RESPALDO(?:\s+(ON|OFF|ESTADO)(?:\s+([0-9]+(?:[.,][0-9]+)?)H?)?)?\s*$/i;
const ORIGENES_MANUAL = new Set(['grok-tablon', 'hermes', 'telegram', 'cli']);
const ORIGENES_LATIDO = new Set([...ORIGENES_MANUAL, 'emilio', 'rutina']);
const ESTADOS = new Set(['ok', 'fallo', 'sin_tokens']);

function mismoSecreto(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function secretoConfigurado(valor: string | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio.length >= 16 ? limpio : null;
}

function parseComando(texto: string): { accion: 'on' | 'off' | 'estado'; horas: number | null } {
  if (!/^\s*RESPALDO\b/i.test(texto)) throw new Error('no es comando');
  const match = COMANDO.exec(texto);
  const verbo = match?.[1];
  if (!match || !verbo) throw new Error('comando invalido');
  const accion = verbo.toLowerCase() as 'on' | 'off' | 'estado';
  const horasTxt = match[2];
  if (horasTxt && accion !== 'on') throw new Error('horas solo en ON');
  if (!horasTxt) return { accion, horas: null };
  const horas = Number(horasTxt.replace(',', '.'));
  if (!(horas > 0) || horas > 72) throw new Error('horas fuera de rango');
  return { accion, horas };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function estadoHttp(error: { message?: string; code?: string }): number {
  const message = error.message ?? '';
  if (error.code === '42501' || /unauthorized/i.test(message)) return 401;
  if (/does not exist|schema cache|Could not find the function/i.test(message)) return 503;
  return 400;
}

Deno.serve(async req => {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ ok: false }, 405);
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (bearer.length < 16) return json({ ok: false, error: 'unauthorized' }, 401);

  const supabase = getServerSupabase();
  const webhook = secretoConfigurado(Deno.env.get('IMEIA_AGENT_WEBHOOK_KEY'));
  const service = secretoConfigurado(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const conSecreto =
    (webhook !== null && mismoSecreto(bearer, webhook)) ||
    (service !== null && mismoSecreto(bearer, service));
  if (!conSecreto && !(await esTokenWorkerHermes(supabase, bearer))) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const tokenRpc = conSecreto ? '' : bearer;
  const rpc = async (nombre: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(nombre, { ...args, p_token: tokenRpc });
    if (error) {
      const status = estadoHttp(error);
      const code =
        status === 401 ? 'unauthorized' : status === 503 ? 'migracion_pendiente' : 'peticion_invalida';
      return json({ ok: false, error: code }, status);
    }
    return json({ ok: true, data }, 200);
  };

  if (req.method === 'GET') return rpc('imeia_respaldo_pull', {});

  const raw = await req.text();
  if (raw.length > 8000) return json({ ok: false, error: 'peticion_invalida' }, 400);

  try {
    const input = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return json({ ok: false, error: 'peticion_invalida' }, 400);
    }
    const accion = input.accion;
    if (accion === 'estado') return rpc('imeia_respaldo_pull', {});
    if (accion === 'latido') {
      const estado = input.estado;
      const quien = input.quien;
      const origen = input.origen;
      if (typeof estado !== 'string' || !ESTADOS.has(estado)) return json({ ok: false, error: 'peticion_invalida' }, 400);
      if (typeof quien !== 'string' || typeof origen !== 'string' || !ORIGENES_LATIDO.has(origen)) {
        return json({ ok: false, error: 'peticion_invalida' }, 400);
      }
      return rpc('imeia_latido_registrar', {
        p_estado: estado,
        p_quien: quien,
        p_origen: origen,
        p_detalle: typeof input.detalle === 'string' ? input.detalle : null,
        p_utc: typeof input.utc === 'string' ? input.utc : null,
      });
    }
    if (accion === 'expirar') {
      if (typeof input.quien !== 'string' || typeof input.origen !== 'string') {
        return json({ ok: false, error: 'peticion_invalida' }, 400);
      }
      return rpc('imeia_respaldo_expirar', { p_quien: input.quien, p_origen: input.origen });
    }
    let comando: 'on' | 'off' | 'estado' | null = null;
    let horas: number | null = null;
    if (accion === 'comando') {
      if (typeof input.texto !== 'string') return json({ ok: false, error: 'peticion_invalida' }, 400);
      const parsed = parseComando(input.texto);
      comando = parsed.accion;
      horas = parsed.horas;
    } else if (accion === 'manual') {
      if (input.comando === 'on' || input.comando === 'off' || input.comando === 'estado') comando = input.comando;
      if (typeof input.horas === 'number') horas = input.horas;
    }
    if (comando === 'estado') return rpc('imeia_respaldo_pull', {});
    if (comando !== 'on' && comando !== 'off') return json({ ok: false, error: 'peticion_invalida' }, 400);
    if (typeof input.quien !== 'string' || typeof input.origen !== 'string' || !ORIGENES_MANUAL.has(input.origen)) {
      return json({ ok: false, error: 'peticion_invalida' }, 400);
    }
    return rpc('imeia_respaldo_set', {
      p_accion: comando,
      p_quien: input.quien,
      p_motivo: typeof input.motivo === 'string' ? input.motivo : '',
      p_origen: input.origen,
      ...(horas === null ? {} : { p_horas: horas }),
    });
  } catch {
    return json({ ok: false, error: 'peticion_invalida' }, 400);
  }
});
