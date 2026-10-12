/**
 * Identidad del asesor que firma una cotización (email y PDF) y dirección de
 * respuesta (Reply-To). Lógica pura: la usan las Edge Functions (Deno) y el MCP.
 */

export const ASESOR_NOMBRE_DEFECTO = 'Equipo Comercial I-ME';
export const REPLY_TO_DEFECTO = 'comercial1@i-me.com.co';

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export interface PerfilAsesor {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
}

export interface AsesorResuelto {
  /** Nombre visible: nunca un email en crudo. */
  nombre: string;
  /** Correo que se muestra en el cuerpo del email y en el PDF. */
  correo: string;
  telefono: string;
  /** Valor del header Reply-To. */
  replyTo: string;
  /** true si el correo salió de un perfil real (no del fallback genérico). */
  deperfil: boolean;
}

export function esEmailValido(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

/** Reply-To por defecto: variable de entorno COTIZACION_REPLY_TO o comercial1@i-me.com.co. */
export function replyToPorDefecto(valorEntorno?: string | null): string {
  const limpio = String(valorEntorno ?? '')
    .trim()
    .toLowerCase();
  return esEmailValido(limpio) ? limpio : REPLY_TO_DEFECTO;
}

/**
 * Resuelve nombre, correo, teléfono y Reply-To del asesor.
 * - Si el nombre está vacío (o es un email) → "Equipo Comercial I-ME".
 * - Si el perfil no trae email válido → Reply-To de entorno/por defecto.
 */
export function resolverAsesor(
  perfil: PerfilAsesor | null | undefined,
  opciones: { replyToEntorno?: string | null } = {}
): AsesorResuelto {
  const fallbackReplyTo = replyToPorDefecto(opciones.replyToEntorno);
  const emailPerfil = esEmailValido(perfil?.email)
    ? String(perfil?.email).trim().toLowerCase()
    : '';
  const nombreCrudo = String(perfil?.nombre ?? '').trim();
  const nombreUtil = nombreCrudo && !nombreCrudo.includes('@') ? nombreCrudo : '';
  return {
    nombre: nombreUtil || ASESOR_NOMBRE_DEFECTO,
    correo: emailPerfil || fallbackReplyTo,
    telefono: String(perfil?.telefono ?? '').trim(),
    replyTo: emailPerfil || fallbackReplyTo,
    deperfil: Boolean(emailPerfil),
  };
}
