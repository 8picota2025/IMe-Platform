import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

type Entity = 'clientes' | 'proveedores' | 'pedidos' | 'productos' | 'familias' | 'tipos';
type Row = Record<string, unknown>;

interface ImportRequest {
  entity?: Entity;
  rows?: Row[];
}

interface EntityConfig {
  table: Entity;
  roles: string[];
  conflict: string;
  columns: Set<string>;
}

const CONFIGS: Record<Entity, EntityConfig> = {
  clientes: {
    table: 'clientes',
    roles: ['ventas'],
    conflict: 'email',
    columns: new Set([
      'email',
      'nombre',
      'apellido',
      'telefono',
      'institucion',
      'tipo_cliente',
      'documento_tipo',
      'documento_numero',
      'razon_social',
      'tipo_documento',
      'numero_documento',
      'tipo_persona',
      'responsable_iva',
      'agente_retencion',
      'agente_reteica',
      'email_facturacion',
      'direccion_facturacion',
      'consentimiento_datos',
      'consentimiento_timestamp',
      'notas',
      'total_pedidos',
      'total_gastado',
      'ultimo_pedido_at',
    ]),
  },
  proveedores: {
    table: 'proveedores',
    roles: ['catalogo', 'operaciones'],
    conflict: 'slug',
    columns: new Set([
      'slug',
      'nombre',
      'contacto_email',
      'contacto_whatsapp',
      'canal',
      'webhook_url',
      'api_config',
      'notas',
      'activo',
    ]),
  },
  pedidos: {
    table: 'pedidos',
    roles: ['ventas', 'operaciones'],
    conflict: 'referencia_pasarela',
    columns: new Set([
      'id',
      'cliente_id',
      'cliente',
      'items',
      'subtotal',
      'subtotal_sin_impuestos',
      'descuento_total',
      'impuesto_total',
      'retencion_total',
      'envio_total',
      'total',
      'moneda',
      'mercado',
      'proveedor_pago',
      'estado',
      'referencia_pasarela',
      'checkout_url',
      'cupon_codigo',
      'direccion_facturacion',
      'direccion_envio',
      'facturacion_electronica_solicitada',
      'facturacion_electronica_estado',
      'metadata',
      'consentimiento_datos',
      'consentimiento_timestamp',
      'leida',
    ]),
  },
  productos: {
    table: 'productos',
    roles: ['catalogo'],
    conflict: 'slug',
    columns: new Set([
      'id',
      'slug',
      'sku',
      'gtin',
      'familia_id',
      'tipo_id',
      'nombre_es',
      'nombre_en',
      'descripcion_corta_es',
      'descripcion_corta_en',
      'descripcion_larga_es',
      'descripcion_larga_en',
      'especificaciones',
      'aplicaciones_es',
      'aplicaciones_en',
      'imagen_principal',
      'galeria',
      'ficha_pdf',
      'atributos',
      'peso_kg',
      'dimensiones_cm',
      'tipo_comercial',
      'fulfillment_mode',
      'precio',
      'precio_regular',
      'precio_oferta',
      'dian_codigo',
      'tarifa_iva_pct',
      'retencion_fuente_pct',
      'retencion_iva_pct',
      'retencion_ica_pct',
      'oferta_inicio',
      'oferta_fin',
      'moneda',
      'stock',
      'gestionar_stock',
      'stock_estado',
      'backorder_policy',
      'disponible',
      'disponible_actualizado_at',
      'destacado',
      'nuevo',
      'activo',
      'excluido_iva',
      'orden',
    ]),
  },
  familias: {
    table: 'familias',
    roles: ['catalogo'],
    conflict: 'slug',
    columns: new Set([
      'slug',
      'nombre_es',
      'nombre_en',
      'descripcion_es',
      'descripcion_en',
      'imagen',
      'orden',
      'activo',
    ]),
  },
  tipos: {
    table: 'tipos',
    roles: ['catalogo'],
    conflict: 'familia_id,slug',
    columns: new Set([
      'familia_id',
      'slug',
      'nombre_es',
      'nombre_en',
      'descripcion_es',
      'descripcion_en',
      'imagen',
      'orden',
      'activo',
    ]),
  },
};

