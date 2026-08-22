/**
 * CMS comercial: comparte un subconjunto del catalogo (productos) con un
 * contacto externo (persona/centro medico) por email o WhatsApp (link
 * `wa.me`, sin Business API), registra el envio + snapshot de productos,
 * y sincroniza el contacto/nota en Twenty CRM (best-effort, nunca bloquea
 * la respuesta al usuario mas de lo necesario).
 *
 * Rutas (todas requieren `Authorization: Bearer <jwt>` de un admin_profiles
 * activo con rol ventas|admin|owner):
 *   POST /comercial-share                     -> crear envio
 *   POST /comercial-share?action=retry&id=<id> -> reintentar sync CRM
 *   GET  /comercial-share?id=<id>              -> detalle de un envio
 *   GET  /comercial-share                      -> lista paginada
 *       (?page=1&pageSize=20, admin/owner ven todos, ventas solo los suyos)
 *       (incluye comercial_nombre desde admin_profiles)
 *   DELETE /comercial-share?id=<id>           -> borrar envio (solo admin|owner)
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import {
  badRequest,
  errorResponse,
  internalError,
  notFound,
  unauthorized,
} from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { enviarEmailPlantilla, escapeHtml } from '../_shared/email.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import { normalizeE164, maskPhone } from '../_shared/phone.ts';
import { buildProductListHtml, buildProductListText } from '../_shared/comercial-templates.ts';
import { TwentyClient, retryShareWithTwenty, syncShareWithTwenty } from '../_shared/twenty-crm.ts';

const FN_NAME = 'comercial-share';

type ComercialRol = 'ventas' | 'admin' | 'owner';
const ALLOWED_ROLES = new Set<ComercialRol>(['ventas', 'admin', 'owner']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SITE_URL = 'https://i-me.com.co';

// Copia liviana (solo lectura) de la agrupacion UI de especialidades — la
// fuente canonica para el frontend vive en src/lib/comercial-cms.ts
// (SPECIALTY_GROUPS), pero las Edge Functions (Deno) no importan de src/
// (runtime distinto, deploy independiente). Mantener sincronizados a mano
// si se agregan/renombran familias en taxonomia-catalogo.ts.
const SPECIALTY_BY_FAMILY_SLUG: Record<string, string> = {
  monitores: 'Diagnóstico y monitoreo',
  cardiologia: 'Diagnóstico y monitoreo',
  ultrasonido: 'Diagnóstico y monitoreo',
  radiologia: 'Diagnóstico y monitoreo',
  imagenologia: 'Diagnóstico y monitoreo',
  anestesia: 'Terapia y soporte vital',
  'soluciones-iv': 'Terapia y soporte vital',
  neonatologia: 'Terapia y soporte vital',
  'sala-cirugia': 'Quirófano y cuidado crítico',
  mobiliario: 'Infraestructura clínica',
};

interface ShareBody {
  channel?: 'email' | 'whatsapp';
  recipientName?: string;
  medicalCenterName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  phoneCountryCode?: string;
  productIds?: string[];
  message?: string;
  campaign?: string;
  messageOnly?: boolean;
  consentContact?: boolean;
  idempotencyKey?: string;
}

interface AdminProfileRow {
  user_id: string;
  email: string;
  rol: string;
  activo: boolean;
  nombre: string | null;
  telefono: string | null;
}

interface ProductoTaxonomiaRow {
  id: string;
  slug: string;
  nombre_es: string;
  sku: string | null;
  tipo_comercial: string;
  familias: { nombre_es: string; slug: string } | null;
  tipos: { nombre_es: string; slug: string } | null;
}

interface ProductSnapshot {
  product_id: string;
  product_name_snapshot: string;
  product_slug_snapshot: string;
  product_url_snapshot: string;
  product_sku_snapshot: string | null;
  specialty_snapshot: string | null;
  family_snapshot: string | null;
  subfamily_snapshot: string | null;
  section_snapshot: string;
}

interface ShareRow {
  id: string;
  user_id: string;
  recipient_name: string;
  medical_center_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  phone_country_code: string | null;
  channel: 'email' | 'whatsapp';
  message: string | null;
  status: string;
  crm_sync_status: string;
  crm_record_id: string | null;
  crm_person_id: string | null;
  crm_company_id: string | null;
  whatsapp_url: string | null;
  idempotency_key: string | null;
  created_at: string;
  sent_at: string | null;
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;

    const supabase = getServerSupabase();

    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return unauthorized(origin);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);

    const { data: profileData, error: profileError } = await supabase
      .from('admin_profiles')
      .select('user_id, email, rol, activo, nombre, telefono')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) return internalError(profileError.message, origin);

    const profile = profileData as AdminProfileRow | null;
    if (!profile || !profile.activo || !ALLOWED_ROLES.has(profile.rol as ComercialRol)) {
      return errorResponse(
        { code: 'FORBIDDEN', message: 'Tu usuario no tiene permiso para el CMS comercial.' },
        403,
        origin
      );
    }

    const url = new URL(req.url);

    try {
      if (req.method === 'GET') {
        const action = url.searchParams.get('action');
        if (action === 'status') {
          return await handleTwentyStatus(supabase, origin);
        }
        const id = url.searchParams.get('id');
        if (id) return await handleGetDetail(supabase, profile, id, origin);
        return await handleGetList(supabase, profile, url, origin);
      }

      if (req.method === 'POST') {
        const action = url.searchParams.get('action');
        if (action === 'retry') {
          const id = url.searchParams.get('id');
          if (!id) return badRequest('id es obligatorio para action=retry', origin);
          return await handleRetry(supabase, profile, id, origin);
        }
        return await handleCreate(req, supabase, profile, origin);
      }

      if (req.method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return badRequest('id es obligatorio', origin);
        return await handleDelete(supabase, profile, id, origin);
      }

      return badRequest('Metodo no soportado', origin);
    } catch (err) {
      return internalError(
        err instanceof Error ? err.message : `${FN_NAME}: error desconocido`,
        origin
      );
    }
  })
);

// ── Crear envio ────────────────────────────────────────────────

async function handleCreate(
  req: Request,
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  origin: string | null
): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as ShareBody;

  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 200)
      : null;

  // Idempotencia: mismo key + envío exitoso → devolver tal cual.
  // Si falló/draft → liberar clave y permitir reintento comercial real.
  if (idempotencyKey) {
    const { data: existente } = await supabase
      .from('commercial_shares')
      .select('id, status, whatsapp_url, crm_sync_status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existente) {
      const row = existente as Pick<ShareRow, 'id' | 'status' | 'whatsapp_url' | 'crm_sync_status'>;
      const terminalOk = new Set(['sent', 'prepared', 'queued', 'opened', 'delivered', 'read']);
      if (terminalOk.has(row.status)) {
        return jsonResponse(
          {
            shareId: row.id,
            status: row.status,
            whatsappUrl: row.whatsapp_url ?? undefined,
            crmSyncStatus: row.crm_sync_status,
            idempotent: true,
          },
          origin
        );
      }
      // Liberar UNIQUE para reintento (failed/draft/otros).
      await supabase.from('commercial_shares').update({ idempotency_key: null }).eq('id', row.id);
    }
  }

  const limite = await checkRateLimit(
    supabase,
    `comercial-share:user:${profile.user_id}`,
    'comercial-share'
  );
  if (limite.limited) {
    return new Response(
      JSON.stringify({
        error: { code: 'RATE_LIMITED', message: 'Demasiados envios, intenta mas tarde.' },
      }),
      { status: 429, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }

  const channel =
    body.channel === 'whatsapp' ? 'whatsapp' : body.channel === 'email' ? 'email' : null;
  if (!channel) return badRequest('channel debe ser "email" o "whatsapp"', origin);

  const recipientName = (body.recipientName ?? '').trim().slice(0, 200);
  if (!recipientName) return badRequest('recipientName es obligatorio', origin);

  const medicalCenterName = (body.medicalCenterName ?? '').trim().slice(0, 200) || null;
  const message = (body.message ?? '').trim().slice(0, 4000);

  if (body.consentContact !== true) {
    return badRequest('consentContact es obligatorio para contactar a un tercero', origin);
  }

  const productIds = Array.isArray(body.productIds)
    ? [
        ...new Set(
          body.productIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        ),
      ].slice(0, 50)
    : [];
  if (productIds.length === 0) return badRequest('productIds no puede estar vacio', origin);

  let recipientEmail: string | null = null;
  let recipientPhoneE164: string | null = null;
  const phoneCountryCode = (body.phoneCountryCode ?? '57').trim().slice(0, 4) || '57';

  if (channel === 'email') {
    recipientEmail = (body.recipientEmail ?? '').trim().slice(0, 200);
    if (!EMAIL_RE.test(recipientEmail)) return badRequest('recipientEmail invalido', origin);
  } else {
    const normalized = normalizeE164(body.recipientPhone, phoneCountryCode);
    if (!normalized.ok || !normalized.e164) {
      return badRequest(normalized.error ?? 'recipientPhone invalido', origin);
    }
    recipientPhoneE164 = normalized.e164;
  }

  const { data: productosData, error: productosError } = await supabase
    .from('productos')
    .select(
      'id, slug, nombre_es, sku, tipo_comercial, familias(nombre_es, slug), tipos(nombre_es, slug)'
    )
    .in('id', productIds)
    .eq('activo', true);
  if (productosError) return internalError(productosError.message, origin);

  const productos = (productosData ?? []) as unknown as ProductoTaxonomiaRow[];
  if (productos.length === 0) {
    return badRequest('Ningun producto valido encontrado para productIds', origin);
  }

  const siteUrl = (Deno.env.get('SITE_URL') ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
  const snapshots: ProductSnapshot[] = productos.map(p => ({
    product_id: p.id,
    product_name_snapshot: p.nombre_es,
    product_slug_snapshot: p.slug,
    product_url_snapshot: `${siteUrl}/es/productos/${p.slug}/`,
    product_sku_snapshot: p.sku ?? null,
    specialty_snapshot: p.familias?.slug
      ? (SPECIALTY_BY_FAMILY_SLUG[p.familias.slug] ?? null)
      : null,
    family_snapshot: p.familias?.nombre_es ?? null,
    subfamily_snapshot: p.tipos?.nombre_es ?? null,
    section_snapshot: p.tipo_comercial,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('commercial_shares')
    .insert({
      user_id: profile.user_id,
      recipient_name: recipientName,
      medical_center_name: medicalCenterName,
      recipient_email: recipientEmail,
      recipient_phone: recipientPhoneE164,
      phone_country_code: phoneCountryCode,
      channel,
      message: message || null,
      status: 'draft',
      crm_sync_status: 'pending',
      consent_contact: true,
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    // Carrera: dos requests pasan el check y chocan UNIQUE → devolver existente.
    if (idempotencyKey && /duplicate|unique/i.test(insertError?.message ?? '')) {
      const { data: raced } = await supabase
        .from('commercial_shares')
        .select('id, status, whatsapp_url, crm_sync_status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (raced) {
        const row = raced as Pick<ShareRow, 'id' | 'status' | 'whatsapp_url' | 'crm_sync_status'>;
        return jsonResponse(
          {
            shareId: row.id,
            status: row.status,
            whatsappUrl: row.whatsapp_url ?? undefined,
            crmSyncStatus: row.crm_sync_status,
            idempotent: true,
          },
          origin
        );
      }
    }
    return internalError(insertError?.message ?? 'No se pudo crear el envio', origin);
  }
  const shareId = (inserted as { id: string }).id;

  const { error: productsInsertError } = await supabase.from('commercial_share_products').insert(
    snapshots.map(s => ({
      commercial_share_id: shareId,
      product_id: s.product_id,
      product_name_snapshot: s.product_name_snapshot,
      product_slug_snapshot: s.product_slug_snapshot,
      product_url_snapshot: s.product_url_snapshot,
      product_sku_snapshot: s.product_sku_snapshot,
      specialty_snapshot: s.specialty_snapshot,
      family_snapshot: s.family_snapshot,
      subfamily_snapshot: s.subfamily_snapshot,
      section_snapshot: s.section_snapshot,
    }))
  );
  if (productsInsertError) {
    console.error(
      `${FN_NAME}: error insertando commercial_share_products`,
      productsInsertError.message
    );
  }

  const nombreComercial = profile.nombre || profile.email;

  let status: string;
  let whatsappUrl: string | null = null;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let sentAt: string | null = null;

  if (channel === 'email') {
    const vars = {
      nombre_destinatario: escapeHtml(recipientName),
      nombre_comercial: escapeHtml(nombreComercial),
      centro_medico: escapeHtml(medicalCenterName ?? ''),
      mensaje: escapeHtml(message || '(sin mensaje adicional)'),
      lista_productos_html: buildProductListHtml(
        snapshots.map(s => ({
          nombre: s.product_name_snapshot,
          url: s.product_url_snapshot,
          sku: s.product_sku_snapshot,
        })),
        escapeHtml
      ),
      correo_comercial: escapeHtml(profile.email),
      telefono_comercial: escapeHtml(profile.telefono ?? ''),
    };
    const envio = await enviarEmailPlantilla(
      supabase,
      'comercial_catalogo',
      [recipientEmail as string],
      vars,
      shareId,
      [],
      body.campaign === 'acise2026'
        ? {
            subjectOverride:
              'Gracias por conocernos en ACISE | Información de los equipos seleccionados',
          }
        : undefined
    );
    if (envio.ok) {
      status = 'sent';
      sentAt = new Date().toISOString();
    } else {
      status = 'failed';
      errorCode = 'EMAIL_SEND_FAILED';
      errorMessage = envio.detalle ?? 'Fallo el envio del email';
    }
  } else {
    const textoPlano = body.messageOnly
      ? `Hola ${recipientName}, soy ${nombreComercial}, asesor comercial de I-ME | International Medical Enterprise.\n\n${message || ''}`
      : `Hola ${recipientName}, soy ${nombreComercial} de I-ME.\n` +
        `${message || ''}\n\n` +
        `Te comparto estos productos de nuestro catalogo:\n${buildProductListText(
          snapshots.map(s => ({
            nombre: s.product_name_snapshot,
            url: s.product_url_snapshot,
            sku: s.product_sku_snapshot,
          }))
        )}\n\n` +
        `Cualquier duda, quedo atento(a). ${profile.telefono ?? ''}`;
    whatsappUrl = `https://wa.me/${(recipientPhoneE164 as string).replace('+', '')}?text=${encodeURIComponent(
      textoPlano.trim()
    )}`;
    // WhatsApp modo link: el mensaje no se "envia" desde el servidor, solo se
    // prepara el enlace para que el comercial lo abra. Nunca marcar 'sent'.
    status = 'prepared';
  }

  // Sincronizacion con Twenty CRM — best-effort, nunca bloquea el resultado
  // principal del envio (email ya enviado / link de WhatsApp ya generado).
  const twenty = await syncShareWithTwenty(
    {
      recipientName,
      medicalCenterName,
      recipientEmail,
      recipientPhoneE164,
      phoneCountryCode,
      message,
      channel,
      commercialName: nombreComercial,
      commercialEmail: profile.email,
    },
    snapshots.map(s => ({
      name: s.product_name_snapshot,
      sku: s.product_sku_snapshot,
      url: s.product_url_snapshot,
      family: s.family_snapshot,
      specialty: s.specialty_snapshot,
    }))
  );

  const crmSyncStatus = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';
  // Si el canal principal (email) no fallo, pero CRM si, dejar rastro en
  // error_* sin pisar un EMAIL_SEND_FAILED ya registrado.
  if (!twenty.ok && !twenty.skipped && !errorCode) {
    errorCode = 'CRM_SYNC_FAILED';
    errorMessage = twenty.error?.slice(0, 500) ?? 'Fallo la sincronizacion con Twenty CRM';
  }

  const { error: updateError } = await supabase
    .from('commercial_shares')
    .update({
      status,
      whatsapp_url: whatsappUrl,
      error_code: errorCode,
      error_message: errorMessage,
      sent_at: sentAt,
      crm_sync_status: crmSyncStatus,
      crm_person_id: twenty.data?.personId ?? null,
      crm_company_id: twenty.data?.companyId ?? null,
      crm_record_id: twenty.data?.noteId ?? null,
    })
    .eq('id', shareId);
  if (updateError) {
    console.error(`${FN_NAME}: error actualizando resultado de envio`, updateError.message);
  }

  await insertAuditLog(supabase, profile.user_id, 'share_created', 'commercial_shares', shareId, {
    channel,
    status,
    crm_sync_status: crmSyncStatus,
    products_count: snapshots.length,
    recipient_email_masked: recipientEmail
      ? recipientEmail.replace(/(?<=.).(?=[^@]*@)/g, '*')
      : null,
    recipient_phone_masked: recipientPhoneE164 ? maskPhone(recipientPhoneE164) : null,
  });

  void trackEvent(FN_NAME, 'comercial_share_creado', {
    channel,
    status,
    crm_sync_status: crmSyncStatus,
    products_count: snapshots.length,
  });

  return jsonResponse(
    {
      shareId,
      status,
      whatsappUrl: whatsappUrl ?? undefined,
      crmSyncStatus,
    },
    origin
  );
}

// ── Detalle ────────────────────────────────────────────────────

async function handleGetDetail(
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  const { data, error } = await supabase
    .from('commercial_shares')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return internalError(error.message, origin);
  const share = data as ShareRow | null;
  if (!share) return notFound(origin);
  if (!canAccessShare(profile, share)) {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'No tienes acceso a este envio.' },
      403,
      origin
    );
  }

  const { data: productsData, error: productsError } = await supabase
    .from('commercial_share_products')
    .select('*')
    .eq('commercial_share_id', id);
  if (productsError) return internalError(productsError.message, origin);

  return jsonResponse({ share, products: productsData ?? [] }, origin);
}

// ── Lista paginada ──────────────────────────────────────────────

async function handleGetList(
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  url: URL,
  origin: string | null
): Promise<Response> {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);

  const isAdminOrOwner = profile.rol === 'admin' || profile.rol === 'owner';

  let scopedQuery = supabase.from('commercial_shares').select('*', { count: 'exact' });
  if (!isAdminOrOwner) scopedQuery = scopedQuery.eq('user_id', profile.user_id);
  if (q) {
    const safe = q
      .replace(/[%_,.()"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (safe) {
      const like = `"%${safe}%"`;
      scopedQuery = scopedQuery.or(
        `recipient_name.ilike.${like},medical_center_name.ilike.${like},recipient_email.ilike.${like},recipient_phone.ilike.${like}`
      );
    }
  }

  const { data, error, count } = await scopedQuery
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return internalError(error.message, origin);

  const shares = (data ?? []) as ShareRow[];
  const userIds = [...new Set(shares.map(s => s.user_id).filter(Boolean))];
  const nombreByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('admin_profiles')
      .select('user_id, nombre, email')
      .in('user_id', userIds);
    if (profilesError) return internalError(profilesError.message, origin);
    for (const p of profiles ?? []) {
      const row = p as { user_id: string; nombre: string | null; email: string | null };
      const label = String(row.nombre ?? '').trim() || String(row.email ?? '').trim() || '—';
      nombreByUser.set(row.user_id, label);
    }
  }

  return jsonResponse(
    {
      shares: shares.map(s => ({
        ...s,
        comercial_nombre: nombreByUser.get(s.user_id) ?? '—',
      })),
      page,
      pageSize,
      total: count ?? 0,
      q: q || undefined,
    },
    origin
  );
}

// ── Borrar envio (admin/owner) ─────────────────────────────────

async function handleDelete(
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  if (profile.rol !== 'admin' && profile.rol !== 'owner') {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'Solo administradores pueden borrar envios de info.' },
      403,
      origin
    );
  }
  const { data, error } = await supabase
    .from('commercial_shares')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) return internalError(error.message, origin);
  if (!data) return notFound(origin);

  const { error: delError } = await supabase.from('commercial_shares').delete().eq('id', id);
  if (delError) return internalError(delError.message, origin);
  return jsonResponse({ ok: true, deleted: id }, origin);
}

// ── Reintento de sincronizacion CRM ─────────────────────────────

async function handleRetry(
  supabase: ReturnType<typeof getServerSupabase>,
  profile: AdminProfileRow,
  id: string,
  origin: string | null
): Promise<Response> {
  const { data, error } = await supabase
    .from('commercial_shares')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return internalError(error.message, origin);
  const share = data as ShareRow | null;
  if (!share) return notFound(origin);
  if (!canAccessShare(profile, share)) {
    return errorResponse(
      { code: 'FORBIDDEN', message: 'No tienes acceso a este envio.' },
      403,
      origin
    );
  }

  const { data: productsData, error: productsError } = await supabase
    .from('commercial_share_products')
    .select(
      'product_name_snapshot, product_sku_snapshot, product_url_snapshot, family_snapshot, specialty_snapshot'
    )
    .eq('commercial_share_id', id);
  if (productsError) return internalError(productsError.message, origin);

  const productos = (productsData ?? []) as Array<{
    product_name_snapshot: string;
    product_sku_snapshot: string | null;
    product_url_snapshot: string | null;
    family_snapshot: string | null;
    specialty_snapshot: string | null;
  }>;

  const { data: ownerProfile } = await supabase
    .from('admin_profiles')
    .select('nombre, email')
    .eq('user_id', share.user_id)
    .maybeSingle();
  const owner = ownerProfile as { nombre: string | null; email: string | null } | null;

  const twenty = await retryShareWithTwenty(
    {
      recipientName: share.recipient_name,
      medicalCenterName: share.medical_center_name,
      recipientEmail: share.recipient_email,
      recipientPhoneE164: share.recipient_phone,
      phoneCountryCode: share.phone_country_code,
      message: share.message,
      channel: share.channel,
      commercialName: owner?.nombre?.trim() || owner?.email || null,
      commercialEmail: owner?.email ?? null,
    },
    productos.map(p => ({
      name: p.product_name_snapshot,
      sku: p.product_sku_snapshot,
      url: p.product_url_snapshot,
      family: p.family_snapshot,
      specialty: p.specialty_snapshot,
    })),
    {
      personId: share.crm_person_id,
      companyId: share.crm_company_id,
      noteId: share.crm_record_id,
    }
  );

  const crmSyncStatus = twenty.skipped ? 'skipped' : twenty.ok ? 'synced' : 'failed';

  const { error: updateError } = await supabase
    .from('commercial_shares')
    .update({
      crm_sync_status: crmSyncStatus,
      crm_person_id: twenty.data?.personId ?? share.crm_person_id,
      crm_company_id: twenty.data?.companyId ?? share.crm_company_id,
      crm_record_id: twenty.data?.noteId ?? share.crm_record_id,
      error_code: twenty.ok || twenty.skipped ? null : 'CRM_SYNC_FAILED',
      error_message: twenty.ok || twenty.skipped ? null : (twenty.error ?? null),
    })
    .eq('id', id);
  if (updateError) return internalError(updateError.message, origin);

  await insertAuditLog(supabase, profile.user_id, 'crm_retry', 'commercial_shares', id, {
    crm_sync_status: crmSyncStatus,
  });

  return jsonResponse({ shareId: id, crmSyncStatus }, origin);
}

// ── Estado Twenty CRM (sin exponer secretos) ─────────────────────

async function handleTwentyStatus(
  supabase: ReturnType<typeof getServerSupabase>,
  origin: string | null
): Promise<Response> {
  const configured = Boolean(
    Deno.env.get('TWENTY_BASE_URL')?.trim() && Deno.env.get('TWENTY_API_KEY')?.trim()
  );
  const { count: pendingCount } = await supabase
    .from('commercial_shares')
    .select('id', { count: 'exact', head: true })
    .eq('crm_sync_status', 'pending');
  const { count: failedCount } = await supabase
    .from('commercial_shares')
    .select('id', { count: 'exact', head: true })
    .eq('crm_sync_status', 'failed');

  let connectivity: 'ok' | 'error' | 'unconfigured' = 'unconfigured';
  let detail: string | undefined;
  if (configured) {
    const client = TwentyClient.fromEnv();
    if (!client) {
      connectivity = 'unconfigured';
    } else {
      // Petición mínima de conectividad. No encontrar la empresa es OK (API viva).
      const probe = await client.findCompanyByName('__ime_healthcheck__');
      connectivity = probe.ok ? 'ok' : 'error';
      if (!probe.ok) detail = probe.error ?? 'No se pudo contactar Twenty CRM';
    }
  }

  return jsonResponse(
    {
      twenty: {
        configured,
        connectivity,
        detail: connectivity === 'error' ? detail : undefined,
        whatsappMode: Deno.env.get('WHATSAPP_MODE')?.trim() || 'link',
      },
      queue: {
        pending: pendingCount ?? 0,
        failed: failedCount ?? 0,
      },
    },
    origin
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function canAccessShare(profile: AdminProfileRow, share: ShareRow): boolean {
  if (profile.rol === 'admin' || profile.rol === 'owner') return true;
  return share.user_id === profile.user_id;
}

async function insertAuditLog(
  supabase: ReturnType<typeof getServerSupabase>,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.from('commercial_audit_log').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
    if (error) console.error(`${FN_NAME}: error insertando audit log`, error.message);
  } catch (err) {
    console.error(
      `${FN_NAME}: excepcion insertando audit log`,
      err instanceof Error ? err.message : err
    );
  }
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
