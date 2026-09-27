import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import {
  PROVEEDOR_IMPORT_COLUMNS,
  prepareContactoImportRow,
  prepareInteraccionImportRow,
  prepareProveedorImportRow,
  sanitizeDropshipImportPayload,
  type ImportFieldError,
} from '../../../src/lib/proveedor-import.ts';

type Entity = 'clientes' | 'proveedores' | 'pedidos' | 'productos' | 'familias' | 'tipos';
type Row = Record<string, unknown>;

interface ImportRequest {
  entity?: Entity;
  rows?: Row[];
  contactRows?: Row[];
  interactionRows?: Row[];
  clearEmpty?: boolean;
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
    columns: new Set(PROVEEDOR_IMPORT_COLUMNS),
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
    roles: ['catalogo', 'ventas'],
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

    const ventasOnlyDraft = entity === 'productos' && rol === 'ventas';

    if (entity === 'proveedores') {
      const result = await importProveedores(supabase, rows, {
        contactRows: Array.isArray(body.contactRows) ? body.contactRows : [],
        interactionRows: Array.isArray(body.interactionRows) ? body.interactionRows : [],
        clearEmpty: body.clearEmpty === true,
      });
      return jsonResponse(result, origin);
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
      const productRows = ventasOnlyDraft
        ? cleanRows.map(row => ({ ...row, activo: false }))
        : cleanRows;
      const result = await importProductos(supabase, productRows, sanitized.length);
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

async function importProveedores(
  supabase: ReturnType<typeof getServerSupabase>,
  rows: Row[],
  options: { contactRows: Row[]; interactionRows: Row[]; clearEmpty: boolean }
): Promise<{
  ok: boolean;
  processed: number;
  skipped: number;
  created: number;
  updated: number;
  rejected: ImportFieldError[];
  contacts: { processed: number; rejected: ImportFieldError[] };
  interactions: { processed: number; rejected: ImportFieldError[] };
}> {
  const rejected: ImportFieldError[] = [];
  const prepared = rows.map((row, index) =>
    prepareProveedorImportRow(row, index + 2, { clearEmpty: options.clearEmpty })
  );
  const seenSlugs = new Set<string>();
  const valid: Row[] = [];
  for (const item of prepared) {
    if (!item.ok) {
      rejected.push(...item.errors);
      continue;
    }
    const slug = String(item.payload.slug ?? '');
    if (seenSlugs.has(slug)) {
      rejected.push({
        row: item.rowNumber,
        column: 'slug',
        value: slug,
        message: `Fila ${item.rowNumber}, columna slug: "${slug}" está repetido en el archivo.`,
      });
      continue;
    }
    seenSlugs.add(slug);
    valid.push(item.payload);
  }

  const existing = await fetchProveedoresBySlug(
    supabase,
    valid.map(row => String(row.slug ?? ''))
  );
  const accepted: Row[] = [];
  for (const item of prepared) {
    if (!item.ok) continue;
    const slug = String(item.payload.slug ?? '');
    if (!valid.some(row => row.slug === slug)) continue;
    const current = existing.get(slug);
    // Dropship live: never let CSV/Excel rewrite notification routing or activo.
    // Commercial fills (INVIMA, líneas, notas) still apply; secrets stay stripped upstream.
    accepted.push(sanitizeDropshipImportPayload(item.payload, current));
  }

  for (const group of groupRowsByColumns(accepted)) {
    const { error } = await supabase.from('proveedores').upsert(group, { onConflict: 'slug' });
    if (error) {
      throw new Error(`Supabase rechazo la importacion en proveedores: ${error.message}`);
    }
  }

  let created = 0;
  let updated = 0;
  for (const row of accepted) {
    if (existing.has(String(row.slug ?? ''))) updated += 1;
    else created += 1;
  }

  const contactPrepared = options.contactRows.map((row, index) =>
    prepareContactoImportRow(row, index + 2)
  );
  const interactionPrepared = options.interactionRows.map((row, index) =>
    prepareInteraccionImportRow(row, index + 2)
  );
  const neededSlugs = [
    ...accepted.map(row => String(row.slug ?? '')),
    ...contactPrepared
      .filter(item => item.ok)
      .map(item => String(item.payload.slug_proveedor ?? '')),
    ...interactionPrepared
      .filter(item => item.ok)
      .map(item => String(item.payload.slug_proveedor ?? '')),
  ];
  const ids = await fetchProveedoresBySlug(supabase, neededSlugs);
  const contacts = await importProveedorContactos(supabase, contactPrepared, ids);
  const interactions = await importProveedorInteracciones(supabase, interactionPrepared, ids);

  return {
    ok: true,
    processed: accepted.length,
    skipped: rows.length - accepted.length,
    created,
    updated,
    rejected,
    contacts,
    interactions,
  };
}

async function fetchProveedoresBySlug(
  supabase: ReturnType<typeof getServerSupabase>,
  slugs: string[]
): Promise<Map<string, { id: string; dropship_enabled: boolean }>> {
  const result = new Map<string, { id: string; dropship_enabled: boolean }>();
  const unique = [...new Set(slugs.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    const { data, error } = await supabase
      .from('proveedores')
      .select('id,slug,dropship_enabled')
      .in('slug', chunk);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<{
      id: string;
      slug: string;
      dropship_enabled?: boolean | null;
    }>) {
      result.set(row.slug, { id: row.id, dropship_enabled: row.dropship_enabled === true });
    }
  }
  return result;
}

function groupRowsByColumns(rows: Row[]): Row[][] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = Object.keys(row).sort().join('|');
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.values()];
}

