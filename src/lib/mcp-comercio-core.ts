/** Shared server-only commerce dispatcher. Neither transport owns business logic. */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  construirCambiosCotizacion,
  construirLineasCotizacion,
  detalleCotizacion,
  normalizarFiltroCotizaciones,
  resumenCotizacion,
  type AsesorVista,
  type FilaCotizacion,
  type ProductoCatalogo,
} from './cotizacion-mcp.ts';
import { huellaOferta, validarEnvioCotizacion } from './cotizacion-envio.ts';
import { esEmailValido } from './cotizacion-asesor.ts';
import {
  cambioEtapaCrm,
  camposFichaPermitidos,
  confirmacionEjecutable,
  decidirCompra,
  filaSinSecretos,
  MCP_TOOLS,
  objetivoBorradoCrm,
  precioBajoPiso,
  siguientePasoPedido,
  unidadesReservables,
  type McpToolName,
  type ObjetoTwentyBorrable,
} from './comercio-operacion.ts';

type Json = Record<string, unknown>;

const PRODUCTO_COLS =
  'id,slug,sku,gtin,nombre_es,precio,precio_regular,stock,gestionar_stock,stock_estado,disponible,activo,ficha_pdf,imagen_principal,especificaciones,fulfillment_mode';
const PROVEEDOR_COLS =
  'id,slug,nombre,razon_social,pais,ciudad,contacto_email,lineas_equipos,estado_invima,invima_titular,distribuidor_local,lifecycle_status,activo';

function sinBase(): Json {
  return {
    ok: false,
    error:
      'Falta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno del MCP. La clave no se imprime.',
  };
}

function actorDe(args: Json): { actor: string; rol: string; motivo: string } {
  return {
    actor: String(args.actor ?? 'agente'),
    rol: String(args.rol ?? 'lectura'),
    motivo: String(args.motivo ?? ''),
  };
}

async function registrar(
  db: SupabaseClient,
  entrada: {
    actor: string;
    rol: string;
    herramienta: string;
    entidad: string;
    entidadId?: string | null;
    antes?: unknown;
    despues?: unknown;
    motivo?: string;
    confirmacionId?: string | null;
  }
): Promise<void> {
  await db.from('comercio_actuaciones').insert({
    actor: entrada.actor,
    rol: entrada.rol,
    herramienta: entrada.herramienta,
    entidad: entrada.entidad,
    entidad_id: entrada.entidadId ?? null,
    antes: entrada.antes ?? null,
    despues: entrada.despues ?? null,
    motivo: entrada.motivo ?? null,
    confirmacion_id: entrada.confirmacionId ?? null,
  });
}

async function preparar(
  db: SupabaseClient,
  args: Json,
  herramienta: string,
  entidad: string,
  venceMs = 24 * 60 * 60 * 1000
): Promise<Json> {
  const quien = actorDe(args);
  if (!quien.motivo) return { ok: false, error: 'Hace falta un motivo.' };
  // Margen para que un owner/admin la revise y apruebe en el CMS.
  const vence = new Date(Date.now() + venceMs).toISOString();
  const { data, error } = await db
    .from('comercio_confirmaciones')
    .insert({
      vence_en: vence,
      actor: quien.actor,
      rol: quien.rol,
      herramienta,
      entidad,
      entidad_id: args.entidad_id ? String(args.entidad_id) : null,
      payload: args.payload ?? {},
      motivo: quien.motivo,
    })
    .select('id,vence_en,estado')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, confirmacion_id: data.id, vence_en: data.vence_en, estado: data.estado };
}

/**
 * Ejecutar exige una aprobación hecha en el CMS por un owner/admin con sesión
 * (estado `aprobada`, fijado por trigger). El `rol` de los argumentos no cuenta.
 */
async function confirmar(db: SupabaseClient, args: Json, herramienta: string): Promise<Json> {
  const quien = actorDe(args);
  const id = String(args.confirmacion_id ?? '');
  if (!id || !quien.motivo) return { ok: false, error: 'Hacen falta confirmacion_id y motivo.' };
  const { data, error } = await db
    .from('comercio_confirmaciones')
    .select('id,estado,vence_en,herramienta,payload,entidad_id,aprobada_por,aprobada_en')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Confirmación no encontrada.' };
  if (data.estado === 'pendiente' && new Date(String(data.vence_en)).getTime() < Date.now()) {
    await db.from('comercio_confirmaciones').update({ estado: 'vencida' }).eq('id', id);
    return { ok: false, error: 'La confirmación venció sin aprobarse.' };
  }
  const aprobador = data.aprobada_por
    ? (
        await db
          .from('admin_profiles')
          .select('rol,activo,email')
          .eq('user_id', data.aprobada_por)
          .maybeSingle()
      ).data
    : null;
  const veredicto = confirmacionEjecutable(
    {
      estado: String(data.estado),
      herramienta: String(data.herramienta),
      aprobada_por: data.aprobada_por ? String(data.aprobada_por) : null,
      aprobada_en: data.aprobada_en ? String(data.aprobada_en) : null,
    },
    herramienta,
    aprobador ? { rol: String(aprobador.rol), activo: aprobador.activo === true } : null
  );
  if (!veredicto.ok) return veredicto;
  return {
    ok: true,
    fila: data,
    quien: { ...quien, rol: String(aprobador?.rol), aprobador: String(aprobador?.email ?? '') },
  };
}

/**
 * Borra en Twenty con la clave propia del agente (TWENTY_MCP_API_KEY, rol con
 * Delete). Nunca usa TWENTY_API_KEY: esa es la de la web y no debe poder borrar.
 */
