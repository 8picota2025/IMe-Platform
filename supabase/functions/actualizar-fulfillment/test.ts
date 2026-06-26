/**
 * Test para actualizar-fulfillment
 * Ejecutar: deno test --allow-net --allow-env test.ts
 */

const FUNCTION_URL =
  Deno.env.get('FUNCTION_URL') || 'http://localhost:54321/functions/v1/actualizar-fulfillment';
const PROVEEDOR_TOKEN = Deno.env.get('PROVEEDOR_TOKEN') || 'test-token-xyz';
const TEST_FULFILLMENT_ID =
  Deno.env.get('TEST_FULFILLMENT_ID') || '550e8400-e29b-41d4-a716-446655440000';

interface TestResult {
  name: string;
  ok: boolean;
  error?: string;
  response?: unknown;
}

const results: TestResult[] = [];

async function testActualizarFulfillment() {
  console.log('🧪 Iniciando tests para actualizar-fulfillment...\n');

  // Test 1: Request válido
  console.log('Test 1: Actualizar a estado "enviado" con tracking');
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PROVEEDOR_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fulfillment_id: TEST_FULFILLMENT_ID,
        estado: 'enviado',
        tracking_number: 'TRACK123456',
        tracking_url: 'https://ejemplo.com/track/123456',
        notas: 'Enviado por DHL express',
      }),
    });

    const data = await response.json();
    const ok = response.ok && (data as { ok?: boolean }).ok === true;
    results.push({
      name: 'Valid request',
      ok,
      response: data,
    });
    console.log(`  ${ok ? '✅' : '❌'} ${ok ? 'Passed' : 'Failed'}`);
    console.log(`  Response: ${JSON.stringify(data, null, 2)}\n`);
  } catch (error) {
    results.push({
      name: 'Valid request',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ❌ Error: ${error}\n`);
  }

  // Test 2: Sin token
  console.log('Test 2: Sin header Authorization (debe fallar con 401)');
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fulfillment_id: TEST_FULFILLMENT_ID,
        estado: 'preparando',
      }),
    });

    const ok = response.status === 401;
    const data = await response.json();
    results.push({
      name: 'Missing token',
      ok,
      response: data,
    });
    console.log(`  ${ok ? '✅' : '❌'} Status: ${response.status} (esperado 401)\n`);
  } catch (error) {
    results.push({
      name: 'Missing token',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ❌ Error: ${error}\n`);
  }

  // Test 3: Estado inválido
  console.log('Test 3: Estado inválido (debe fallar con 400)');
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PROVEEDOR_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fulfillment_id: TEST_FULFILLMENT_ID,
        estado: 'estado-invalido',
      }),
    });

    const ok = response.status === 400;
    const data = await response.json();
    results.push({
      name: 'Invalid state',
      ok,
      response: data,
    });
    console.log(`  ${ok ? '✅' : '❌'} Status: ${response.status} (esperado 400)\n`);
  } catch (error) {
    results.push({
      name: 'Invalid state',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ❌ Error: ${error}\n`);
  }

  // Test 4: fulfillment_id inválido
  console.log('Test 4: fulfillment_id inválido (debe fallar con 400)');
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PROVEEDOR_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fulfillment_id: 'no-es-uuid',
        estado: 'enviado',
      }),
    });

    const ok = response.status === 400;
    const data = await response.json();
    results.push({
      name: 'Invalid fulfillment_id',
      ok,
      response: data,
    });
    console.log(`  ${ok ? '✅' : '❌'} Status: ${response.status} (esperado 400)\n`);
  } catch (error) {
    results.push({
      name: 'Invalid fulfillment_id',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ❌ Error: ${error}\n`);
  }

  // Test 5: fulfillment_id inexistente
  console.log('Test 5: fulfillment_id inexistente (debe fallar con 404)');
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PROVEEDOR_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fulfillment_id: '00000000-0000-0000-0000-000000000000',
        estado: 'enviado',
      }),
    });

    const ok = response.status === 404;
    const data = await response.json();
    results.push({
      name: 'Non-existent fulfillment',
      ok,
      response: data,
    });
    console.log(`  ${ok ? '✅' : '❌'} Status: ${response.status} (esperado 404)\n`);
  } catch (error) {
    results.push({
      name: 'Non-existent fulfillment',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ❌ Error: ${error}\n`);
  }

  // Resumen
  console.log('📊 Resumen de tests:');
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  console.log(`  Pasados: ${passed}/${total}`);
  results.forEach(r => {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.error ? ` — ${r.error}` : ''}`);
  });

  const allPassed = passed === total;
  Deno.exit(allPassed ? 0 : 1);
}

testActualizarFulfillment().catch(error => {
  console.error('Fatal error:', error);
  Deno.exit(1);
});
