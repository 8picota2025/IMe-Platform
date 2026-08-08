/**
 * Edge Function: crear-pago
 *
 * Checkout de productos con precio (>0). Recalcula precios server-side
 * desde Supabase, crea un pedido 'pendiente' y devuelve la URL de checkout
 * hospedado (Wompi Web Checkout para mercado CO, Stripe para INTL).
 * Sin precio → no checkout (van a cotización). Con precio → dropship/carrito.
 *
 * REGLA RECTORA: el servidor recalcula siempre — el cliente nunca decide
 * precios ni estado de pago.
 *
 * Variables requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * WOMPI_PUBLIC_KEY + WOMPI_INTEGRITY_SECRET (mercado CO) o STRIPE_SECRET_KEY (mercado INTL),
 * SITE_URL.
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { getPaymentGateway, type CheckoutItem, type Mercado } from '../_shared/payment-gateway.ts';
import {
  buildDianInvoiceDraft,
  calculateFiscalSummary,
  validateClienteFiscal,
  type ClienteFiscalProfile,
} from '../../../src/lib/fiscal.ts';
import { withTelemetry, trackEvent } from '../_shared/telemetry.ts';
import { notificarEstadoPedido } from '../_shared/post-pago.ts';
import { pushClienteToTwenty } from '../_shared/twenty-commerce-sync.ts';
import {
  calcularTotalOfertado,
  hashTokenSha256,
  ofertaCompleta,
  parseLineasOferta,
  tokenExpirado,
  type CotizacionOfertaRow,
  type CotizacionLineaOferta,
} from '../../../src/lib/cotizacion-oferta.ts';
import { decideCuponBurn } from '../../../src/lib/cupon-burn.ts';

const FN_NAME = 'crear-pago';
const MAX_ITEMS = 20;
const MAX_CANTIDAD = 50;

interface ItemRequest {
  slug?: string;
  cantidad?: number;
}

interface ClienteRequest {
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  institucion?: string;
}

interface FiscalDireccionRequest {
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  codigo_postal?: string;
  pais?: string;
}

interface FiscalRequest {
  solicitar_factura_electronica?: boolean;
  tipo_documento?: 'CC' | 'NIT' | 'CE' | 'PP' | 'OTRO';
  numero_documento?: string;
  tipo_persona?: 'natural' | 'juridica';
  razon_social?: string;
  responsable_iva?: boolean;
  agente_retencion?: boolean;
  agente_reteica?: boolean;
  email_facturacion?: string;
  direccion_facturacion?: FiscalDireccionRequest;
}

interface CrearPagoRequest {
  items?: ItemRequest[];
  cliente?: ClienteRequest;
  mercado?: string;
  cupon_codigo?: string;
  consentimiento_datos?: boolean;
  locale?: string;
  fiscal?: FiscalRequest;
  /** Formalizar desde cotización ofertada: precios locked en la oferta. */
  cotizacion_id?: string;
  formalizacion_token?: string;
}

interface ProductoRow {
  id: string;
  slug: string;
  familia_id: string | null;
  nombre_es: string;
  nombre_en: string | null;
  precio: number | string | null;
  precio_oferta: number | string | null;
  oferta_inicio: string | null;
  oferta_fin: string | null;
  moneda: string;
  stock: number | null;
  activo: boolean;
  /** Escenario A: disponibilidad en tiempo real provista por el proveedor. */
  disponible: boolean;
  tipo_comercial: string;
  fulfillment_mode: string;
  dian_codigo?: string | null;
  tarifa_iva_pct?: number | string | null;
  retencion_fuente_pct?: number | string | null;
  retencion_iva_pct?: number | string | null;
  retencion_ica_pct?: number | string | null;
  excluido_iva?: boolean | null;
}

interface CuponRow {
  id: string;
  codigo: string;
  tipo_descuento: 'porcentaje' | 'monto_carrito' | 'monto_producto';
  valor: number | string;
  moneda: string;
  activo: boolean;
  monto_minimo: number | string | null;
  monto_maximo: number | string | null;
  productos_incluidos: string[] | null;
  productos_excluidos: string[] | null;
  familias_incluidas: string[] | null;
  familias_excluidas: string[] | null;
  emails_permitidos: string[] | null;
  limite_uso_total: number | null;
  limite_uso_por_usuario: number | null;
  usos: number;
  empieza_at: string | null;
  expira_at: string | null;
}

function obtenerIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

interface ListaPrecioResuelta {
  descuentoPct: number;
  precios: Map<string, number>;
}

