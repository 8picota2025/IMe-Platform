import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  TwentyClient,
  deriveLifecycleFromOpportunityStage,
  mapCrmEtapaToTwentyStage,
  mergeAccountLifecycle,
  type TwentyRecord,
} from './twenty-crm.ts';

interface RecordedCall {
  method: string;
  pathname: string;
  body?: Record<string, unknown>;
}

interface MockOptions {
  company?: TwentyRecord;
  person?: TwentyRecord;
  opportunity?: TwentyRecord;
  task?: TwentyRecord;
  target?: TwentyRecord;
  staleOpportunityIds?: string[];
  failTaskWrites?: boolean;
  failTargetWrites?: boolean;
}

function collection(key: string, value: TwentyRecord | null): Response {
  return Response.json({ data: { [key]: value ? [value] : [] } });
}

function record(value: TwentyRecord, status = 200): Response {
  return Response.json(value, { status });
}

function installTwentyMock(options: MockOptions = {}) {
  const originalFetch = globalThis.fetch;
  const calls: RecordedCall[] = [];
  const staleOpportunityIds = new Set(options.staleOpportunityIds ?? []);
  let company = options.company ?? null;
  let person = options.person ?? null;
  let opportunity = options.opportunity ?? null;
  let task = options.task ?? null;
  let target = options.target ?? null;
  let note: TwentyRecord | null = null;
  let noteTarget: TwentyRecord | null = null;

  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    );
    const method = init?.method ?? request?.method ?? 'GET';
    const rawBody = init?.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : undefined;
    calls.push({ method, pathname: url.pathname, ...(body ? { body } : {}) });

    if (url.pathname === '/rest/companies') {
      if (method === 'GET') return collection('companies', company);
      company = { id: 'company-1', ...body };
      return record(company, 201);
    }
    if (url.pathname.startsWith('/rest/companies/')) {
      company = { ...(company ?? {}), id: url.pathname.split('/').at(-1)!, ...body };
      return record(company);
    }

    if (url.pathname === '/rest/people') {
      if (method === 'GET') return collection('people', person);
      person = { id: 'person-1', ...body };
      return record(person, 201);
    }
    if (url.pathname.startsWith('/rest/people/')) {
      person = { ...(person ?? {}), id: url.pathname.split('/').at(-1)!, ...body };
      return record(person);
    }

    if (url.pathname === '/rest/opportunities') {
      if (method === 'GET') return collection('opportunities', opportunity);
      opportunity = { id: 'opportunity-1', ...body };
      return record(opportunity, 201);
    }
    if (url.pathname.startsWith('/rest/opportunities/')) {
      const id = url.pathname.split('/').at(-1)!;
      if (staleOpportunityIds.has(id) || (opportunity && opportunity.id !== id)) {
        return Response.json({ error: 'not found' }, { status: 404 });
      }
      opportunity = { ...(opportunity ?? {}), id, ...body };
      return record(opportunity);
    }

    if (url.pathname === '/rest/tasks') {
      if (method === 'GET') return collection('tasks', task);
      if (options.failTaskWrites) {
        return Response.json({ error: 'task failed' }, { status: 500 });
      }
      task = { id: 'task-1', ...body };
      return record(task, 201);
    }
    if (url.pathname.startsWith('/rest/tasks/')) {
      if (options.failTaskWrites) {
        return Response.json({ error: 'task failed' }, { status: 500 });
      }
      task = { ...(task ?? {}), id: url.pathname.split('/').at(-1)!, ...body };
      return record(task);
    }

    if (url.pathname === '/rest/taskTargets') {
      if (method === 'GET') return collection('taskTargets', target);
      if (options.failTargetWrites) {
        return Response.json({ error: 'target failed' }, { status: 500 });
      }
      target = { id: 'target-1', ...body };
      return record(target, 201);
    }
    if (url.pathname.startsWith('/rest/taskTargets/')) {
      if (options.failTargetWrites) {
        return Response.json({ error: 'target failed' }, { status: 500 });
      }
      target = { ...(target ?? {}), id: url.pathname.split('/').at(-1)!, ...body };
      return record(target);
    }

    if (url.pathname === '/rest/notes') {
      if (method === 'GET') return collection('notes', note);
      note = { id: 'note-1', ...body };
      return record(note, 201);
    }
    if (url.pathname.startsWith('/rest/notes/')) {
      note = { ...(note ?? {}), id: url.pathname.split('/').at(-1)!, ...body };
      return record(note);
    }
    if (url.pathname === '/rest/noteTargets') {
      noteTarget = { id: 'note-target-1', ...body };
      return record(noteTarget, 201);
    }

    return Response.json({ error: 'unexpected request' }, { status: 500 });
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function eventInput(overrides: Record<string, unknown> = {}) {
  return {
    nombre: 'Ana María Pérez Gómez',
    nombres: 'Ana María',
    apellidos: 'Pérez Gómez',
    email: 'ana.evento@example.test',
    telefono: '+57 300 123 4567',
    empresa: 'Hospital Demo',
    mensaje: 'Registro de asistente al evento',
    origen: 'evento',
    tipoSolicitud: 'registro_evento',
    productos: [],
    priority: 'P1' as const,
    campaign: 'evento',
    familySlug: 'evento',
    purchaseHorizon: 'exploracion',
    ciudad: 'Bogotá',
    leadReference: 'lead-evento-123',
    ownerId: 'owner-1',
    ...overrides,
  };
}