const MAX_ROWS = 1000;

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return unauthorized(origin);

  let body: ImportRequest;
  try {
    body = (await req.json()) as ImportRequest;
  } catch {
    return badRequest('JSON invalido', origin);
  }

  const entity = body.entity;
  if (!entity || !(entity in CONFIGS)) return badRequest('Entidad no soportada', origin);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return badRequest('No hay filas para importar', origin);
  if (rows.length > MAX_ROWS) return badRequest(`Maximo ${MAX_ROWS} filas por importacion`, origin);

  const config = CONFIGS[entity];
  const supabase = getServerSupabase();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);

    const { data: profile, error: profileError } = await supabase
      .from('admin_profiles')
      .select('rol, activo')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const rol = String((profile as Row | null)?.rol ?? '');
    const activo = (profile as Row | null)?.activo === true;
    const allowed = activo && (rol === 'owner' || rol === 'admin' || config.roles.includes(rol));
    if (!allowed) {
      return errorResponse(
        {
          code: 'FORBIDDEN',
          message: `Tu usuario no tiene permiso para importar ${entity}. Rol requerido: ${config.roles.join(', ')}.`,
        },
        403,
        origin
      );
    }

    const sanitized = rows.map((row, index) => sanitizeRow(row, config, index));
    const invalid = sanitized.filter(item => item.error);
    if (invalid.length) {
      return errorResponse(
        {
          code: 'VALIDATION_ERROR',
          message: 'Hay filas con columnas no permitidas o claves faltantes.',
          details: invalid.slice(0, 20),
        },
        400,
        origin
      );
    }

    if (entity === 'pedidos') {
      const result = await importPedidos(
        supabase,
        sanitized.map(item => item.row)
      );
      return jsonResponse(result, origin);
    }

    const cleanRows = sanitized.map(item => item.row);
    if (entity === 'productos') {
      const result = await importProductos(supabase, cleanRows, sanitized.length);
      return jsonResponse(result, origin);
    }

    const { error } = await supabase
      .from(config.table)
      .upsert(cleanRows, { onConflict: config.conflict });
    if (error) {
      return errorResponse(
        {
          code: 'UPSERT_ERROR',
          message: `Supabase rechazo la importacion en ${entity}: ${error.message}`,
          details: error,
        },
        400,
        origin
      );
    }

    return jsonResponse({ ok: true, processed: cleanRows.length, skipped: 0 }, origin);
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'admin import error', origin);
  }
});

function sanitizeRow(row: Row, config: EntityConfig, index: number): { row: Row; error?: Row } {
  const clean: Row = {};
  const unknownColumns: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (!config.columns.has(key)) {
      unknownColumns.push(key);
      continue;
    }
    clean[key] = value;
  }

  const requiredKey =
    config.table === 'clientes'
      ? 'email'
      : config.table === 'proveedores' ||
          config.table === 'productos' ||
          config.table === 'familias' ||
          config.table === 'tipos'
        ? 'slug'
        : null;
  if (requiredKey && !clean[requiredKey]) {
    return { row: clean, error: { row: index + 2, message: `Falta ${requiredKey}` } };
  }
  if (config.table === 'tipos' && !clean.familia_id) {
    return { row: clean, error: { row: index + 2, message: 'Falta familia_id' } };
  }
  if (config.table === 'pedidos' && !clean.id && !clean.referencia_pasarela) {
    return {
      row: clean,
      error: { row: index + 2, message: 'Falta id o referencia_pasarela' },
    };
  }
  if (unknownColumns.length) {
    return {
      row: clean,
      error: {
        row: index + 2,
        message: `Columnas no permitidas: ${unknownColumns.join(', ')}`,
      },
    };
  }
  return { row: clean };
}

