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

function isFacturacionColombia(config: FiscalConfig): boolean {
  return config.mercado === 'CO' && config.moneda.toUpperCase() === 'COP';
}

export function validateClienteFiscal(
  profile: ClienteFiscalProfile,
  config: FiscalConfig
): string[] {
  const errors: string[] = [];
  if (!profile.solicitar_factura_electronica || !isFacturacionColombia(config)) return errors;

  if (!profile.tipo_documento) errors.push('tipo_documento requerido para facturacion electronica');
  if (!profile.numero_documento?.trim()) {
    errors.push('numero_documento requerido para facturacion electronica');
  }
  if (!profile.tipo_persona) errors.push('tipo_persona requerida para facturacion electronica');
  if (!profile.razon_social?.trim()) {
    errors.push('razon_social requerida para facturacion electronica');
  }
  if (!profile.email_facturacion?.trim()) {
    errors.push('email_facturacion requerido para facturacion electronica');
  }
  if (!profile.direccion_facturacion?.direccion?.trim()) {
    errors.push('direccion_facturacion.direccion requerida para facturacion electronica');
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
    codigo?: string | null;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    base_neta: number;
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
      numero_documento: clienteFiscal.numero_documento,
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
      codigo: line.dian_codigo ?? null,
      descripcion: line.nombre ?? line.slug ?? 'Item',
      cantidad: line.cantidad,
      precio_unitario: line.precio_unitario,
      base_neta: line.base_neta,
      iva: line.iva,
      retencion_fuente: line.retencion_fuente,
      retencion_iva: line.retencion_iva,
      retencion_ica: line.retencion_ica,
      total: line.total_linea,
    })),
  };
}
