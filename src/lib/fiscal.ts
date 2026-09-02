export type TipoDocumentoFiscal = 'CC' | 'NIT' | 'CE' | 'PP' | 'OTRO';

export type TipoPersonaFiscal = 'natural' | 'juridica';

export interface DireccionFiscal {
  direccion: string;
  ciudad: string;
  departamento?: string | null;
  codigo_postal?: string | null;
  pais?: string | null;
}

export interface ClienteFiscalProfile {
  solicitar_factura_electronica: boolean;
  tipo_documento?: TipoDocumentoFiscal | null;
  numero_documento?: string | null;
  tipo_persona?: TipoPersonaFiscal | null;
  razon_social?: string | null;
  responsable_iva?: boolean;
  agente_retencion?: boolean;
  agente_reteica?: boolean;
  email_facturacion?: string | null;
  direccion_facturacion?: DireccionFiscal | null;
}

export interface ProductFiscalProfile {
  producto_id?: string;
  slug?: string;
  nombre?: string;
  cantidad: number;
  precio_unitario: number;
  tarifa_iva_pct?: number | null;
  retencion_fuente_pct?: number | null;
  retencion_iva_pct?: number | null;
  retencion_ica_pct?: number | null;
  dian_codigo?: string | null;
  excluido_iva?: boolean;
}

export interface FiscalConfig {
  moneda: string;
  mercado: 'CO' | 'INTL';
  descuento_total?: number;
  envio_total?: number;
  default_iva_pct?: number;
  default_retencion_fuente_pct?: number;
  default_retencion_iva_pct?: number;
  default_retencion_ica_pct?: number;
  retefuente_base_minima?: number;
  reteiva_base_minima?: number;
  reteica_base_minima?: number;
}

export interface FiscalLineSummary {
  producto_id?: string | undefined;
  slug?: string | undefined;
  nombre?: string | undefined;
  cantidad: number;
  precio_unitario: number;
  base_bruta: number;
  descuento_asignado: number;
  base_neta: number;
  tarifa_iva_pct: number;
  iva: number;
  retencion_fuente: number;
  retencion_iva: number;
  retencion_ica: number;
  total_linea: number;
  dian_codigo?: string | null;
}

export interface FiscalSummary {
  subtotal: number;
  descuento_total: number;
  base_gravable: number;
  impuesto_total: number;
  retencion_total: number;
  retencion_fuente_total: number;
  retencion_iva_total: number;
  retencion_ica_total: number;
  envio_total: number;
  total: number;
  lineas: FiscalLineSummary[];
}

function toMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function toPct(value: number | null | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

/**
 * Convierte un precio comercial que ya incluye IVA a su base gravable.
 * Las cotizaciones se facturan solo cuando el comercial confirmó esta
 * condición; nunca se infiere desde texto libre.
 */
export function baseNetaDesdePrecioConIva(precioConIva: number, tarifaIvaPct: number): number {
  if (!Number.isFinite(precioConIva) || precioConIva < 0) return 0;
  if (!Number.isFinite(tarifaIvaPct) || tarifaIvaPct < 0) return 0;
  return Math.round((precioConIva / (1 + tarifaIvaPct / 100)) * 100) / 100;
}

export interface LockedOfferFiscalProducto {
  tarifa_iva_pct?: number | string | null;
  retencion_fuente_pct?: number | string | null;
  retencion_iva_pct?: number | string | null;
  retencion_ica_pct?: number | string | null;
  dian_codigo?: string | null;
  excluido_iva?: boolean | null;
}

/**
 * Perfil fiscal para una línea de cotización locked.
 * El `precio_unitario` ofertado es el total comercial acordado — nunca se le
 * suma de nuevo la tarifa IVA del catálogo (eso sobre-cobraría en Wompi/Stripe).
 *
 * - Sin FE: marca `excluido_iva` para cobrar exactamente lo ofertado.
 * - Con FE + `impuestos_incluidos`: extrae base neta y re-aplica IVA.
 * - Con FE sin `impuestos_incluidos`: error (misma regla que formalizar-cotizacion).
 */
export function fiscalProfileFromLockedOffer(args: {
  producto_id?: string;
  slug: string;
  nombre: string;
  cantidad: number;
  precio_unitario_ofertado: number;
  solicitar_factura_electronica: boolean;
  impuestos_incluidos: boolean;
  producto?: LockedOfferFiscalProducto | null;
}): ProductFiscalProfile {
  const base = {
    producto_id: args.producto_id,
    slug: args.slug,
    nombre: args.nombre,
    cantidad: args.cantidad,
  };

  if (!args.solicitar_factura_electronica) {
    return {
      ...base,
      precio_unitario: args.precio_unitario_ofertado,
      excluido_iva: true,
    };
  }

  if (!args.impuestos_incluidos) {
    throw new Error(
      'La oferta no declara que sus precios incluyen impuestos. Solicita a I-ME una cotizacion revisada antes de emitir factura electronica.'
    );
  }

  const producto = args.producto;
  if (!producto) {
    throw new Error(`Producto sin configuracion fiscal: ${args.slug}`);
  }

  const excluido = producto.excluido_iva === true;
  const tarifaIva = excluido ? 0 : Number(producto.tarifa_iva_pct);
  if (!excluido && (!Number.isFinite(tarifaIva) || tarifaIva < 0)) {
    throw new Error(`Tarifa IVA invalida para producto: ${args.slug}`);
  }

  return {
    ...base,
    precio_unitario: baseNetaDesdePrecioConIva(args.precio_unitario_ofertado, tarifaIva),
    tarifa_iva_pct: tarifaIva,
    retencion_fuente_pct:
      producto.retencion_fuente_pct === null || producto.retencion_fuente_pct === undefined
        ? null
        : Number(producto.retencion_fuente_pct),
    retencion_iva_pct:
      producto.retencion_iva_pct === null || producto.retencion_iva_pct === undefined
        ? null
        : Number(producto.retencion_iva_pct),
    retencion_ica_pct:
      producto.retencion_ica_pct === null || producto.retencion_ica_pct === undefined
        ? null
        : Number(producto.retencion_ica_pct),
    dian_codigo: producto.dian_codigo ?? null,
    excluido_iva: excluido,
  };
}

function isFacturacionColombia(config: FiscalConfig): boolean {
  return config.mercado === 'CO' && config.moneda.toUpperCase() === 'COP';
}

/** Solo dígitos (quita espacios, puntos, guiones). */
export function soloDigitosDocumento(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normaliza número de documento para DIAN/Siigo.
 * NIT/CC → solo dígitos (901441908-2 → 9014419082; "9 0 1 …" → limpio).
 * CE/PP/OTRO → sin espacios, mayúsculas.
 */
export function normalizeNumeroDocumento(
  tipo: TipoDocumentoFiscal | null | undefined,
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (tipo === 'NIT' || tipo === 'CC' || !tipo) {
    const digits = soloDigitosDocumento(trimmed);
    return digits || null;
  }
  const cleaned = trimmed.replace(/\s+/g, '').toUpperCase();
  return cleaned || null;
}

/** Dígito de verificación NIT Colombia (módulo 11). */
export function digitoVerificacionNit(nitSinDv: string): number | null {
  const digits = soloDigitosDocumento(nitSinDv);
  if (!digits || digits.length < 5 || digits.length > 15) return null;
  const primes = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i]);
    const p = primes[i];
    if (!Number.isFinite(d) || p == null) return null;
    sum += d * p;
  }
  const mod = sum % 11;
  return mod > 1 ? 11 - mod : mod;
}

/**
 * Valida formato del documento. Devuelve mensaje de error o null si OK.
 * NIT: 9–10 dígitos; si 10, verifica dígito de chequeo.
 */