function callsFor(calls: RecordedCall[], method: string, pathname: string): RecordedCall[] {
  return calls.filter(call => call.method === method && call.pathname === pathname);
}

Deno.test('evento: crea persona, oportunidad, tarea y enlace con datos del asistente', async () => {
  const mock = installTwentyMock();
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, true);
    assertEquals(result.data, {
      personId: 'person-1',
      companyId: 'company-1',
      opportunityId: 'opportunity-1',
      taskId: 'task-1',
    });

    const person = callsFor(mock.calls, 'POST', '/rest/people')[0]?.body;
    assertEquals(person?.name, { firstName: 'Ana María', lastName: 'Pérez Gómez' });
    assertEquals(person?.jobTitle, 'Lead evento · evento');

    const opportunity = callsFor(mock.calls, 'POST', '/rest/opportunities')[0]?.body;
    assertStringIncludes(String(opportunity?.name), 'Registro evento lead-evento-123');

    const task = callsFor(mock.calls, 'POST', '/rest/tasks')[0]?.body;
    const taskBody = task?.bodyV2 as { markdown?: string };
    assertStringIncludes(taskBody.markdown ?? '', '**Campaña:** evento');
    assertStringIncludes(taskBody.markdown ?? '', '**Evento:** evento');
    assertStringIncludes(taskBody.markdown ?? '', '**Ciudad:** Bogotá');

    const target = callsFor(mock.calls, 'POST', '/rest/taskTargets')[0]?.body;
    assertEquals(target?.targetOpportunityId, 'opportunity-1');
  } finally {
    mock.restore();
  }
});

Deno.test('evento: actualiza oportunidad persistida sin buscarla ni duplicarla', async () => {
  const mock = installTwentyMock({ opportunity: { id: 'opportunity-saved' } });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput({ twentyOpportunityId: 'opportunity-saved' }));

    assertEquals(result.ok, true);
    assertEquals(result.data?.opportunityId, 'opportunity-saved');
    assertEquals(callsFor(mock.calls, 'PATCH', '/rest/opportunities/opportunity-saved').length, 1);
    assertEquals(callsFor(mock.calls, 'GET', '/rest/opportunities').length, 0);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/opportunities').length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test('evento: recupera oportunidad si ID persistido fue borrado', async () => {
  const mock = installTwentyMock({ staleOpportunityIds: ['opportunity-deleted'] });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput({ twentyOpportunityId: 'opportunity-deleted' }));

    assertEquals(result.ok, true);
    assertEquals(result.data?.opportunityId, 'opportunity-1');
    assertEquals(
      callsFor(mock.calls, 'PATCH', '/rest/opportunities/opportunity-deleted').length,
      1
    );
    assertEquals(callsFor(mock.calls, 'GET', '/rest/opportunities').length, 1);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/opportunities').length, 1);
  } finally {
    mock.restore();
  }
});

