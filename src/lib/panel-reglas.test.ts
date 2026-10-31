import { describe, expect, it } from 'vitest';
import {
  accesoPanel,
  agruparTarjetas,
  alertasDeTarjeta,
  esIdempotenteCotizacion,
  esIdempotenteTarea,
  puedeAprobar,
  validarCuerpo,
  PanelAccionError,
  type TarjetaPanel,
} from './panel-reglas';

const ID = '11111111-1111-4111-8111-111111111111';

function tarjeta(parcial: Partial<TarjetaPanel> = {}): TarjetaPanel {
  return {
    id: ID,
    origen: 'cotizacion',
    tipo: 'cotizacion',
    titulo: 'ABIERTA',
    ref: 'ABIERTA',
    columna: 'por_aprobar',
    estado: 'en_revision',
    total: 10,
    moneda: 'COP',
    aprobado_por: null,
    aprobado_at: null,
    aprobacion_tipo: null,
    validez_hasta: null,
    send_error: null,
    notas_internas: null,
    empresa: 'Clinica',
    bot_dueno: null,
    updated_at: null,
    ...parcial,
  };
}

describe('reglas del panel', () => {
  it('agrupa columnas y marca PENDIENTE con alertas', () => {
    const grupos = agruparTarjetas([
      tarjeta({
        id: 'a',
        total: 500,
        columna: 'bloqueado',
        notas_internas: 'NO ENVIAR',
        send_error: 'smtp',
      }),
      tarjeta({ id: 'b', total: 100, columna: 'aprobado_en_cola', aprobado_por: 'shoky' }),
      tarjeta({ id: 'c', origen: 'twenty', columna: 'en_ejecucion' }),
    ]);
    expect(grupos.bloqueado.map(item => item.id)).toEqual(['a']);
    expect(alertasDeTarjeta(grupos.bloqueado[0]!).sort()).toEqual(['NO ENVIAR', 'send_error']);
    expect(grupos.aprobado_en_cola[0]?.aprobado_por).toBe('shoky');
    expect(puedeAprobar(grupos.en_ejecucion[0]!)).toBe(false);
    expect(puedeAprobar(grupos.bloqueado[0]!)).toBe(true);
  });

  it('niega el panel a quien no es admin u owner', () => {
    expect(accesoPanel({ ok: false })).toBe('forbidden');
    expect(accesoPanel({ ok: true, userId: 'u', role: 'ventas' })).toBe('forbidden');
    expect(accesoPanel({ ok: true, userId: null, role: 'admin' })).toBe('forbidden');
    expect(accesoPanel({ ok: true, userId: 'u', role: 'admin' })).toBe('ok');
    expect(accesoPanel({ ok: true, userId: 'u', role: 'owner' })).toBe('ok');
  });

  it('exige confirmacion y trata Twenty como solo lectura', () => {
    expect(() =>
      validarCuerpo({ accion: 'aprobar', origen: 'twenty', id: ID, confirmado: true })
    ).toThrow(PanelAccionError);
    expect(() =>
      validarCuerpo({ accion: 'aprobar', origen: 'cotizacion', id: ID, confirmado: false })
    ).toThrow(PanelAccionError);
    const cuerpo = validarCuerpo({
      accion: 'aprobar',
      origen: 'cotizacion',
      id: ID,
      confirmado: true,
      aprobacion_tipo: 'ok_shoky',
      ref: 'chat-1',
    });
    expect(cuerpo.ref).toBe('chat-1');
  });

  it('reconoce una marca ya puesta y una tarea ya encolada', () => {
    expect(
      esIdempotenteCotizacion(
        {
          aprobado_por: 'shoky',
          aprobado_at: '2026-10-31T16:00:00Z',
          aprobacion_tipo: 'ok_shoky',
          aprobacion_hash: 'abc',
        },
        'ok_shoky'
      )
    ).toBe(true);
    expect(esIdempotenteCotizacion({ aprobado_por: 'shoky' }, 'ok_shoky')).toBe(false);
    expect(esIdempotenteTarea({ columna: 'aprobado_en_cola', estado: 'en_cola' })).toBe(true);
    expect(esIdempotenteTarea({ columna: 'bloqueado', estado: 'abierta' })).toBe(false);
  });
});
