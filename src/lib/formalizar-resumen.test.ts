import { expect, it } from 'vitest';
import { htmlResumenFormalizar, saludoFormalizar } from './formalizar-resumen';

const money = (valor: number, moneda: string) => `${moneda} ${valor}`;

const base = {
  nombre: 'Essam Yaseen',
  empresa: '2M Trading',
  email: '—',
  telefono: '—',
  nit: '—',
  direccion: '—',
  ciudad: 'Doha',
  pais: 'Qatar',
  condiciones: 'Entrega en 30 días.',
  condiciones_en: '',
  validez_hasta: '2026-10-31',
  moneda: 'USD',
  total: 10,
  lineas: [
    {
      nombre: 'Monitor',
      nombre_en: '',
      cantidad: 1,
      precio_unitario: 10,
      subtotal: 10,
      moneda: 'USD',
    },
  ],
};

it('omits empty client rows and stays in Spanish for a national quote', () => {
  const html = htmlResumenFormalizar({ ...base, idioma: 'es', moneda: 'COP', email: 'compras@cliente.co', telefono: '+974 4000 1000' }, money);
  expect(html).toContain('Correo:');
  expect(html).toContain('compras@cliente.co');
  expect(html).not.toContain('Email');
  expect(html).not.toContain('Unit price');
  expect(html).toContain('Precio unitario');
  expect(html).not.toContain('i-me.com.co');
});

it('prints bilingual labels and keeps the Spanish line when there is no English version', () => {
  const html = htmlResumenFormalizar({ ...base, idioma: 'es-en' }, money);
  expect(html).toContain('Precio unitario / Unit price');
  expect(html).toContain('Razón social / Company');
  expect(html).toContain('Monitor');
  expect(html).not.toContain('Correo / Email');
  expect(html).not.toContain('Teléfono / Phone');
  expect(html).toContain('Ciudad / City');
  expect(html).toContain('Doha');
  expect(saludoFormalizar('Essam Yaseen', 'es-en')).toContain('Wompi solo aplica');
  expect(saludoFormalizar('Essam Yaseen', 'es-en')).toContain('(COP) only');
});
