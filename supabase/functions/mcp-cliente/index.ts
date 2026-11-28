/**
 * MCP público para agentes de IA externos con rol `client`.
 *
 * Bundle aislado: solo importa la superficie cliente. Ninguna herramienta de
 * operación/administración (mcp-comercio-core) forma parte de esta función.
 * service_role se usa únicamente en el servidor, con columnas en lista blanca.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.108.0';
import { DESTINATARIOS_INTERNOS, enviarEmailPlantilla, escapeHtml } from '../_shared/email.ts';
import { resolvePrecioPublico } from '../_shared/precio-publico.ts';
import { hashIdentifier } from '../../../src/lib/mcp-comercio-http.ts';
import {
  generarTokenCliente,
  RUTA_FICHA_RE,
  SITIO,
  type ClienteDeps,
  type ClienteRow,
  type ProductoPublicoRow,
} from '../../../src/lib/mcp-cliente-core.ts';
import { createClienteHttpHandler, RATE_LIMITS } from '../../../src/lib/mcp-cliente-http.ts';

const env = Deno.env.toObject();
const db = createClient(env.SUPABASE_URL ?? '', env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const secrets = Object.entries(env)
  .filter(
    ([name, value]) =>
      /TOKEN|SECRET|PASSWORD|PRIVATE|API_KEY|SERVICE_ROLE/i.test(name) && value.length > 0
  )
  .map(([, value]) => value);

const BUCKET = 'fichas-clientes';
const PREFIJO_FICHAS = '/assets/productos/fichas/';
const FIRMA_SEGUNDOS = 600;
const MAX_FICHA_BYTES = 25 * 1024 * 1024;
// Lista blanca: nunca precio (base), precio_costo, stock numérico ni proveedor.
const COLS =
  'id,slug,sku,nombre_es,nombre_en,descripcion_corta_es,descripcion_corta_en,imagen_principal,ficha_pdf,fulfillment_mode,stock_estado,disponible,precio_regular,precio_oferta,oferta_inicio,oferta_fin,familias(slug)';

type Fila = Record<string, unknown>;
function aPublico(row: Fila): ProductoPublicoRow {
  const familia = row.familias as { slug?: string } | null;
  const texto = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    id: String(row.id),
    slug: String(row.slug),
    sku: texto(row.sku),
    nombre_es: String(row.nombre_es ?? row.slug),
    nombre_en: texto(row.nombre_en),
    descripcion_corta_es: texto(row.descripcion_corta_es),
    descripcion_corta_en: texto(row.descripcion_corta_en),
    imagen_principal: texto(row.imagen_principal),
    ficha_pdf: texto(row.ficha_pdf),
    fulfillment_mode: String(row.fulfillment_mode ?? 'cotizacion'),
    stock_estado: String(row.stock_estado ?? 'instock'),
    disponible: row.disponible !== false,
    precio_publico: resolvePrecioPublico(row),
    familia_slug: familia?.slug ?? null,
  };
}

function falla(contexto: string, error: { message?: string } | null): never {
  // El detalle va al log del servidor; el agente recibe un error genérico.
  console.error(`mcp-cliente: ${contexto}`, error?.message ?? 'unknown');
  throw new Error(contexto);
}

/** Lee la respuesta con tope de tamaño y comprueba la firma %PDF. */
async function leerPdf(res: Response): Promise<Uint8Array | null> {
  if (Number(res.headers.get('content-length') ?? 0) > MAX_FICHA_BYTES) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FICHA_BYTES) {
      await reader.cancel();
      return null;
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const p of partes) {
    bytes.set(p, off);
    off += p.byteLength;
  }
  return new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-' ? bytes : null;
}

