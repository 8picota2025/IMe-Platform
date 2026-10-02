import { describe, expect, it } from 'vitest';
import {
  construirCambiosCotizacion,
  construirLineasCotizacion,
  detalleCotizacion,
  normalizarFiltroCotizaciones,
  resumenCotizacion,
  type ProductoCatalogo,
} from './cotizacion-mcp';
import { MCP_TOOLS } from './comercio-operacion';

const catalogo = new Map<string, ProductoCatalogo>([
  ['prod-1', { id: 'prod-1', slug: 'monitor-m12', nombre_es: 'Monitor M12' }],
]);

const filaEditable = {
  id: '22222222-2222-4222-8222-222222222222',
  estado: 'nueva',
  nombre: 'Ana',
  email: 'ana@example.com',
  telefono: '3001234567',
  moneda: 'COP',
  productos: [
    {
      slug: 'monitor-m12',
      nombre: 'Monitor M12',
      cantidad: 1,
      precio_unitario: 1000,
      subtotal: 1000,
      moneda: 'COP',
    },
  ],
  condiciones: 'Entrega 30 días',
  formalizacion_token_hash: 'NO-DEBE-SALIR',
  metadata: {
    formalizacion_url: 'https://i-me.com.co/es/cotizacion/formalizar?id=x&t=y',
    quote_send_error: 'HTTP 422: dominio no verificado',
  },
};

describe('herramientas MCP de cotizaciones', () => {
  it('están registradas', () => {
    for (const nombre of [
      'buscar_cotizaciones',
      'obtener_cotizacion',
      'actualizar_cotizacion',
      'preparar_envio_cotizacion',
      'confirmar_envio_cotizacion',
      'crear_borrador_cotizacion',
    ]) {
      expect(MCP_TOOLS).toContain(nombre);
    }
  });
});

describe('normalizarFiltroCotizaciones', () => {
  it('aplica límites y limpia caracteres de filtro', () => {
    const r = normalizarFiltroCotizaciones({ q: 'a,b(c)%', limite: 999, estado: 'Enviada nueva' });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.filtro.q).toBe('a b c');
      expect(r.filtro.limite).toBe(50);
      expect(r.filtro.estados).toEqual(['enviada', 'nueva']);
    }
    const sinLimite = normalizarFiltroCotizaciones({});
    expect(sinLimite.ok && sinLimite.filtro.limite).toBe(20);
  });

  it('valida estados y fechas', () => {
    expect(normalizarFiltroCotizaciones({ estado: 'inventado' }).ok).toBe(false);
    expect(normalizarFiltroCotizaciones({ desde: '2026-13-40' }).ok).toBe(false);
    expect(normalizarFiltroCotizaciones({ desde: '2026-02-01', hasta: '2026-01-01' }).ok).toBe(
      false
    );
    expect(normalizarFiltroCotizaciones({ desde: '2026-01-01', hasta: '2026-02-01' }).ok).toBe(
      true
    );
  });
});

describe('construirLineasCotizacion', () => {
  it('acepta producto de catálogo y línea libre con descripción', () => {
    const r = construirLineasCotizacion(
      [
        { producto_id: 'prod-1', cantidad: 2, precio_unitario: 1500.5 },
        { nombre: 'Instalación', cantidad: 1, precio_unitario: 300000, descripcion: 'In situ' },
      ],
      catalogo,
      'COP'
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lineas[0]).toMatchObject({ slug: 'monitor-m12', subtotal: 3001, moneda: 'COP' });
      expect(r.lineas[1]).toMatchObject({ slug: '', notas: 'In situ' });
    }
  });

  it('rechaza precio ≤ 0, producto inexistente, cantidad inválida y precio bajo el piso', () => {
    const mal = (item: Record<string, unknown>) =>
      construirLineasCotizacion([item], catalogo, 'COP');
    expect(mal({ nombre: 'X', cantidad: 1, precio_unitario: 0 }).ok).toBe(false);
    expect(mal({ producto_id: 'nope', cantidad: 1, precio_unitario: 5 }).ok).toBe(false);
    expect(mal({ nombre: 'X', cantidad: 0, precio_unitario: 5 }).ok).toBe(false);
    expect(mal({ cantidad: 1, precio_unitario: 5 }).ok).toBe(false);
    expect(mal({ nombre: 'X', cantidad: 1, precio_unitario: 90, piso: 100 }).ok).toBe(false);
    expect(construirLineasCotizacion([], catalogo, 'COP').ok).toBe(false);
  });
});

