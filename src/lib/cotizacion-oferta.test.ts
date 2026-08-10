import { describe, expect, it } from 'vitest';
import {
  COTIZACION_ESTADOS_CLAIMABLES,
  calcularTotalOfertado,
  evaluateCotizacionConversionClaim,
  expiryFromValidez,
  formalizarPath,
  hashTokenSha256,
  ofertaCompleta,
  parseLineasOferta,
  puedeFormalizar,
  splitNombreApellido,
  tokenExpirado,
} from './cotizacion-oferta';

describe('cotizacion-oferta', () => {
  it('parseLineasOferta calcula subtotal y filtra invalidas', () => {
    const lineas = parseLineasOferta([
      { slug: 'a', nombre: 'A', cantidad: 2, precio_unitario: 1000, moneda: 'COP' },
      { slug: '', cantidad: 1, precio_unitario: 10 },
      { slug: 'b', cantidad: 1 },
      { slug: 'c', cantidad: 0, precio_unitario: 10 },
    ]);
    expect(lineas).toHaveLength(2);
    expect(lineas[0]!.subtotal).toBe(2000);
    expect(lineas[1]!.precio_unitario).toBe(0);
  });

  it('parseLineasOferta acepta lineas sin slug si tienen nombre', () => {
    const lineas = parseLineasOferta([
      { slug: '', nombre: 'Estetoscopio IA', cantidad: 2, precio_unitario: 500, moneda: 'COP' },
    ]);
    expect(lineas).toHaveLength(1);
    expect(lineas[0]!.slug).toBe('');
    expect(lineas[0]!.subtotal).toBe(1000);
    expect(ofertaCompleta(lineas, 'Entrega 30 dias').ok).toBe(true);
  });

  it('ofertaCompleta exige precios y condiciones', () => {
    const lineas = parseLineasOferta([
      { slug: 'a', nombre: 'A', cantidad: 1, precio_unitario: 50000, moneda: 'COP' },
    ]);
    expect(ofertaCompleta(lineas, 'Validez 15 dias').ok).toBe(true);
    expect(ofertaCompleta(lineas, '').ok).toBe(false);
    expect(ofertaCompleta(parseLineasOferta([{ slug: 'a', cantidad: 1 }]), 'ok').ok).toBe(false);
  });

  it('calcularTotalOfertado suma lineas', () => {
    expect(
      calcularTotalOfertado(
        parseLineasOferta([
          { slug: 'a', cantidad: 2, precio_unitario: 100 },
          { slug: 'b', cantidad: 1, precio_unitario: 50 },
        ])
      )
    ).toBe(250);
  });

  it('hashTokenSha256 estable', async () => {
    const a = await hashTokenSha256('token-demo');
    const b = await hashTokenSha256('token-demo');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('tokenExpirado / puedeFormalizar', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(tokenExpirado('2026-07-01T00:00:00Z', now)).toBe(true);
    expect(tokenExpirado('2026-08-10T00:00:00Z', now)).toBe(false);
    expect(
      puedeFormalizar(
        {
          id: 'x',
          estado: 'enviada',
          formalizacion_token_hash: 'abc',
          formalizacion_token_expira_at: '2026-08-10T00:00:00Z',
          condiciones: 'Pago contra entrega',
          productos: [{ slug: 'a', cantidad: 1, precio_unitario: 10, nombre: 'A' }],
        },
        now
      )
    ).toBe(true);
    expect(
      puedeFormalizar(
        {
          id: 'x',
          estado: 'nueva',
          formalizacion_token_hash: 'abc',
          formalizacion_token_expira_at: '2026-08-10T00:00:00Z',
          condiciones: 'ok',
          productos: [{ slug: 'a', cantidad: 1, precio_unitario: 10 }],
        },
        now
      )
    ).toBe(false);
  });

  it('splitNombreApellido y formalizarPath', () => {
    expect(splitNombreApellido('Juan Perez Lopez')).toEqual({
      nombre: 'Juan',
      apellido: 'Perez Lopez',
    });
    expect(formalizarPath('es', 'id1', 'tok')).toContain('/es/cotizacion/formalizar?id=id1');
    expect(formalizarPath('en', 'id1', 'tok')).toContain('/en/quote/formalize?id=id1');
  });

  it('expiryFromValidez usa validez_hasta o default dias', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    expect(expiryFromValidez('2026-08-20', 14, now)).toContain('2026-08-20');
    const fallback = expiryFromValidez(null, 14, now);
    expect(Date.parse(fallback)).toBeGreaterThan(now.getTime());
  });

  it('evaluateCotizacionConversionClaim distingue claimed / lost_race / error', () => {
    expect(COTIZACION_ESTADOS_CLAIMABLES).toEqual(['enviada', 'respondida']);
    expect(evaluateCotizacionConversionClaim({ claimedId: 'cot-1' })).toBe('claimed');
    expect(evaluateCotizacionConversionClaim({ claimedId: null })).toBe('lost_race');
    expect(evaluateCotizacionConversionClaim({ claimedId: undefined })).toBe('lost_race');
    expect(
      evaluateCotizacionConversionClaim({
        claimedId: 'cot-1',
        claimErrorMessage: 'db down',
      })
    ).toBe('error');
    expect(
      evaluateCotizacionConversionClaim({
        claimedId: null,
        claimErrorMessage: 'db down',
      })
    ).toBe('error');
  });
});
