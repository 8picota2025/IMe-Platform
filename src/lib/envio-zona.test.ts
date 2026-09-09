import { describe, expect, it } from 'vitest';
import { normalizarDeptoEnvio, resolverEnvioPorZona, type TarifaEnvioZona } from './envio-zona';

const ZONAS: TarifaEnvioZona[] = [
  { departamentos: ['Cundinamarca', 'Bogotá'], tarifa: 15000, gratis_desde: 500000 },
  { departamentos: ['Antioquia'], tarifa: 25000, gratis_desde: null },
  { departamentos: [], tarifa: 35000, gratis_desde: null },
];

describe('resolverEnvioPorZona', () => {
  it('sin tarifas activas mantiene envio 0 (logistica no configurada)', () => {
    expect(resolverEnvioPorZona([], undefined, 100000)).toEqual({ ok: true, envio: 0 });
  });

  it('con tarifas, omitir departamento no regala envio (undercharge guard)', () => {
    const result = resolverEnvioPorZona(ZONAS, undefined, 100000);
    expect(result).toEqual({
      ok: false,
      code: 'ENVIO_DEPARTAMENTO_REQUERIDO',
      message: 'Departamento requerido para calcular el envio',
    });
  });

  it('con tarifas, departamento vacio tampoco falla abierto a 0', () => {
    expect(resolverEnvioPorZona(ZONAS, '  ', 100000).ok).toBe(false);
  });

  it('resuelve zona especifica por departamento normalizado', () => {
    expect(resolverEnvioPorZona(ZONAS, 'Bogotá', 100000)).toEqual({ ok: true, envio: 15000 });
    expect(resolverEnvioPorZona(ZONAS, 'antioquia', 100000)).toEqual({ ok: true, envio: 25000 });
  });

  it('usa zona default solo cuando el departamento no tiene tarifa especifica', () => {
    expect(resolverEnvioPorZona(ZONAS, 'Valle del Cauca', 100000)).toEqual({
      ok: true,
      envio: 35000,
    });
  });

  it('aplica gratis_desde sobre la base post-descuento', () => {
    expect(resolverEnvioPorZona(ZONAS, 'Cundinamarca', 500000)).toEqual({ ok: true, envio: 0 });
  });

  it('sin zona especifica ni default → error, no envio 0 silencioso', () => {
    const soloEspecificas: TarifaEnvioZona[] = [
      { departamentos: ['Antioquia'], tarifa: 25000, gratis_desde: null },
    ];
    expect(resolverEnvioPorZona(soloEspecificas, 'Cundinamarca', 100000)).toEqual({
      ok: false,
      code: 'ENVIO_ZONA_DESCONOCIDA',
      message: 'No hay tarifa de envio para el departamento indicado',
    });
  });
});

describe('normalizarDeptoEnvio', () => {
  it('elimina acentos y normaliza mayusculas', () => {
    expect(normalizarDeptoEnvio('  Bogotá  ')).toBe('bogota');
  });
});