describe('construirCambiosCotizacion', () => {
  const lineas = [
    { slug: 'a', nombre: 'A', cantidad: 2, precio_unitario: 500, subtotal: 1000, moneda: 'COP' },
  ];
  const hoy = new Date('2026-10-01T12:00:00Z');

  it('actualiza cliente, condiciones, validez, IVA, moneda y notas', () => {
    const r = construirCambiosCotizacion(
      {
        cliente: {
          nombre: 'Ana Gómez',
          empresa: 'Clínica X',
          nit: '900.123.456-7',
          email: 'ANA@Clinica.co',
          telefono: '+57 300 1112233',
          direccion_envio: 'Cra 7 # 1-2',
          ciudad: 'Bogotá',
        },
        condiciones: 'Pago 100 % anticipado',
        validez_hasta: '2026-10-30',
        impuestos_incluidos: true,
        notas: 'Pedido por WhatsApp',
      },
      filaEditable,
      lineas,
      hoy
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cambios.patch).toMatchObject({
        nombre: 'Ana Gómez',
        email: 'ana@clinica.co',
        nit: '900.123.456-7',
        direccion_envio: 'Cra 7 # 1-2, Bogotá',
        condiciones: 'Pago 100 % anticipado',
        validez_hasta: '2026-10-30',
        impuestos_incluidos: true,
        productos: lineas,
        precio_total_ofertado: 1000,
        leida: true,
      });
      expect(String(r.cambios.patch.notas_internas)).toContain(
        '2026-10-01 12:00] Pedido por WhatsApp'
      );
      expect(r.cambios.campos).toContain('impuestos_incluidos');
    }
  });

  it('bloquea cotizaciones convertidas o ya enviadas', () => {
    expect(
      construirCambiosCotizacion(
        { condiciones: 'x' },
        { ...filaEditable, estado: 'convertida' },
        null
      )
    ).toMatchObject({ ok: false, code: 'COTIZACION_YA_CONVERTIDA' });
    expect(
      construirCambiosCotizacion({ condiciones: 'x' }, { ...filaEditable, pedido_id: 'p1' }, null)
    ).toMatchObject({ ok: false, code: 'COTIZACION_YA_CONVERTIDA' });
    expect(
      construirCambiosCotizacion({ condiciones: 'x' }, { ...filaEditable, estado: 'enviada' }, null)
    ).toMatchObject({ ok: false, code: 'COTIZACION_INMUTABLE' });
  });

  it('valida email, fecha pasada, moneda y que haya algo que cambiar', () => {
    const c = (args: Record<string, unknown>) =>
      construirCambiosCotizacion(args, filaEditable, null, hoy);
    expect(c({ cliente: { email: 'malo' } }).ok).toBe(false);
    expect(c({ validez_hasta: '2020-01-01' }).ok).toBe(false);
    expect(c({ validez_hasta: 'mañana' }).ok).toBe(false);
    expect(c({ moneda: 'EUR' }).ok).toBe(false);
    expect(c({ impuestos_incluidos: 'sí' }).ok).toBe(false);
    expect(c({}).ok).toBe(false);
  });

  it('cambiar la moneda reetiqueta las líneas existentes', () => {
    const r = construirCambiosCotizacion({ moneda: 'USD' }, filaEditable, null, hoy);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cambios.patch.mercado).toBe('INTL');
      expect((r.cambios.patch.productos as Array<{ moneda: string }>)[0]?.moneda).toBe('USD');
    }
  });
});

describe('detalleCotizacion / resumenCotizacion', () => {
  it('devuelve enlaces y último error de envío, sin el hash del token', () => {
    const detalle = detalleCotizacion(filaEditable, {
      user_id: 'u1',
      nombre: 'Equipo Comercial I-ME',
      email: 'comercial1@i-me.com.co',
    });
    expect(detalle.enlaces.formalizar_url).toContain('/es/cotizacion/formalizar');
    expect(detalle.ultimo_error_envio).toBe('HTTP 422: dominio no verificado');
    expect(detalle.editable).toBe(true);
    expect(detalle.owner?.nombre).toBe('Equipo Comercial I-ME');
    expect(detalle.lineas[0]).toMatchObject({ nombre: 'Monitor M12', cantidad: 1 });
    expect(JSON.stringify(detalle)).not.toContain('NO-DEBE-SALIR');
  });

  it('el resumen incluye cliente, total, moneda, estado y owner', () => {
    const r = resumenCotizacion(filaEditable, null);
    expect(r).toMatchObject({
      cliente: { email: 'ana@example.com' },
      total: 1000,
      moneda: 'COP',
      estado: 'nueva',
      owner: null,
    });
  });
});
