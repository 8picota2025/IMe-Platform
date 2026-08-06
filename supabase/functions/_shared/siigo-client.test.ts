import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  autenticar,
  crearFactura,
  resolverCliente,
  resolverProducto,
  type SiigoConfig,
  type SiigoInvoicePayload,
} from './siigo-client.ts';

/** No se usa (los tests aqui no pasan productoId), solo satisface el tipo. */
const SUPABASE_NO_USADO = undefined as unknown as SupabaseClient;

const CONFIG: SiigoConfig = {
  username: 'info@i-me.com.co',
  accessKey: 'fake-key',
  partnerId: 'IMECOMCO',
  documentTypeId: 31158,
  sellerId: 304,
  paymentTypeId: 12939,
  accountGroupId: 603,
  taxMap: { '19': 6331, '5': 6332, '0': 13962 },
};

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async (_input: unknown, _init?: unknown) => {
    const next = responses[call] ?? responses[responses.length - 1]!;
    call += 1;
    return new Response(JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

Deno.test('autenticar: devuelve access_token en respuesta exitosa', async () => {
  const restore = mockFetchSequence([{ status: 200, body: { access_token: 'tok-123' } }]);
  try {
    const token = await autenticar(CONFIG);
    assertEquals(token, 'tok-123');
  } finally {
    restore();
  }
});

Deno.test('autenticar: lanza error si Siigo responde 401', async () => {
  const restore = mockFetchSequence([{ status: 401, body: { message: 'invalid credentials' } }]);
  try {
    await assertRejects(() => autenticar(CONFIG));
  } finally {
    restore();
  }
});

Deno.test('resolverCliente: cliente existente no crea uno nuevo', async () => {
  const restore = mockFetchSequence([{ status: 200, body: { results: [{ id: 'cust-1' }] } }]);
  try {
    const result = await resolverCliente('tok', CONFIG, {
      tipo_documento: 'NIT',
      numero_documento: '900123456',
      tipo_persona: 'juridica',
      razon_social: 'Hospital Demo SAS',
      email: 'facturas@hospital-demo.test',
      responsable_iva: true,
      direccion: { direccion: 'Calle 1 # 2-3', ciudad: 'Medellin', departamento: 'Antioquia' },
    });
    assertEquals(result.identification, '900123456');
  } finally {
    restore();
  }
});

Deno.test('resolverCliente: crea cliente juridico cuando no existe', async () => {
  const restore = mockFetchSequence([
    { status: 200, body: { results: [] } },
    { status: 201, body: { id: 'cust-nuevo' } },
  ]);
  try {
    const result = await resolverCliente('tok', CONFIG, {
      tipo_documento: 'NIT',
      numero_documento: '900999999',
      tipo_persona: 'juridica',
      razon_social: 'Clinica Nueva SAS',
      email: 'facturas@clinica-nueva.test',
      responsable_iva: true,
      direccion: { direccion: 'Cra 1', ciudad: 'Bogota', departamento: 'Bogota' },
    });
    assertEquals(result.identification, '900999999');
  } finally {
    restore();
  }
});

Deno.test(
  'resolverCliente: lanza error si no puede resolver DIVIPOLA (nunca inventa codigo)',
  async () => {
    const restore = mockFetchSequence([{ status: 200, body: { results: [] } }]);
    try {
      await assertRejects(() =>
        resolverCliente('tok', CONFIG, {
          tipo_documento: 'CC',
          numero_documento: '123',
          tipo_persona: 'natural',
          razon_social: 'Juan Perez',
          email: 'juan@test.com',
          responsable_iva: false,
          direccion: { direccion: 'Calle X', ciudad: 'Ciudad Inventada', departamento: 'Nada' },
        })
      );
    } finally {
      restore();
    }
  }
);

Deno.test('resolverCliente: lanza error si tipo_documento sin mapeo id_type', async () => {
  const restore = mockFetchSequence([{ status: 200, body: { results: [] } }]);
  try {
    await assertRejects(() =>
      resolverCliente('tok', CONFIG, {
        tipo_documento: 'OTRO',
        numero_documento: '123',
        tipo_persona: 'natural',
        razon_social: 'Juan Perez',
        email: 'juan@test.com',
        responsable_iva: false,
        direccion: { direccion: 'Calle X', ciudad: 'Medellin', departamento: 'Antioquia' },
      })
    );
  } finally {
    restore();
  }
});

Deno.test('resolverProducto: usa slug cuando no hay sku ni supabase client', async () => {
  const restore = mockFetchSequence([{ status: 200, body: { results: [{ id: 'prod-1' }] } }]);
  try {
    const result = await resolverProducto('tok', CONFIG, SUPABASE_NO_USADO, {
      productoId: undefined,
      slug: 'consumible-demo',
      nombre: 'Consumible Demo',
      tarifaIvaPct: 19,
    });
    assertEquals(result.code, 'consumible-demo');
  } finally {
    restore();
  }
});

Deno.test('resolverProducto: crea producto nuevo con impuesto mapeado', async () => {
  const restore = mockFetchSequence([
    { status: 200, body: { results: [] } },
    { status: 201, body: { id: 'prod-nuevo' } },
  ]);
  try {
    const result = await resolverProducto('tok', CONFIG, SUPABASE_NO_USADO, {
      productoId: undefined,
      slug: 'consumible-nuevo',
      nombre: 'Consumible Nuevo',
      tarifaIvaPct: 19,
    });
    assertEquals(result.code, 'consumible-nuevo');
  } finally {
    restore();
  }
});

Deno.test('resolverProducto: lanza error si tarifa IVA sin mapeo', async () => {
  const restore = mockFetchSequence([{ status: 200, body: { results: [] } }]);
  try {
    await assertRejects(() =>
      resolverProducto('tok', CONFIG, SUPABASE_NO_USADO, {
        productoId: undefined,
        slug: 'consumible-demo',
        nombre: 'Consumible Demo',
        tarifaIvaPct: 7,
      })
    );
  } finally {
    restore();
  }
});

const PAYLOAD_FIXTURE: SiigoInvoicePayload = {
  document: { id: 31158 },
  date: '2026-07-07',
  customer: { identification: '900123456', branch_office: 0 },
  seller: 304,
  items: [
    { code: 'sku-1', description: 'Item', quantity: 1, price: 100000, taxes: [{ id: 6331 }] },
  ],
  payments: [{ id: 12939, value: 119000 }],
  stamp: { send: true },
  mail: { send: true },
};

Deno.test('crearFactura: mapea respuesta aceptada', async () => {
  const restore = mockFetchSequence([
    { status: 201, body: { name: 'FV-2-25', stamp: { status: 'Accepted', cufe: 'cufe-abc' } } },
  ]);
  try {
    const result = await crearFactura('tok', CONFIG, PAYLOAD_FIXTURE);
    assertEquals(result.ok, true);
    assertEquals(result.numeroFactura, 'FV-2-25');
    assertEquals(result.cufe, 'cufe-abc');
    assertEquals(result.estadoStamp, 'Accepted');
  } finally {
    restore();
  }
});

Deno.test('crearFactura: mapea fallo HTTP a ok=false con mensaje de error', async () => {
  const restore = mockFetchSequence([
    { status: 400, body: { Errors: [{ Message: 'Producto inactivo' }] } },
  ]);
  try {
    const result = await crearFactura('tok', CONFIG, PAYLOAD_FIXTURE);
    assertEquals(result.ok, false);
    assertEquals(result.error, 'Producto inactivo');
  } finally {
    restore();
  }
});
