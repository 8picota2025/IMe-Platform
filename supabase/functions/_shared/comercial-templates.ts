/**
 * Renderizado de plantillas comerciales (email/WhatsApp) para el CMS
 * comercial. Solo se permiten variables conocidas — cualquier `{{x}}` no
 * reconocido se rechaza para evitar filtrar placeholders sin resolver o
 * permitir inyeccion de variables arbitrarias desde plantillas editadas
 * por usuarios con rol `ventas`.
 */

export interface ComercialTemplateVars {
  nombre_destinatario: string;
  nombre_comercial: string;
  centro_medico: string;
  mensaje: string;
  lista_productos_texto: string;
  lista_productos_html: string;
  correo_comercial: string;
  telefono_comercial: string;
}

const KNOWN_VARS = new Set<keyof ComercialTemplateVars>([
  'nombre_destinatario',
  'nombre_comercial',
  'centro_medico',
  'mensaje',
  'lista_productos_texto',
  'lista_productos_html',
  'correo_comercial',
  'telefono_comercial',
]);

export interface RenderTemplateResult {
  ok: boolean;
  text?: string;
  error?: string;
  unknownVars?: string[];
}

/**
 * Reemplaza `{{variable}}` en `body` usando `vars`. Si `body` contiene una
 * variable no reconocida (no presente en KNOWN_VARS), la funcion falla en
 * vez de dejar el placeholder sin reemplazar o ignorarlo silenciosamente.
 */
export function renderTemplate(
  body: string,
  vars: Partial<ComercialTemplateVars>
): RenderTemplateResult {
  const unknownVars = new Set<string>();

  const text = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey as keyof ComercialTemplateVars;
    if (!KNOWN_VARS.has(key)) {
      unknownVars.add(rawKey);
      return '';
    }
    return vars[key] ?? '';
  });

  if (unknownVars.size > 0) {
    return {
      ok: false,
      error: `Variables desconocidas en plantilla: ${[...unknownVars].join(', ')}`,
      unknownVars: [...unknownVars],
    };
  }

  return { ok: true, text };
}

export interface ProductoParaLista {
  nombre: string;
  url?: string | null;
  sku?: string | null;
}

/**
 * Construye el bloque de texto plano con la lista de productos (para
 * WhatsApp y como fallback de email en texto).
 */
export function buildProductListText(productos: ProductoParaLista[]): string {
  if (productos.length === 0) return '(sin productos seleccionados)';
  return productos
    .map(p => {
      const sku = p.sku ? ` (ref. ${p.sku})` : '';
      const url = p.url ? ` — ${p.url}` : '';
      return `• ${p.nombre}${sku}${url}`;
    })
    .join('\n');
}

/**
 * Construye el bloque HTML con la lista de productos (para el email).
 * `escapeHtml` debe aplicarse a los valores ANTES de llamar a esta funcion
 * si provienen de input libre; los snapshots de producto son datos propios
 * del catalogo, pero se escapan igual por defensividad.
 */
export function buildProductListHtml(
  productos: ProductoParaLista[],
  escapeHtml: (value: string) => string
): string {
  if (productos.length === 0) return '<li>(sin productos seleccionados)</li>';
  return productos
    .map(p => {
      const nombre = escapeHtml(p.nombre);
      const sku = p.sku ? ` <small>(ref. ${escapeHtml(p.sku)})</small>` : '';
      const item = p.url ? `<a href="${escapeHtml(p.url)}">${nombre}</a>${sku}` : `${nombre}${sku}`;
      return `<li>${item}</li>`;
    })
    .join('');
}

export const DEFAULT_EMAIL_SUBJECT = 'Catalogo I-ME para {{centro_medico}}';

export const DEFAULT_EMAIL_BODY =
  'Hola {{nombre_destinatario}},\n\n' +
  'Soy {{nombre_comercial}}, asesor(a) comercial de I-ME International Medical Enterprise.\n\n' +
  '{{mensaje}}\n\n' +
  'Estos son los productos que quiero compartir contigo:\n{{lista_productos_texto}}\n\n' +
  'Quedo atento(a) a tus comentarios para coordinar una cotizacion o demostracion.\n\n' +
  'Saludos,\n{{nombre_comercial}}\nI-ME International Medical Enterprise\n{{correo_comercial}} · {{telefono_comercial}}';

export const DEFAULT_WHATSAPP_BODY =
  'Hola {{nombre_destinatario}}, soy {{nombre_comercial}} de I-ME.\n' +
  '{{mensaje}}\n\n' +
  'Te comparto estos productos de nuestro catalogo:\n{{lista_productos_texto}}\n\n' +
  'Cualquier duda, quedo atento(a). {{telefono_comercial}}';
