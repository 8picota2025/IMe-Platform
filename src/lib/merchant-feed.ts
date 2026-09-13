/**
 * Serialización XML Google Merchant (fuente canónica lógica).
 * La Edge Function `generar-feed-google` es el único generador desplegado.
 */

import {
  isMerchantEligible,
  merchantAvailability,
  type CommerceProductSignals,
} from './commerce-policy';
import { tienePrecioPublico } from './format';

export interface MerchantFeedProduct extends CommerceProductSignals {
  id: string;
  nombre: string;
  descripcion?: string | null;
  link: string;
  currency?: string;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function merchantTitle(nombre: string): string {
  // No añadir "Precio Colombia" automáticamente.
  return nombre.trim().slice(0, 150);
}

export function formatMerchantPrice(precio: number, currency = 'COP'): string {
  if (!tienePrecioPublico(precio)) throw new Error('precio_invalido');
  const amount = currency === 'COP' ? Math.round(precio) : Math.round(precio * 100) / 100;
  return `${amount.toFixed(currency === 'COP' ? 0 : 2)} ${currency}`;
}

export function buildMerchantItemXml(product: MerchantFeedProduct): string | null {
  const eligible = isMerchantEligible(product);
  if (!eligible.ok) return null;
  if (!tienePrecioPublico(product.precio)) return null;

  const brand =
    (typeof product.marca === 'string' && product.marca.trim()) ||
    (typeof product.fabricante === 'string' && product.fabricante.trim()) ||
    '';

  const lines = [
    '<item>',
    `<g:id>${escapeXml(product.id)}</g:id>`,
    `<g:title>${escapeXml(merchantTitle(product.nombre))}</g:title>`,
    `<g:description>${escapeXml((product.descripcion || product.nombre).trim().slice(0, 5000))}</g:description>`,
    `<g:link>${escapeXml(product.link)}</g:link>`,
    `<g:image_link>${escapeXml(String(product.imagen_principal).trim())}</g:image_link>`,
    `<g:price>${escapeXml(formatMerchantPrice(product.precio, product.currency ?? 'COP'))}</g:price>`,
    `<g:availability>${merchantAvailability(product)}</g:availability>`,
    `<g:condition>new</g:condition>`,
  ];
  if (brand) lines.push(`<g:brand>${escapeXml(brand)}</g:brand>`);
  lines.push('<g:custom_label_0>ime_catalog</g:custom_label_0>');
  // g:google_product_category solo si mapping verificado (no inventar).
  lines.push('</item>');
  return lines.join('');
}

export function buildMerchantFeedXml(
  products: MerchantFeedProduct[],
  channelTitle: string
): string {
  const items = products
    .map(buildMerchantItemXml)
    .filter((x): x is string => typeof x === 'string');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    `<title>${escapeXml(channelTitle)}</title>`,
    '<link>https://i-me.com.co/</link>',
    '<description>Feed de productos I-ME (fuente dinámica)</description>',
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');
}
