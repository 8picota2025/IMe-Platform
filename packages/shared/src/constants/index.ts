export const FAMILIAS = [
  { slug: 'monitores', nombre: 'Monitores de Signos Vitales' },
  { slug: 'cardiologia', nombre: 'Cardiología' },
  { slug: 'sala-cirugia', nombre: 'Sala de Cirugía' },
  { slug: 'neonatologia', nombre: 'Neonatología' },
  { slug: 'ultrasonido', nombre: 'Ultrasonido' },
  { slug: 'soluciones-iv', nombre: 'Soluciones IV' },
  { slug: 'mobiliario', nombre: 'Mobiliario Hospitalario' },
  { slug: 'anestesia', nombre: 'Anestesia y Ventilación' },
] as const;

export const FAMILIA_SLUGS = FAMILIAS.map(f => f.slug);

export const TIPO_COMERCIAL_OPTIONS = ['consumible', 'equipo'] as const;

export const FULFILLMENT_MODE_OPTIONS = ['dropship', 'cotizacion', 'individualizado'] as const;

export const MONEDAS = ['COP', 'USD', 'EUR'] as const;

export const LOCALES = ['es', 'en'] as const;

export const DEFAULT_LOCALE = 'es' as const;

export const SUPPORTED_LOCALES = ['es', 'en'] as const;

export const PAIS_DEFAULT = 'CO';

export const PAISES_SOPORTADOS = [
  'CO',
  'ES',
  'MX',
  'AR',
  'CL',
  'PE',
  'EC',
  'VE',
  'BO',
  'PY',
  'UY',
  'CR',
  'PA',
  'GT',
  'DO',
  'SV',
  'HN',
  'NI',
] as const;

export const PRECIO_COSTO_CONFIDENCIAL = true;

export const BUDGET_ASesor_DEFAULT_USD = 0.02;

export const RATE_LIMIT_ASesor = {
  requests_per_minute: 10,
  requests_per_hour: 100,
  requests_per_day: 500,
};

export const TURNSTILE_ACTIONS = {
  asesor: 'asesor',
  contacto: 'contacto',
  cotizacion: 'cotizacion',
} as const;