async function importProveedorContactos(
  supabase: ReturnType<typeof getServerSupabase>,
  prepared: ReturnType<typeof prepareContactoImportRow>[],
  proveedores: Map<string, { id: string }>
): Promise<{ processed: number; rejected: ImportFieldError[] }> {
  const rejected: ImportFieldError[] = [];
  let processed = 0;
  for (const item of prepared) {
    if (!item.ok) {
      rejected.push(...item.errors);
      continue;
    }
    const slug = String(item.payload.slug_proveedor ?? '');
    const proveedor = proveedores.get(slug);
    if (!proveedor) {
      rejected.push({
        row: item.rowNumber,
        column: 'slug_proveedor',
        value: slug,
        message: `Fila ${item.rowNumber}, hoja contactos: no existe el proveedor "${slug}".`,
      });
      continue;
    }
    const tipo = String(item.payload.tipo ?? 'comercial');
    const email = typeof item.payload.email === 'string' ? item.payload.email : '';
    const payload = {
      proveedor_id: proveedor.id,
      tipo,
      nombre: item.payload.nombre,
      cargo: item.payload.cargo,
      email: item.payload.email,
      telefono: item.payload.telefono,
      whatsapp: item.payload.whatsapp,
      es_principal: item.payload.es_principal === true,
      source_note: item.payload.source_note,
      verification_status: 'pendiente',
    };
    let existingId = '';
    if (email) {
      const { data, error } = await supabase
        .from('proveedor_contactos')
        .select('id')
        .eq('proveedor_id', proveedor.id)
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      existingId = String((data as { id?: string } | null)?.id ?? '');
    } else if (payload.es_principal) {
      const { data, error } = await supabase
        .from('proveedor_contactos')
        .select('id')
        .eq('proveedor_id', proveedor.id)
        .eq('tipo', tipo)
        .eq('es_principal', true)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      existingId = String((data as { id?: string } | null)?.id ?? '');
    }
    const { error } = existingId
      ? await supabase.from('proveedor_contactos').update(payload).eq('id', existingId)
      : await supabase.from('proveedor_contactos').insert(payload);
    if (error) {
      rejected.push({
        row: item.rowNumber,
        column: 'slug_proveedor',
        value: slug,
        message: `Fila ${item.rowNumber}, hoja contactos: ${error.message}`,
      });
      continue;
    }
    processed += 1;
  }
  return { processed, rejected };
}

async function importProveedorInteracciones(
  supabase: ReturnType<typeof getServerSupabase>,
  prepared: ReturnType<typeof prepareInteraccionImportRow>[],
  proveedores: Map<string, { id: string }>
): Promise<{ processed: number; rejected: ImportFieldError[] }> {
  const rejected: ImportFieldError[] = [];
  let processed = 0;
  for (const item of prepared) {
    if (!item.ok) {
      rejected.push(...item.errors);
      continue;
    }
    const slug = String(item.payload.slug_proveedor ?? '');
    const proveedor = proveedores.get(slug);
    if (!proveedor) {
      rejected.push({
        row: item.rowNumber,
        column: 'slug_proveedor',
        value: slug,
        message: `Fila ${item.rowNumber}: no existe el proveedor "${slug}" para la interacción.`,
      });
      continue;
    }
    const resumen = String(item.payload.resumen ?? '');
    const { data: existing, error: existingError } = await supabase
      .from('proveedor_interacciones')
      .select('id')
      .eq('proveedor_id', proveedor.id)
      .eq('resumen', resumen)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) {
      const fecha = typeof item.payload.fecha === 'string' ? item.payload.fecha : '';
      const { error } = await supabase.from('proveedor_interacciones').insert({
        proveedor_id: proveedor.id,
        fecha: fecha || new Date().toISOString(),
        tipo: item.payload.tipo,
        resumen,
        proximo_paso: item.payload.proximo_paso,
        responsable: item.payload.responsable,
      });
      if (error) {
        rejected.push({
          row: item.rowNumber,
          column: 'resumen',
          value: resumen.slice(0, 80),
          message: `Fila ${item.rowNumber}: ${error.message}`,
        });
        continue;
      }
      processed += 1;
    }
    const { error: touchError } = await supabase
      .from('proveedores')
      .update({ ultimo_contacto_at: new Date().toISOString() })
      .eq('id', proveedor.id);
    if (touchError) throw new Error(touchError.message);
  }
  return { processed, rejected };
}

function jsonResponse(data: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
