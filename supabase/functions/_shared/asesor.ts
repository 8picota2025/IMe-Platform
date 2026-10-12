/**
 * Perfil comercial (asesor) de las cotizaciones: quién firma el email/PDF y a
 * qué dirección responde el cliente (Reply-To).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  resolverAsesor,
  replyToPorDefecto,
  type AsesorResuelto,
} from '../../../src/lib/cotizacion-asesor.ts';

export const ROLES_COMERCIALES = new Set(['owner', 'admin', 'ventas']);

export interface PerfilComercial {
  user_id: string;
  email: string;
  rol: string;
  activo: boolean;
  nombre: string | null;
  telefono: string | null;
}

const COLUMNAS = 'user_id, email, rol, activo, nombre, telefono';

/** Reply-To configurado por entorno (COTIZACION_REPLY_TO) o comercial1@i-me.com.co. */
export function replyToConfigurado(): string {
  return replyToPorDefecto(Deno.env.get('COTIZACION_REPLY_TO'));
}

export async function perfilPorUsuario(
  supabase: SupabaseClient,
  userId: string
): Promise<PerfilComercial | null> {
  const { data } = await supabase
    .from('admin_profiles')
    .select(COLUMNAS)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as PerfilComercial | null) ?? null;
}

/**
 * Perfil de un usuario comercial para "enviar como": debe existir, estar activo y
 * tener rol ventas/admin/owner. Busca por user_id y, si no, por email.
 */
export async function perfilComercialActivo(
  supabase: SupabaseClient,
  ref: { userId?: string | null; email?: string | null }
): Promise<PerfilComercial | null> {
  let perfil: PerfilComercial | null = null;
  if (ref.userId) perfil = await perfilPorUsuario(supabase, ref.userId);
  if (!perfil && ref.email) {
    const { data } = await supabase
      .from('admin_profiles')
      .select(COLUMNAS)
      .ilike('email', String(ref.email).trim())
      .maybeSingle();
    perfil = (data as PerfilComercial | null) ?? null;
  }
  if (!perfil || !perfil.activo || !ROLES_COMERCIALES.has(perfil.rol)) return null;
  return perfil;
}

/** Asesor de un usuario (perfil CMS) con fallback a "Equipo Comercial I-ME". */
export async function asesorDeUsuario(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  respaldo?: { email?: string | null }
): Promise<AsesorResuelto> {
  const perfil = userId ? await perfilPorUsuario(supabase, userId) : null;
  return resolverAsesor(perfil ?? (respaldo?.email ? { email: respaldo.email } : null), {
    replyToEntorno: Deno.env.get('COTIZACION_REPLY_TO'),
  });
}

/**
 * Reply-To para correos al cliente derivados de una cotización: el email del
 * asesor propietario (created_by) o, si no hay, el de entorno.
 */
export async function replyToDeCotizacion(
  supabase: SupabaseClient,
  cotizacionId: string | null | undefined
): Promise<string> {
  if (!cotizacionId) return replyToConfigurado();
  const { data } = await supabase
    .from('solicitudes_cotizacion')
    .select('created_by')
    .eq('id', cotizacionId)
    .maybeSingle();
  const owner = (data as { created_by?: string | null } | null)?.created_by ?? null;
  const asesor = await asesorDeUsuario(supabase, owner);
  return asesor.replyTo;
}
