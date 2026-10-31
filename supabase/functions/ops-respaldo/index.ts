import { getServerSupabase } from '../_shared/supabase-server.ts';

const COMANDO =
  /^\s*RESPALDO(?:\s+(ON|OFF|ESTADO)(?:\s+([0-9]+(?:[.,][0-9]+)?)H?)?)?\s*$/i;
const ORIGENES_MANUAL = new Set(['grok-tablon', 'hermes', 'telegram', 'cli']);
const ORIGENES_LATIDO = new Set([...ORIGENES_MANUAL, 'emilio', 'rutina']);
const ESTADOS = new Set(['ok', 'fallo', 'sin_tokens']);
const ALCANCES = ['worker', 'respaldo_lectura', 'respaldo_latido'] as const;

type Necesidad = 'pull' | 'latido' | 'worker';
type RpcError = { message?: string; code?: string; details?: string };

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

function textoError(error: RpcError): string {
  return `${error.message ?? ''} ${error.details ?? ''}`;
}

function funcionAusente(error: RpcError): boolean {
  return /does not exist|schema cache|Could not find the function/i.test(textoError(error));
}

function estadoHttp(error: RpcError): number {
  const message = textoError(error);
  if (/forbidden/i.test(message)) return 403;
  if (error.code === '42501' || /unauthorized/i.test(message)) return 401;
  if (/does not exist|schema cache|Could not find the function/i.test(message)) return 503;
  return 400;
}

function necesidadDe(method: string, input: Record<string, unknown> | null): Necesidad | 'invalida' {
  if (method === 'GET') return 'pull';
  if (!input) return 'invalida';
  const accion = input.accion;
  if (accion === 'estado') return 'pull';
  if (accion === 'latido') return 'latido';
  if (accion === 'expirar') return 'worker';
  if (accion === 'comando') {
    if (typeof input.texto !== 'string') return 'invalida';
    try {
      const parsed = parseComando(input.texto);
      return parsed.accion === 'estado' ? 'pull' : 'worker';
    } catch {
      return 'invalida';
    }
  }
  if (accion === 'manual') {
    if (input.comando === 'estado') return 'pull';
    if (input.comando === 'on' || input.comando === 'off') return 'worker';
    return 'invalida';
  }
  return 'invalida';
}

function permite(alcances: ReadonlySet<string>, necesidad: Necesidad): boolean {
  if (alcances.has('worker')) return true;
  if (necesidad === 'pull') return alcances.has('respaldo_lectura');
  if (necesidad === 'latido') return alcances.has('respaldo_latido');
  return false;
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
  if (!conSecreto && bearer.length < 32) return json({ ok: false, error: 'unauthorized' }, 401);

  let alcances: ReadonlySet<string> | 'servicio' = 'servicio';
  if (!conSecreto) {
    const consultas = await Promise.all(
      ALCANCES.map(async nombre => {
        const { data, error } = await supabase.rpc('imeia_token_alcance_ok', {
          p_token: bearer,
          p_alcance: nombre,
        });
        return { nombre, data, error: error as RpcError | null };
      }),
    );
    if (consultas.some(item => item.error && funcionAusente(item.error))) {
      return json({ ok: false, error: 'migracion_pendiente' }, 503);
    }
    const activos = new Set<string>();
    for (const item of consultas) {
      if (!item.error && item.data === true) activos.add(item.nombre);
    }
    if (activos.size === 0) return json({ ok: false, error: 'unauthorized' }, 401);
    alcances = activos;
  }

  let input: Record<string, unknown> | null = null;
  if (req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > 8000) return json({ ok: false, error: 'peticion_invalida' }, 400);
    try {
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
        return json({ ok: false, error: 'peticion_invalida' }, 400);
      }
      input = parsed as Record<string, unknown> | null;
    } catch {
      return json({ ok: false, error: 'peticion_invalida' }, 400);
    }
  }

  const necesidad = necesidadDe(req.method, input);
  if (necesidad === 'invalida') return json({ ok: false, error: 'peticion_invalida' }, 400);
  if (alcances !== 'servicio' && !permite(alcances, necesidad)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const tokenRpc = conSecreto ? '' : bearer;
  const rpc = async (nombre: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(nombre, { ...args, p_token: tokenRpc });
    if (error) {
      const status = estadoHttp(error as RpcError);
      const code =
        status === 403 ? 'forbidden'
        : status === 401 ? 'unauthorized'
        : status === 503 ? 'migracion_pendiente'
        : 'peticion_invalida';
      return json({ ok: false, error: code }, status);
    }
    return json({ ok: true, data }, 200);
  };

  if (req.method === 'GET' || input?.accion === 'estado') return rpc('imeia_respaldo_pull', {});

  const cuerpo = input ?? {};
  try {
    if (cuerpo.accion === 'latido') {
      const estado = cuerpo.estado;
      const quien = cuerpo.quien;
      const origen = cuerpo.origen;
      if (typeof estado !== 'string' || !ESTADOS.has(estado)) return json({ ok: false, error: 'peticion_invalida' }, 400);
      if (typeof quien !== 'string' || typeof origen !== 'string' || !ORIGENES_LATIDO.has(origen)) {
        return json({ ok: false, error: 'peticion_invalida' }, 400);
      }
      return rpc('imeia_latido_registrar', {
        p_estado: estado,
        p_quien: quien,
        p_origen: origen,
        p_detalle: typeof cuerpo.detalle === 'string' ? cuerpo.detalle : null,
        p_utc: typeof cuerpo.utc === 'string' ? cuerpo.utc : null,
      });
    }
    if (cuerpo.accion === 'expirar') {
      if (typeof cuerpo.quien !== 'string' || typeof cuerpo.origen !== 'string') {
        return json({ ok: false, error: 'peticion_invalida' }, 400);
      }
      return rpc('imeia_respaldo_expirar', { p_quien: cuerpo.quien, p_origen: cuerpo.origen });
    }
    let comando: 'on' | 'off' | 'estado' | null = null;
    let horas: number | null = null;
    if (cuerpo.accion === 'comando') {
      if (typeof cuerpo.texto !== 'string') return json({ ok: false, error: 'peticion_invalida' }, 400);
      const parsed = parseComando(cuerpo.texto);
      comando = parsed.accion;
      horas = parsed.horas;
    } else if (cuerpo.accion === 'manual') {
      if (cuerpo.comando === 'on' || cuerpo.comando === 'off' || cuerpo.comando === 'estado') comando = cuerpo.comando;
      if (typeof cuerpo.horas === 'number') horas = cuerpo.horas;
    }
    if (comando === 'estado') return rpc('imeia_respaldo_pull', {});
    if (comando !== 'on' && comando !== 'off') return json({ ok: false, error: 'peticion_invalida' }, 400);
    if (typeof cuerpo.quien !== 'string' || typeof cuerpo.origen !== 'string' || !ORIGENES_MANUAL.has(cuerpo.origen)) {
      return json({ ok: false, error: 'peticion_invalida' }, 400);
    }
    return rpc('imeia_respaldo_set', {
      p_accion: comando,
      p_quien: cuerpo.quien,
      p_motivo: typeof cuerpo.motivo === 'string' ? cuerpo.motivo : '',
      p_origen: cuerpo.origen,
      ...(horas === null ? {} : { p_horas: horas }),
    });
  } catch {
    return json({ ok: false, error: 'peticion_invalida' }, 400);
  }
});
