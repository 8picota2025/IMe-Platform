import { describe, expect, it } from 'vitest';
import {
  ASESOR_NOMBRE_DEFECTO,
  REPLY_TO_DEFECTO,
  esEmailValido,
  replyToPorDefecto,
  resolverAsesor,
} from './cotizacion-asesor';
import { huellaOferta, validarEnvioCotizacion } from './cotizacion-envio';
import { construirPayloadResend } from './email-payload';
import { calcularTotalOfertado, parseLineasOferta } from './cotizacion-oferta';
import { baseNetaDesdePrecioConIva, calculateFiscalSummary } from './fiscal';

const lineaOk = {
  slug: 'monitor-m12',
  nombre: 'Monitor M12',
  cantidad: 2,
  precio_unitario: 1_000_000,
  subtotal: 2_000_000,
  moneda: 'COP',
};

const filaBase = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'Cliente@Example.com ',
  telefono: '3001234567',
  moneda: 'COP',
  productos: [lineaOk],
  condiciones: 'Entrega en 30 días.',
};

describe('resolverAsesor', () => {
  it('usa el perfil del usuario que envía', () => {
    const asesor = resolverAsesor({
      nombre: 'Equipo Comercial I-ME',
      email: 'Comercial1@i-me.com.co',
      telefono: ' +57 300 000 0000 ',
    });
    expect(asesor).toMatchObject({
      nombre: 'Equipo Comercial I-ME',
      correo: 'comercial1@i-me.com.co',
      replyTo: 'comercial1@i-me.com.co',
      telefono: '+57 300 000 0000',
      deperfil: true,
    });
  });

  it('nunca muestra el email en crudo como nombre', () => {
    expect(resolverAsesor({ nombre: '', email: 'root@i-me.com.co' }).nombre).toBe(
      ASESOR_NOMBRE_DEFECTO
    );
    expect(resolverAsesor({ nombre: 'root@i-me.com.co', email: 'root@i-me.com.co' }).nombre).toBe(
      ASESOR_NOMBRE_DEFECTO
    );
    expect(resolverAsesor(null).nombre).toBe(ASESOR_NOMBRE_DEFECTO);
  });

  it('sin perfil: Reply-To de entorno o comercial1@i-me.com.co', () => {
    expect(resolverAsesor(null).replyTo).toBe(REPLY_TO_DEFECTO);
    expect(resolverAsesor(null, { replyToEntorno: 'Ventas@i-me.com.co' }).replyTo).toBe(
      'ventas@i-me.com.co'
    );
    expect(resolverAsesor(null, { replyToEntorno: 'no es un email' }).replyTo).toBe(
      REPLY_TO_DEFECTO
    );
    expect(resolverAsesor(null).deperfil).toBe(false);
  });

  it('el perfil gana sobre la variable de entorno', () => {
    const asesor = resolverAsesor(
      { email: 'ana@i-me.com.co' },
      { replyToEntorno: 'otro@i-me.com.co' }
    );
    expect(asesor.replyTo).toBe('ana@i-me.com.co');
  });

  it('valida emails', () => {
    expect(esEmailValido('a@b.co')).toBe(true);
    expect(esEmailValido('a@b')).toBe(false);
    expect(replyToPorDefecto(undefined)).toBe(REPLY_TO_DEFECTO);
  });
});

describe('construirPayloadResend (Reply-To del email de cotización)', () => {
  const base = { from: 'pedidos@i-me.com.co', to: 'c@example.com', subject: 'S', html: '<p>x</p>' };

  it('incluye reply_to del asesor y el PDF adjunto', () => {
    const payload = construirPayloadResend({
      ...base,
      replyTo: 'comercial1@i-me.com.co',
      adjuntos: [{ filename: 'IME-Q-2026-000001.pdf', content: 'JVBERg==' }],
    });
    expect(payload).toMatchObject({
      reply_to: 'comercial1@i-me.com.co',
      attachments: [{ filename: 'IME-Q-2026-000001.pdf' }],
    });
  });

  it('omite reply_to si no es un email válido y no manda adjuntos vacíos', () => {
    const payload = construirPayloadResend({ ...base, replyTo: 'basura', adjuntos: [] });
    expect(payload).not.toHaveProperty('reply_to');
    expect(payload).not.toHaveProperty('attachments');
  });
});