async function obtenerListaPrecio(
  supabase: ReturnType<typeof getServerSupabase>,
  email: string
): Promise<ListaPrecioResuelta | null> {
  const { data: clienteRow } = await supabase
    .from('clientes')
    .select('lista_precio_id')
    .eq('email', email)
    .maybeSingle();
  const listaId = (clienteRow as { lista_precio_id?: string | null } | null)?.lista_precio_id;
  if (!listaId) return null;

  const [{ data: lista }, { data: items }] = await Promise.all([
    supabase.from('listas_precio').select('descuento_pct, activo').eq('id', listaId).maybeSingle(),
    supabase.from('lista_precio_items').select('producto_id, precio').eq('lista_id', listaId),
  ]);
  const listaRow = lista as { descuento_pct?: number | string; activo?: boolean } | null;
  if (!listaRow?.activo) return null;

  const precios = new Map<string, number>();
  for (const item of (items ?? []) as Array<{ producto_id: string; precio: number | string }>) {
    const valor = Number(item.precio);
    if (valor > 0) precios.set(item.producto_id, valor);
  }
  return { descuentoPct: Number(listaRow.descuento_pct ?? 0), precios };
}

function normalizarDepto(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * Envio por zona (tabla tarifas_envio, solo mercado CO). La zona se resuelve
 * por departamento de la direccion de facturacion; una zona con departamentos
 * vacios actua como tarifa por defecto. gratis_desde compara contra la base
 * (subtotal - descuento). Sin tarifas configuradas: envio 0 (comportamiento previo).
 */
async function calcularEnvio(
  supabase: ReturnType<typeof getServerSupabase>,
  departamento: string | undefined,
  base: number
): Promise<number> {
  const { data, error } = await supabase
    .from('tarifas_envio')
    .select('zona, departamentos, tarifa, gratis_desde')
    .eq('activo', true);
  if (error || !data || data.length === 0) return 0;

  const tarifas = data as Array<{
    departamentos: string[] | null;
    tarifa: number | string;
    gratis_desde: number | string | null;
  }>;
  const depto = departamento ? normalizarDepto(departamento) : '';
  const especifica = depto
    ? tarifas.find(t => (t.departamentos ?? []).some(d => normalizarDepto(d) === depto))
    : undefined;
  const porDefecto = tarifas.find(t => (t.departamentos ?? []).length === 0);
  const zona = especifica ?? porDefecto;
  if (!zona) return 0;
  const gratisDesde = zona.gratis_desde === null ? null : Number(zona.gratis_desde);
  if (gratisDesde !== null && base >= gratisDesde) return 0;
  return Number(zona.tarifa) || 0;
}

/** Precio por producto de la lista tiene prioridad; si no, descuento % sobre el publico. */
function aplicarListaPrecio(
  lista: ListaPrecioResuelta | null,
  productoId: string,
  precioPublico: number
): number {
  if (!lista) return precioPublico;
  const especifico = lista.precios.get(productoId);
  if (especifico !== undefined) return especifico;
  if (lista.descuentoPct > 0) {
    return Math.round(precioPublico * (1 - lista.descuentoPct / 100) * 100) / 100;
  }
  return precioPublico;
}

function precioVigente(producto: ProductoRow): number | string | null {
  if (producto.precio_oferta === null) return producto.precio;
  const now = Date.now();
  const inicioOk = !producto.oferta_inicio || new Date(producto.oferta_inicio).getTime() <= now;
  const finOk = !producto.oferta_fin || new Date(producto.oferta_fin).getTime() >= now;
  return inicioOk && finOk ? producto.precio_oferta : producto.precio;
}

async function upsertCliente(
  supabase: ReturnType<typeof getServerSupabase>,
  cliente: ClienteRequest,
  fiscal: ClienteFiscalProfile
): Promise<string | null> {
  const email = String(cliente.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) return null;
  const { data, error } = await supabase
    .from('clientes')
    .upsert(
      {
        email,
        nombre: cliente.nombre ?? null,
        apellido: cliente.apellido ?? null,
        telefono: cliente.telefono ?? null,
        institucion: cliente.institucion ?? null,
        tipo_cliente: cliente.institucion ? 'b2b' : 'b2c',
        razon_social: fiscal.razon_social ?? cliente.institucion ?? null,
        tipo_documento: fiscal.tipo_documento ?? null,
        numero_documento: fiscal.numero_documento ?? null,
        tipo_persona: fiscal.tipo_persona ?? null,
        responsable_iva: fiscal.responsable_iva === true,
        agente_retencion: fiscal.agente_retencion === true,
        agente_reteica: fiscal.agente_reteica === true,
        email_facturacion: fiscal.email_facturacion ?? email,
        direccion_facturacion: fiscal.direccion_facturacion ?? null,
        consentimiento_datos: true,
        consentimiento_timestamp: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single();
  if (error) {
    console.error('upsertCliente: no se pudo persistir cliente', error.message);
    return null;
  }
  return (data as { id: string }).id;
}

function parseEnvNumber(name: string, fallback = 0): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeFiscal(
  fiscal: FiscalRequest | undefined,
  cliente: ClienteRequest,
  mercado: Mercado,
  moneda: string
): ClienteFiscalProfile {
  const direccion = fiscal?.direccion_facturacion?.direccion?.trim();
  const ciudad = fiscal?.direccion_facturacion?.ciudad?.trim();
  return {
    solicitar_factura_electronica:
      mercado === 'CO' && moneda === 'COP' && fiscal?.solicitar_factura_electronica === true,
    tipo_documento: fiscal?.tipo_documento ?? null,
    numero_documento: fiscal?.numero_documento?.trim() ?? null,
    tipo_persona: fiscal?.tipo_persona ?? null,
    razon_social: fiscal?.razon_social?.trim() || cliente.institucion?.trim() || null,
    responsable_iva: fiscal?.responsable_iva === true,
    agente_retencion: fiscal?.agente_retencion === true,
    agente_reteica: fiscal?.agente_reteica === true,
    email_facturacion: fiscal?.email_facturacion?.trim() || cliente.email?.trim() || null,
    direccion_facturacion:
      direccion && ciudad
        ? {
            direccion,
            ciudad,
            departamento: fiscal?.direccion_facturacion?.departamento?.trim() || null,
            codigo_postal: fiscal?.direccion_facturacion?.codigo_postal?.trim() || null,
            pais: fiscal?.direccion_facturacion?.pais?.trim() || 'CO',
          }
        : null,
  };
}

function emailPermitido(email: string, restricciones: string[] | null): boolean {
  const rules = restricciones ?? [];
  if (rules.length === 0) return true;
  return rules.some(rule => {
    const clean = rule.trim().toLowerCase();
    if (!clean) return false;
    if (clean.includes('*')) {
      const pattern = `^${clean.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`;
      return new RegExp(pattern).test(email);
    }
    return clean === email;
  });
}

async function calcularDescuentoCupon(args: {
  supabase: ReturnType<typeof getServerSupabase>;
  codigo: string;
  subtotal: number;
  moneda: string;
  email: string;
  items: Array<Record<string, unknown>>;
  origin: string | null;
}): Promise<
  { ok: true; descuento: number; cupon: CuponRow | null } | { ok: false; response: Response }
> {
  const { data, error } = await args.supabase
    .from('cupones')
    .select('*')
    .eq('codigo', args.codigo)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      response: internalError(`error consultando cupon: ${error.message}`, args.origin),
    };
  }
  const cupon = data as CuponRow | null;
  if (!cupon || !cupon.activo) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_INVALIDO', message: 'Cupon invalido o inactivo' },
        422,
        args.origin
      ),
    };
  }

  const now = Date.now();
  if (cupon.empieza_at && new Date(cupon.empieza_at).getTime() > now) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_NO_VIGENTE', message: 'Cupon aun no vigente' },
        422,
        args.origin
      ),
    };
  }
  if (cupon.expira_at && new Date(cupon.expira_at).getTime() < now) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_EXPIRADO', message: 'Cupon expirado' },
        422,
        args.origin
      ),
    };
  }
  if (cupon.moneda !== args.moneda) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_MONEDA_INVALIDA', message: 'El cupon no aplica a la moneda del carrito' },
        422,
        args.origin
      ),
    };
  }
  if (cupon.limite_uso_total !== null && cupon.usos >= cupon.limite_uso_total) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_AGOTADO', message: 'Cupon sin usos disponibles' },
        422,
        args.origin
      ),
    };
  }
  if (!emailPermitido(args.email, cupon.emails_permitidos)) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_EMAIL_NO_PERMITIDO', message: 'Cupon no valido para este email' },
        422,
        args.origin
      ),
    };
  }

  if (cupon.limite_uso_por_usuario !== null) {
    const { count } = await args.supabase
      .from('cupon_usos')
      .select('id', { count: 'exact', head: true })
      .eq('cupon_id', cupon.id)
      .eq('email', args.email);
    if ((count ?? 0) >= cupon.limite_uso_por_usuario) {
      return {
        ok: false,
        response: errorResponse(
          { code: 'CUPON_LIMITE_USUARIO', message: 'Limite de uso alcanzado para este email' },
          422,
          args.origin
        ),
      };
    }
  }

  const min = cupon.monto_minimo === null ? null : Number(cupon.monto_minimo);
  const max = cupon.monto_maximo === null ? null : Number(cupon.monto_maximo);
  if (min !== null && args.subtotal < min) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_MONTO_MINIMO', message: 'El carrito no alcanza el minimo del cupon' },
        422,
        args.origin
      ),
    };
  }
  if (max !== null && args.subtotal > max) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_MONTO_MAXIMO', message: 'El carrito supera el maximo del cupon' },
        422,
        args.origin
      ),
    };
  }

  const incluidos = new Set(cupon.productos_incluidos ?? []);
  const excluidos = new Set(cupon.productos_excluidos ?? []);
  const familiasIncluidas = new Set(cupon.familias_incluidas ?? []);
  const familiasExcluidas = new Set(cupon.familias_excluidas ?? []);
  const elegibles = args.items.filter(item => {
    const slug = String(item.slug ?? '');
    const familiaId = String(item.familia_id ?? '');
    if (excluidos.has(slug) || familiasExcluidas.has(familiaId)) return false;
    if (incluidos.size > 0 && !incluidos.has(slug)) return false;
    if (familiasIncluidas.size > 0 && !familiasIncluidas.has(familiaId)) return false;
    return true;
  });
  if (elegibles.length === 0) {
    return {
      ok: false,
      response: errorResponse(
        { code: 'CUPON_NO_APLICA', message: 'El cupon no aplica a los productos del carrito' },
        422,
        args.origin
      ),
    };
  }

  const baseElegible = elegibles.reduce(
    (acc, item) => acc + Number(item.precio_unitario ?? 0) * Number(item.cantidad ?? 0),
    0
  );
  const valorRaw = Number(cupon.valor);
  const valor =
    cupon.tipo_descuento === 'porcentaje'
      ? Math.min(100, Math.max(0, Number.isFinite(valorRaw) ? valorRaw : 0))
      : Math.max(0, Number.isFinite(valorRaw) ? valorRaw : 0);
  const descuento =
    cupon.tipo_descuento === 'porcentaje'
      ? baseElegible * (valor / 100)
      : cupon.tipo_descuento === 'monto_producto'
        ? Math.min(
            baseElegible,
            valor * elegibles.reduce((acc, item) => acc + Number(item.cantidad ?? 0), 0)
          )
        : Math.min(args.subtotal, valor);
  return { ok: true, descuento: Math.max(0, Math.round(descuento)), cupon };
}

