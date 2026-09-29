import { describe, expect, it } from 'vitest';
import { getAccionComercial } from './comercial';
import {
  cambioEtapaCrm,
  camposFichaPermitidos,
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
