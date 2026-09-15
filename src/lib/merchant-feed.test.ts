import { describe, expect, it } from 'vitest';
import {
  buildMerchantFeedXml,
  buildMerchantItemXml,
  escapeXml,
  formatMerchantPrice,
} from './merchant-feed';

const base = {
  id: 'uuid-1',
  slug: 'sensor-flujo',
  nombre: 'Sensor de flujo',
  descripcion: 'Sensor <desc> & co',
  link: 'https://i-me.com.co/es/productos/sensor-flujo/',
  imagen_principal: 'https://i-me.com.co/img.jpg',
  precio: 119000,
  currency: 'COP',
  activo: true,
  disponible: true,
  stock: 3,
  gestionar_stock: true,
  marca: 'SLE',
};

describe('merchant-feed', () => {
  it('escapa XML', () => {
    expect(escapeXml(`a<"&>'`)).toContain('&lt;');
    expect(escapeXml(`a<"&>'`)).toContain('&amp;');
  });

  it('precio COP sin decimales inventados', () => {
    expect(formatMerchantPrice(119000, 'COP')).toBe('119000 COP');
  });

  it('omite productos no elegibles', () => {
    expect(buildMerchantItemXml({ ...base, precio: null })).toBeNull();
    expect(buildMerchantItemXml({ ...base, imagen_principal: '' })).toBeNull();
  });

  it('feed bien formado sin INVIMA global ni brand inventado I-ME', () => {
    const xml = buildMerchantFeedXml(
      [base, { ...base, id: '2', marca: null, fabricante: null }],
      'I-ME'
    );
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<g:id>uuid-1</g:id>');
    expect(xml).toContain('<g:brand>SLE</g:brand>');
    expect(xml).not.toContain('Con INVIMA');
    expect(xml).not.toContain('<g:brand>I-ME</g:brand>');
    expect(xml).toContain('119000 COP');
  });
});