Deno.test('evento: reutiliza oportunidad encontrada por nombre determinista', async () => {
  const mock = installTwentyMock({ opportunity: { id: 'opportunity-existing' } });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, true);
    assertEquals(result.data?.opportunityId, 'opportunity-existing');
    assertEquals(
      callsFor(mock.calls, 'PATCH', '/rest/opportunities/opportunity-existing').length,
      1
    );
    assertEquals(callsFor(mock.calls, 'POST', '/rest/opportunities').length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test('evento: reutiliza tarea encontrada por título determinista', async () => {
  const mock = installTwentyMock({
    opportunity: { id: 'opportunity-existing' },
    task: { id: 'task-existing' },
  });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, true);
    assertEquals(result.data?.taskId, 'task-existing');
    assertEquals(callsFor(mock.calls, 'PATCH', '/rest/tasks/task-existing').length, 1);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/tasks').length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test('evento: reporta fallo si Twenty no crea la tarea', async () => {
  const mock = installTwentyMock({ failTaskWrites: true });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, false);
    assertStringIncludes(result.error ?? '', 'HTTP 500');
    assertEquals(callsFor(mock.calls, 'GET', '/rest/taskTargets').length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test('evento: reporta fallo si Twenty no enlaza la tarea', async () => {
  const mock = installTwentyMock({ failTargetWrites: true });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, false);
    assertStringIncludes(result.error ?? '', 'HTTP 500');
  } finally {
    mock.restore();
  }
});

Deno.test('evento: conserva taskTarget ya enlazado a la oportunidad correcta', async () => {
  const mock = installTwentyMock({
    opportunity: { id: 'opportunity-existing' },
    task: { id: 'task-existing' },
    target: {
      id: 'target-existing',
      taskId: 'task-existing',
      targetOpportunityId: 'opportunity-existing',
    },
  });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, true);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/taskTargets').length, 0);
    assertEquals(callsFor(mock.calls, 'PATCH', '/rest/taskTargets/target-existing').length, 0);
  } finally {
    mock.restore();
  }
});

Deno.test('evento: corrige taskTarget enlazado a otra oportunidad', async () => {
  const mock = installTwentyMock({
    opportunity: { id: 'opportunity-existing' },
    task: { id: 'task-existing' },
    target: {
      id: 'target-existing',
      taskId: 'task-existing',
      targetOpportunityId: 'opportunity-wrong',
    },
  });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(eventInput());

    assertEquals(result.ok, true);
    const patch = callsFor(mock.calls, 'PATCH', '/rest/taskTargets/target-existing')[0];
    assertEquals(patch?.body?.targetOpportunityId, 'opportunity-existing');
  } finally {
    mock.restore();
  }
});

Deno.test('evento: reintento idempotente no duplica oportunidad, tarea ni enlace', async () => {
  const mock = installTwentyMock();
  try {
    const client = new TwentyClient({ baseUrl: 'https://twenty.test', apiKey: 'test-key' });
    const first = await client.syncCotizacionLead(eventInput());
    const second = await client.syncCotizacionLead(eventInput());

    assert(first.ok);
    assert(second.ok);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/opportunities').length, 1);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/tasks').length, 1);
    assertEquals(callsFor(mock.calls, 'POST', '/rest/taskTargets').length, 1);
  } finally {
    mock.restore();
  }
});

Deno.test('congreso: etiqueta persona/opp/tarea con evento ACISE y productos', async () => {
  const mock = installTwentyMock();
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCotizacionLead(
      eventInput({
        origen: 'congreso',
        eventSlug: 'acise2026',
        eventName: 'ACISE2026',
        productos: [
          { nombre: 'Autoclave Tuttnauer', slug: 'autoclave-tuttnauer', cantidad: 1 },
          { nombre: 'Torre laparoscopia', slug: 'torre-lap', cantidad: 1 },
        ],
      })
    );

    assertEquals(result.ok, true);
    const person = callsFor(mock.calls, 'POST', '/rest/people')[0]?.body;
    assertEquals(person?.jobTitle, 'Lead evento · ACISE2026');

    const opportunity = callsFor(mock.calls, 'POST', '/rest/opportunities')[0]?.body;
    assertStringIncludes(String(opportunity?.name), 'Registro ACISE2026');

    const task = callsFor(mock.calls, 'POST', '/rest/tasks')[0]?.body;
    const taskBody = task?.bodyV2 as { markdown?: string };
    assertStringIncludes(taskBody.markdown ?? '', '**Canal:** congreso');
    assertStringIncludes(taskBody.markdown ?? '', '**Evento:** ACISE2026');
    assertStringIncludes(taskBody.markdown ?? '', '**Evento slug:** acise2026');
    assertStringIncludes(taskBody.markdown ?? '', 'Autoclave Tuttnauer');
    assertStringIncludes(String(task?.title ?? ''), 'Lead ACISE2026');
  } finally {
    mock.restore();
  }
});

