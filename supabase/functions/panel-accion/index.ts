/**
 * panel-accion: verifica JWT de admin/owner y ejecuta la marca o el encolado.
 * service_role solo vive en el entorno de la funcion. El navegador no lo recibe.
 * No envia correo, WhatsApp ni Telegram.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import {
  ejecutarPanelAccion,
  type PanelDeps,
  type TablonPayload,
} from '../../../src/lib/panel-accion.ts';
import { PanelAccionError, accesoPanel, validarCuerpo } from '../../../src/lib/panel-reglas.ts';

const ROLES = new Set(['owner', 'admin']);

function ipDe(req: Request): string {
  const reenviada = req.headers.get('x-forwarded-for') ?? '';
  const primera = reenviada.split(',')[0]?.trim() ?? '';
  return primera || req.headers.get('cf-connecting-ip')?.trim() || '';
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const plano = String(valor).trim();
  return plano || null;
}

function payloadDe(valor: unknown): Record<string, unknown> {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor as Record<string, unknown>;
  }
  return {};
}

function depsDe(supabase: ReturnType<typeof getServerSupabase>): PanelDeps {
  return {
    async leerCotizacion(id) {
      const { data, error } = await supabase
        .from('solicitudes_cotizacion')
        .select(
          'id, numero, estado, notas_internas, send_error, aprobado_por, aprobado_at, aprobacion_tipo, aprobacion_hash, updated_at'
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw new PanelAccionError(500, 'LECTURA', error.message);
      if (!data) return null;
      const fila = data as Record<string, unknown>;
      return {
        id: String(fila.id),
        numero: texto(fila.numero),
        estado: texto(fila.estado),
        notas_internas: texto(fila.notas_internas),
        send_error: texto(fila.send_error),
        aprobado_por: texto(fila.aprobado_por),
        aprobado_at: texto(fila.aprobado_at),
        aprobacion_tipo: texto(fila.aprobacion_tipo),
        aprobacion_hash: texto(fila.aprobacion_hash),
        updated_at: texto(fila.updated_at),
      };
    },
    async aprobarCotizacion(args) {
      const { error } = await supabase.rpc('aprobar_cotizacion_envio', {
        p_id: args.id,
        p_por: args.por,
        p_tipo: args.tipo,
        p_ref: args.ref,
        p_margen: args.margen,
      });
      if (error) throw new Error(error.message);
    },
    async insertarEvento(evento) {
      const { error } = await supabase.from('panel_eventos').insert({
        tarjeta_id: evento.tarjetaId,
        tarjeta_tipo: evento.tarjetaTipo,
        accion: evento.accion,
        actor: evento.actor,
        actor_id: evento.actorId,
        actor_canal: 'admin',
        ts: evento.ts,
        resultado: evento.resultado,
        detalle: evento.detalle,
        hash: evento.hash,
        ip: evento.ip,
        version_tarjeta: evento.version,
      });
      if (error) throw new PanelAccionError(500, 'AUDITORIA', error.message);
    },
    async leerTarea(id) {
      const { data, error } = await supabase
        .from('panel_tareas')
        .select('id, tipo, titulo, ref, bot_dueno, columna, estado, payload, updated_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new PanelAccionError(500, 'LECTURA', error.message);
      if (!data) return null;
      const fila = data as Record<string, unknown>;
      return {
        id: String(fila.id),
        tipo: String(fila.tipo ?? ''),
        titulo: String(fila.titulo ?? ''),
        ref: texto(fila.ref),
        bot_dueno: texto(fila.bot_dueno),
        columna: String(fila.columna ?? ''),
        estado: String(fila.estado ?? ''),
        payload: payloadDe(fila.payload),
        updated_at: texto(fila.updated_at),
      };
    },
    async marcarTareaEnCola(id, marca) {
      const { error } = await supabase
        .from('panel_tareas')
        .update({
          columna: 'aprobado_en_cola',
          estado: 'en_cola',
          payload: marca.payload,
        })
        .eq('id', id);
      if (error) throw new PanelAccionError(500, 'COLA', error.message);
    },
    async encolarTablon(cuerpo: TablonPayload) {
      const url = Deno.env.get('PANEL_TABLON_WEBHOOK_URL')?.trim() ?? '';
      if (!url) throw new Error('PANEL_TABLON_WEBHOOK_URL no configurado');
      const secreto = Deno.env.get('PANEL_TABLON_WEBHOOK_SECRET')?.trim() ?? '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secreto) headers['X-Panel-Token'] = secreto;
      const respuesta = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(cuerpo),
      });
      if (!respuesta.ok) throw new Error(`tablon HTTP ${respuesta.status}`);
    },
  };
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return errorResponse({ code: 'METHOD', message: 'Metodo no soportado' }, 405, origin);
  }

  const supabase = getServerSupabase();
  const auth = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
  if (accesoPanel(auth) === 'forbidden') {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'Se requiere rol admin u owner' },
      403,
      origin
    );
  }
  if (!auth.ok || !auth.userId) {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'Se requiere rol admin u owner' },
      403,
      origin
    );
  }

  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return errorResponse({ code: 'BAD_REQUEST', message: 'JSON invalido' }, 400, origin);
  }

  try {
    const cuerpo = validarCuerpo(crudo);
    const resultado = await ejecutarPanelAccion(depsDe(supabase), cuerpo, {
      userId: auth.userId,
      email: auth.email ?? auth.userId,
      ip: ipDe(req),
    });
    return new Response(JSON.stringify({ ok: true, idempotente: resultado.idempotente }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  } catch (error) {
    if (error instanceof PanelAccionError) {
      return errorResponse({ code: error.code, message: error.message }, error.status, origin);
    }
    return errorResponse(
      { code: 'INTERNAL', message: 'No se pudo ejecutar la accion' },
      500,
      origin
    );
  }
});
