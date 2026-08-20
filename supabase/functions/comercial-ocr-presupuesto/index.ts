/**
 * OCR de foto de presupuesto competencia → borrador en solicitudes_cotizacion
 * + imagen en storage `presupuestos-competencia` (+ espejo local opcional).
 *
 * POST /comercial-ocr-presupuesto
 * Body: { image_base64, mime?, filename? }
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { withTelemetry } from '../_shared/telemetry.ts';
import { defaultCondicionesOferta } from '../../../src/lib/condiciones-oferta.ts';
import {
  calcularTotalOfertado,
  sanitizarLineasComercial,
  type CotizacionLineaOferta,
} from '../../../src/lib/cotizacion-oferta.ts';
import { extractQuoteFromImage } from '../_shared/vision-quote-ocr.ts';

const FN_NAME = 'comercial-ocr-presupuesto';
const ALLOWED_ROLES = new Set(['ventas', 'admin', 'owner']);
const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET = 'presupuestos-competencia';

interface AdminProfileRow {
  user_id: string;
  email: string;
  rol: string;
  activo: boolean;
  nombre: string | null;
}

function json(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

async function mirrorLocal(
  bytes: Uint8Array,
  baseName: string,
  sidecar: Record<string, unknown>
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const dir = Deno.env.get('PRESUPUESTOS_COMP_DIR')?.trim();
  if (!dir) return { ok: false, error: 'PRESUPUESTOS_COMP_DIR no configurado' };
  try {
    await Deno.mkdir(dir, { recursive: true });
    const imagePath = `${dir.replace(/\/+$/, '')}/${baseName}`;
    await Deno.writeFile(imagePath, bytes);
    const jsonPath = imagePath.replace(/\.[^.]+$/, '') + '.json';
    await Deno.writeTextFile(jsonPath, JSON.stringify(sidecar, null, 2));
    return { ok: true, path: imagePath };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fallo escritura local',
    };
  }
}

function improveLines(
  extracted: CotizacionLineaOferta[],
  catalogHits: Map<string, { slug: string; precio: number; nombre: string }>
): CotizacionLineaOferta[] {
  return extracted.map(line => {
    const key = line.nombre.toLowerCase().slice(0, 40);
    let best: { slug: string; precio: number; nombre: string } | undefined;
    for (const [k, v] of catalogHits) {
      if (key.includes(k) || k.includes(key.slice(0, 12))) {
        best = v;
        break;
      }
    }
    if (best && best.precio > 0) {
      const precio = best.precio;
      return {
        ...line,
        slug: best.slug || line.slug,
        nombre: best.nombre || line.nombre,
        precio_unitario: precio,
        subtotal: Math.round(precio * line.cantidad * 100) / 100,
        notas: [
          line.notas,
          line.precio_unitario > 0
            ? `Comp. ${line.precio_unitario} → I-ME ${precio}`
            : `Precio catálogo I-ME`,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 240),
      };
    }
    // Sin match: conservar precio competencia; marcar revisión.
    const precio = line.precio_unitario;
    return {
      ...line,
      precio_unitario: precio,
      subtotal: Math.round(precio * line.cantidad * 100) / 100,
      precio_pendiente_validar: !(precio > 0) ? true : undefined,
      notas: [line.notas, 'Origen OCR competencia — revisar vs catálogo I-ME']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 240),
    };
  });
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

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
      .select('user_id, email, rol, activo, nombre')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) return internalError(profileError.message, origin);
    const profile = profileData as AdminProfileRow | null;
    if (!profile || !profile.activo || !ALLOWED_ROLES.has(profile.rol)) {
      return errorResponse({ code: 'FORBIDDEN', message: 'Sin permiso comercial.' }, 403, origin);
    }

    const rl = await checkRateLimit(supabase, `ocr-quote:${user.id}`, 'cotizacion');
    if (rl.limited) {
      return errorResponse(
        { code: 'RATE_LIMIT', message: 'Demasiados OCR. Espera un momento.' },
        429,
        origin
      );
    }

    let body: {
      image_base64?: string;
      mime?: string;
      filename?: string;
      quote_id?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return badRequest('JSON inválido', origin);
    }

    const rawB64 = String(body.image_base64 ?? '')
      .replace(/^data:[^;]+;base64,/, '')
      .replace(/\s/g, '');
    if (!rawB64 || rawB64.length < 100) {
      return badRequest('image_base64 obligatorio', origin);
    }
    let bytes: Uint8Array;
    try {
      const bin = atob(rawB64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return badRequest('image_base64 inválido', origin);
    }
    if (bytes.byteLength > MAX_BYTES) {
      return errorResponse({ code: 'IMAGE_TOO_LARGE', message: 'Imagen máx. 8 MB.' }, 413, origin);
    }

    const mime =
      String(body.mime ?? 'image/jpeg')
        .toLowerCase()
        .split(';')[0]!
        .trim() || 'image/jpeg';
    // Cliente convierte PDF/HEIC → JPEG; aceptamos image/* (no application/pdf crudo).
    if (!mime.startsWith('image/')) {
      return badRequest(
        'mime debe ser image/* (JPG/PNG/WebP). Convierte PDF en el cliente.',
        origin
      );
    }

    // Staging en Storage + URL firmada → puente moondream (túnel sin base64).
    // Evita 500 por timeout: Cloudflare cuelga al POST de imágenes a Ollama.
    const stagingPath = `ocr-inbox/${crypto.randomUUID()}.${extForMime(mime)}`;
    const { error: stageErr } = await supabase.storage
      .from(BUCKET)
      .upload(stagingPath, bytes, { contentType: mime, upsert: true });
    if (stageErr) {
      return errorResponse(
        {
          code: 'STORAGE_FAILED',
          message: `No se pudo subir imagen para OCR: ${stageErr.message}`,
        },
        502,
        origin
      );
    }
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(stagingPath, 600);
    if (signErr || !signed?.signedUrl) {
      return errorResponse(
        {
          code: 'STORAGE_FAILED',
          message: `No se pudo firmar URL OCR: ${signErr?.message ?? 'sin URL'}`,
        },
        502,
        origin
      );
    }

    let vision;
    try {
      vision = await extractQuoteFromImage(rawB64, mime, { imageUrl: signed.signedUrl });
    } catch (err) {
      return errorResponse(
        {
          code: 'OCR_FAILED',
          message: err instanceof Error ? err.message : 'No se pudo analizar la imagen',
        },
        502,
        origin
      );
    }

    const extract = vision.extract;
    if (extract.productos.length === 0 && !extract.cliente_nombre && !extract.cliente_empresa) {
      return errorResponse(
        {
          code: 'OCR_EMPTY',
          message: 'No se detectaron datos útiles. Prueba otra foto más nítida.',
        },
        422,
        origin
      );
    }

    // Typeahead catálogo para mejorar precios I-ME.
    const catalogHits = new Map<string, { slug: string; precio: number; nombre: string }>();
    for (const p of extract.productos.slice(0, 12)) {
      const q = p.nombre.slice(0, 48).replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim();
      if (q.length < 2) continue;
      const { data: hits } = await supabase
        .from('productos')
        .select('slug,nombre_es,precio,precio_oferta,precio_regular,moneda')
        .eq('activo', true)
        .or(`nombre_es.ilike.%${q}%,sku.ilike.%${q}%,slug.ilike.%${q}%`)
        .limit(3);
      const hit = (hits ?? [])[0] as
        | {
            slug: string;
            nombre_es: string;
            precio?: number | null;
            precio_oferta?: number | null;
            precio_regular?: number | null;
          }
        | undefined;
      if (hit) {
        const precio = Number(hit.precio_oferta || hit.precio || hit.precio_regular || 0);
        catalogHits.set(p.nombre.toLowerCase().slice(0, 40), {
          slug: hit.slug,
          nombre: hit.nombre_es,
          precio,
        });
      }
    }

    const lineasRaw: CotizacionLineaOferta[] = extract.productos.map(p => ({
      slug: p.sku || '',
      nombre: p.nombre,
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario,
      subtotal: Math.round(p.precio_unitario * p.cantidad * 100) / 100,
      moneda: extract.moneda,
      notas: p.notas,
    }));
    const mejoradas = improveLines(lineasRaw, catalogHits);
    const lineas = sanitizarLineasComercial(mejoradas, extract.moneda);
    const total = calcularTotalOfertado(lineas);

    const condicionesBase = defaultCondicionesOferta('es');
    const condiciones = [
      condicionesBase.trim(),
      '',
      '---',
      'Mejora sobre presupuesto competencia (OCR):',
      extract.notas ? `- Notas OCR: ${extract.notas}` : '- (sin notas OCR)',
      `- Confianza OCR: ${(extract.confianza * 100).toFixed(0)}%`,
      '- Revisar precios vs catálogo I-ME antes de enviar.',
    ].join('\n');

    const nombre = extract.cliente_nombre || extract.cliente_empresa || 'Cliente (OCR competencia)';
    const email =
      extract.cliente_email && extract.cliente_email.includes('@')
        ? extract.cliente_email
        : `ocr+${user.id.slice(0, 8)}@pending.i-me.com.co`;
    const telefono = extract.cliente_telefono || '570000000000';

    const existingId = String(body.quote_id ?? '').trim();
    const metaBase = {
      origen_ocr_competencia: true,
      ocr_confianza: extract.confianza,
      ocr_model: vision.model,
      ocr_provider: vision.provider,
      ocr_at: new Date().toISOString(),
      ocr_by: profile.user_id,
      ocr_extract: extract,
    };

    let quoteId = existingId;
    if (existingId) {
      const { data: existing, error: exErr } = await supabase
        .from('solicitudes_cotizacion')
        .select('id,metadata,estado,pedido_id')
        .eq('id', existingId)
        .maybeSingle();
      if (exErr) return internalError(exErr.message, origin);
      if (!existing) return badRequest('quote_id no encontrado', origin);
      const row = existing as {
        estado?: string;
        pedido_id?: string | null;
        metadata?: Record<string, unknown> | null;
      };
      if (row.pedido_id || row.estado === 'convertida' || row.estado === 'enviada') {
        return errorResponse(
          { code: 'QUOTE_LOCKED', message: 'No se puede OCR sobre presupuesto bloqueado.' },
          409,
          origin
        );
      }
      const prevMeta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? { ...row.metadata }
          : {};
      const { error: upErr } = await supabase
        .from('solicitudes_cotizacion')
        .update({
          nombre,
          empresa: extract.cliente_empresa || null,
          email,
          telefono,
          moneda: extract.moneda,
          mercado: extract.moneda === 'USD' ? 'INTL' : 'CO',
          validez_hasta: extract.validez_hasta,
          condiciones,
          productos: lineas,
          precio_total_ofertado: total,
          metadata: { ...prevMeta, ...metaBase },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);
      if (upErr) return internalError(upErr.message, origin);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('solicitudes_cotizacion')
        .insert({
          nombre,
          empresa: extract.cliente_empresa || null,
          email,
          telefono,
          moneda: extract.moneda,
          mercado: extract.moneda === 'USD' ? 'INTL' : 'CO',
          validez_hasta: extract.validez_hasta,
          condiciones,
          productos: lineas,
          precio_total_ofertado: total,
          estado: 'nueva',
          origen: 'pwa',
          tipo_solicitud: 'cotizacion_oferta',
          campaign: 'ocr-competencia',
          created_by: profile.user_id,
          crm_sync_status: 'pending',
          locale: 'es',
          metadata: metaBase,
        })
        .select('id')
        .single();
      if (insErr || !inserted) {
        return internalError(insErr?.message ?? 'No se pudo crear presupuesto', origin);
      }
      quoteId = (inserted as { id: string }).id;
      await supabase.rpc('ensure_cotizacion_numero', { p_id: quoteId });
    }

    const { data: quoteRow } = await supabase
      .from('solicitudes_cotizacion')
      .select('id,numero,twenty_opportunity_id,metadata')
      .eq('id', quoteId)
      .maybeSingle();
    const q = quoteRow as {
      id: string;
      numero?: string | null;
      twenty_opportunity_id?: string | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    const oppId = q?.twenty_opportunity_id?.trim() || 'pending';
    const numero = q?.numero?.trim() || quoteId.slice(0, 8);
    const ext = extForMime(mime);
    const baseName = `${quoteId}__${oppId}__${stamp()}.${ext}`;
    const storagePath = `${quoteId}/${baseName}`;

    const { error: upStorageErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: mime, upsert: true });
    if (upStorageErr) {
      return errorResponse(
        {
          code: 'STORAGE_FAILED',
          message: `Presupuesto creado pero falló guardar foto: ${upStorageErr.message}`,
        },
        502,
        origin
      );
    }

    const sidecar = {
      quote_id: quoteId,
      numero,
      twenty_opportunity_id: oppId === 'pending' ? null : oppId,
      storage_path: storagePath,
      bucket: BUCKET,
      ocr_confianza: extract.confianza,
      ocr_model: vision.model,
      created_at: new Date().toISOString(),
      commercial_email: profile.email,
    };

    const prevMeta =
      q?.metadata && typeof q.metadata === 'object' && !Array.isArray(q.metadata)
        ? { ...q.metadata }
        : {};
    await supabase
      .from('solicitudes_cotizacion')
      .update({
        metadata: {
          ...prevMeta,
          ...metaBase,
          competencia_foto_path: storagePath,
          competencia_foto_id: baseName,
          competencia_opp_ref: oppId,
        },
      })
      .eq('id', quoteId);

    const local = await mirrorLocal(bytes, baseName, sidecar);
    // Sidecar en storage también
    await supabase.storage
      .from(BUCKET)
      .upload(
        `${quoteId}/${baseName.replace(/\.[^.]+$/, '')}.json`,
        new TextEncoder().encode(JSON.stringify(sidecar, null, 2)),
        { contentType: 'application/json', upsert: true }
      );

    return json(
      {
        ok: true,
        quote_id: quoteId,
        numero,
        twenty_opportunity_id: oppId === 'pending' ? null : oppId,
        storage_path: storagePath,
        local_filename: baseName,
        local_mirror: local,
        extract,
        improved_lines: lineas,
        total,
        moneda: extract.moneda,
        model: vision.model,
        provider: vision.provider,
      },
      origin
    );
  })
);
