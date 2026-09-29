/**
 * MCP stdio de ime-comercio. Centro de verdad: las tablas de Supabase.
 * Lo arranca `npm run mcp:comercio`. No lo importa el admin.
 * La service role se lee del entorno y no se devuelve en ninguna herramienta.
 */
import { createInterface } from 'node:readline';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
} from '../lib/comercio-operacion.ts';

type Json = Record<string, unknown>;

const PRODUCTO_COLS =
  'id,slug,sku,gtin,nombre_es,precio,precio_regular,stock,gestionar_stock,stock_estado,disponible,activo,ficha_pdf,imagen_principal,especificaciones,fulfillment_mode';
const PROVEEDOR_COLS =
  'id,slug,nombre,razon_social,pais,ciudad,contacto_email,lineas_equipos,estado_invima,invima_titular,distribuidor_local,lifecycle_status,activo';

function cliente(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

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
  entidad: string
): Promise<Json> {
  const quien = actorDe(args);
  if (!quien.motivo) return { ok: false, error: 'Hace falta un motivo.' };
  // Margen para que un owner/admin la revise y apruebe en el CMS.
  const vence = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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
async function borrarEnTwenty(objeto: ObjetoTwentyBorrable, id: string): Promise<Json> {
  const base = process.env.TWENTY_BASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.TWENTY_MCP_API_KEY?.trim();
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

async function ejecutar(nombre: McpToolName, args: Json): Promise<Json> {
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

  const db = cliente();
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
      const borrado = await borrarEnTwenty(objetivo.objeto, objetivo.id);
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
  },
};

function herramientas() {
  return MCP_TOOLS.map(name => ({
    name,
    description: `Operación ime-comercio: ${name}. No activa dropshipping ni devuelve secretos.`,
    inputSchema,
  }));
}

function responder(id: unknown, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

async function onMessage(message: Json): Promise<void> {
  const id = message.id;
  const method = String(message.method ?? '');
  if (method === 'initialize') {
    responder(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'ime-comercio', version: '0.1.0' },
    });
    return;
  }
  if (method === 'notifications/initialized') return;
  if (method === 'tools/list') {
    responder(id, { tools: herramientas() });
    return;
  }
  if (method === 'tools/call') {
    const params = (message.params ?? {}) as Json;
    const name = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Json;
    if (!MCP_TOOLS.includes(name as McpToolName)) {
      responder(id, {
        content: [{ type: 'text', text: `Herramienta desconocida: ${name}` }],
        isError: true,
      });
      return;
    }
    const resultado = await ejecutar(name as McpToolName, args);
    responder(id, {
      content: [{ type: 'text', text: JSON.stringify(resultado) }],
      isError: resultado.ok === false,
    });
    return;
  }
  if (id !== undefined) {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Método ${method}` },
      })}\n`
    );
  }
}

const lineas = createInterface({ input: process.stdin });
lineas.on('line', line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  void onMessage(JSON.parse(trimmed) as Json).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'error mcp'}\n`);
  });
});
