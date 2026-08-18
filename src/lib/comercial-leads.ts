/**
 * Dominio de leads comerciales B2B (landings consultivas).
 * No inventa precios ni claims clínicos — solo calificación y mensajes.
 */

export type LeadPriority = 'P1' | 'P2' | 'P3';

export type FabricanteLandingId =
  | 'fab_tuttnauer'
  | 'fab_saikang'
  | 'fab_angell'
  | 'fab_northern'
  | 'fab_ilumitec'
  | 'fab_perlong'
  | 'fab_bm'
  | 'fab_advanced'
  | 'fab_m';

export type CampaignLandingId =
  | 'torres_laparoscopia'
  | 'esterilizacion'
  | 'imagenologia'
  | 'robotica_rehabilitacion'
  | 'proyectos'
  | 'pdf_descarga'
  | 'evento'
  | FabricanteLandingId;

export type HorizonteCompra = '0-3' | '4-12' | 'exploracion';

export interface CommercialLeadInput {
  nombre: string;
  cargo?: string;
  institucion: string;
  ciudad: string;
  telefono?: string;
  email?: string;
  familia_slug: string;
  tipo_slug?: string;
  tipo_proyecto: string;
  horizonte: HorizonteCompra;
  presupuesto_estado?: string;
  necesidad: string;
  consentimiento: boolean;
  campaign: CampaignLandingId;
  locale?: 'es' | 'en';
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const WHATSAPP_E164 = '573103332607';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPTIONAL_TURNSTILE_CAMPAIGNS = new Set<CampaignLandingId>(['pdf_descarga', 'evento']);

/** Turnstile 600* puede fallar en navegadores/redes legítimas. Estas campañas
 * siguen protegidas por honeypot, rate-limit e campos obligatorios. */
export function isTurnstileOptionalCampaign(campaign?: string | null): boolean {
  return Boolean(campaign && OPTIONAL_TURNSTILE_CAMPAIGNS.has(campaign as CampaignLandingId));
}

export function classifyLead(horizonte: HorizonteCompra): LeadPriority {
  if (horizonte === '0-3') return 'P1';
  if (horizonte === '4-12') return 'P2';
  return 'P3';
}

export function validateCommercialLead(input: Partial<CommercialLeadInput>): ValidationResult {
  const errors: Record<string, string> = {};
  const locale = input.locale ?? 'es';
  const req = (key: string, es: string, en: string) => {
    errors[key] = locale === 'en' ? en : es;
  };

  if (!input.nombre?.trim()) req('nombre', 'Indica tu nombre.', 'Enter your name.');
  if (!input.institucion?.trim())
    req('institucion', 'Indica la institución.', 'Enter the institution.');
  if (!input.ciudad?.trim()) req('ciudad', 'Indica la ciudad.', 'Enter the city.');
  if (input.campaign === 'evento') {
    if (!input.telefono?.trim()) req('telefono', 'Indica el teléfono.', 'Enter the phone number.');
    if (!input.email?.trim()) req('email', 'Indica el correo.', 'Enter the email address.');
  } else if (!input.telefono?.trim() && !input.email?.trim()) {
    req('contacto', 'Indica teléfono o correo.', 'Enter phone or email.');
  }
  if (input.email?.trim() && !EMAIL_RE.test(input.email.trim())) {
    req('email', 'Indica un correo válido.', 'Enter a valid email.');
  }
  if (!input.tipo_proyecto?.trim())
    req('tipo_proyecto', 'Selecciona el tipo de proyecto.', 'Select the project type.');
  if (!input.horizonte)
    req('horizonte', 'Selecciona el horizonte.', 'Select the purchase horizon.');
  if (!input.necesidad?.trim())
    req('necesidad', 'Describe la necesidad concreta.', 'Describe the concrete need.');
  if (!input.consentimiento)
    req('consentimiento', 'Debes autorizar el contacto.', 'Contact authorization is required.');
  if (!input.familia_slug?.trim())
    req('familia_slug', 'Falta la familia del proyecto.', 'Project family is missing.');
  if (!input.campaign) req('campaign', 'Falta la campaña.', 'Campaign is missing.');

  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildWhatsAppMessage(input: CommercialLeadInput): string {
  const lines = [
    `Hola, soy ${input.nombre.trim()}${input.cargo?.trim() ? ` (${input.cargo.trim()})` : ''} de ${input.institucion.trim()} en ${input.ciudad.trim()}.`,
    `Familia: ${input.familia_slug}.`,
    input.tipo_slug ? `Tipo: ${input.tipo_slug}.` : null,
    input.campaign.startsWith('fab_') ? `Campaña tipología/fabricante: ${input.campaign}.` : null,
    `Proyecto: ${input.tipo_proyecto}.`,
    `Horizonte: ${input.horizonte}.`,
    input.presupuesto_estado ? `Presupuesto/financiación: ${input.presupuesto_estado}.` : null,
    `Necesidad: ${input.necesidad.trim()}.`,
    'Quisiera evaluar el proyecto con I-ME.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildWhatsAppUrl(input: CommercialLeadInput): string {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(buildWhatsAppMessage(input))}`;
}

export function slaForPriority(priority: LeadPriority, locale: 'es' | 'en' = 'es'): string {
  if (priority === 'P1') {
    return locale === 'en'
      ? 'Got it — your timeline looks near-term. We will aim to contact you the same business day.'
      : 'Recibido — su plazo se ve cercano. Buscaremos contactarle el mismo día hábil.';
  }
  if (priority === 'P2') {
    return locale === 'en'
      ? 'Thanks — we will follow up with consultative guidance in the coming business days.'
      : 'Gracias — le daremos seguimiento con orientación en los próximos días hábiles.';
  }
  return locale === 'en'
    ? 'Thanks for exploring. We will share useful material without flooding your inbox.'
    : 'Gracias por explorar. Le compartiremos material útil sin saturarle.';
}