export function validateNumeroDocumentoFormat(
  tipo: TipoDocumentoFiscal | null | undefined,
  numero: string | null | undefined
): string | null {
  const normalized = normalizeNumeroDocumento(tipo, numero);
  if (!normalized) return 'numero_documento requerido para facturacion electronica';

  if (tipo === 'NIT') {
    if (!/^\d{9,10}$/.test(normalized)) {
      return 'NIT invalido: use 9 o 10 digitos sin espacios (ej. 9014419082)';
    }
    if (normalized.length === 10) {
      const base = normalized.slice(0, -1);
      const dv = Number(normalized.slice(-1));
      const expected = digitoVerificacionNit(base);
      if (expected != null && dv !== expected) {
        return `NIT invalido: digito de verificacion incorrecto (esperado ${expected})`;
      }
    }
    return null;
  }

  if (tipo === 'CC') {
    if (!/^\d{5,12}$/.test(normalized)) {
      return 'CC invalida: use solo digitos (5-12)';
    }
    return null;
  }

  if (tipo === 'CE' || tipo === 'PP') {
    if (!/^[A-Z0-9-]{4,20}$/.test(normalized)) {
      return `${tipo} invalido: 4-20 caracteres alfanumericos`;
    }
    return null;
  }

  return null;
}

export function validateClienteFiscal(
  profile: ClienteFiscalProfile,
  config: FiscalConfig
): string[] {
  const errors: string[] = [];
  if (!profile.solicitar_factura_electronica || !isFacturacionColombia(config)) return errors;

  if (!profile.tipo_documento) errors.push('tipo_documento requerido para facturacion electronica');
  const docError = validateNumeroDocumentoFormat(profile.tipo_documento, profile.numero_documento);
  if (docError) errors.push(docError);
  if (!profile.tipo_persona) errors.push('tipo_persona requerida para facturacion electronica');
  if (!profile.razon_social?.trim()) {
    errors.push('razon_social requerida para facturacion electronica');
  }
  if (!profile.email_facturacion?.trim()) {
    errors.push('email_facturacion requerido para facturacion electronica');
  }
  if (!profile.direccion_facturacion?.direccion?.trim()) {
    errors.push('direccion_facturacion.direccion requerida para facturacion electronica');
  } else {
    const dir = profile.direccion_facturacion.direccion.trim();
    // Evita el error tipico: pegar el NIT en la casilla de direccion.
    if (/^[\d\s.-]{8,}$/.test(dir) && soloDigitosDocumento(dir).length >= 8) {
      errors.push(
        'direccion_facturacion.direccion parece un numero de documento; indique una direccion fisica'
      );
    }
  }
  if (!profile.direccion_facturacion?.ciudad?.trim()) {
    errors.push('direccion_facturacion.ciudad requerida para facturacion electronica');
  }

  return errors;
}

