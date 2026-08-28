export interface CotizacionMensajeProducto {
  slug: string;
  nombre: string;
  cantidad: number;
  url?: string | undefined;
  modelo?: string | undefined;
}

export interface CotizacionSubmitPayload {
  locale?: 'es' | 'en' | undefined;
  mensaje: string;
  productos?: CotizacionMensajeProducto[] | undefined;
  [key: string]: unknown;
}

/** Mensaje por defecto cuando el usuario no escribe detalle pero sí eligió productos. */
export function resolverMensajeCotizacion(params: {
  locale?: 'es' | 'en' | undefined;
  mensaje?: string | undefined;
  productos?: CotizacionMensajeProducto[] | undefined;
}): string {
  const trimmed = (params.mensaje ?? '').trim();
  if (trimmed) return trimmed.slice(0, 2000);

  const productos = params.productos ?? [];
  if (!productos.length) return '';

  const locale = params.locale === 'en' ? 'en' : 'es';
  const lines = productos.map(producto => {
    const qty = producto.cantidad && producto.cantidad > 1 ? ` (x${producto.cantidad})` : '';
    const ref = producto.modelo
      ? locale === 'en'
        ? ` (Model ${producto.modelo})`
        : ` (Ref. ${producto.modelo})`
      : '';
    const page = producto.url
      ? locale === 'en'
        ? `\n  Product page: ${producto.url}`
        : `\n  Página del producto: ${producto.url}`
      : '';
    return `- ${producto.nombre}${ref}${qty}${page}`;
  });

  if (locale === 'en') {
    return [
      'I would like a quote for:',
      ...lines,
      '',
      'Please confirm availability, configuration, lead time and support.',
    ].join('\n');
  }

  return [
    'Quiero solicitar cotización de:',
    ...lines,
    '',
    'Por favor confirmar disponibilidad, configuración, plazo y soporte.',
  ].join('\n');
}

export interface CotizacionEmailStatus {
  interno?: boolean;
  cliente?: boolean;
}

/** Mensaje de éxito según locale y si el correo de confirmación se envió. */
export function mensajeExitoCotizacion(
  locale: 'es' | 'en' | undefined,
  emails?: CotizacionEmailStatus | null
): string {
  const isEn = locale === 'en';
  const base = isEn
    ? 'Request sent! We will contact you soon.'
    : '¡Solicitud enviada! Te contactaremos pronto.';
  if (!emails) return base;
  if (emails.cliente) {
    return isEn
      ? `${base} We sent a confirmation to your email.`
      : `${base} Enviamos confirmación a tu correo.`;
  }
  return isEn
    ? `${base} Our team was notified; if you do not receive email, check spam or contact us on WhatsApp.`
    : `${base} Nuestro equipo fue avisado; si no recibes correo, revisa spam o escríbenos por WhatsApp.`;
}

export function normalizarPayloadCotizacion<T extends CotizacionSubmitPayload>(datos: T): T {
  const mensaje = resolverMensajeCotizacion({
    locale: datos.locale,
    mensaje: datos.mensaje,
    productos: datos.productos,
  });
  return { ...datos, mensaje };
}

type EdgeErrorBody = {
  ok?: boolean;
  error?: string | { message?: string; code?: string };
};

/** Extrae mensaje legible de `functions.invoke` (400/500 con cuerpo JSON). */
export async function interpretarErrorEdgeFunction(error: unknown, data: unknown): Promise<string> {
  const json = (data ?? null) as EdgeErrorBody | null;
  if (json?.error) {
    if (typeof json.error === 'string') return json.error;
    if (json.error.message) return json.error.message;
  }

  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as EdgeErrorBody;
      if (body?.error) {
        if (typeof body.error === 'string') return body.error;
        if (body.error.message) return body.error.message;
      }
    } catch {
      /* ignore */
    }
    if (context.status === 429) {
      return 'Demasiadas solicitudes de cotización. Espera unos minutos e intenta de nuevo.';
    }
  }

  if (error instanceof Error && error.message) {
    if (/429|rate.?limit|too many/i.test(error.message)) {
      return 'Demasiadas solicitudes de cotización. Espera unos minutos e intenta de nuevo.';
    }
    return error.message;
  }
  return 'Error registrando solicitud';
}
