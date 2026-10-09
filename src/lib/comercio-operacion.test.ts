import { describe, expect, it } from 'vitest';
import { getAccionComercial } from './comercial';
import {
  cambioEtapaCrm,
  cambiosFichaAplicables,
  camposFichaPermitidos,
  filaProductoDesdePropuesta,
  productoNuevoPermitido,
  rutaFichaPropuesta,
  confirmacionEjecutable,
  decidirCompra,
  filaSinSecretos,
  MCP_TOOLS,
  objetivoBorradoCrm,
  precioBajoPiso,
  siguientePasoPedido,
  unidadesReservables,
} from './comercio-operacion';

const comprable = {
  activo: true,
  disponible: true,
  precio: 150_000,
  stock: 5,
  gestionar_stock: true,
  stock_estado: 'instock' as const,
  backorder_policy: 'no' as const,
  slug: 'sensor-flujo',
};

describe('decidirCompra', () => {
  it('coincide con la tienda', () => {
    const casos = [
      comprable,
      { ...comprable, precio: null },
      { ...comprable, disponible: false },
      { ...comprable, stock: 0 },
    ];
    for (const producto of casos) {
      expect(decidirCompra(producto).tipo).toBe(getAccionComercial(producto, 'es').tipo);
    }
  });

  it('sin precio público pide cotización', () => {
    expect(decidirCompra({ ...comprable, precio: null }).tipo).toBe('cotizacion');
  });
});

describe('siguientePasoPedido', () => {
  it('prioriza la transferencia y la guía', () => {
    expect(
      siguientePasoPedido({ estado: 'pendiente', proveedorPago: 'transferencia' }).accion
    ).toBe('Validar transferencia');
    expect(siguientePasoPedido({ estado: 'preparando', tieneGuia: false }).accion).toBe(
      'Cargar la guía'
    );
    expect(siguientePasoPedido({ estado: 'preparando', tieneGuia: true }).accion).toBe(
      'Marcar enviado'
    );
    expect(siguientePasoPedido({ estado: 'cancelado' }).cerrado).toBe(true);
    expect(siguientePasoPedido({ estado: 'entregado', facturaEstado: 'emitida' }).cerrado).toBe(
      true
    );
  });
});

describe('precio y secretos', () => {
  it('no deja bajar del piso y no copia secretos', () => {
    expect(precioBajoPiso(90, 100)).toBe(true);
    expect(precioBajoPiso(100, 100)).toBe(false);
    expect(precioBajoPiso(80, null)).toBe(false);
    const limpia = filaSinSecretos({
      nombre: 'Acme',
      api_token: 'no',
      precio_costo: 10,
      webhook_url: 'https://hooks.example',
    });
    expect(limpia).toEqual({ nombre: 'Acme' });
    expect(MCP_TOOLS).not.toContain('activar_dropship');
  });
});

describe('reglas de escritura del agente', () => {
  it('solo admite etapas del CHECK y exige motivo al cerrar', () => {
    expect(cambioEtapaCrm('negociacion', '')).toEqual({ ok: true, cierra: false });
    expect(cambioEtapaCrm('inventada', 'x').ok).toBe(false);
    expect(cambioEtapaCrm('ganado', ' ').ok).toBe(false);
    expect(cambioEtapaCrm('perdido', 'precio')).toEqual({ ok: true, cierra: true });
  });

  it('descuenta reservas activas del stock gestionado', () => {
    expect(unidadesReservables(5, true, 2)).toBe(3);
    expect(unidadesReservables(2, true, 5)).toBe(0);
    expect(unidadesReservables(5, false, 2)).toBeNull();
    expect(unidadesReservables(null, true, 0)).toBeNull();
  });

  it('una propuesta de ficha no toca activo, precio ni dropship', () => {
    expect(
      camposFichaPermitidos({
        descripcion_corta_es: 'Monitor',
        activo: true,
        precio: 1,
        dropship_enabled: true,
      })
    ).toEqual({ descripcion_corta_es: 'Monitor' });
  });
});

describe('borrado en Twenty (preparar/confirmar)', () => {
  it('solo admite objetos borrables y UUID de Twenty', () => {
    expect(MCP_TOOLS).toContain('preparar_borrado_crm');
    expect(MCP_TOOLS).toContain('confirmar_borrado_crm');
    expect(objetivoBorradoCrm('opportunities', ' 74F0A95D-3561-4446-895A-16AC73418D53 ')).toEqual({
      ok: true,
      objeto: 'opportunities',
      id: '74f0a95d-3561-4446-895a-16ac73418d53',
    });
    expect(objetivoBorradoCrm('workspaceMembers', '74f0a95d-3561-4446-895a-16ac73418d53').ok).toBe(
      false
    );
    expect(objetivoBorradoCrm('people', '../companies/x').ok).toBe(false);
    expect(objetivoBorradoCrm('companies', undefined).ok).toBe(false);
  });
});