async function borrarEnTwenty(
  objeto: ObjetoTwentyBorrable,
  id: string,
  env: McpEnvironment
): Promise<Json> {
  const base = env.TWENTY_BASE_URL?.trim().replace(/\/+$/, '');
  const key = env.TWENTY_MCP_API_KEY?.trim();
  if (!base || !key) {
    return {
      ok: false,
      error:
        'Falta TWENTY_BASE_URL o TWENTY_MCP_API_KEY en el entorno del MCP. La clave no se imprime.',
    };
  }
  const res = await fetch(`${base}/rest/${objeto}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (res.ok || res.status === 404) return { ok: true };
  return { ok: false, error: `Twenty respondió HTTP ${res.status} al borrar ${objeto}/${id}.` };
}

const COTIZACION_COLS_LISTA =
  'id,numero,estado,nombre,empresa,email,moneda,precio_total_ofertado,validez_hasta,created_by,updated_at,created_at,productos,metadata,pedido_id,impuestos_incluidos';
const COTIZACION_COLS_DETALLE = `${COTIZACION_COLS_LISTA},telefono,condiciones,nit,responsable_iva,direccion_envio,direccion_facturacion,notas_internas,send_error,pdf_storage_path,oferta_enviada_at,locale`;
// Huella y envío solo necesitan estas columnas (sin PII adicional).
const COTIZACION_COLS_ENVIO =
  'id,numero,estado,email,telefono,moneda,productos,condiciones,validez_hasta,impuestos_incluidos,pedido_id,created_by';

/** Vigencia de una solicitud de envío: corta, para que no se apruebe una oferta vieja. */
const ENVIO_COTIZACION_VENCE_MS = 4 * 60 * 60 * 1000;
const MOTIVO_ENVIO_DEFECTO = 'Envío oficial de cotización';

async function asesoresPorIds(
  db: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, AsesorVista>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const mapa = new Map<string, AsesorVista>();
  if (unicos.length === 0) return mapa;
  const { data } = await db
    .from('admin_profiles')
    .select('user_id,nombre,email')
    .in('user_id', unicos);
  for (const fila of data ?? []) {
    mapa.set(String(fila.user_id), {
      user_id: String(fila.user_id),
      nombre: fila.nombre ? String(fila.nombre) : null,
      email: fila.email ? String(fila.email) : null,
    });
  }
  return mapa;
}

/** Extrae `{ error: { code, message, details } }` de una respuesta HTTP de Edge Function. */
async function errorDeFuncion(
  error: unknown
): Promise<{ message: string; code?: string; details?: string }> {
  const respuesta = (error as { context?: Response } | null)?.context;
  if (respuesta && typeof respuesta.json === 'function') {
    try {
      const cuerpo = (await respuesta.clone().json()) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      const e = cuerpo?.error;
      if (e?.message) {
        const resultado: { message: string; code?: string; details?: string } = {
          message: String(e.message),
        };
        if (e.code) resultado.code = String(e.code);
        if (e.details != null) resultado.details = String(e.details).slice(0, 500);
        return resultado;
      }
    } catch {
      // cuerpo no JSON: se usa el mensaje genérico
    }
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

async function cotizacionPorId(
  db: SupabaseClient,
  args: Json,
  columnas: string
): Promise<{ ok: true; fila: FilaCotizacion } | { ok: false; error: string }> {
  const id = String(args.cotizacion_id ?? args.id ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Hace falta cotizacion_id (uuid).' };
  const { data, error } = await db
    .from('solicitudes_cotizacion')
    .select(columnas)
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Cotización no encontrada.' };
  return { ok: true, fila: data as unknown as FilaCotizacion };
}

async function ejecutarCotizacion(
  db: SupabaseClient,
  nombre: string,
  args: Json,
  quien: { actor: string; rol: string; motivo: string }
): Promise<Json | null> {
  if (nombre === 'buscar_cotizaciones') {
    const normalizado = normalizarFiltroCotizaciones(args);
    if (!normalizado.ok) return normalizado;
    const f = normalizado.filtro;
    let consulta = db
      .from('solicitudes_cotizacion')
      .select(COTIZACION_COLS_LISTA)
      .order('updated_at', { ascending: false })
      .limit(f.limite);
    if (f.estados.length > 0) consulta = consulta.in('estado', f.estados);
    if (f.email) consulta = consulta.ilike('email', `%${f.email}%`);
    if (f.empresa) consulta = consulta.ilike('empresa', `%${f.empresa}%`);
    if (f.desde) consulta = consulta.gte('created_at', `${f.desde}T00:00:00Z`);
    if (f.hasta) consulta = consulta.lte('created_at', `${f.hasta}T23:59:59.999Z`);
    if (f.q) {
      consulta = consulta.or(
        `numero.ilike.%${f.q}%,nombre.ilike.%${f.q}%,empresa.ilike.%${f.q}%,email.ilike.%${f.q}%`
      );
    }
    const { data, error } = await consulta;
    if (error) return { ok: false, error: error.message };
    const filas = (data ?? []) as unknown as FilaCotizacion[];
    const asesores = await asesoresPorIds(
      db,
      filas.map(fila => fila.created_by)
    );
    return {
      ok: true,
      total: filas.length,
      cotizaciones: filas.map(fila =>
        resumenCotizacion(fila, fila.created_by ? (asesores.get(fila.created_by) ?? null) : null)
      ),
    };
  }

  if (nombre === 'obtener_cotizacion') {
    const cargada = await cotizacionPorId(db, args, COTIZACION_COLS_DETALLE);
    if (!cargada.ok) return cargada;
    const fila = cargada.fila;
    const asesores = await asesoresPorIds(db, [fila.created_by]);
    let pdfUrl: string | null = null;
    const ruta = (fila as { pdf_storage_path?: string | null }).pdf_storage_path;
    if (ruta) {
      const firmada = await db.storage.from('cotizaciones-pdf').createSignedUrl(ruta, 3600);
      pdfUrl = firmada.data?.signedUrl ?? null;
    }
    return {
      ok: true,
      cotizacion: detalleCotizacion(
        fila,
        fila.created_by ? (asesores.get(fila.created_by) ?? null) : null,
        { pdf_url: pdfUrl }
      ),
    };
  }

  if (nombre === 'actualizar_cotizacion') {
    const cargada = await cotizacionPorId(db, args, COTIZACION_COLS_DETALLE);
    if (!cargada.ok) return cargada;
    const fila = cargada.fila;
    if (
      args.updated_at &&
      fila.updated_at &&
      new Date(String(args.updated_at)).getTime() !== new Date(fila.updated_at).getTime()
    ) {
      return {
        ok: false,
        code: 'CONCURRENT_UPDATE',
        error: 'Otra persona modificó la cotización. Vuelve a leerla con obtener_cotizacion.',
      };
    }
    let lineas: Awaited<ReturnType<typeof construirLineasCotizacion>> | null = null;
    if (args.lineas !== undefined) {
      const monedaFinal =
        String(args.moneda ?? fila.moneda ?? 'COP').toUpperCase() === 'USD' ? 'USD' : 'COP';
      const ids = (Array.isArray(args.lineas) ? (args.lineas as Json[]) : [])
        .map(linea => String(linea?.producto_id ?? '').trim())
        .filter(Boolean);
      const catalogo = new Map<string, ProductoCatalogo>();
      if (ids.length > 0) {
        const { data, error } = await db
          .from('productos')
          .select('id,slug,nombre_es')
          .in('id', ids);
        if (error) return { ok: false, error: error.message };
        for (const producto of data ?? []) {
          catalogo.set(String(producto.id), {
            id: String(producto.id),
            slug: String(producto.slug ?? ''),
            nombre_es: String(producto.nombre_es ?? ''),
          });
        }
      }
      lineas = construirLineasCotizacion(args.lineas, catalogo, monedaFinal);
      if (!lineas.ok) return lineas;
    }
    const cambios = construirCambiosCotizacion(
      args,
      fila,
      lineas && lineas.ok ? lineas.lineas : null
    );
    if (!cambios.ok) return cambios;
    const { error } = await db
      .from('solicitudes_cotizacion')
      .update(cambios.cambios.patch)
      .eq('id', fila.id);
    if (error) return { ok: false, error: error.message };
    await db.rpc('ensure_cotizacion_numero', { p_id: fila.id });
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'solicitudes_cotizacion',
      entidadId: fila.id,
      antes: {
        estado: fila.estado,
        total: fila.precio_total_ofertado,
        lineas: Array.isArray(fila.productos) ? fila.productos.length : null,
      },
      despues: { campos: cambios.cambios.campos },
    });
    const recargada = await cotizacionPorId(
      db,
      { cotizacion_id: fila.id },
      COTIZACION_COLS_DETALLE
    );
    if (!recargada.ok) return { ok: true, actualizados: cambios.cambios.campos };
    const asesores = await asesoresPorIds(db, [recargada.fila.created_by]);
    return {
      ok: true,
      actualizados: cambios.cambios.campos,
      cotizacion: detalleCotizacion(
        recargada.fila,
        recargada.fila.created_by ? (asesores.get(recargada.fila.created_by) ?? null) : null
      ),
      siguiente_paso:
        'preparar_envio_cotizacion para enviarla al cliente (requiere aprobación de owner/admin).',
    };
  }

  if (nombre === 'preparar_envio_cotizacion') {
    const actorEmail = String(args.actor_email ?? '')
      .trim()
      .toLowerCase();
    if (!esEmailValido(actorEmail)) {
      return {
        ok: false,
        error:
          'Hace falta actor_email: el usuario comercial a cuyo nombre se envía (p. ej. comercial1@i-me.com.co).',
      };
    }
    const canal = args.canal === 'whatsapp' ? 'whatsapp' : 'email';
    const cargada = await cotizacionPorId(db, args, COTIZACION_COLS_ENVIO);
    if (!cargada.ok) return cargada;
    const fila = cargada.fila;
    if (fila.pedido_id || fila.estado === 'convertida') {
      return {
        ok: false,
        code: 'COTIZACION_YA_CONVERTIDA',
        error: 'La cotización ya fue convertida en pedido.',
      };
    }
    const validada = validarEnvioCotizacion(fila, { canal, exigirPreciosFirmes: true });
    if (!validada.ok) return { ok: false, code: validada.code, error: validada.message };
    // Dry-run en la misma función que enviará: valida actor, plantilla activa y genera la vista previa.
    const simulacion = await db.functions.invoke('enviar-cotizacion', {
      body: { cotizacion_id: fila.id, canal, actor_email: actorEmail, dry_run: true },
    });
    if (simulacion.error) {
      const detalle = await errorDeFuncion(simulacion.error);
      return {
        ok: false,
        error: detalle.message,
        ...(detalle.code ? { code: detalle.code } : {}),
        ...(detalle.details ? { detalle: detalle.details } : {}),
      };
    }
    const vista = simulacion.data as Json;
    const huella = await huellaOferta(fila);
    const resumen = {
      destinatario: vista.destinatario,
      asunto: vista.asunto ?? null,
      total: vista.total,
      moneda: vista.moneda,
      validez_hasta: vista.validez_hasta ?? null,
      lineas: vista.lineas,
      asesor: vista.asesor,
      reply_to: vista.reply_to,
    };
    const previa = await preparar(
      db,
      {
        ...args,
        motivo: quien.motivo || `${MOTIVO_ENVIO_DEFECTO} ${fila.numero ?? ''}`.trim(),
        entidad_id: fila.id,
        payload: {
          cotizacion_id: fila.id,
          canal,
          actor_email: actorEmail,
          huella,
          pdf_preview_url: vista.pdf_preview_url ?? null,
          resumen,
        },
      },
      'preparar_envio_cotizacion',
      'solicitudes_cotizacion',
      ENVIO_COTIZACION_VENCE_MS
    );
    if (!previa.ok) return previa;
    return {
      ...previa,
      cotizacion_id: fila.id,
      numero: fila.numero ?? null,
      resumen,
      pdf_preview_url: vista.pdf_preview_url ?? null,
      pdf_preview_error: vista.pdf_preview_error ?? null,
      aprobacion:
        'Un owner/admin debe aprobar esta solicitud en el CMS (Dashboard → Aprobaciones del agente) antes de confirmar. Vence en 4 h.',
    };
  }

  if (nombre === 'confirmar_envio_cotizacion') {
    const conMotivo = { ...args, motivo: quien.motivo || MOTIVO_ENVIO_DEFECTO };
    const listo = await confirmar(db, conMotivo, 'preparar_envio_cotizacion');
    if (!listo.ok) return listo;
    const confirmacion = listo.fila as { id: string; entidad_id: string | null; payload: Json };
    const payload = confirmacion.payload ?? {};
    const cargada = await cotizacionPorId(
      db,
      { cotizacion_id: confirmacion.entidad_id },
      COTIZACION_COLS_ENVIO
    );
    if (!cargada.ok) return cargada;
    // La oferta no puede haber cambiado entre la aprobación y el envío.
    if ((await huellaOferta(cargada.fila)) !== String(payload.huella ?? '')) {
      return {
        ok: false,
        code: 'OFERTA_CAMBIADA',
        error: 'La cotización cambió después de preparar el envío. Prepara y aprueba uno nuevo.',
      };
    }
    const canal = payload.canal === 'whatsapp' ? 'whatsapp' : 'email';
    const envio = await db.functions.invoke('enviar-cotizacion', {
      body: {
        cotizacion_id: confirmacion.entidad_id,
        canal,
        actor_email: String(payload.actor_email ?? ''),
      },
    });
    if (envio.error) {
      const detalle = await errorDeFuncion(envio.error);
      await registrar(db, {
        ...quien,
        herramienta: nombre,
        entidad: 'solicitudes_cotizacion',
        entidadId: confirmacion.entidad_id,
        despues: { enviado: false, send_error: detalle.details ?? detalle.message },
        confirmacionId: confirmacion.id,
      });
      return {
        ok: false,
        error: detalle.message,
        ...(detalle.code ? { code: detalle.code } : {}),
        send_error: detalle.details ?? detalle.message,
        nota: 'No se marcó como enviada. La aprobación sigue vigente: corrige la causa y vuelve a confirmar.',
      };
    }
    const resultado = envio.data as Json;
    await db
      .from('comercio_confirmaciones')
      .update({
        estado: 'confirmada',
        confirmada_en: new Date().toISOString(),
        confirmada_por: quien.actor,
      })
      .eq('id', confirmacion.id);
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'solicitudes_cotizacion',
      entidadId: confirmacion.entidad_id,
      despues: {
        numero: resultado.numero,
        estado: resultado.estado,
        canal,
        message_id: resultado.message_id ?? null,
        reply_to: resultado.reply_to ?? null,
      },
      confirmacionId: confirmacion.id,
    });
    return {
      ok: true,
      cotizacion_id: confirmacion.entidad_id,
      numero: resultado.numero,
      estado: resultado.estado,
      canal,
      formalizar_url: resultado.formalizar_url,
      whatsapp_url: resultado.whatsapp_url ?? null,
      message_id: resultado.message_id ?? null,
      asesor: resultado.asesor,
      reply_to: resultado.reply_to ?? null,
      confirmacion_id: confirmacion.id,
    };
  }

  return null;
}

export interface McpEnvironment {
  TWENTY_BASE_URL?: string | undefined;
  TWENTY_MCP_API_KEY?: string | undefined;
}

export async function ejecutarComercio(
  nombre: McpToolName,
  args: Json,
  db: SupabaseClient | null,
  env: McpEnvironment = {}
): Promise<Json> {
  if (nombre === 'decidir_compra') {
    const precio = args.precio == null || args.precio === '' ? null : Number(args.precio);
    const stock = args.stock == null || args.stock === '' ? null : Number(args.stock);
    return {
      ok: true,
      ...decidirCompra({
        activo: args.activo !== false,
        disponible: args.disponible !== false,
        precio: Number.isFinite(precio) ? precio : null,
        stock: Number.isFinite(stock) ? stock : null,
        gestionar_stock: Boolean(args.gestionar_stock),
        stock_estado: args.stock_estado ? String(args.stock_estado) : null,
        slug: args.slug ? String(args.slug) : null,
      }),
    };
  }

  if (!db) return sinBase();
  const quien = actorDe(args);

  if (nombre === 'bandeja_trabajo') {
    const [cotizaciones, oportunidades, pedidos, carritos, fulfillments] = await Promise.all([
      db
        .from('solicitudes_cotizacion')
        .select('id,numero,nombre,empresa,created_at')
        .eq('leida', false)
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('crm_opportunities')
        .select('id,titulo,etapa,updated_at')
        .in('etapa', ['nuevo', 'cotizando'])
        .is('eliminada_at', null)
        .order('updated_at', { ascending: false })
        .limit(8),
      db
        .from('pedidos')
        .select('id,estado,proveedor_pago,referencia_pasarela,total,moneda')
        .in('estado', ['pendiente', 'pendiente_validacion'])
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('carritos_abandonados')
        .select('id,estado,subtotal,created_at')
        .eq('estado', 'activo')
        .order('created_at', { ascending: false })
        .limit(5),
      db
        .from('fulfillments')
        .select('id,estado,pedido_id,tracking_number')
        .eq('estado', 'error')
        .limit(5),
    ]);
    const errores = [cotizaciones, oportunidades, pedidos, carritos, fulfillments]
      .map(result => result.error?.message)
      .filter(Boolean);
    return {
      ok: errores.length === 0,
      errores,
      presupuestos_sin_leer: cotizaciones.data ?? [],
      oportunidades: oportunidades.data ?? [],
      pedidos: (pedidos.data ?? []).map(row => ({
        href: `#/pedido?id=${row.id}`,
        titulo: `Pedido ${row.referencia_pasarela || String(row.id).slice(0, 8)}`,
        siguiente_paso: siguientePasoPedido({
          estado: String(row.estado ?? ''),
          proveedorPago: row.proveedor_pago ? String(row.proveedor_pago) : null,
        }),
      })),
      carritos: carritos.data ?? [],
      fulfillments_error: fulfillments.data ?? [],
    };
  }

  if (nombre === 'buscar_productos' || nombre === 'fichas_incompletas') {
    let query = db.from('productos').select(PRODUCTO_COLS).limit(30);
    if (nombre === 'fichas_incompletas') query = query.eq('activo', true);
    const q = String(args.q ?? '').replace(/[,()%]/g, '');
    if (q) {
      query = query.or(
        `nombre_es.ilike.%${q}%,slug.ilike.%${q}%,sku.ilike.%${q}%,gtin.ilike.%${q}%`
      );
    }
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []).map(row => filaSinSecretos(row as Json));
    const filtradas =
      nombre === 'fichas_incompletas'
        ? rows.filter(row => {
            const specs = row.especificaciones;
            return (
              !row.imagen_principal || !row.ficha_pdf || !Array.isArray(specs) || specs.length === 0
            );
          })
        : rows;
    return {
      ok: true,
      productos: filtradas.map(row => ({
        ...row,
        decision: decidirCompra({
          activo: row.activo !== false,
          disponible: row.disponible !== false,
          precio: typeof row.precio === 'number' ? row.precio : null,
          stock: typeof row.stock === 'number' ? row.stock : null,
          gestionar_stock: Boolean(row.gestionar_stock),
          stock_estado: row.stock_estado ? String(row.stock_estado) : null,
          slug: row.slug ? String(row.slug) : null,
        }),
      })),
    };
  }

  if (nombre === 'buscar_clientes') {
    const q = String(args.q ?? '').replace(/[,()%]/g, '');
    let query = db
      .from('clientes')
      .select('id,email,nombre,apellido,institucion,razon_social,documento_numero,tipo_cliente')
      .limit(30);
    if (q) {
      query = query.or(
        `email.ilike.%${q}%,nombre.ilike.%${q}%,institucion.ilike.%${q}%,razon_social.ilike.%${q}%,documento_numero.ilike.%${q}%`
      );
    }
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, clientes: data ?? [] };
  }

  if (nombre === 'ficha_cliente') {
    const id = String(args.id ?? '');
    const { data, error } = await db
      .from('clientes')
      .select(
        'id,email,nombre,apellido,institucion,razon_social,documento_numero,tipo_cliente,lista_precio_id,notas'
      )
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Cliente no encontrado.' };
    const [pedidos, cotizaciones] = await Promise.all([
      db.from('pedidos').select('id,estado,total,moneda,created_at').eq('cliente_id', id).limit(10),
      db
        .from('solicitudes_cotizacion')
        .select('id,numero,nombre,created_at')
        .eq('email', data.email)
        .limit(10),
    ]);
    return {
      ok: true,
      cliente: filaSinSecretos(data as Json),
      pedidos: pedidos.data ?? [],
      cotizaciones: cotizaciones.data ?? [],
      errores: [pedidos.error?.message, cotizaciones.error?.message].filter(Boolean),
    };
  }

  if (nombre === 'buscar_pedidos' || nombre === 'ficha_pedido') {
    if (nombre === 'ficha_pedido') {
      const { data, error } = await db
        .from('pedidos')
        .select(
          'id,estado,proveedor_pago,referencia_pasarela,total,moneda,facturacion_electronica_estado,cliente_id'
        )
        .eq('id', String(args.id ?? ''))
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      if (!data) return { ok: false, error: 'Pedido no encontrado.' };
      const guias = await db
        .from('fulfillments')
        .select('id,estado,tracking_number,tracking_url')
        .eq('pedido_id', data.id);
      const tieneGuia = (guias.data ?? []).some(row => row.tracking_number || row.tracking_url);
      return {
        ok: true,
        pedido: filaSinSecretos(data as Json),
        guias: guias.data ?? [],
        siguiente_paso: siguientePasoPedido({
          estado: String(data.estado ?? ''),
          proveedorPago: data.proveedor_pago ? String(data.proveedor_pago) : null,
          tieneGuia,
          facturaEstado: data.facturacion_electronica_estado
            ? String(data.facturacion_electronica_estado)
            : null,
        }),
      };
    }
    const q = String(args.q ?? '').replace(/[,()%]/g, '');
    let query = db
      .from('pedidos')
      .select('id,estado,proveedor_pago,referencia_pasarela,total,moneda,created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    if (q) query = query.or(`referencia_pasarela.ilike.%${q}%,estado.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      pedidos: (data ?? []).map(row => ({
        ...filaSinSecretos(row as Json),
        siguiente_paso: siguientePasoPedido({
          estado: String(row.estado ?? ''),
          proveedorPago: row.proveedor_pago ? String(row.proveedor_pago) : null,
        }),
      })),
    };
  }

  if (nombre === 'buscar_proveedores') {
    const q = String(args.q ?? '').replace(/[,()%]/g, '');
    let query = db.from('proveedores').select(PROVEEDOR_COLS).limit(30);
    if (q) {
      query = query.or(
        `nombre.ilike.%${q}%,slug.ilike.%${q}%,pais.ilike.%${q}%,lineas_equipos.ilike.%${q}%,contacto_email.ilike.%${q}%`
      );
    }
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, proveedores: (data ?? []).map(row => filaSinSecretos(row as Json)) };
  }

  if (nombre === 'tarifas_envio') {
    const departamento = String(args.departamento ?? '').trim();
    const { data, error } = await db
      .from('tarifas_envio')
      .select('zona,costo,gratis_desde,departamentos')
      .limit(50);
    if (error) return { ok: false, error: error.message };
    const filas = data ?? [];
    const match = departamento
      ? filas.filter(row =>
          JSON.stringify(row.departamentos ?? '')
            .toLowerCase()
            .includes(departamento.toLowerCase())
        )
      : filas;
    return { ok: true, tarifas: match.length ? match : filas };
  }

  if (nombre === 'proponer_precio') {
    const precio = Number(args.precio);
    const piso = args.piso == null || args.piso === '' ? null : Number(args.piso);
    if (precioBajoPiso(precio, piso)) {
      return preparar(
        db,
        { ...args, payload: { precio, piso }, entidad_id: args.producto_id },
        'preparar_precio_bajo_piso',
        'productos'
      );
    }
    const id = String(args.producto_id ?? '');
    const antes = await db.from('productos').select('precio_regular').eq('id', id).maybeSingle();
    const { error } = await db.from('productos').update({ precio_regular: precio }).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'productos',
      entidadId: id,
      antes: antes.data,
      despues: { precio_regular: precio },
    });
    return { ok: true, precio_regular: precio };
  }

  if (nombre === 'proponer_stock') {
    const id = String(args.producto_id ?? '');
    const patch: Json = {};
    if (args.stock != null && args.stock !== '') patch.stock = Number(args.stock);
    if (typeof args.disponible === 'boolean') patch.disponible = args.disponible;
    const { error } = await db.from('productos').update(patch).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'productos',
      entidadId: id,
      despues: patch,
    });
    return { ok: true, aplicado: patch };
  }

  if (nombre === 'redactar_recordatorio_carrito') {
    const items = Array.isArray(args.items) ? args.items : [];
    return {
      ok: true,
      texto: `Tienes un carrito pendiente en I-ME. Ítems: ${
        items.map(item => JSON.stringify(item)).join(', ') || 'sin detalle'
      }. El precio y la reserva son los del checkout.`,
      envio: 'Lo envía una persona o el flujo recordatorio-carritos.',
    };
  }

  const deCotizacion = await ejecutarCotizacion(db, nombre, args, quien);
  if (deCotizacion) return deCotizacion;

  if (nombre === 'preparar_borrado_crm') {
    const objetivo = objetivoBorradoCrm(args.objeto, args.entidad_id);
    if (!objetivo.ok) return objetivo;
    return preparar(
      db,
      { ...args, entidad_id: objetivo.id, payload: { objeto: objetivo.objeto } },
      nombre,
      `twenty.${objetivo.objeto}`
    );
  }

  if (nombre.startsWith('preparar_')) {
    return preparar(db, args, nombre, String(args.entidad ?? 'comercio'));
  }

  if (nombre.startsWith('confirmar_')) {
    const prepararNombre = nombre.replace('confirmar_', 'preparar_');
    const listo = await confirmar(db, args, prepararNombre);
    if (!listo.ok) return listo;
    const fila = listo.fila as { id: string; entidad_id: string | null; payload: Json };
    if (nombre === 'confirmar_precio_bajo_piso' && fila.entidad_id) {
      const precio = Number((fila.payload as Json).precio);
      const { error } = await db
        .from('productos')
        .update({ precio_regular: precio })
        .eq('id', fila.entidad_id);
      if (error) return { ok: false, error: error.message };
    }
    if (nombre === 'confirmar_reembolso' && fila.entidad_id) {
      const { error } = await db
        .from('pedidos')
        .update({ estado: 'reembolsado' })
        .eq('id', fila.entidad_id);
      if (error) return { ok: false, error: error.message };
    }
    if (nombre === 'confirmar_afirmacion_invima' && fila.entidad_id) {
      const payload = fila.payload as Json;
      const patch: Json = {};
      if (payload.estado_invima) patch.estado_invima = String(payload.estado_invima).slice(0, 120);
      if (payload.invima_titular)
        patch.invima_titular = String(payload.invima_titular).slice(0, 200);
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: 'La confirmación no trae estado_invima ni invima_titular.' };
      }
      const { error } = await db.from('proveedores').update(patch).eq('id', fila.entidad_id);
      if (error) return { ok: false, error: error.message };
    }
    if (nombre === 'confirmar_borrado_crm') {
      const objetivo = objetivoBorradoCrm((fila.payload as Json).objeto, fila.entidad_id);
      if (!objetivo.ok) return objetivo;
      const borrado = await borrarEnTwenty(objetivo.objeto, objetivo.id, env);
      if (!borrado.ok) return borrado;
    }
    if (nombre === 'confirmar_factura' || nombre === 'confirmar_anulacion_factura') {
      const funcion =
        nombre === 'confirmar_factura' ? 'emitir-factura-dian' : 'anular-factura-dian';
      const invocado = await db.functions.invoke(funcion, {
        body: { pedido_id: fila.entidad_id, motivo: quien.motivo },
      });
      if (invocado.error) return { ok: false, error: invocado.error.message };
    }
    await db
      .from('comercio_confirmaciones')
      .update({
        estado: 'confirmada',
        confirmada_en: new Date().toISOString(),
        confirmada_por: quien.actor,
      })
      .eq('id', fila.id);
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'comercio_confirmaciones',
      entidadId: fila.id,
      despues: { estado: 'confirmada' },
      confirmacionId: fila.id,
    });
    return { ok: true, confirmacion_id: fila.id, estado: 'confirmada' };
  }

  if (nombre === 'reservar_stock') {
    const productoId = String(args.producto_id ?? '');
    const cantidad = Math.trunc(Number(args.cantidad));
    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) {
      return { ok: false, error: 'Hacen falta producto_id y cantidad > 0.' };
    }
    const minutos = Math.min(120, Math.max(5, Number(args.minutos) || 30));
    const [producto, activas] = await Promise.all([
      db.from('productos').select('id,stock,gestionar_stock').eq('id', productoId).maybeSingle(),
      db
        .from('stock_reservas')
        .select('cantidad')
        .eq('producto_id', productoId)
        .eq('estado', 'activa')
        .gt('expires_at', new Date().toISOString()),
    ]);
    if (producto.error) return { ok: false, error: producto.error.message };
    if (!producto.data) return { ok: false, error: 'Producto no encontrado.' };
    if (activas.error) return { ok: false, error: activas.error.message };
    const reservadas = (activas.data ?? []).reduce(
      (sum, row) => sum + Number(row.cantidad || 0),
      0
    );
    const libres = unidadesReservables(
      typeof producto.data.stock === 'number' ? producto.data.stock : null,
      Boolean(producto.data.gestionar_stock),
      reservadas
    );
    if (libres != null && libres < cantidad) {
      return { ok: false, error: `Solo quedan ${libres} unidades sin reservar.`, libres };
    }
    const fila = {
      producto_id: productoId,
      pedido_id: args.pedido_id ? String(args.pedido_id) : null,
      cantidad,
      expires_at: new Date(Date.now() + minutos * 60 * 1000).toISOString(),
      correlation_id: String(args.correlation_id ?? `mcp:${quien.actor}:${Date.now()}`),
    };
    const { data, error } = await db
      .from('stock_reservas')
      .insert(fila)
      .select('id,expires_at')
      .single();
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'productos',
      entidadId: productoId,
      despues: { reserva_id: data.id, cantidad, expires_at: data.expires_at },
    });
    return { ok: true, reserva_id: data.id, expires_at: data.expires_at, libres_antes: libres };
  }

  if (nombre === 'registrar_handoff') {
    const titulo = String(args.titulo ?? '').trim();
    if (!titulo) return { ok: false, error: 'Hace falta un titulo.' };
    const cotizacionId = args.cotizacion_id ? String(args.cotizacion_id) : '';
    const sourceType = cotizacionId ? 'cotizacion' : 'formulario';
    const sourceTable = cotizacionId ? 'solicitudes_cotizacion' : 'mcp_handoff';
    const sourceId = cotizacionId || crypto.randomUUID();
    if (cotizacionId) {
      const existente = await db
        .from('crm_opportunities')
        .select('id,etapa,metadata')
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .maybeSingle();
      if (existente.error) return { ok: false, error: existente.error.message };
      if (existente.data) {
        const metadata = {
          ...((existente.data.metadata as Json | null) ?? {}),
          ultimo_handoff: {
            canal: String(args.canal ?? 'agente'),
            resumen: String(args.resumen ?? '').slice(0, 2000),
            por: quien.actor,
            en: new Date().toISOString(),
          },
        };
        const { error } = await db
          .from('crm_opportunities')
          .update({ metadata })
          .eq('id', existente.data.id);
        if (error) return { ok: false, error: error.message };
        await registrar(db, {
          ...quien,
          herramienta: nombre,
          entidad: 'crm_opportunities',
          entidadId: existente.data.id,
          despues: { ultimo_handoff: metadata.ultimo_handoff },
        });
        return { ok: true, oportunidad_id: existente.data.id, etapa: existente.data.etapa };
      }
    }
    const { data, error } = await db
      .from('crm_opportunities')
      .upsert(
        {
          source_type: sourceType,
          source_table: sourceTable,
          source_id: sourceId,
          cliente_id: args.cliente_id ? String(args.cliente_id) : null,
          titulo: titulo.slice(0, 200),
          etapa: 'nuevo',
          valor_estimado:
            args.valor_estimado == null || args.valor_estimado === ''
              ? null
              : Number(args.valor_estimado),
          productos: Array.isArray(args.items) ? args.items : [],
          metadata: {
            canal: String(args.canal ?? 'agente'),
            resumen: String(args.resumen ?? '').slice(0, 2000),
            email: args.email ? String(args.email) : null,
            registrado_por: quien.actor,
          },
        },
        { onConflict: 'source_table,source_id' }
      )
      .select('id,etapa')
      .single();
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'crm_opportunities',
      entidadId: data.id,
      despues: { titulo, source_type: sourceType, canal: args.canal ?? 'agente' },
    });
    return { ok: true, oportunidad_id: data.id, etapa: data.etapa };
  }

  if (nombre === 'actualizar_etapa_crm') {
    const id = String(args.id ?? '');
    const etapa = String(args.etapa ?? '');
    const cambio = cambioEtapaCrm(etapa, quien.motivo);
    if (!cambio.ok) return cambio;
    const antes = await db
      .from('crm_opportunities')
      .select('id,etapa,closed_at')
      .eq('id', id)
      .maybeSingle();
    if (antes.error) return { ok: false, error: antes.error.message };
    if (!antes.data) return { ok: false, error: 'Oportunidad no encontrada.' };
    const patch: Json = {
      etapa,
      closed_at: cambio.cierra ? new Date().toISOString() : null,
    };
    if (args.next_action_at) patch.next_action_at = String(args.next_action_at);
    const { error } = await db.from('crm_opportunities').update(patch).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'crm_opportunities',
      entidadId: id,
      antes: antes.data,
      despues: patch,
    });
    return { ok: true, etapa };
  }

  if (nombre === 'crear_borrador_cotizacion') {
    const nombreCliente = String(args.nombre ?? '').trim();
    const email = String(args.email ?? '').trim();
    const telefono = String(args.telefono ?? '').trim();
    if (!nombreCliente || !email || !telefono) {
      return { ok: false, error: 'Hacen falta nombre, email y telefono.' };
    }
    const items = (Array.isArray(args.items) ? args.items : []) as Json[];
    const ids = items.map(item => String(item.producto_id ?? '')).filter(Boolean);
    if (ids.length === 0) return { ok: false, error: 'Añade al menos un producto_id en items.' };
    const { data: productos, error: prodError } = await db
      .from('productos')
      .select(PRODUCTO_COLS)
      .in('id', ids);
    if (prodError) return { ok: false, error: prodError.message };
    const porId = new Map((productos ?? []).map(row => [String(row.id), row as Json]));
    const lineas = items.flatMap(item => {
      const producto = porId.get(String(item.producto_id ?? ''));
      if (!producto) return [];
      const cantidad = Math.max(1, Math.trunc(Number(item.cantidad) || 1));
      const precio = typeof producto.precio === 'number' ? producto.precio : 0;
      return [
        {
          slug: String(producto.slug ?? ''),
          nombre: String(producto.nombre_es ?? ''),
          cantidad,
          precio_unitario: precio,
          subtotal: precio * cantidad,
          moneda: 'COP',
          precio_pendiente_validar: true,
        },
      ];
    });
    if (lineas.length === 0) return { ok: false, error: 'Ningún producto_id existe.' };
    const { data, error } = await db
      .from('solicitudes_cotizacion')
      .insert({
        nombre: nombreCliente.slice(0, 200),
        email: email.slice(0, 200),
        telefono: telefono.slice(0, 40),
        empresa: args.empresa ? String(args.empresa).slice(0, 200) : null,
        mensaje: String(args.mensaje ?? '').slice(0, 4000),
        productos: lineas,
        estado: 'nueva',
        origen: 'mcp',
      })
      .select('id,estado')
      .single();
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'solicitudes_cotizacion',
      entidadId: data.id,
      despues: { lineas: lineas.length },
    });
    return {
      ok: true,
      cotizacion_id: data.id,
      estado: data.estado,
      nota: 'Borrador con precios por validar. Enviarlo al cliente lo hace una persona desde el admin.',
    };
  }

  if (nombre === 'proponer_ficha') {
    const productoId = String(args.producto_id ?? '');
    const campos = camposFichaPermitidos((args.payload ?? {}) as Json);
    if (!productoId || Object.keys(campos).length === 0) {
      return {
        ok: false,
        error: 'Hacen falta producto_id y al menos un campo de ficha en payload.',
      };
    }
    if (!quien.motivo) return { ok: false, error: 'Hace falta un motivo.' };
    const { data, error } = await db
      .from('comercio_confirmaciones')
      .insert({
        vence_en: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        actor: quien.actor,
        rol: quien.rol,
        herramienta: 'proponer_ficha',
        entidad: 'productos',
        entidad_id: productoId,
        payload: campos,
        motivo: quien.motivo,
      })
      .select('id,vence_en')
      .single();
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      propuesta_id: data.id,
      vence_en: data.vence_en,
      nota: 'La ficha no cambia hasta que una persona aplica la propuesta en el admin.',
    };
  }

  if (nombre === 'proponer_fulfillment') {
    const id = String(args.id ?? '');
    const estado = args.estado ? String(args.estado) : '';
    const antes = await db
      .from('fulfillments')
      .select('id,estado,tracking_number,tracking_url,pedido_id')
      .eq('id', id)
      .maybeSingle();
    if (antes.error) return { ok: false, error: antes.error.message };
    if (!antes.data) return { ok: false, error: 'Fulfillment no encontrado.' };
    const patch: Json = {};
    if (args.tracking_number) patch.tracking_number = String(args.tracking_number).slice(0, 120);
    if (args.tracking_url) patch.tracking_url = String(args.tracking_url).slice(0, 500);
    if (estado) {
      if (!['preparando', 'enviado', 'entregado'].includes(estado)) {
        return { ok: false, error: 'El agente solo marca preparando, enviado o entregado.' };
      }
      const guia =
        patch.tracking_number ||
        patch.tracking_url ||
        antes.data.tracking_number ||
        antes.data.tracking_url;
      if ((estado === 'enviado' || estado === 'entregado') && !guia) {
        return { ok: false, error: 'Sin guía no se marca enviado ni entregado.' };
      }
      patch.estado = estado;
    }
    if (Object.keys(patch).length === 0) return { ok: false, error: 'Nada que actualizar.' };
    const { error } = await db.from('fulfillments').update(patch).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await registrar(db, {
      ...quien,
      herramienta: nombre,
      entidad: 'pedidos',
      entidadId: String(antes.data.pedido_id ?? ''),
      antes: antes.data,
      despues: patch,
    });
    return { ok: true, aplicado: patch };
  }

  return { ok: false, error: `Herramienta no implementada: ${nombre}` };
}

