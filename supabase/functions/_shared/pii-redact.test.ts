import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { redactHistorial, redactPii } from './pii-redact.ts';

Deno.test('redactPii: reemplaza un email', () => {
  assertEquals(
    redactPii('mi correo es juan.perez@hospitaldemo.com.co gracias'),
    'mi correo es [EMAIL] gracias'
  );
});

Deno.test('redactPii: reemplaza un telefono con formato CO', () => {
  assertEquals(redactPii('llamame al +57 300 123 4567 porfa'), 'llamame al [TELEFONO] porfa');
});

Deno.test('redactPii: reemplaza un telefono sin separadores', () => {
  assertEquals(redactPii('mi numero es 3001234567'), 'mi numero es [TELEFONO]');
});

Deno.test('redactPii: reemplaza email y telefono en el mismo mensaje', () => {
  assertEquals(
    redactPii('contactame a ventas@imedemo.com o al 6015551234'),
    'contactame a [EMAIL] o al [TELEFONO]'
  );
});

Deno.test('redactPii: no toca texto sin PII detectable', () => {
  const texto = 'Necesito un monitor multiparametrico para UCI, 4 camas.';
  assertEquals(redactPii(texto), texto);
});

Deno.test('redactPii: no confunde un numero corto (cantidad, ref de producto) con telefono', () => {
  assertEquals(
    redactPii('necesito 4 unidades del modelo SK-123'),
    'necesito 4 unidades del modelo SK-123'
  );
});

Deno.test('redactPii: string vacio no falla', () => {
  assertEquals(redactPii(''), '');
});

Deno.test('redactHistorial: redacta contenido en cada item, conserva rol', () => {
  const historial = [
    { rol: 'usuario', contenido: 'mi correo es a@b.com' },
    { rol: 'asesor', contenido: 'Claro, te contactamos pronto.' },
  ];
  const result = redactHistorial(historial);
  assertEquals(result[0]?.contenido, 'mi correo es [EMAIL]');
  assertEquals(result[0]?.rol, 'usuario');
  assertEquals(result[1]?.contenido, 'Claro, te contactamos pronto.');
});

Deno.test('redactPii: reemplaza fijo CO con indicativo entre parentesis', () => {
  assertEquals(redactPii('oficina (601) 555 1234 ext 2'), 'oficina [TELEFONO] ext 2');
});

Deno.test('redactPii: reemplaza internacional explicito con +', () => {
  assertEquals(redactPii('whatsapp +1 305 555 0142'), 'whatsapp [TELEFONO]');
});

Deno.test('redactPii: conserva datos comerciales que el agente necesita', () => {
  for (const texto of [
    'Precio 1.500.000 COP',
    'Presupuesto de 350.000.000 para 2027',
    'Monitor ref 7021-3350 cantidad 2',
    'Entrega 2026-09-22',
    'NIT 900.123.456-7',
    'Registro INVIMA 2019DM-0019876',
    'Pedido 3001234567890',
  ]) {
    assertEquals(redactPii(texto), texto);
  }
});
