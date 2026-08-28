/**
 * Verifica NIT (formato + DV) e importa datos del contribuyente desde DIAN
 * (proveedor configurado: verifik|coresoft|generic). No usa Siigo ni clientes locales.
 *
 * Auth: JWT admin (ventas|operaciones+) o service_role.
 * Body: { nit: string, tipo_documento?: 'NIT'|'CC'|... }
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { consultarContribuyentePorNit } from '../_shared/dian-nit-lookup.ts';
import type { TipoDocumentoFiscal } from '../_shared/nit-verificacion.ts';

const ROLES = new Set(['owner', 'admin', 'ventas', 'operaciones']);

interface Body {
  nit?: string;
  tipo_documento?: string;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const supabase = getServerSupabase();
  const auth = await requireAdmin(supabase, req.headers.get('authorization'), ROLES);
  if (!auth.ok) return unauthorized(origin);

  const body = (await req.json().catch(() => ({}))) as Body;
  const nit = String(body.nit ?? '').trim();
  if (!nit) return badRequest('nit requerido', origin);

  const tipoRaw = String(body.tipo_documento ?? 'NIT').toUpperCase();
  const tipo = (
    ['NIT', 'CC', 'CE', 'PP', 'OTRO'].includes(tipoRaw) ? tipoRaw : 'NIT'
  ) as TipoDocumentoFiscal;

  const resultado = await consultarContribuyentePorNit({ nit, tipo_documento: tipo });

  return new Response(JSON.stringify(resultado), {
    status: resultado.verificacion.ok ? 200 : 422,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
});