async function importPedidos(
  supabase: ReturnType<typeof getServerSupabase>,
  rows: Row[]
): Promise<{ ok: boolean; processed: number; skipped: number }> {
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const referencia =
      typeof row.referencia_pasarela === 'string' ? row.referencia_pasarela.trim() : '';

    if (id) {
      const { error } = await supabase.from('pedidos').upsert(row, { onConflict: 'id' });
      if (error) throw new Error(`Fila pedido ${id}: ${error.message}`);
      processed += 1;
      continue;
    }

    if (referencia) {
      const { error } = await supabase
        .from('pedidos')
        .upsert(row, { onConflict: 'referencia_pasarela' });
      if (error) throw new Error(`Fila pedido ${referencia}: ${error.message}`);
      processed += 1;
      continue;
    }

    skipped += 1;
  }

  return { ok: true, processed, skipped };
}

async function importProductos(
  supabase: ReturnType<typeof getServerSupabase>,
  rows: Row[],
  totalRows: number
): Promise<{ ok: boolean; processed: number; skipped: number }> {
  const slugs = new Set<string>();
  const skus = new Set<string>();
  const skuToRow = new Map<string, number>();
  const slugToRow = new Map<string, number>();

  rows.forEach((row, index) => {
    const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
    const sku = typeof row.sku === 'string' ? row.sku.trim() : '';
    if (slug) {
      if (slugToRow.has(slug)) {
        throw new Error(`Fila ${index + 2}: slug duplicado en el archivo: ${slug}`);
      }
      slugToRow.set(slug, index + 2);
      slugs.add(slug);
    }
    if (sku) {
      if (skuToRow.has(sku)) {
        const firstRow = skuToRow.get(sku);
        throw new Error(`Filas ${firstRow} y ${index + 2}: sku duplicado en el archivo: ${sku}`);
      }
      skuToRow.set(sku, index + 2);
      skus.add(sku);
    }
  });

  const [existingBySku, existingBySlug] = await Promise.all([
    fetchExistingProductos(supabase, 'sku', [...skus]),
    fetchExistingProductos(supabase, 'slug', [...slugs]),
  ]);

  const resolvedRows = rows.map((row, index) => {
    const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
    const sku = typeof row.sku === 'string' ? row.sku.trim() : '';
    const bySku = sku ? existingBySku.get(sku) : null;
    const bySlug = slug ? existingBySlug.get(slug) : null;

    if (bySku && bySlug && bySku.id !== bySlug.id) {
      throw new Error(
        `Fila ${index + 2}: sku ${sku} ya pertenece a otro producto distinto del slug ${slug}.`
      );
    }

    const existing = bySku ?? bySlug;
    return existing ? { ...row, id: existing.id } : row;
  });

  // Split: existing rows (have id) vs new rows (no id).
  // Mixing both in a single upsert causes PostgREST to include 'id' in the
  // column list for all rows, sending NULL for new ones → NOT NULL violation.
  const existingRows = resolvedRows.filter(row => row.id);
  const newRows = resolvedRows.filter(row => !row.id);

  if (existingRows.length) {
    const { error } = await supabase.from('productos').upsert(existingRows, { onConflict: 'id' });
    if (error) {
      throw new Error(`Supabase rechazo la importacion en productos: ${error.message}`);
    }
  }

  if (newRows.length) {
    const { error } = await supabase.from('productos').upsert(newRows, { onConflict: 'slug' });
    if (error) {
      throw new Error(`Supabase rechazo la importacion en productos: ${error.message}`);
    }
  }

  return { ok: true, processed: resolvedRows.length, skipped: totalRows - resolvedRows.length };
}

async function fetchExistingProductos(
  supabase: ReturnType<typeof getServerSupabase>,
  column: 'sku' | 'slug',
  values: string[]
): Promise<Map<string, { id: string }>> {
  const result = new Map<string, { id: string }>();
  if (!values.length) return result;
  const chunkSize = 100;
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('productos')
      .select('id,slug,sku')
      .in(column, chunk);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{
      id: string;
      slug?: string | null;
      sku?: string | null;
    }>) {
      const key = column === 'sku' ? String(row.sku ?? '').trim() : String(row.slug ?? '').trim();
      if (key) result.set(key, { id: row.id });
    }
  }
  return result;
}

function jsonResponse(data: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