const inputSchema = {
  type: 'object',
  properties: {
    actor: { type: 'string' },
    rol: { type: 'string' },
    motivo: { type: 'string' },
    q: { type: 'string' },
    id: { type: 'string' },
    producto_id: { type: 'string' },
    precio: { type: 'number' },
    piso: { type: 'number' },
    stock: { type: 'number' },
    disponible: { type: 'boolean' },
    activo: { type: 'boolean' },
    gestionar_stock: { type: 'boolean' },
    stock_estado: { type: 'string' },
    slug: { type: 'string' },
    departamento: { type: 'string' },
    confirmacion_id: { type: 'string' },
    entidad_id: { type: 'string' },
    entidad: { type: 'string' },
    objeto: {
      type: 'string',
      description: 'borrado_crm: opportunities | people | companies (Twenty)',
    },
    items: { type: 'array', description: '[{producto_id, cantidad}]' },
    payload: { type: 'object' },
    cantidad: { type: 'number' },
    minutos: { type: 'number' },
    pedido_id: { type: 'string' },
    correlation_id: { type: 'string' },
    titulo: { type: 'string' },
    canal: { type: 'string' },
    resumen: { type: 'string' },
    email: { type: 'string' },
    cliente_id: { type: 'string' },
    cotizacion_id: { type: 'string' },
    valor_estimado: { type: 'number' },
    etapa: { type: 'string' },
    next_action_at: { type: 'string' },
    nombre: { type: 'string' },
    telefono: { type: 'string' },
    empresa: { type: 'string' },
    mensaje: { type: 'string' },
    estado: { type: 'string' },
    tracking_number: { type: 'string' },
    tracking_url: { type: 'string' },
    actor_email: {
      type: 'string',
      description:
        'preparar_envio_cotizacion: usuario comercial (ventas/admin/owner activo) a cuyo nombre se envía.',
    },
    lineas: {
      type: 'array',
      description:
        'actualizar_cotizacion: reemplaza las líneas. [{producto_id|nombre, cantidad, precio_unitario>0, descripcion?}]',
    },
    cliente: {
      type: 'object',
      description:
        'actualizar_cotizacion: {nombre, empresa, nit, email, telefono, ciudad, direccion_envio, direccion_facturacion}',
    },
    condiciones: { type: 'string' },
    validez_hasta: { type: 'string', description: 'YYYY-MM-DD' },
    moneda: { type: 'string', description: 'COP | USD' },
    impuestos_incluidos: { type: 'boolean' },
    notas: { type: 'string' },
    updated_at: {
      type: 'string',
      description: 'actualizar_cotizacion: control de concurrencia opcional',
    },
    desde: { type: 'string', description: 'buscar_cotizaciones: YYYY-MM-DD (created_at)' },
    hasta: { type: 'string', description: 'buscar_cotizaciones: YYYY-MM-DD (created_at)' },
    limite: { type: 'number', description: 'buscar_cotizaciones: 1-50 (def. 20)' },
  },
};

export function herramientasComercio() {
  return MCP_TOOLS.map(name => ({
    name,
    description: `Operación ime-comercio: ${name}. No activa dropshipping ni devuelve secretos.`,
    inputSchema,
  }));
}
