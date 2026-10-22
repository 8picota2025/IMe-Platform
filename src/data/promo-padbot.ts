/**
 * Promoción comercial confirmada por Shoky.
 * El texto deja abierto si entra un PadBot P2, un X3, o el alcance del pedido.
 */
import type { Locale } from '../i18n/utils';

export const PROMO_PADBOT_ES =
  'Con la compra de un equipo de imagenología de última generación (WR-3D, Talent II) o del equipamiento de quirófano, I-ME puede incluir sin costo un robot PadBot P2 o X3, según el pedido.';

export const PROMO_PADBOT_EN =
  'With the purchase of a latest-generation imaging system (WR-3D, Talent II) or operating-room equipment, I-ME may include a PadBot P2 or X3 robot at no charge, depending on the order.';

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
