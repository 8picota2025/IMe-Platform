import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from './seo';

describe('buildProductJsonLd', () => {
  const producto = {
    nombre: 'Monitor de Paciente Biolight M12',
    descripcion_corta: 'Monitor de paciente compacto.',
    imagen_principal: '/assets/importados/equitronic/img/monitor-de-paciente-m12-biolight-1.jpg',
    slug: 'eq-monitor-de-paciente-m12-biolight',
    precio: 12500000,
    moneda: 'COP',
  };

  it('usa la marca del fabricante cuando esta presente', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.brand as { name: string }).name).toBe('Biolight');
  });

  it('cae a I-ME cuando no hay marca', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', null);
    expect((jsonLd.brand as { name: string }).name).toBe('I-ME International Medical Enterprise');
  });

  it('incluye precio y moneda cuando el producto los tiene visibles', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.offers as { price: number }).price).toBe(12500000);
    expect((jsonLd.offers as { priceCurrency: string }).priceCurrency).toBe('COP');
  });
});