export function calculateFiscalSummary(
  items: ProductFiscalProfile[],
  clienteFiscal: ClienteFiscalProfile,
  config: FiscalConfig
): FiscalSummary {
  const subtotal = toMoney(
    items.reduce((acc, item) => acc + item.precio_unitario * item.cantidad, 0)
  );
  const descuentoTotal = toMoney(config.descuento_total ?? 0);
  const envioTotal = toMoney(config.envio_total ?? 0);
  const factorDescuento = subtotal > 0 ? descuentoTotal / subtotal : 0;
  const esCO = isFacturacionColombia(config);

  let descuentoAcumulado = 0;
  const lineas = items.map((item, index) => {
    const baseBruta = toMoney(item.precio_unitario * item.cantidad);
    const descuentoAsignado =
      index === items.length - 1
        ? toMoney(descuentoTotal - descuentoAcumulado)
        : toMoney(baseBruta * factorDescuento);
    descuentoAcumulado += descuentoAsignado;

    const baseNeta = Math.max(0, toMoney(baseBruta - descuentoAsignado));
    const tarifaIvaPct = esCO
      ? item.excluido_iva
        ? 0
        : toPct(item.tarifa_iva_pct, toPct(config.default_iva_pct, 0))
      : 0;
    const iva = tarifaIvaPct > 0 ? toMoney(baseNeta * (tarifaIvaPct / 100)) : 0;

    const aplicaRetencion = esCO && clienteFiscal.agente_retencion === true;
    const aplicaReteIca = esCO && clienteFiscal.agente_reteica === true;

    const retFuentePct = aplicaRetencion
      ? toPct(item.retencion_fuente_pct, toPct(config.default_retencion_fuente_pct, 0))
      : 0;
    const retIvaPct = aplicaRetencion
      ? toPct(item.retencion_iva_pct, toPct(config.default_retencion_iva_pct, 0))
      : 0;
    const retIcaPct = aplicaReteIca
      ? toPct(item.retencion_ica_pct, toPct(config.default_retencion_ica_pct, 0))
      : 0;

    const retencionFuente =
      retFuentePct > 0 && baseNeta >= toMoney(config.retefuente_base_minima ?? 0)
        ? toMoney(baseNeta * (retFuentePct / 100))
        : 0;
    const retencionIva =
      retIvaPct > 0 && iva > 0 && baseNeta >= toMoney(config.reteiva_base_minima ?? 0)
        ? toMoney(iva * (retIvaPct / 100))
        : 0;
    const retencionIca =
      retIcaPct > 0 && baseNeta >= toMoney(config.reteica_base_minima ?? 0)
        ? toMoney(baseNeta * (retIcaPct / 100))
        : 0;

    const totalLinea = toMoney(baseNeta + iva - retencionFuente - retencionIva - retencionIca);

    return {
      producto_id: item.producto_id,
      slug: item.slug,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      base_bruta: baseBruta,
      descuento_asignado: descuentoAsignado,
      base_neta: baseNeta,
      tarifa_iva_pct: tarifaIvaPct,
      iva,
      retencion_fuente: retencionFuente,
      retencion_iva: retencionIva,
      retencion_ica: retencionIca,
      total_linea: totalLinea,
      dian_codigo: item.dian_codigo ?? null,
    } satisfies FiscalLineSummary;
  });

  const baseGravable = toMoney(lineas.reduce((acc, line) => acc + line.base_neta, 0));
  const impuestoTotal = toMoney(lineas.reduce((acc, line) => acc + line.iva, 0));
  const retencionFuenteTotal = toMoney(
    lineas.reduce((acc, line) => acc + line.retencion_fuente, 0)
  );
  const retencionIvaTotal = toMoney(lineas.reduce((acc, line) => acc + line.retencion_iva, 0));
  const retencionIcaTotal = toMoney(lineas.reduce((acc, line) => acc + line.retencion_ica, 0));
  const retencionTotal = toMoney(retencionFuenteTotal + retencionIvaTotal + retencionIcaTotal);
  const total = toMoney(baseGravable + impuestoTotal + envioTotal - retencionTotal);

  return {
    subtotal,
    descuento_total: descuentoTotal,
    base_gravable: baseGravable,
    impuesto_total: impuestoTotal,
    retencion_total: retencionTotal,
    retencion_fuente_total: retencionFuenteTotal,
    retencion_iva_total: retencionIvaTotal,
    retencion_ica_total: retencionIcaTotal,
    envio_total: envioTotal,
    total,
    lineas,
  };
}

export interface DianInvoiceDraft {
  referencia: string;
  moneda: string;
  cliente: {
    tipo_documento: string;
    numero_documento: string;
    tipo_persona: string;
    razon_social: string;
    email: string;
    responsable_iva: boolean;
    direccion: DireccionFiscal;
  };
  totales: {
    subtotal: number;
    descuento_total: number;
    impuesto_total: number;
    retencion_total: number;
    total: number;
  };
  lineas: Array<{
    producto_id?: string | undefined;
    slug?: string | undefined;
    codigo?: string | null;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    base_neta: number;
    tarifa_iva_pct: number;
    iva: number;
    retencion_fuente: number;
    retencion_iva: number;
    retencion_ica: number;
    total: number;
  }>;
}