describe('confirmación verificada contra admin de Supabase', () => {
  const ahora = Date.parse('2026-09-29T12:00:00Z');
  const aprobada = {
    estado: 'aprobada',
    herramienta: 'preparar_borrado_crm',
    aprobada_por: '11111111-1111-4111-8111-111111111111',
    aprobada_en: '2026-09-29T11:00:00Z',
  };
  const owner = { rol: 'owner', activo: true };

  it('ejecuta solo lo aprobado por owner/admin activo', () => {
    expect(confirmacionEjecutable(aprobada, 'preparar_borrado_crm', owner, ahora)).toEqual({
      ok: true,
    });
    expect(
      confirmacionEjecutable(
        aprobada,
        'preparar_borrado_crm',
        { rol: 'admin', activo: true },
        ahora
      ).ok
    ).toBe(true);
  });

  it('no se fía del rol declarado: sin aprobación del CMS no ejecuta', () => {
    const pendiente = { ...aprobada, estado: 'pendiente', aprobada_por: null, aprobada_en: null };
    const r = confirmacionEjecutable(pendiente, 'preparar_borrado_crm', owner, ahora);
    expect(r.ok).toBe(false);
  });

  it('rechaza aprobador sin rol, inactivo, herramienta cruzada o aprobación caducada', () => {
    expect(
      confirmacionEjecutable(
        aprobada,
        'preparar_borrado_crm',
        { rol: 'ventas', activo: true },
        ahora
      ).ok
    ).toBe(false);
    expect(
      confirmacionEjecutable(
        aprobada,
        'preparar_borrado_crm',
        { rol: 'owner', activo: false },
        ahora
      ).ok
    ).toBe(false);
    expect(confirmacionEjecutable(aprobada, 'preparar_borrado_crm', null, ahora).ok).toBe(false);
    expect(confirmacionEjecutable(aprobada, 'preparar_reembolso', owner, ahora).ok).toBe(false);
    expect(
      confirmacionEjecutable(
        { ...aprobada, aprobada_en: '2026-09-28T10:00:00Z' },
        'preparar_borrado_crm',
        owner,
        ahora
      ).ok
    ).toBe(false);
    expect(
      confirmacionEjecutable(
        { ...aprobada, estado: 'confirmada' },
        'preparar_borrado_crm',
        owner,
        ahora
      ).ok
    ).toBe(false);
  });
});

describe('propuestas desde fichas PDF', () => {
  it('acepta nombre_en y solo atributos de landing permitidos', () => {
    expect(
      camposFichaPermitidos({
        nombre_en: 'Monitor',
        atributos: { beneficios_es: ['a'], seo_keywords_en: ['b'], precio_costo: 1 },
      })
    ).toEqual({
      nombre_en: 'Monitor',
      atributos: { beneficios_es: ['a'], seo_keywords_en: ['b'] },
    });
    expect(camposFichaPermitidos({ atributos: { precio_costo: 1 } })).toEqual({});
  });

  it('mezcla atributos con los actuales sin borrar claves', () => {
    expect(
      cambiosFichaAplicables(
        { descripcion_corta_es: 'x', atributos: { valor_es: 'nuevo' } },
        { marca: 'Acme', valor_es: 'viejo' }
      )
    ).toEqual({ descripcion_corta_es: 'x', atributos: { marca: 'Acme', valor_es: 'nuevo' } });
    expect(cambiosFichaAplicables({ nombre_en: 'y' }, { marca: 'Acme' })).toEqual({
      nombre_en: 'y',
    });
  });

  it('valida el producto nuevo y nunca deja pasar activo ni precio', () => {
    expect(productoNuevoPermitido({ slug: 'Mal Slug', nombre_es: 'x' }).ok).toBe(false);
    expect(productoNuevoPermitido({ slug: 'monitor-x1' }).ok).toBe(false);
    const ok = productoNuevoPermitido({
      slug: 'monitor-x1',
      nombre_es: ' Monitor X1 ',
      activo: true,
      precio: 10,
      marca: 'Acme',
      descripcion_corta_en: 'Monitor',
    });
    expect(ok).toEqual({
      ok: true,
      campos: {
        descripcion_corta_en: 'Monitor',
        slug: 'monitor-x1',
        nombre_es: 'Monitor X1',
        marca: 'Acme',
      },
    });
  });

  it('crea la fila de producto siempre inactiva y con marca en atributos', () => {
    const fila = filaProductoDesdePropuesta(
      { slug: 'monitor-x1', nombre_es: 'Monitor X1', marca: 'Acme', precio: 5, activo: true },
      { familiaId: 'f1' }
    );
    expect(fila).toEqual({
      slug: 'monitor-x1',
      nombre_es: 'Monitor X1',
      atributos: { marca: 'Acme', origen: 'propuesta_agente_ficha_pdf' },
      familia_id: 'f1',
      tipo_id: null,
      activo: false,
    });
  });

  it('guarda el PDF propuesto bajo propuestas/<slug>/', () => {
    expect(rutaFichaPropuesta('monitor-x1', 'ABCDEF0123456789ffff')).toBe(
      'propuestas/monitor-x1/abcdef0123456789.pdf'
    );
  });
});