const deps: ClienteDeps = {
  async listarProductos({ familia, limite, desplazamiento }) {
    const cols = familia ? COLS.replace('familias(slug)', 'familias!inner(slug)') : COLS;
    let query = db
      .from('productos')
      .select(cols, { count: 'exact' })
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('slug', { ascending: true })
      .range(desplazamiento, desplazamiento + limite - 1);
    if (familia) query = query.eq('familias.slug', familia);
    const { data, error, count } = await query;
    if (error) falla('listar productos', error);
    // `cols` es dinámico (inner join opcional): el parser de tipos no lo infiere.
    return { filas: ((data ?? []) as unknown as Fila[]).map(aPublico), total: count ?? null };
  },

  async buscarProductos(texto, limite) {
    const { data, error } = await db.rpc('buscar_productos_keyword', {
      query_text: texto,
      match_count: limite,
      filtro: null,
    });
    if (error) falla('buscar productos', error);
    const ids = ((data ?? []) as Fila[]).map(r => String(r.id));
    if (!ids.length) return [];
    const det = await db.from('productos').select(COLS).in('id', ids).eq('activo', true);
    if (det.error) falla('detalle búsqueda', det.error);
    const porId = new Map(((det.data ?? []) as Fila[]).map(r => [String(r.id), aPublico(r)]));
    return ids.map(id => porId.get(id)).filter((p): p is ProductoPublicoRow => Boolean(p));
  },

  async productoPorSlug(slug) {
    const { data, error } = await db
      .from('productos')
      .select(COLS)
      .eq('slug', slug)
      .eq('activo', true)
      .maybeSingle();
    if (error) falla('producto por slug', error);
    return data ? aPublico(data as Fila) : null;
  },

  async productosPorSlugs(slugs) {
    const { data, error } = await db
      .from('productos')
      .select(COLS)
      .in('slug', slugs)
      .eq('activo', true);
    if (error) falla('productos por slugs', error);
    return ((data ?? []) as Fila[]).map(aPublico);
  },

  async crearCliente(fila) {
    const { data, error } = await db.from('mcp_clientes').insert(fila).select('id').single();
    if (error || !data) falla('crear cliente', error);
    return { id: String((data as Fila).id) };
  },

  async clientePorTokenHash(hash) {
    const { data, error } = await db
      .from('mcp_clientes')
      .select('id,nombre,email,empresa,telefono,pais,expira_en,revocado_at')
      .eq('token_hash', hash)
      .maybeSingle();
    if (error) falla('leer cliente', error);
    return (data as ClienteRow | null) ?? null;
  },

  async tocarCliente(id) {
    await db.from('mcp_clientes').update({ ultimo_uso_at: new Date().toISOString() }).eq('id', id);
  },

  async registrarDescarga(clienteId, producto) {
    const { error } = await db.from('mcp_cliente_descargas').insert({
      cliente_id: clienteId,
      producto_id: producto.id,
      producto_slug: producto.slug,
    });
    if (error) falla('registrar descarga', error);
  },

  async firmarFicha(rutaPublica) {
    if (!RUTA_FICHA_RE.test(rutaPublica) || rutaPublica.includes('..')) return null;
    const objeto = rutaPublica.slice(PREFIJO_FICHAS.length);
    const store = db.storage.from(BUCKET);
    let firmada = await store.createSignedUrl(objeto, FIRMA_SEGUNDOS);
    if (firmada.error || !firmada.data?.signedUrl) {
      // Copia bajo demanda desde el sitio estático: solo el propio dominio y sin
      // redirecciones (evita SSRF). El enlace público de la web no cambia.
      const url = `${SITIO}${rutaPublica.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const bytes = await leerPdf(res);
      if (!bytes) return null;
      const subida = await store.upload(objeto, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (subida.error) falla('subir ficha privada', subida.error);
      firmada = await store.createSignedUrl(objeto, FIRMA_SEGUNDOS);
      if (firmada.error || !firmada.data?.signedUrl) falla('firmar ficha', firmada.error);
    }
    return {
      url: firmada.data.signedUrl,
      expira_en: new Date(Date.now() + FIRMA_SEGUNDOS * 1000).toISOString(),
    };
  },

  async reservarIdempotencia(clienteId, herramienta, clave, huella) {
    const ins = await db
      .from('mcp_cliente_idempotencia')
      .insert({ cliente_id: clienteId, herramienta, clave, huella });
    if (!ins.error) return { estado: 'nueva' };
    if (ins.error.code !== '23505') falla('reservar idempotencia', ins.error);
    const { data, error } = await db
      .from('mcp_cliente_idempotencia')
      .select('huella,estado,respuesta')
      .eq('cliente_id', clienteId)
      .eq('herramienta', herramienta)
      .eq('clave', clave)
      .maybeSingle();
    if (error || !data) falla('leer idempotencia', error);
    const fila = data as { huella: string; estado: string; respuesta: Fila | null };
    if (fila.huella !== huella) return { estado: 'conflicto' };
    if (fila.estado === 'completada' && fila.respuesta)
      return { estado: 'completada', respuesta: fila.respuesta };
    return { estado: 'en_curso' };
  },

  async completarIdempotencia(clienteId, herramienta, clave, respuesta) {
    const { error } = await db
      .from('mcp_cliente_idempotencia')
      .update({ estado: 'completada', respuesta })
      .eq('cliente_id', clienteId)
      .eq('herramienta', herramienta)
      .eq('clave', clave);
    if (error) falla('completar idempotencia', error);
  },

  async liberarIdempotencia(clienteId, herramienta, clave) {
    await db
      .from('mcp_cliente_idempotencia')
      .delete()
      .eq('cliente_id', clienteId)
      .eq('herramienta', herramienta)
      .eq('clave', clave)
      .eq('estado', 'en_curso');
  },

  async crearSolicitud(fila) {
    const { data, error } = await db
      .from('solicitudes_cotizacion')
      .insert({
        tipo_solicitud: fila.tipo_solicitud,
        origen: 'mcp_cliente',
        campaign: 'mcp_cliente',
        nombre: fila.nombre,
        email: fila.email,
        empresa: fila.empresa,
        telefono: fila.telefono,
        mensaje: fila.mensaje || null,
        productos: fila.productos.map(p => ({ ...p, moneda: 'COP' })),
        consentimiento_datos: true,
        consentimiento_timestamp: new Date().toISOString(),
        locale: fila.locale,
        mercado: fila.pais && fila.pais !== 'CO' ? 'INTL' : 'CO',
        moneda: 'COP',
        pais: fila.pais,
        ciudad: fila.ciudad,
        metadata: { canal: 'mcp_cliente', mcp_cliente_id: fila.mcp_cliente_id },
      })
      .select('id')
      .single();
    if (error || !data) falla('crear solicitud', error);
    return { id: String((data as Fila).id) };
  },

  async notificarVentas(solicitudId, fila) {
    const lineas = fila.productos.length
      ? fila.productos
          .map(
            p =>
              `<li><a href="${escapeHtml(p.url)}">${escapeHtml(p.nombre)}</a> × ${p.cantidad}</li>`
          )
          .join('')
      : '<li>(sin productos específicos)</li>';
    const tipo = fila.tipo_solicitud === 'cotizacion' ? 'Cotización' : 'Contacto';
    const r = await enviarEmailPlantilla(
      db,
      'cotizacion_interna',
      DESTINATARIOS_INTERNOS,
      {
        referencia: escapeHtml(solicitudId),
        cliente_nombre: escapeHtml(fila.nombre),
        cliente_email: escapeHtml(fila.email),
        empresa: escapeHtml(fila.empresa),
        telefono: escapeHtml(fila.telefono),
        mensaje: `[${tipo} vía agente IA (MCP)] ${escapeHtml(fila.mensaje)}`.replace(/\n/g, '<br>'),
        items_html: lineas,
        total: 'Por validar',
        moneda: 'COP',
        fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
      },
      solicitudId,
      [],
      { idempotencyKey: `mcp-cliente:${solicitudId}` }
    );
    if (!r.ok) console.error('mcp-cliente: aviso a ventas', r.detalle ?? 'fallo');
    return r.ok;
  },

  sha256: hashIdentifier,
  randomToken: generarTokenCliente,
  now: () => new Date(),
};

Deno.serve(
  createClienteHttpHandler({
    deps,
    secrets,
    consumeRateLimit: async (scope, keys) => {
      const limite = RATE_LIMITS[scope];
      const { data, error } = await db.rpc('consume_mcp_cliente_rate_limit', {
        p_keys: keys,
        p_max_ventana: limite.ventana,
        p_max_dia: limite.dia,
      });
      if (error) throw new Error('Rate limit unavailable');
      return data === true;
    },
    auditStart: async entry => {
      const { data, error } = await db
        .from('mcp_cliente_auditoria')
        .insert(entry)
        .select('id')
        .single();
      if (error || !data) throw new Error('Audit unavailable');
      return (data as { id: number }).id;
    },
    auditFinish: async (id, entry) => {
      const { error } = await db.from('mcp_cliente_auditoria').update(entry).eq('id', id);
      if (error) console.error('mcp-cliente: cerrar auditoría', error.message);
    },
  })
);