export function buildDianInvoiceDraft(args: {
  referencia: string;
  fiscal: FiscalSummary;
  clienteFiscal: ClienteFiscalProfile;
  moneda: string;
}): DianInvoiceDraft | null {
  const { clienteFiscal, fiscal, referencia, moneda } = args;
  if (!clienteFiscal.solicitar_factura_electronica) return null;
  if (
    !clienteFiscal.tipo_documento ||
    !clienteFiscal.numero_documento ||
    !clienteFiscal.tipo_persona ||
    !clienteFiscal.razon_social ||
    !clienteFiscal.email_facturacion ||
    !clienteFiscal.direccion_facturacion
  ) {
    return null;
  }

  return {
    referencia,
    moneda,
    cliente: {
      tipo_documento: clienteFiscal.tipo_documento,
      numero_documento:
        normalizeNumeroDocumento(clienteFiscal.tipo_documento, clienteFiscal.numero_documento) ??
        clienteFiscal.numero_documento,
      tipo_persona: clienteFiscal.tipo_persona,
      razon_social: clienteFiscal.razon_social,
      email: clienteFiscal.email_facturacion,
      responsable_iva: clienteFiscal.responsable_iva === true,
      direccion: clienteFiscal.direccion_facturacion,
    },
    totales: {
      subtotal: fiscal.subtotal,
      descuento_total: fiscal.descuento_total,
      impuesto_total: fiscal.impuesto_total,
      retencion_total: fiscal.retencion_total,
      total: fiscal.total,
    },
    lineas: fiscal.lineas.map(line => ({
      producto_id: line.producto_id,
      slug: line.slug,
      codigo: line.dian_codigo ?? null,
      descripcion: line.nombre ?? line.slug ?? 'Item',
      cantidad: line.cantidad,
      precio_unitario: line.precio_unitario,
      base_neta: line.base_neta,
      tarifa_iva_pct: line.tarifa_iva_pct,
      iva: line.iva,
      retencion_fuente: line.retencion_fuente,
      retencion_iva: line.retencion_iva,
      retencion_ica: line.retencion_ica,
      total: line.total_linea,
    })),
  };
}

/** Normaliza payload fiscal del cliente (CO/COP). Fuera de CO → no solicita factura. */
export function normalizeClienteFiscalInput(
  fiscal: Partial<ClienteFiscalProfile> | null | undefined,
  defaults: {
    mercado: 'CO' | 'INTL';
    moneda: string;
    email?: string | null;
    razonSocialFallback?: string | null;
  }
): ClienteFiscalProfile {
  const mercadoOk = defaults.mercado === 'CO' && defaults.moneda.toUpperCase() === 'COP';
  const solicitar = mercadoOk && fiscal?.solicitar_factura_electronica === true;
  const tipoDocumento = fiscal?.tipo_documento ?? null;
  const direccion = fiscal?.direccion_facturacion?.direccion?.trim();
  const ciudad = fiscal?.direccion_facturacion?.ciudad?.trim();
  return {
    solicitar_factura_electronica: solicitar,
    tipo_documento: tipoDocumento,
    numero_documento: normalizeNumeroDocumento(tipoDocumento, fiscal?.numero_documento),
    tipo_persona: fiscal?.tipo_persona ?? null,
    razon_social: fiscal?.razon_social?.trim() || defaults.razonSocialFallback?.trim() || null,
    responsable_iva: fiscal?.responsable_iva === true,
    agente_retencion: fiscal?.agente_retencion === true,
    agente_reteica: fiscal?.agente_reteica === true,
    email_facturacion: fiscal?.email_facturacion?.trim() || defaults.email?.trim() || null,
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
