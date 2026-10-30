/**
 * Promoción comercial confirmada por Shoky.
 * El texto deja abierto si entra un PadBot P2, un X3, o el alcance del pedido.
 */
import type { Locale } from '../i18n/utils';

export const PROMO_PADBOT_ES =
  'En proyectos integrales de equipamiento de quirófano o con la adquisición de equipos de imagenología de última generación (como sistemas DR dinámicos WR-3D o arcos en C quirúrgicos Talent II), I-ME puede llegar a incluir una unidad robótica de servicio PadBot P2 o PadBot X3 sin costo adicional según el alcance del pedido.';

export const PROMO_PADBOT_EN =
  'On integrated operating-room equipment projects, or with the acquisition of latest-generation imaging systems (such as WR-3D dynamic DR systems or Talent II surgical C-arms), I-ME may include one service PadBot P2 or PadBot X3 unit at no additional charge, depending on the scope of the order.';

export const SLUGS_PROMO_PADBOT = [
  'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot',
  'padbot-x3-robot-recepcion-ref-padbot-x3-padbot',
  'sistema-radiografico-3d-wr-3d-angell-technology-ref-wr-3d-angell',
  'telemando-digital-rf-ref-talent-ii-angell',
] as const;

const SLUGS = new Set<string>(SLUGS_PROMO_PADBOT);

export function textoPromoPadbot(locale: Locale): string {
  return locale === 'en' ? PROMO_PADBOT_EN : PROMO_PADBOT_ES;
}

export function muestraPromoPadbot(slug: string): boolean {
  return SLUGS.has(slug);
}