Deno.serve(
  withTelemetry(FN_NAME, async req => {
    const origin = req.headers.get('origin');
    const corsRes = handleCors(req);
    if (corsRes) return corsRes;
    if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

    let body: CrearPagoRequest;
    try {
      body = (await req.json()) as CrearPagoRequest;
    } catch {
      return badRequest('JSON invalido', origin);
    }

    // ── Validación de input ──────────────────────────────────
    const cotizacionId = typeof body.cotizacion_id === 'string' ? body.cotizacion_id.trim() : '';
    const formalizacionToken =
      typeof body.formalizacion_token === 'string' ? body.formalizacion_token.trim() : '';
    const usaCotizacionLocked = Boolean(cotizacionId && formalizacionToken);

    let items = body.items;
    if (!usaCotizacionLocked) {
      if (!Array.isArray(items) || items.length === 0) {
        return badRequest('items requerido (array no vacio)', origin);
      }
      if (items.length > MAX_ITEMS) {
        return badRequest(`maximo ${MAX_ITEMS} items por pedido`, origin);
      }
      for (const item of items) {
        if (typeof item.slug !== 'string' || !item.slug) {
          return badRequest('cada item requiere slug', origin);
        }
        if (
          typeof item.cantidad !== 'number' ||
          !Number.isInteger(item.cantidad) ||
          item.cantidad < 1 ||
          item.cantidad > MAX_CANTIDAD
        ) {
          return badRequest(`cantidad invalida para ${item.slug}`, origin);
        }
      }
    } else if (Array.isArray(items) && items.length > MAX_ITEMS) {
      return badRequest(`maximo ${MAX_ITEMS} items por pedido`, origin);
    }

    const cliente = body.cliente;
    if (
      !cliente ||
      typeof cliente.nombre !== 'string' ||
      !cliente.nombre.trim() ||
      typeof cliente.apellido !== 'string' ||
      !cliente.apellido.trim() ||
      typeof cliente.email !== 'string' ||
      !cliente.email.includes('@') ||
      typeof cliente.telefono !== 'string' ||
      !cliente.telefono.trim()
    ) {
      return badRequest(
        'cliente invalido: nombre, apellido, email y telefono son requeridos',
        origin
      );
    }

    const mercado = body.mercado;
    if (mercado !== 'CO' && mercado !== 'INTL') {
      return badRequest("mercado debe ser 'CO' o 'INTL'", origin);
    }

    if (body.consentimiento_datos !== true) {
      return badRequest('consentimiento_datos requerido', origin);
    }

    const locale = body.locale === 'en' ? 'en' : 'es';
    const monedaMercado = mercado === 'CO' ? 'COP' : 'USD';
    const fiscalCliente = normalizeFiscal(body.fiscal, cliente, mercado, monedaMercado);
    const fiscalErrors = validateClienteFiscal(fiscalCliente, {
      moneda: monedaMercado,
      mercado,
    });
    if (fiscalErrors.length > 0) {
      return errorResponse(
        {
          code: 'DATOS_FISCALES_INVALIDOS',
          message: 'Faltan datos fiscales requeridos para facturacion electronica',
          details: fiscalErrors,
        },
        422,
        origin
      );
    }

    const supabase = getServerSupabase();
    const ip = obtenerIp(req);

    // ── Rate-limit por IP ────────────────────────────────────
    const limite = await checkRateLimit(supabase, `pago:ip:${ip}`, 'crear-pago');
    if (limite.limited) {
      return new Response(
        JSON.stringify({
          error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intenta mas tarde' },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin),
            ...(limite.retryAfterSeconds
              ? { 'Retry-After': String(limite.retryAfterSeconds) }
              : {}),
          },
        }
      );
    }

    // ── Cotización formalizada: precios locked (admin), no recalc catálogo ──
    let lineasCotizacion: CotizacionLineaOferta[] | null = null;
    if (usaCotizacionLocked) {
      const { data: cotizacionData, error: cotizacionError } = await supabase
        .from('solicitudes_cotizacion')
        .select('*')
        .eq('id', cotizacionId)
        .maybeSingle();
      if (cotizacionError) {
        return internalError(`error consultando cotizacion: ${cotizacionError.message}`, origin);
      }
      if (!cotizacionData) {
        return errorResponse(
          { code: 'COTIZACION_NO_ENCONTRADA', message: 'Cotizacion no encontrada' },
          404,
          origin
        );
      }
      const cotizacion = cotizacionData as CotizacionOfertaRow;
      if (cotizacion.pedido_id || cotizacion.estado === 'convertida') {
        return errorResponse(
          { code: 'COTIZACION_YA_CONVERTIDA', message: 'Esta cotizacion ya fue formalizada' },
          409,
          origin
        );
      }
      if (cotizacion.estado !== 'enviada' && cotizacion.estado !== 'respondida') {
        return errorResponse(
          { code: 'COTIZACION_NO_ENVIADA', message: 'Cotizacion no disponible para formalizar' },
          409,
          origin
        );
      }
      if (tokenExpirado(cotizacion.formalizacion_token_expira_at)) {
        return errorResponse(
          { code: 'TOKEN_EXPIRADO', message: 'El enlace de formalizacion expiro' },
          410,
          origin
        );
      }
      if (!cotizacion.formalizacion_token_hash) {
        return errorResponse({ code: 'TOKEN_INVALIDO', message: 'Token invalido' }, 401, origin);
      }
      const tokenHash = await hashTokenSha256(formalizacionToken);
      if (tokenHash !== cotizacion.formalizacion_token_hash) {
        return errorResponse({ code: 'TOKEN_INVALIDO', message: 'Token invalido' }, 401, origin);
      }
      lineasCotizacion = parseLineasOferta(cotizacion.productos);
      const ofertaCheck = ofertaCompleta(lineasCotizacion, cotizacion.condiciones);
      if (!ofertaCheck.ok) {
        return errorResponse(
          { code: ofertaCheck.error, message: 'Oferta incompleta' },
          422,
          origin
        );
      }
      items = lineasCotizacion.map(l => ({ slug: l.slug, cantidad: l.cantidad }));
    }

    // ── Recalcular desde Supabase (NUNCA confiar en el cliente) ──
    // Excepción: cotización formalizada → precio de la oferta (locked).
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest('items requerido (array no vacio)', origin);
    }
    const slugs = items.map(i => i.slug as string);
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('*')
      .in('slug', slugs);

    if (productosError) {
      return internalError(`error consultando productos: ${productosError.message}`, origin);
    }

    const productosPorSlug = new Map<string, ProductoRow>(
      ((productos ?? []) as ProductoRow[]).map(p => [p.slug, p])
    );

    // ── Escenario A: rechazar el pedido completo si algun item ya no esta
    // disponible (proveedor lo flagueo en tiempo real). El cliente nunca decide
    // disponibilidad — esta comprobacion es la fuente de verdad final.
    const slugsNoDisponibles = slugs.filter(
      slug => productosPorSlug.get(slug)?.disponible === false
    );
    if (slugsNoDisponibles.length > 0) {
      return errorResponse(
        {
          code: 'PRODUCTO_NO_DISPONIBLE_TEMPORAL',
          message: 'Uno o mas productos del carrito ya no estan disponibles',
          details: { slugs: slugsNoDisponibles },
        },
        422,
        origin
      );
    }

    // Lista de precios B2B del cliente (server-side; el cliente nunca fija precios)
    // En cotización locked se ignora: manda el precio ofertado.
    const listaPrecio = lineasCotizacion
      ? null
      : await obtenerListaPrecio(supabase, cliente.email.toLowerCase());
    const preciosLockedPorSlug = lineasCotizacion
      ? new Map(lineasCotizacion.map(l => [l.slug, l]))
      : null;

    const checkoutItems: CheckoutItem[] = [];
    const itemsSnapshot: Array<Record<string, unknown>> = [];
    const fiscalItems: Array<Record<string, unknown>> = [];
    let monedaComun: string | null = null;

    for (const item of items) {
      const slug = item.slug as string;
      const cantidad = item.cantidad as number;
      const producto = productosPorSlug.get(slug);

      if (!producto || !producto.activo) {
        return errorResponse(
          { code: 'PRODUCTO_NO_DISPONIBLE', message: `Producto no disponible: ${slug}` },
          400,
          origin
        );
      }

      const locked = preciosLockedPorSlug?.get(slug);
      let precio: number | null;
      if (locked) {
        precio = locked.precio_unitario;
      } else {
        // Regla comercial: cualquier producto con precio vigente > 0 es comprable
        // vía carrito (equipo o consumible). Sin precio → cotización, no checkout.
        const precioBase = precioVigente(producto);
        const precioPublico = precioBase === null ? null : Number(precioBase);
        precio =
          precioPublico === null
            ? null
            : aplicarListaPrecio(listaPrecio, producto.id, precioPublico);
      }
      if (precio === null || Number.isNaN(precio) || precio <= 0) {
        return errorResponse(
          {
            code: 'SIN_PRECIO',
            message: `${slug} no tiene precio real configurado (TODO_CLIENTE). No puede comprarse.`,
          },
          409,
          origin
        );
      }
      if (!lineasCotizacion && producto.stock !== null && cantidad > producto.stock) {
        return errorResponse(
          { code: 'STOCK_INSUFICIENTE', message: `Stock insuficiente para ${slug}` },
          409,
          origin
        );
      }
      if (producto.fulfillment_mode === 'dropship') {
        const { data: proveedor, error: provError } = await supabase.rpc(
          'get_proveedor_para_producto',
          { p_producto_id: producto.id }
        );
        if (provError) {
          return internalError(`error consultando proveedor: ${provError.message}`, origin);
        }
        const proveedorRow = Array.isArray(proveedor) ? proveedor[0] : proveedor;
        if (!proveedorRow) {
          // No bloquear checkout: productos con precio son dropship por defecto.
          // Sin proveedor asignado, el pago sigue; la notificación queda pendiente
          // de asignación en admin/Proveedores (fulfillment manual).
          console.warn(
            `crear-pago: ${slug} dropship sin proveedor asignado — checkout permitido, notificación diferida`
          );
        }
      }

      const monedaItem = locked?.moneda || producto.moneda;
      if (monedaComun === null) monedaComun = monedaItem;
      if (monedaComun !== monedaItem) {
        return badRequest('todos los items deben tener la misma moneda', origin);
      }

      const nombre =
        locale === 'en' && producto.nombre_en ? producto.nombre_en : producto.nombre_es;
      checkoutItems.push({
        producto_id: producto.id,
        nombre,
        cantidad,
        precio_unitario: precio,
        moneda: monedaItem,
      });
      itemsSnapshot.push({
        producto_id: producto.id,
        slug: producto.slug,
        familia_id: producto.familia_id,
        nombre,
        cantidad,
        precio_unitario: precio,
        moneda: monedaItem,
        ...(locked ? { precio_locked_cotizacion: true } : {}),
      });
      fiscalItems.push({
        producto_id: producto.id,
        slug: producto.slug,
        nombre,
        cantidad,
        precio_unitario: precio,
        tarifa_iva_pct: producto.tarifa_iva_pct === null ? null : Number(producto.tarifa_iva_pct),
        retencion_fuente_pct:
          producto.retencion_fuente_pct === null ? null : Number(producto.retencion_fuente_pct),
        retencion_iva_pct:
          producto.retencion_iva_pct === null ? null : Number(producto.retencion_iva_pct),
        retencion_ica_pct:
          producto.retencion_ica_pct === null ? null : Number(producto.retencion_ica_pct),
        dian_codigo: producto.dian_codigo,
        excluido_iva: producto.excluido_iva === true,
      });
    }

    const moneda = monedaComun ?? 'COP';
    const subtotal = checkoutItems.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
    // Cotización locked: no cupones (precio ya negociado en la oferta).
    const cuponCodigo =
      !lineasCotizacion && typeof body.cupon_codigo === 'string'
        ? body.cupon_codigo.trim().toUpperCase()
        : '';
    const descuento = cuponCodigo
      ? await calcularDescuentoCupon({
          supabase,
          codigo: cuponCodigo,
          subtotal,
          moneda,
          email: cliente.email.toLowerCase(),
          items: itemsSnapshot,
          origin,
        })
      : { ok: true as const, descuento: 0, cupon: null as CuponRow | null };
    if (!descuento.ok) return descuento.response;

    // Envio por zona (solo CO; INTL se cotiza aparte)
    const envioTotal =
      mercado === 'CO'
        ? await calcularEnvio(
            supabase,
            body.fiscal?.direccion_facturacion?.departamento,
            subtotal - descuento.descuento
          )
        : 0;

    const fiscal = calculateFiscalSummary(
      fiscalItems as Array<{
        producto_id: string;
        slug: string;
        nombre: string;
        cantidad: number;
        precio_unitario: number;
        tarifa_iva_pct?: number | null;
        retencion_fuente_pct?: number | null;
        retencion_iva_pct?: number | null;
        retencion_ica_pct?: number | null;
        dian_codigo?: string | null;
        excluido_iva?: boolean;
      }>,
      fiscalCliente,
      {
        moneda,
        mercado: mercado as Mercado,
        descuento_total: descuento.descuento,
        envio_total: envioTotal,
        default_iva_pct: parseEnvNumber('CO_DEFAULT_IVA_PCT', 0),
        default_retencion_fuente_pct: parseEnvNumber('CO_DEFAULT_RETEFUENTE_PCT', 0),
        default_retencion_iva_pct: parseEnvNumber('CO_DEFAULT_RETEIVA_PCT', 0),
        default_retencion_ica_pct: parseEnvNumber('CO_DEFAULT_RETEICA_PCT', 0),
        retefuente_base_minima: parseEnvNumber('CO_RETEFUENTE_BASE_MINIMA', 0),
        reteiva_base_minima: parseEnvNumber('CO_RETEIVA_BASE_MINIMA', 0),
        reteica_base_minima: parseEnvNumber('CO_RETEICA_BASE_MINIMA', 0),
      }
    );

    const _impuestoTotal = fiscal.impuesto_total;
    const total = fiscal.total;
    const pedidoId = crypto.randomUUID();
    const dianDraft = buildDianInvoiceDraft({
      referencia: pedidoId,
      fiscal,
      clienteFiscal: fiscalCliente,
      moneda,
    });

    const proveedorPago = mercado === 'CO' ? 'wompi' : 'stripe';
    const clienteId = await upsertCliente(supabase, cliente, fiscalCliente);
    if (clienteId) {
      void pushClienteToTwenty(supabase, clienteId);
    }

    const { error: insertError } = await supabase.from('pedidos').insert({
      id: pedidoId,
      cliente_id: clienteId,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        telefono: cliente.telefono,
        institucion: cliente.institucion ?? null,
      },
      items: itemsSnapshot,
      subtotal,
      envio_total: envioTotal,
      total,
      moneda,
      mercado,
      proveedor_pago: proveedorPago,
      estado: 'pendiente',
      referencia_pasarela: pedidoId,
      facturacion_electronica_solicitada: fiscalCliente.solicitar_factura_electronica,
      facturacion_electronica_estado: fiscalCliente.solicitar_factura_electronica
        ? 'pendiente_pago'
        : 'no_solicitada',
      consentimiento_datos: true,
      consentimiento_timestamp: new Date().toISOString(),
      metadata: {
        locale,
        fiscal: {
          solicitar_factura_electronica: fiscalCliente.solicitar_factura_electronica,
          tipo_documento: fiscalCliente.tipo_documento,
          numero_documento: fiscalCliente.numero_documento,
          tipo_persona: fiscalCliente.tipo_persona,
          razon_social: fiscalCliente.razon_social,
          responsable_iva: fiscalCliente.responsable_iva === true,
          agente_retencion: fiscalCliente.agente_retencion === true,
          agente_reteica: fiscalCliente.agente_reteica === true,
          email_facturacion: fiscalCliente.email_facturacion,
        },
        fiscal_resumen: fiscal,
        dian_draft: dianDraft,
        ...(lineasCotizacion
          ? {
              solicitud_cotizacion_id: cotizacionId,
              origen: 'cotizacion',
              precios_locked: true,
              total_ofertado: calcularTotalOfertado(lineasCotizacion),
            }
          : {}),
      },
    });

    if (insertError) {
      return internalError(`error creando pedido: ${insertError.message}`, origin);
    }

    if (lineasCotizacion && cotizacionId) {
      await supabase
        .from('solicitudes_cotizacion')
        .update({
          estado: 'convertida',
          pedido_id: pedidoId,
          precio_total_ofertado: calcularTotalOfertado(lineasCotizacion),
          leida: true,
        })
        .eq('id', cotizacionId);
    }

    if (fiscalCliente.solicitar_factura_electronica) {
      await supabase.from('facturas_electronicas').upsert(
        {
          pedido_id: pedidoId,
          estado: 'pendiente_pago',
          proveedor: 'siigo',
          payload: dianDraft ?? {},
        },
        { onConflict: 'pedido_id' }
      );
    }

    const gateway = getPaymentGateway(mercado as Mercado);
    const resultado = await gateway.crearCheckout({
      items: checkoutItems,
      cliente: {
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        telefono: cliente.telefono,
        ...(cliente.institucion ? { institucion: cliente.institucion } : {}),
      },
      mercado: mercado as Mercado,
      locale,
      referencia: pedidoId,
      total,
      moneda,
    });

    if (!resultado.ok) {
      await supabase.from('pedidos').update({ estado: 'error_verificacion' }).eq('id', pedidoId);
      await notificarEstadoPedido(pedidoId, 'error_verificacion', 'pendiente');

      return errorResponse(
        {
          code: 'GATEWAY_ERROR',
          message: 'No se pudo crear el checkout',
          details: resultado.error,
        },
        502,
        origin
      );
    }

    // Burn only after checkout exists — otherwise single-use coupons are lost on GATEWAY_ERROR.
    if (
      decideCuponBurn({ hasCupon: Boolean(descuento.cupon), checkoutOk: resultado.ok }) ===
        'burn' &&
      descuento.cupon
    ) {
      await supabase.from('cupon_usos').insert({
        cupon_id: descuento.cupon.id,
        pedido_id: pedidoId,
        cliente_id: clienteId,
        email: cliente.email.toLowerCase(),
        descuento: descuento.descuento,
      });
      await supabase
        .from('cupones')
        .update({ usos: descuento.cupon.usos + 1 })
        .eq('id', descuento.cupon.id);
    }

    const { error: updateCheckoutError } = await supabase
      .from('pedidos')
      .update({ checkout_url: resultado.checkout_url ?? null })
      .eq('id', pedidoId);

    if (updateCheckoutError) {
      console.warn('crear-pago: no se pudo persistir checkout_url', updateCheckoutError.message);
    }
    await notificarEstadoPedido(pedidoId, 'pendiente');

    void trackEvent(FN_NAME, 'pedido_creado', {
      pedido_id: pedidoId,
      mercado,
      proveedor_pago: proveedorPago,
      items_count: checkoutItems.length,
    });

    return new Response(
      JSON.stringify({ ok: true, checkout_url: resultado.checkout_url, referencia: pedidoId }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
      }
    );
  })
);
