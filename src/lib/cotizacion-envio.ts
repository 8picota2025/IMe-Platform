/**
 * Validaciones del envío oficial de una cotización. Las comparten la Edge
 * Function `enviar-cotizacion` (envío real y dry-run) y el MCP `ime-comercio`
 * (preparar/confirmar), para que no diverjan.
 */
import { normalizeE164 } from '../../supabase/functions/_shared/phone.ts';
import {
  hashBytesSha256,
  normalizarOferta,
  parseLineasOferta,
  type CotizacionLineaOferta,
  type CotizacionOfertaRow,
} from './cotizacion-oferta.ts';

export type CanalEnvio = 'email' | 'whatsapp';

export interface ErrorEnvio {
  ok: false;
  code: string;
  message: string;
  status: number;
}

export interface OfertaListaParaEnviar {
  ok: true;
  lineas: CotizacionLineaOferta[];
  total: number;
  moneda: 'COP' | 'USD';
  /** Email normalizado (solo canal email). */
  email: string;
}

/**
 * Valida lo que exige `enviar-cotizacion`:
 * líneas con precio, condiciones, moneda única, y destinatario real según el canal.
 * Con `exigirPreciosFirmes` además rechaza líneas "pendiente de validar", que el
 * envío real tolera pero que nunca deben salir hacia un cliente por el MCP.
 */
export function validarEnvioCotizacion(
  row: CotizacionOfertaRow,
  opciones: { canal: CanalEnvio; exigirPreciosFirmes?: boolean }
): OfertaListaParaEnviar | ErrorEnvio {
  const lineas = parseLineasOferta(row.productos);
  const oferta = normalizarOferta(lineas, row.condiciones, row.moneda);
  if (!oferta.ok) {
    return {
      ok: false,
      code: oferta.error,
      message: 'Completa precios y condiciones antes de enviar',
      status: 422,
    };
  }
  if (opciones.exigirPreciosFirmes && oferta.lineas.some(l => l.precio_pendiente_validar)) {
    return {
      ok: false,
      code: 'PRECIO_PENDIENTE',
      message: 'Hay líneas con precio pendiente de validar; asigna un precio unitario > 0.',
      status: 422,
    };
  }
  const email = String(row.email ?? '')
    .trim()
    .toLowerCase();
  if (opciones.canal === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        ok: false,
        code: 'SIN_EMAIL',
        message: 'Cotizacion sin email de cliente',
        status: 422,
      };
    }
  } else {
    const phone = normalizeE164(String(row.telefono ?? '').trim(), '57');
    if (!phone.ok || !phone.e164) {
      return {
        ok: false,
        code: 'SIN_TELEFONO',
        message: 'Cotizacion sin telefono valido para WhatsApp.',
        status: 422,
      };
    }
  }
  return { ok: true, lineas: oferta.lineas, total: oferta.total, moneda: oferta.moneda, email };
}

/**
 * Huella (sha256) del contenido que el cliente recibiría. Se guarda al preparar el
 * envío y se vuelve a calcular al confirmar: si la oferta cambió entre la
 * aprobación humana y el envío, se rechaza.
 */
export async function huellaOferta(row: CotizacionOfertaRow): Promise<string> {
  const lineas = parseLineasOferta(row.productos).map(l => ({
    slug: l.slug,
    nombre: l.nombre,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    moneda: l.moneda,
    pendiente: Boolean(l.precio_pendiente_validar),
    notas: l.notas ?? '',
  }));
  const canonico = JSON.stringify({
    lineas,
    condiciones: String(row.condiciones ?? '').trim(),
    moneda: String(row.moneda ?? 'COP').toUpperCase(),
    validez: row.validez_hasta ?? null,
    email: String(row.email ?? '')
      .trim()
      .toLowerCase(),
    impuestos_incluidos:
      (row as { impuestos_incluidos?: boolean | null }).impuestos_incluidos ?? null,
  });
  return hashBytesSha256(new TextEncoder().encode(canonico));
}
