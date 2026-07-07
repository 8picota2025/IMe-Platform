import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolverDivipola } from './divipola.ts';

Deno.test('resolverDivipola: match exacto departamento+ciudad', () => {
  const match = resolverDivipola('Antioquia', 'Medellin');
  assertEquals(match?.stateCode, '05');
  assertEquals(match?.cityCode, '05001');
});

Deno.test('resolverDivipola: ignora tildes/mayusculas/puntuacion', () => {
  const match = resolverDivipola('bogota d.c.', 'BOGOTÁ, D.C.');
  assertEquals(match?.stateCode, '11');
  assertEquals(match?.cityCode, '11001');
});

Deno.test('resolverDivipola: departamento vacio busca solo por ciudad si es unica', () => {
  const match = resolverDivipola('', 'Medellin');
  assertEquals(match?.cityCode, '05001');
});

Deno.test('resolverDivipola: ciudad inexistente retorna null (nunca inventa codigo)', () => {
  const match = resolverDivipola('Antioquia', 'Ciudad Que No Existe');
  assertEquals(match, null);
});

Deno.test('resolverDivipola: ciudad vacia retorna null', () => {
  const match = resolverDivipola('Antioquia', '');
  assertEquals(match, null);
});

Deno.test('resolverDivipola: "Bogota" a secas resuelve al Distrito Capital', () => {
  const match = resolverDivipola('Bogota', 'Bogota');
  assertEquals(match?.stateCode, '11');
  assertEquals(match?.cityCode, '11001');
});