Deno.test('mapCrmEtapaToTwentyStage traduce pipeline admin', () => {
  assertEquals(mapCrmEtapaToTwentyStage('nuevo'), 'NEW');
  assertEquals(mapCrmEtapaToTwentyStage('cotizando'), 'PROPOSAL');
  assertEquals(mapCrmEtapaToTwentyStage('ganado'), 'CUSTOMER');
});

Deno.test('deriveLifecycleFromOpportunityStage mapea pipeline I-ME', () => {
  assertEquals(deriveLifecycleFromOpportunityStage('NEW'), 'LEAD');
  assertEquals(deriveLifecycleFromOpportunityStage('SCREENING'), 'PROSPECT');
  assertEquals(deriveLifecycleFromOpportunityStage('PROPOSAL'), 'PROSPECT');
  assertEquals(deriveLifecycleFromOpportunityStage('CUSTOMER'), 'CLIENT');
  assertEquals(mergeAccountLifecycle('LEAD', 'CLIENT'), 'CLIENT');
  assertEquals(mergeAccountLifecycle('CLIENT', 'LEAD'), 'CLIENT');
});

Deno.test('reassignCommercialLead parchea owner, cuenta y tarea', async () => {
  const mock = installTwentyMock({
    opportunity: { id: 'opp-1', companyId: 'company-1' },
    target: { id: 'target-1', taskId: 'task-1', targetOpportunityId: 'opp-1' },
    task: { id: 'task-1' },
  });
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).reassignCommercialLead({
      opportunityId: 'opp-1',
      newOwnerId: 'member-2',
      reason: 'rotacion territorio',
    });

    assertEquals(result.ok, true);
    assertEquals(result.data?.taskIds, ['task-1']);

    const oppPatch = mock.calls.find(
      c => c.method === 'PATCH' && c.pathname === '/rest/opportunities/opp-1'
    );
    assertEquals(oppPatch?.body?.ownerId, 'member-2');

    const companyPatch = mock.calls.find(
      c => c.method === 'PATCH' && c.pathname === '/rest/companies/company-1'
    );
    assertEquals(companyPatch?.body?.accountOwnerId, 'member-2');
  } finally {
    mock.restore();
  }
});

Deno.test('share catálogo: nota + tarea de seguimiento asignada al comercial', async () => {
  const mock = installTwentyMock();
  try {
    const result = await new TwentyClient({
      baseUrl: 'https://twenty.test',
      apiKey: 'test-key',
    }).syncCommercialShare(
      {
        recipientName: 'Dra. Ana Pérez',
        medicalCenterName: 'Hospital Central',
        recipientEmail: 'ana@hospital.test',
        channel: 'whatsapp',
        commercialName: 'Comercial Uno',
        commercialEmail: 'comercial1@i-me.com.co',
        ownerId: 'comercial-member-1',
        message: 'Adjunto catálogo de monitores',
      },
      [{ name: 'Monitor X', sku: 'MX-1', family: 'monitores', specialty: 'Diagnóstico' }]
    );

    assertEquals(result.ok, true);
    assertEquals(result.data?.noteId, 'note-1');
    assertEquals(result.data?.personId, 'person-1');

    const note = callsFor(mock.calls, 'POST', '/rest/notes')[0]?.body;
    assertStringIncludes(
      String((note?.bodyV2 as { markdown?: string })?.markdown ?? ''),
      'Monitor X'
    );

    const task = callsFor(mock.calls, 'POST', '/rest/tasks')[0]?.body;
    assertEquals(task?.assigneeId, 'comercial-member-1');
    assertStringIncludes(String(task?.title ?? ''), 'Seguimiento catálogo');

    const taskTarget = callsFor(mock.calls, 'POST', '/rest/taskTargets')[0]?.body;
    assertEquals(taskTarget?.targetPersonId, 'person-1');
  } finally {
    mock.restore();
  }
});
