export type Locale = 'es' | 'en';

export type TipoComercial = 'consumible' | 'equipo';

export type FulfillmentMode = 'dropship' | 'cotizacion' | 'individualizado';

export interface ProductoBase {
  id_origen: number;
  slug: string;
  slug_generado: boolean;
  nombre: string;
  familia: string;
  tipo: TipoComercial | null;
  descripcion_corta: string;
  descripcion_larga: string;
  especificaciones: Especificacion[];
  specs_raw: string;
  imagen_principal: string;
  imagen_local: string;
  galeria: string[];
  ficha_pdf: string | null;
  badges: string[];
  destacado: boolean;
  nuevo: boolean;
  url_origen: string;
  notas_extraccion: string;
}

export interface Especificacion {
  clave: string;
  valor: string;
  unidad?: string;
}

export interface Familia {
  slug: string;
  nombre: string;
  descripcion: string;
  url_origen: string;
}

export interface CotizacionInput {
  items: CotizacionItem[];
  cliente: ClienteInfo;
  notas?: string;
}

export interface CotizacionItem {
  producto_id: string;
  cantidad: number;
  precio_unitario?: number;
  notas?: string;
}

export interface ClienteInfo {
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  pais: string;
  ciudad?: string;
  tipo_documento?: string;
  numero_documento?: string;
}

export interface PagoCrearInput {
  monto: number;
  moneda: 'COP' | 'USD' | 'EUR';
  referencia: string;
  tipo_comercial: TipoComercial;
  fulfillment_mode: FulfillmentMode;
  cliente: ClienteInfo;
  items: PagoItem[];
  return_url: string;
  webhook_url: string;
}

export interface PagoItem {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  nombre: string;
}

export interface AsesorQuery {
  pregunta: string;
  contexto?: {
    producto_id?: string;
    familia?: string;
    historial?: AsesorMessage[];
  };
  locale: Locale;
}

export interface AsesorMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AsesorResponse {
  respuesta: string;
  fuentes: AsesorFuente[];
  presupuesto_usado: number;
  presupuesto_restante: number;
  fallback_usado: boolean;
}

export interface AsesorFuente {
  tipo: 'producto' | 'documento' | 'faq';
  id: string;
  titulo: string;
  relevancia: number;
}

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}
