import { describe, expect, it } from 'vitest';
import {
  esCorreoIme,
  esNitIme,
  esRazonSocialIme,
  esTelefonoIme,
  textoCliente,
  validarContactoClienteBorrador,
  validarContactoClienteParaEnvio,
} from './contacto-cliente';

describe('contacto de I-ME fuera del cliente', () => {
  it('reconoce el dominio i-me.com.co y el teléfono oficial en cualquier formato', () => {
    expect(esCorreoIme('pendiente-2mtrading@i-me.com.co')).toBe(true);
    expect(esCorreoIme('Comercial1@I-ME.com.co')).toBe(true);
    expect(esCorreoIme('ana@mail.i-me.com.co')).toBe(true);
    expect(esCorreoIme('ana@clinic.co')).toBe(false);
    expect(esTelefonoIme('+57 313 724 7353')).toBe(true);
    expect(esTelefonoIme('+573137247353')).toBe(true);
    expect(esTelefonoIme('3137247353')).toBe(true);
    expect(esTelefonoIme('+57 300 123 4567')).toBe(false);
    expect(esNitIme('901.871.720-1')).toBe(true);
    expect(esNitIme('900123456')).toBe(false);
    expect(esRazonSocialIme('International Medical Enterprise IME S.A.S.')).toBe(true);
    expect(esRazonSocialIme('2M Trading, Contracting & Facility Management W.L.L.')).toBe(false);
  });

  it('en pantalla sustituye el dato de I-ME o el vacío por un guion', () => {
    expect(textoCliente('pendiente-2mtrading@i-me.com.co', 'email')).toBe('—');
    expect(textoCliente('+57 313 724 7353', 'telefono')).toBe('—');
    expect(textoCliente('', 'email')).toBe('—');
    expect(textoCliente('essam@2mtrading.com', 'email')).toBe('essam@2mtrading.com');
  });

  it('no deja completar ni enviar si falta el contacto o es de I-ME', () => {
    expect(
      validarContactoClienteParaEnvio({
        email: 'pendiente-2mtrading@i-me.com.co',
        telefono: '+974 5555 0101',
      })
    ).toMatchObject({ ok: false, code: 'CONTACTO_IME' });
    expect(
      validarContactoClienteParaEnvio({
        email: 'essam@2mtrading.com',
        telefono: '+57 313 724 7353',
      })
    ).toMatchObject({ ok: false, code: 'CONTACTO_IME' });
    expect(
      validarContactoClienteParaEnvio({ email: '', telefono: '+974 5555 0101' })
    ).toMatchObject({ ok: false, code: 'SIN_EMAIL' });
    expect(
      validarContactoClienteParaEnvio({ email: 'essam@2mtrading.com', telefono: ' ' })
    ).toMatchObject({ ok: false, code: 'SIN_TELEFONO' });
    expect(
      validarContactoClienteParaEnvio({
        email: 'Essam@2MTrading.com',
        telefono: '+974 5555 0101',
      })
    ).toMatchObject({ ok: true, email: 'essam@2mtrading.com' });
  });

  it('en borrador admite vacío y rechaza un marcador de I-ME', () => {
    expect(validarContactoClienteBorrador({ email: '', telefono: '' }).ok).toBe(true);
    expect(
      validarContactoClienteBorrador({ email: 'tmp@i-me.com.co', telefono: '' })
    ).toMatchObject({ ok: false, code: 'CONTACTO_IME' });
    expect(validarContactoClienteBorrador({ email: 'no-es-email', telefono: '' })).toMatchObject({
      ok: false,
      code: 'SIN_EMAIL',
    });
  });
});