describe('validarEnvioCotizacion', () => {
  it('acepta una oferta completa y normaliza el email', () => {
    const r = validarEnvioCotizacion(filaBase, { canal: 'email', exigirPreciosFirmes: true });
    expect(r).toMatchObject({
      ok: true,
      email: 'cliente@example.com',
      total: 2_000_000,
      moneda: 'COP',
    });
  });

  it('rechaza líneas sin precio, sin condiciones y moneda mixta', () => {
    expect(
      validarEnvioCotizacion(
        { ...filaBase, productos: [{ ...lineaOk, precio_unitario: 0, subtotal: 0 }] },
        { canal: 'email' }
      )
    ).toMatchObject({ ok: false, code: 'OFERTA_SIN_PRECIO', status: 422 });
    expect(
      validarEnvioCotizacion({ ...filaBase, condiciones: '  ' }, { canal: 'email' })
    ).toMatchObject({ ok: false, code: 'OFERTA_SIN_CONDICIONES' });
    expect(
      validarEnvioCotizacion(
        { ...filaBase, productos: [{ ...lineaOk, moneda: 'USD' }] },
        { canal: 'email' }
      )
    ).toMatchObject({ ok: false, code: 'OFERTA_MONEDA_MIXTA' });
  });

  it('el MCP no deja salir líneas con precio pendiente de validar', () => {
    const fila = {
      ...filaBase,
      productos: [
        lineaOk,
        {
          ...lineaOk,
          slug: 'x',
          nombre: 'X',
          precio_unitario: 0,
          subtotal: 0,
          precio_pendiente_validar: true,
        },
      ],
    };
    expect(validarEnvioCotizacion(fila, { canal: 'email' }).ok).toBe(true);
    expect(
      validarEnvioCotizacion(fila, { canal: 'email', exigirPreciosFirmes: true })
    ).toMatchObject({ ok: false, code: 'PRECIO_PENDIENTE' });
  });

  it('exige email real (email) o teléfono válido (whatsapp)', () => {
    expect(
      validarEnvioCotizacion({ ...filaBase, email: 'sin-arroba' }, { canal: 'email' })
    ).toMatchObject({ ok: false, code: 'SIN_EMAIL' });
    expect(
      validarEnvioCotizacion({ ...filaBase, telefono: '12' }, { canal: 'whatsapp' })
    ).toMatchObject({ ok: false, code: 'SIN_TELEFONO' });
    expect(validarEnvioCotizacion(filaBase, { canal: 'whatsapp' }).ok).toBe(true);
  });
});

describe('huellaOferta', () => {
  it('cambia si cambia lo que vería el cliente y no por campos irrelevantes', async () => {
    const a = await huellaOferta(filaBase);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await huellaOferta({ ...filaBase, email: 'cliente@example.com' })).toBe(a);
    expect(await huellaOferta({ ...filaBase, numero: 'IME-Q-2026-000009' })).toBe(a);
    expect(await huellaOferta({ ...filaBase, condiciones: 'Entrega en 10 días.' })).not.toBe(a);
    expect(
      await huellaOferta({ ...filaBase, productos: [{ ...lineaOk, precio_unitario: 900_000 }] })
    ).not.toBe(a);
    expect(await huellaOferta({ ...filaBase, impuestos_incluidos: true })).not.toBe(a);
  });
});

describe('IVA incluido: el total ofertado cuadra con el total fiscal que valida formalizar', () => {
  it('con IVA 19 % incluido, base + IVA == total ofertado (±1)', () => {
    const lineas = parseLineasOferta([
      { ...lineaOk, precio_unitario: 1_190_000, subtotal: 2_380_000 },
      {
        ...lineaOk,
        slug: 'otro',
        nombre: 'Otro',
        cantidad: 1,
        precio_unitario: 595_000,
        subtotal: 595_000,
      },
    ]);
    const total = calcularTotalOfertado(lineas);
    const fiscal = calculateFiscalSummary(
      lineas.map(l => ({
        slug: l.slug,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio_unitario: baseNetaDesdePrecioConIva(l.precio_unitario, 19),
        tarifa_iva_pct: 19,
        excluido_iva: false,
      })) as never,
      { solicitar_factura_electronica: true } as never,
      { moneda: 'COP', mercado: 'CO', envio_total: 0, default_iva_pct: 0 }
    );
    expect(total).toBe(2_975_000);
    expect(Math.abs(fiscal.total - total)).toBeLessThanOrEqual(1);
  });
});
