/**
 * Cliente minimo para Twenty CRM (self-hosted o cloud), usado SOLO desde
 * Edge Functions (nunca desde el navegador). Sincroniza el flujo comercial
 * (compartir catalogo) con los objetos estandar de Twenty: `people`,
 * `companies`, `notes` y `noteTargets`. No se inventan objetos nuevos.
 *
 * API de referencia (Core REST, `{TWENTY_BASE_URL}/rest`):
 *   https://docs.twenty.com/developers/api/rest-api
 *   - Filtro: `?filter=<campo>[<operador>]:<valor>` (ej. `emails.primaryEmail[eq]:"a@b.com"`)
 *   - Person:  campos compuestos `name` ({firstName,lastName}), `emails`
 *     ({primaryEmail}), `phones` ({primaryPhoneNumber, primaryPhoneCallingCode}),
 *     relacion `companyId`.
 *   - Company: `name` (texto simple).
 *   - Note:    `title`, `bodyV2` ({markdown}).
 *   - NoteTarget: join polimorfico nota↔registro via `noteId` +
 *     `targetPersonId` / `targetCompanyId` (nomenclatura post-migracion a
 *     "morph relations"; instancias muy antiguas pueden usar `personId`/
 *     `companyId` planos — si el self-host del cliente es anterior a esa
 *     migracion, ajustar aqui).
 *
 * Nunca lanza excepciones con secretos, PII ni con el body crudo de errores
 * de Twenty: todo fallo se traduce a `{ ok: false, error }` best-effort.
 */

export interface TwentyConfig {
  baseUrl: string;
  apiKey: string;
}

export interface TwentyResult<T> {
  ok: boolean;
  pending?: boolean;
  skipped?: boolean;
  error?: string;
  data?: T;
}

/** Owner Twenty desde env; sin hardcode UUID (evita opp huérfanas si user borrado). */
function resolveTwentyOwnerId(explicit?: string): string | undefined {
  const fromInput = explicit?.trim();
  if (fromInput) return fromInput;
  const fromEnv = Deno.env.get('TWENTY_OWNER_ID')?.trim();
  if (fromEnv) return fromEnv;
  console.warn('[twenty-crm] TWENTY_OWNER_ID no configurado; se omite ownerId');
  return undefined;
}

export interface TwentyRecord {
  id: string;
  [key: string]: unknown;
}

/** Ciclo comercial I-ME sobre cuenta (Company), derivado del pipeline Twenty. */
export type TwentyAccountLifecycle = 'LEAD' | 'PROSPECT' | 'CLIENT';

export type TwentyOpportunityStage = 'NEW' | 'SCREENING' | 'MEETING' | 'PROPOSAL' | 'CUSTOMER';

/** NEW → lead; SCREENING/MEETING/PROPOSAL → prospecto; CUSTOMER → cliente formalizado. */
export function deriveLifecycleFromOpportunityStage(stage: string): TwentyAccountLifecycle {
  if (stage === 'CUSTOMER') return 'CLIENT';
  if (stage === 'NEW') return 'LEAD';
  return 'PROSPECT';
}

/** Mapeo etapa CRM warehouse → pipeline Twenty. */
export function mapCrmEtapaToTwentyStage(etapa: string): TwentyOpportunityStage {
  switch (etapa) {
    case 'nuevo':
    case 'nutrir':
      return 'NEW';
    case 'contactado':
    case 'calificacion':
      return 'SCREENING';
    case 'reunion':
    case 'demo':
      return 'MEETING';
    case 'cotizando':
    case 'negociacion':
    case 'checkout_pendiente':
      return 'PROPOSAL';
    case 'ganado':
    case 'posventa':
      return 'CUSTOMER';
    case 'perdido':
      return 'SCREENING';
    default:
      return 'NEW';
  }
}

/** Prioridad: CLIENT > PROSPECT > LEAD (cuenta con varias oportunidades). */
export function mergeAccountLifecycle(
  current: TwentyAccountLifecycle | null | undefined,
  next: TwentyAccountLifecycle
): TwentyAccountLifecycle {
  const rank: Record<TwentyAccountLifecycle, number> = { LEAD: 1, PROSPECT: 2, CLIENT: 3 };
  if (!current) return next;
  return rank[next] > rank[current] ? next : current;
}

function isTwentyRecord(value: unknown): value is TwentyRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string'
  );
}

/**
 * Twenty REST a veces responde `{ id, ... }`, a veces `{ data: { id, ... } }`
 * y en creates `{ data: { createPerson: { id, ... } } }` (idem createCompany,
 * createNote, createNoteTarget). Extraemos el primer registro con `id`.
 */
function extractTwentyRecord(raw: unknown): TwentyRecord | null {
  if (isTwentyRecord(raw)) return raw;
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (isTwentyRecord(obj.data)) return obj.data;
  if (obj.data && typeof obj.data === 'object') {
    for (const value of Object.values(obj.data as Record<string, unknown>)) {
      if (isTwentyRecord(value)) return value;
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (/^create/i.test(key) && isTwentyRecord(value)) return value;
  }
  return null;
}

function getTwentyConfig(): TwentyConfig | null {
  const baseUrl = Deno.env.get('TWENTY_BASE_URL')?.trim().replace(/\/+$/, '');
  const apiKey = Deno.env.get('TWENTY_API_KEY')?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

/** Escapa comillas dobles para valores de `filter=campo[eq]:"valor"`. */
function filterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Construye un filtro sin dejar que `+`, `&` o espacios corrompan el query string. */
function collectionFilterPath(collection: string, field: string, value: string): string {
  const params = new URLSearchParams({
    filter: `${field}[eq]:${filterValue(value)}`,
    limit: '1',
  });
  return `/${collection}?${params.toString()}`;
}

export class TwentyClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: TwentyConfig) {
    this.baseUrl = `${config.baseUrl}/rest`;
    this.apiKey = config.apiKey;
  }

  /** Fabrica que devuelve `null` si TWENTY_BASE_URL/TWENTY_API_KEY no estan configurados. */
  static fromEnv(): TwentyClient | null {
    const config = getTwentyConfig();
    return config ? new TwentyClient(config) : null;
  }

  /** Request crudo: nunca lanza, siempre resuelve a `{ ok, data, error }`. */
  private async requestRaw(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown
  ): Promise<TwentyResult<unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        // `path` puede llevar email/teléfono en el filtro y el body puede
        // contener datos internos: no persistir ninguno en logs ni en BD.
        return { ok: false, error: `Twenty CRM: HTTP ${res.status}` };
      }

      const json = await res.json().catch(() => ({}));
      return { ok: true, data: json };
    } catch {
      return {
        ok: false,
        error: controller.signal.aborted
          ? 'Twenty CRM: timeout de conexion'
          : 'Twenty CRM: error de conexion',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Igual que `requestRaw`, pero valida y devuelve un unico `TwentyRecord` (create/update). */
  private async requestRecord(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown
  ): Promise<TwentyResult<TwentyRecord>> {
    const res = await this.requestRaw(method, path, body);
    if (!res.ok) return { ok: false, error: res.error };
    const record = extractTwentyRecord(res.data);
    if (!record) {
      return { ok: false, error: `Twenty ${method} ${path}: respuesta sin registro valido` };
    }
    return { ok: true, data: record };
  }

  /** Busca en una coleccion (`GET /rest/{collection}?filter=...`) y devuelve el primer resultado o null. */
  private async requestFirst(
    path: string,
    collectionKey: string
  ): Promise<TwentyResult<TwentyRecord | null>> {
    const res = await this.requestRaw('GET', path);
    if (!res.ok) return { ok: false, error: res.error };
    const raw = res.data;
    // Twenty REST responde colecciones como `{ data: { people: [...] },
    // pageInfo, totalCount }`. Conservamos formas planas para compatibilidad
    // con instalaciones antiguas.
    const root = raw as Record<string, unknown> | null;
    const nested = root?.data as Record<string, unknown> | null;
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray(root?.[collectionKey])
        ? (root?.[collectionKey] as unknown[])
        : Array.isArray(nested?.[collectionKey])
          ? (nested?.[collectionKey] as unknown[])
          : [];
    const first = list[0];
    return { ok: true, data: isTwentyRecord(first) ? first : null };
  }

  async findPersonByEmail(email: string): Promise<TwentyResult<TwentyRecord | null>> {
    return this.requestFirst(
      collectionFilterPath('people', 'emails.primaryEmail', email),
      'people'
    );
  }

  async findPersonByPhone(phoneDigits: string): Promise<TwentyResult<TwentyRecord | null>> {
    return this.requestFirst(
      collectionFilterPath('people', 'phones.primaryPhoneNumber', phoneDigits),
      'people'
    );
  }

  async findCompanyByName(name: string): Promise<TwentyResult<TwentyRecord | null>> {
    return this.requestFirst(collectionFilterPath('companies', 'name', name), 'companies');
  }

  async findOpportunityByName(name: string): Promise<TwentyResult<TwentyRecord | null>> {
    return this.requestFirst(collectionFilterPath('opportunities', 'name', name), 'opportunities');
  }

  async findTaskByTitle(title: string): Promise<TwentyResult<TwentyRecord | null>> {
    return this.requestFirst(collectionFilterPath('tasks', 'title', title), 'tasks');
  }

  async findTaskTargetByTaskId(taskId: string): Promise<TwentyResult<TwentyRecord | null>> {
    return this.requestFirst(collectionFilterPath('taskTargets', 'taskId', taskId), 'taskTargets');
  }

  async findWorkspaceMemberByEmail(email: string): Promise<TwentyResult<TwentyRecord | null>> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return { ok: true, data: null };
    return this.requestFirst(
      collectionFilterPath('workspaceMembers', 'userEmail', normalized),
      'workspaceMembers'
    );
  }

  async listOpportunitiesByCompanyId(
    companyId: string,
    limit = 50
  ): Promise<TwentyResult<TwentyRecord[]>> {
    const params = new URLSearchParams({
      filter: `companyId[eq]:${filterValue(companyId)}`,
      limit: String(Math.min(limit, 60)),
    });
    const res = await this.requestRaw('GET', `/opportunities?${params.toString()}`);
    if (!res.ok) return { ok: false, error: res.error };
    const root = res.data as Record<string, unknown> | null;
    const nested = root?.data as Record<string, unknown> | null;
    const list: unknown[] = Array.isArray(root?.opportunities)
      ? (root.opportunities as unknown[])
      : Array.isArray(nested?.opportunities)
        ? (nested.opportunities as unknown[])
        : [];
    return {
      ok: true,
      data: list.filter(isTwentyRecord),
    };
  }

  /** Deriva LEAD/PROSPECT/CLIENT desde oportunidades enlazadas a la cuenta. */
  async resolveCompanyLifecycle(companyId: string): Promise<TwentyResult<TwentyAccountLifecycle>> {
    const opps = await this.listOpportunitiesByCompanyId(companyId);
    if (!opps.ok) return { ok: false, error: opps.error };
    let lifecycle: TwentyAccountLifecycle = 'LEAD';
    for (const opp of opps.data ?? []) {
      lifecycle = mergeAccountLifecycle(
        lifecycle,
        deriveLifecycleFromOpportunityStage(String(opp.stage ?? 'NEW'))
      );
    }
    return { ok: true, data: lifecycle };
  }

  /**
   * Reasigna oportunidad + cuenta + tareas abiertas a otro comercial (workspaceMemberId).
   * Idempotente: PATCH best-effort; no lanza.
   */
  async reassignCommercialLead(input: {
    opportunityId: string;
    newOwnerId: string;
    companyId?: string;
    personId?: string;
    reason?: string;
  }): Promise<
    TwentyResult<{
      opportunityId: string;
      companyId?: string;
      taskIds: string[];
    }>
  > {
    const ownerId = input.newOwnerId.trim();
    if (!ownerId) return { ok: false, error: 'newOwnerId requerido' };

    const oppPatch = await this.requestRecord('PATCH', `/opportunities/${input.opportunityId}`, {
      ownerId,
    });
    if (!oppPatch.ok) return { ok: false, error: oppPatch.error };

    const companyId =
      input.companyId ||
      (typeof oppPatch.data?.companyId === 'string' ? oppPatch.data.companyId : undefined);
    if (companyId) {
      await this.requestRaw('PATCH', `/companies/${companyId}`, { accountOwnerId: ownerId });
    }

    const taskIds: string[] = [];
    const params = new URLSearchParams({
      filter: `targetOpportunityId[eq]:${filterValue(input.opportunityId)}`,
      limit: '20',
    });
    const targets = await this.requestRaw('GET', `/taskTargets?${params.toString()}`);
    if (targets.ok && targets.data) {
      const root = targets.data as Record<string, unknown>;
      const nested = root.data as Record<string, unknown> | undefined;
      const list: unknown[] = Array.isArray(root.taskTargets)
        ? root.taskTargets
        : Array.isArray(nested?.taskTargets)
          ? (nested.taskTargets as unknown[])
          : [];
      for (const row of list) {
        if (!isTwentyRecord(row)) continue;
        const taskId = typeof row.taskId === 'string' ? row.taskId : undefined;
        if (!taskId || taskIds.includes(taskId)) continue;
        const patched = await this.requestRecord('PATCH', `/tasks/${taskId}`, {
          assigneeId: ownerId,
        });
        if (patched.ok) taskIds.push(taskId);
      }
    }

    const note = await this.createNote({
      title: `Reasignación comercial — ${input.opportunityId.slice(0, 8)}`.slice(0, 120),
      bodyMarkdown: [
        '**Origen:** CMS comercial I-ME',
        `**Nuevo owner:** ${ownerId}`,
        input.reason ? `**Motivo:** ${input.reason}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    if (note.ok && note.data) {
      await this.linkNoteTarget({
        noteId: note.data.id,
        targetOpportunityId: input.opportunityId,
        targetCompanyId: companyId,
        targetPersonId: input.personId,
      });
    }

    return {
      ok: true,
      data: {
        opportunityId: input.opportunityId,
        companyId,
        taskIds,
      },
    };
  }

  /** Enlaza persona huérfana a cuenta existente o recién creada por nombre institución. */
  async ensurePersonCompanyLink(input: {
    personId: string;
    companyName: string;
    companyId?: string;
    ownerId?: string;
  }): Promise<TwentyResult<{ personId: string; companyId: string }>> {
    let companyId = input.companyId?.trim();
    if (!companyId) {
      const company = await this.upsertCompany({ name: input.companyName.trim().slice(0, 120) });
      if (!company.ok || !company.data?.id)
        return { ok: false, error: company.error ?? 'Company no creada' };
      companyId = company.data.id;
    }
    const ownerId = resolveTwentyOwnerId(input.ownerId);
    if (ownerId) {
      await this.requestRaw('PATCH', `/companies/${companyId}`, { accountOwnerId: ownerId });
    }
    const patched = await this.requestRecord('PATCH', `/people/${input.personId}`, { companyId });
    if (!patched.ok) return { ok: false, error: patched.error };
    return { ok: true, data: { personId: input.personId, companyId } };
  }

  /** Nota de ciclo de vida en cuenta (sin custom fields en workspace). */
  async syncCompanyLifecycleNote(input: {
    companyId: string;
    lifecycle: TwentyAccountLifecycle;
    source?: string;
  }): Promise<TwentyResult<{ noteId?: string; lifecycle: TwentyAccountLifecycle }>> {
    const labels: Record<TwentyAccountLifecycle, string> = {
      LEAD: 'Lead (NEW)',
      PROSPECT: 'Prospecto (SCREENING/MEETING/PROPOSAL)',
      CLIENT: 'Cliente formalizado (CUSTOMER)',
    };
    const note = await this.createNote({
      title: `I-ME ciclo — ${input.lifecycle}`.slice(0, 120),
      bodyMarkdown: [
        '**Origen:** CMS comercial I-ME',
        `**Ciclo cuenta:** ${labels[input.lifecycle]}`,
        input.source ? `**Fuente:** ${input.source}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    if (note.ok && note.data) {
      await this.linkNoteTarget({ noteId: note.data.id, targetCompanyId: input.companyId });
    }
    return { ok: true, data: { noteId: note.data?.id, lifecycle: input.lifecycle } };
  }

  async listWorkspaceMembers(limit = 20): Promise<TwentyResult<TwentyRecord[]>> {
    const res = await this.requestRaw('GET', `/workspaceMembers?limit=${Math.min(limit, 60)}`);
    if (!res.ok) return { ok: false, error: res.error };
    const root = res.data as Record<string, unknown> | null;
    const nested = root?.data as Record<string, unknown> | null;
    const list: unknown[] = Array.isArray(root?.workspaceMembers)
      ? (root.workspaceMembers as unknown[])
      : Array.isArray(nested?.workspaceMembers)
        ? (nested.workspaceMembers as unknown[])
        : [];
    return { ok: true, data: list.filter(isTwentyRecord) };
  }

  async listPeopleWithoutCompany(limit = 60): Promise<TwentyResult<TwentyRecord[]>> {
    const res = await this.requestRaw('GET', `/people?limit=${Math.min(limit, 60)}`);
    if (!res.ok) return { ok: false, error: res.error };
    const root = res.data as Record<string, unknown> | null;
    const nested = root?.data as Record<string, unknown> | null;
    const list: unknown[] = Array.isArray(root?.people)
      ? (root.people as unknown[])
      : Array.isArray(nested?.people)
        ? (nested.people as unknown[])
        : [];
    return {
      ok: true,
      data: list.filter(isTwentyRecord).filter(p => !p.companyId),
    };
  }

  /**
   * Enlaza persona ↔ empresa: PATCH person.companyId + accountOwner opcional.
   * Twenty expone people[] en company vía relación inversa automática.
   */
  async linkPersonAndCompany(input: {
    personId: string;
    companyId?: string;
    companyName?: string;
    ownerId?: string;
  }): Promise<TwentyResult<{ personId: string; companyId: string }>> {
    let companyId = input.companyId?.trim();
    const companyName = (input.companyName || '').trim();
    if (!companyId) {
      if (!companyName) {
        return { ok: false, error: 'companyId o companyName requerido' };
      }
      const company = await this.upsertCompany({ name: companyName.slice(0, 120) });
      if (!company.ok || !company.data?.id) {
        return { ok: false, error: company.error ?? 'Company no creada' };
      }
      companyId = company.data.id;
    }
    const ownerId = resolveTwentyOwnerId(input.ownerId);
    if (ownerId) {
      await this.requestRaw('PATCH', `/companies/${companyId}`, { accountOwnerId: ownerId });
    }
    const patched = await this.requestRecord('PATCH', `/people/${input.personId}`, { companyId });
    if (!patched.ok) return { ok: false, error: patched.error };
    return { ok: true, data: { personId: input.personId, companyId } };
  }

  /** Actualiza oportunidad Twenty desde etapa/valor del CRM warehouse. */
  async updateManagedOpportunity(input: {
    opportunityId: string;
    etapa?: string;
    valorEstimado?: number | null;
    moneda?: string;
    ownerId?: string;
    companyId?: string;
    personId?: string;
    nextActionAt?: string | null;
    nextActionNote?: string | null;
    titulo?: string;
  }): Promise<TwentyResult<TwentyRecord>> {
    const payload: Record<string, unknown> = {};
    if (input.etapa) payload.stage = mapCrmEtapaToTwentyStage(input.etapa);
    if (input.titulo?.trim()) payload.name = input.titulo.trim().slice(0, 120);
    if (input.valorEstimado != null && Number.isFinite(input.valorEstimado)) {
      payload.amount = {
        amountMicros: Math.round(Number(input.valorEstimado) * 1_000_000),
        currencyCode: (input.moneda || 'COP').slice(0, 8),
      };
    }
    if (input.nextActionAt) payload.closeDate = input.nextActionAt;
    const ownerId = input.ownerId ? resolveTwentyOwnerId(input.ownerId) : undefined;
    if (ownerId) payload.ownerId = ownerId;
    if (input.companyId) payload.companyId = input.companyId;
    if (input.personId) payload.pointOfContactId = input.personId;

    const patched = await this.requestRecord(
      'PATCH',
      `/opportunities/${input.opportunityId}`,
      payload
    );
    if (!patched.ok) return patched;

    if (input.companyId && input.etapa) {
      void this.syncCompanyLifecycleNote({
        companyId: input.companyId,
        lifecycle: deriveLifecycleFromOpportunityStage(String(payload.stage ?? 'NEW')),
        source: 'updateManagedOpportunity',
      });
    }

    if (input.nextActionNote?.trim()) {
      const note = await this.createNote({
        title: `Seguimiento CRM — ${input.opportunityId.slice(0, 8)}`.slice(0, 120),
        bodyMarkdown: input.nextActionNote.trim().slice(0, 4000),
      });
      if (note.ok && note.data) {
        await this.linkNoteTarget({
          noteId: note.data.id,
          targetOpportunityId: input.opportunityId,
          targetCompanyId: input.companyId,
          targetPersonId: input.personId,
        });
      }
    }

    return patched;
  }

  /** Repara personas sin companyId usando oportunidad vinculada o nombre institución. */
  async repairOrphanPeopleLinks(input?: { ownerId?: string; limit?: number }): Promise<
    TwentyResult<{
      scanned: number;
      linked: number;
      skipped: number;
      errors: number;
    }>
  > {
    const orphans = await this.listPeopleWithoutCompany(input?.limit ?? 60);
    if (!orphans.ok) return { ok: false, error: orphans.error };
    let linked = 0;
    let skipped = 0;
    let errors = 0;
    for (const person of orphans.data ?? []) {
      const params = new URLSearchParams({
        filter: `pointOfContactId[eq]:${filterValue(person.id)}`,
        limit: '1',
      });
      const oppRes = await this.requestRaw('GET', `/opportunities?${params.toString()}`);
      const companyId =
        oppRes.ok && oppRes.data
          ? (() => {
              const root = oppRes.data as Record<string, unknown>;
              const nested = root.data as Record<string, unknown> | undefined;
              const list = (nested?.opportunities ?? root.opportunities) as
                | TwentyRecord[]
                | undefined;
              return list?.[0]?.companyId as string | undefined;
            })()
          : undefined;
      let companyName = '';
      if (!companyId) {
        companyName = String(person.jobTitle || '')
          .replace(/^Lead evento ·\s*/i, '')
          .replace(/^Lead web.*/i, '')
          .trim();
        if (!companyName) {
          const name = person.name as { firstName?: string; lastName?: string } | undefined;
          companyName = `${name?.firstName || ''} ${name?.lastName || ''}`.trim();
        }
      }
      if (!companyId && !companyName) {
        skipped += 1;
        continue;
      }
      const link = await this.linkPersonAndCompany({
        personId: person.id,
        companyId,
        companyName: companyId ? undefined : `Lead — ${companyName}`.slice(0, 120),
        ownerId: input?.ownerId,
      });
      if (link.ok) linked += 1;
      else errors += 1;
    }
    return {
      ok: true,
      data: {
        scanned: orphans.data?.length ?? 0,
        linked,
        skipped,
        errors,
      },
    };
  }

  async upsertPerson(input: {
    firstName: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    phoneCallingCode?: string;
    jobTitle?: string;
    companyId?: string;
    /** Si true y la persona ya existe, no pisa jobTitle (p.ej. share tras lead evento). */
    preserveJobTitleOnUpdate?: boolean;
  }): Promise<TwentyResult<TwentyRecord>> {
    let existing: TwentyResult<TwentyRecord | null> = { ok: true, data: null };
    if (input.email) {
      existing = await this.findPersonByEmail(input.email);
      if (!existing.ok) return { ok: false, error: existing.error };
    }
    // Congreso/share a menudo crea primero por WhatsApp (sin email). Si el email
    // no matchea, deduplicar por teléfono evita HTTP 400 "duplicate entry".
    if (!existing.data && input.phoneNumber) {
      existing = await this.findPersonByPhone(input.phoneNumber);
      if (!existing.ok) return { ok: false, error: existing.error };
    }

    const payload: Record<string, unknown> = {
      name: { firstName: input.firstName, lastName: input.lastName ?? '' },
    };
    if (input.email) payload.emails = { primaryEmail: input.email };
    if (input.phoneNumber) {
      payload.phones = {
        primaryPhoneNumber: input.phoneNumber,
        ...(input.phoneCallingCode ? { primaryPhoneCallingCode: input.phoneCallingCode } : {}),
      };
    }
    const existingId = existing.data?.id;
    if (input.jobTitle && !(existingId && input.preserveJobTitleOnUpdate)) {
      payload.jobTitle = input.jobTitle;
    }
    if (input.companyId) payload.companyId = input.companyId;

    if (existingId) {
      const patched = await this.requestRecord('PATCH', `/people/${existingId}`, payload);
      if (patched.ok || !input.email) return patched;
      // Email puede chocar con workspace user u otro registro no filtrable.
      // Reintenta sin email para no bloquear tipificación del lead.
      const { emails: _emails, ...withoutEmail } = payload;
      return this.requestRecord('PATCH', `/people/${existingId}`, withoutEmail);
    }
    const created = await this.requestRecord('POST', '/people', payload);
    if (created.ok) return created;

    if (input.phoneNumber) {
      const raced = await this.findPersonByPhone(input.phoneNumber);
      if (raced.ok && raced.data?.id) {
        const patched = await this.requestRecord('PATCH', `/people/${raced.data.id}`, payload);
        if (patched.ok || !input.email) return patched;
        const { emails: _emails, ...withoutEmail } = payload;
        return this.requestRecord('PATCH', `/people/${raced.data.id}`, withoutEmail);
      }
    }
    if (input.email) {
      const { emails: _emails, ...withoutEmail } = payload;
      return this.requestRecord('POST', '/people', withoutEmail);
    }
    return created;
  }

  async upsertCompany(input: {
    name: string;
    /** Total pagado acumulado → annualRevenue (campo estándar). */
    totalPagado?: number | null;
    moneda?: string;
    /** Campos custom tipología/facturación (best-effort si existen en workspace). */
    extras?: Record<string, unknown>;
  }): Promise<TwentyResult<TwentyRecord>> {
    const existing = await this.findCompanyByName(input.name);
    if (!existing.ok) return { ok: false, error: existing.error };

    const payload: Record<string, unknown> = { name: input.name };
    if (input.totalPagado != null && Number.isFinite(input.totalPagado)) {
      payload.annualRevenue = {
        amountMicros: Math.round(Number(input.totalPagado) * 1_000_000),
        currencyCode: (input.moneda || 'COP').slice(0, 8),
      };
    }
    if (input.extras) {
      for (const [k, v] of Object.entries(input.extras)) {
        if (v !== undefined && v !== null && v !== '') payload[k] = v;
      }
    }

    if (existing.data?.id) {
      const patched = await this.requestRecord('PATCH', `/companies/${existing.data.id}`, payload);
      // Si fallan extras custom, reintenta solo campos estándar.
      if (!patched.ok && input.extras) {
        const { extras: _e, ...rest } = input;
        return this.upsertCompany(rest);
      }
      return patched.ok ? patched : { ok: true, data: existing.data };
    }
    const created = await this.requestRecord('POST', '/companies', payload);
    if (!created.ok && input.extras) {
      return this.requestRecord('POST', '/companies', {
        name: input.name,
        ...(payload.annualRevenue ? { annualRevenue: payload.annualRevenue } : {}),
      });
    }
    return created;
  }

  /**
   * Cliente nuevo/actualizado (pago o formalización) → Company + Person + nota fiscal.
   * Tipología sin metadata write: jobTitle + extras SELECT si el workspace ya los tiene.
   */
  async syncClienteFacturacion(input: {
    nombre: string;
    apellido?: string | null;
    email: string;
    telefono?: string | null;
    institucion?: string | null;
    tipoCliente: 'b2b' | 'b2c' | 'mixto';
    razonSocial?: string | null;
    tipoDocumento?: string | null;
    numeroDocumento?: string | null;
    emailFacturacion?: string | null;
    totalGastado?: number | null;
    moneda?: string;
  }): Promise<TwentyResult<{ personId: string; companyId: string; noteId?: string }>> {
    const tipoLabel = input.tipoCliente.toUpperCase() as 'B2B' | 'B2C' | 'MIXTO';
    const companyName =
      (input.razonSocial || input.institucion || '').trim() ||
      `${input.nombre} ${input.apellido || ''}`.trim() ||
      input.email;

    const company = await this.upsertCompany({
      name: companyName.slice(0, 120),
      totalPagado: input.totalGastado,
      moneda: input.moneda || 'COP',
      extras: {
        tipoCliente: tipoLabel,
        nitDocumento: input.numeroDocumento || undefined,
        emailFacturacion: input.emailFacturacion || input.email,
        estadoFacturacion: 'SIN_FACTURA',
      },
    });
    if (!company.ok || !company.data) return { ok: false, error: company.error };

    let phoneNumber: string | undefined;
    let phoneCallingCode: string | undefined;
    if (input.telefono) {
      const digits = input.telefono.replace(/[^\d]/g, '');
      if (digits.length >= 8) {
        if (digits.startsWith('57') && digits.length > 10) {
          phoneCallingCode = '+57';
          phoneNumber = digits.slice(2);
        } else {
          phoneCallingCode = '+57';
          phoneNumber = digits;
        }
      }
    }

    const person = await this.upsertPerson({
      firstName: input.nombre.trim() || 'Cliente',
      lastName: (input.apellido || '').trim() || 'I-ME',
      email: input.email,
      phoneNumber,
      phoneCallingCode,
      jobTitle: `Cliente ${tipoLabel}${input.numeroDocumento ? ` · ${input.tipoDocumento || 'DOC'} ${input.numeroDocumento}` : ''}`,
      companyId: company.data.id,
    });
    if (!person.ok || !person.data) return { ok: false, error: person.error };

    // Best-effort tipología en Person si el campo custom existe.
    await this.requestRaw('PATCH', `/people/${person.data.id}`, { tipoCliente: tipoLabel });

    const note = await this.createNote({
      title: `Perfil fiscal I-ME — ${companyName}`.slice(0, 120),
      bodyMarkdown: [
        `**Tipo cliente:** ${tipoLabel}`,
        `**Razón social:** ${input.razonSocial || companyName}`,
        `**Documento:** ${input.tipoDocumento || '—'} ${input.numeroDocumento || '—'}`,
        `**Email facturación:** ${input.emailFacturacion || input.email}`,
        `**Total pagado (Supabase):** ${input.totalGastado ?? 0} ${input.moneda || 'COP'}`,
      ].join('\n'),
    });
    if (note.ok && note.data) {
      await this.linkNoteTarget({
        noteId: note.data.id,
        targetPersonId: person.data.id,
        targetCompanyId: company.data.id,
      });
    }

    return {
      ok: true,
      data: {
        personId: person.data.id,
        companyId: company.data.id,
        noteId: note.data?.id,
      },
    };
  }

  /** Pago confirmado → oportunidad CUSTOMER + importe + nota. */
  async syncPagoConfirmado(input: {
    companyId?: string;
    personId?: string;
    opportunityId?: string;
    pedidoId: string;
    nombreOportunidad: string;
    total: number;
    moneda?: string;
    proveedorPago: 'wompi' | 'stripe' | 'bold' | 'transferencia';
    ownerId?: string;
  }): Promise<TwentyResult<{ opportunityId: string; noteId?: string }>> {
    const ownerId = resolveTwentyOwnerId(input.ownerId);
    const amount = {
      amountMicros: Math.round(Number(input.total) * 1_000_000),
      currencyCode: (input.moneda || 'COP').slice(0, 8),
    };
    const proveedor = input.proveedorPago.toUpperCase();

    let opportunityId = input.opportunityId;
    const standardPayload: Record<string, unknown> = {
      name: input.nombreOportunidad.slice(0, 120),
      stage: 'CUSTOMER',
      amount,
      closeDate: new Date().toISOString(),
      position: 'first',
      ...(ownerId ? { ownerId } : {}),
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.personId ? { pointOfContactId: input.personId } : {}),
    };
    const fullPayload: Record<string, unknown> = {
      ...standardPayload,
      pedidoId: input.pedidoId,
      proveedorPago: proveedor,
      estadoFacturacion: 'PENDIENTE',
    };

    if (opportunityId) {
      const patched = await this.requestRecord(
        'PATCH',
        `/opportunities/${opportunityId}`,
        fullPayload
      );
      if (!patched.ok) {
        const retry = await this.requestRecord(
          'PATCH',
          `/opportunities/${opportunityId}`,
          standardPayload
        );
        if (!retry.ok) return { ok: false, error: retry.error };
      }
    } else {
      let created = await this.requestRecord('POST', '/opportunities', fullPayload);
      if (!created.ok) {
        created = await this.requestRecord('POST', '/opportunities', standardPayload);
      }
      if (!created.ok || !created.data) return { ok: false, error: created.error };
      opportunityId = created.data.id;
    }

    const note = await this.createNote({
      title: `Pago confirmado — ${input.pedidoId.slice(0, 8)}`,
      bodyMarkdown: [
        `**Pedido:** ${input.pedidoId}`,
        `**Importe:** ${input.total} ${input.moneda || 'COP'}`,
        `**Proveedor pago:** ${proveedor}`,
        `**Estado oportunidad:** CUSTOMER`,
      ].join('\n'),
    });
    if (note.ok && note.data) {
      await this.linkNoteTarget({
        noteId: note.data.id,
        targetOpportunityId: opportunityId,
        targetPersonId: input.personId,
        targetCompanyId: input.companyId,
      });
    }

    if (input.companyId) {
      void this.syncCompanyLifecycleNote({
        companyId: input.companyId,
        lifecycle: 'CLIENT',
        source: 'syncPagoConfirmado',
      });
    }

    return { ok: true, data: { opportunityId, noteId: note.data?.id } };
  }

  /** Factura DIAN emitida → nota + patch oportunidad/compañía. */
  async syncFacturaEmitida(input: {
    companyId?: string;
    personId?: string;
    opportunityId?: string;
    pedidoId: string;
    numeroFactura?: string | null;
    cufe?: string | null;
    estado: string;
    total?: number | null;
    moneda?: string;
  }): Promise<TwentyResult<{ noteId?: string }>> {
    const estadoMap: Record<string, string> = {
      emitida: 'EMITIDA',
      pendiente_envio: 'PENDIENTE',
      rechazada: 'ANULADA',
      anulada: 'ANULADA',
      error: 'PENDIENTE',
    };
    const estadoFacturacion = estadoMap[input.estado] || 'PENDIENTE';

    if (input.opportunityId) {
      const patch: Record<string, unknown> = {
        numeroFactura: input.numeroFactura || undefined,
        cufe: input.cufe || undefined,
        estadoFacturacion,
        pedidoId: input.pedidoId,
      };
      const res = await this.requestRaw('PATCH', `/opportunities/${input.opportunityId}`, patch);
      if (!res.ok) {
        // sin campos custom: no bloquea
      }
    }

    if (input.companyId) {
      await this.requestRaw('PATCH', `/companies/${input.companyId}`, {
        ultimaFactura: input.numeroFactura || undefined,
        estadoFacturacion,
        ...(input.total != null
          ? {
              annualRevenue: {
                amountMicros: Math.round(Number(input.total) * 1_000_000),
                currencyCode: (input.moneda || 'COP').slice(0, 8),
              },
            }
          : {}),
      });
    }

    const note = await this.createNote({
      title: `Factura DIAN ${input.numeroFactura || input.pedidoId.slice(0, 8)}`.slice(0, 120),
      bodyMarkdown: [
        `**Pedido:** ${input.pedidoId}`,
        `**Número:** ${input.numeroFactura || '—'}`,
        `**CUFE:** ${input.cufe || '—'}`,
        `**Estado:** ${input.estado}`,
        input.total != null ? `**Total:** ${input.total} ${input.moneda || 'COP'}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    if (note.ok && note.data) {
      await this.linkNoteTarget({
        noteId: note.data.id,
        targetOpportunityId: input.opportunityId,
        targetPersonId: input.personId,
        targetCompanyId: input.companyId,
      });
    }
    return { ok: true, data: { noteId: note.data?.id } };
  }

  async createNote(input: {
    title: string;
    bodyMarkdown: string;
  }): Promise<TwentyResult<TwentyRecord>> {
    return this.requestRecord('POST', '/notes', {
      title: input.title,
      bodyV2: { markdown: input.bodyMarkdown },
    });
  }

  async linkNoteTarget(input: {
    noteId: string;
    targetPersonId?: string;
    targetCompanyId?: string;
    targetOpportunityId?: string;
  }): Promise<TwentyResult<TwentyRecord>> {
    const payload: Record<string, unknown> = { noteId: input.noteId, position: 'first' };
    if (input.targetPersonId) payload.targetPersonId = input.targetPersonId;
    if (input.targetCompanyId) payload.targetCompanyId = input.targetCompanyId;
    if (input.targetOpportunityId) payload.targetOpportunityId = input.targetOpportunityId;
    return this.requestRecord('POST', '/noteTargets', payload);
  }

  /**
   * Orquesta la sincronizacion de un `commercial_share`: upsert de
   * compania (si hay `medicalCenterName`), upsert de persona (dedup por
   * email o telefono), nota con el mensaje + lista de productos, y su
   * `noteTarget` hacia la persona (y la compania si existe).
   *
   * Nunca lanza: cualquier fallo se refleja en `ok:false` + `error`, para
   * que el llamador marque `crm_sync_status = 'failed'` y reintente luego.
   */
  async syncCommercialShare(
    share: {
      recipientName: string;
      medicalCenterName?: string | null;
      recipientEmail?: string | null;
      recipientPhoneE164?: string | null;
      phoneCountryCode?: string | null;
      message?: string | null;
      channel?: 'email' | 'whatsapp' | string | null;
      commercialName?: string | null;
      commercialEmail?: string | null;
      ownerId?: string | null;
    },
    products: Array<{
      name: string;
      sku?: string | null;
      url?: string | null;
      family?: string | null;
      specialty?: string | null;
    }>
  ): Promise<TwentyResult<{ personId: string; companyId?: string; noteId: string }>> {
    let companyId: string | undefined;
    const centerName = share.medicalCenterName?.trim();
    const companyLabel =
      centerName ||
      (share.recipientName?.trim()
        ? `Lead catálogo — ${share.recipientName.trim()}`.slice(0, 120)
        : '');
    if (companyLabel) {
      const company = await this.upsertCompany({ name: companyLabel });
      if (!company.ok) return { ok: false, error: company.error };
      companyId = company.data?.id;
    }

    const [firstName, ...restName] = share.recipientName.trim().split(/\s+/);
    let phoneNumber: string | undefined;
    let phoneCallingCode: string | undefined;
    if (share.recipientPhoneE164) {
      const digits = share.recipientPhoneE164.replace(/[^\d]/g, '');
      const preferred = (share.phoneCountryCode || '57').replace(/[^\d]/g, '') || '57';
      if (digits.startsWith(preferred) && digits.length > preferred.length + 5) {
        phoneCallingCode = `+${preferred}`;
        phoneNumber = digits.slice(preferred.length);
      } else if (digits.length >= 8) {
        phoneCallingCode = `+${digits.slice(0, 2)}`;
        phoneNumber = digits.slice(2);
      }
    }

    const canal =
      share.channel === 'whatsapp'
        ? 'WhatsApp'
        : share.channel === 'email'
          ? 'Email'
          : share.channel || '—';
    const person = await this.upsertPerson({
      firstName: firstName || share.recipientName.trim() || 'Contacto',
      lastName: restName.join(' ') || undefined,
      email: share.recipientEmail ?? undefined,
      phoneNumber,
      phoneCallingCode,
      jobTitle: `Lead catálogo · ${canal}`,
      companyId,
      // No pisar "Lead evento · ACISE…" si el contacto ya nació del flujo congreso.
      preserveJobTitleOnUpdate: true,
    });
    if (!person.ok || !person.data)
      return { ok: false, error: person.error ?? 'Persona no creada' };

    const productList = products.length
      ? products
          .map(p => {
            const taxo = [p.specialty, p.family].filter(Boolean).join(' / ');
            return `- ${p.name}${p.sku ? ` (ref. ${p.sku})` : ''}${taxo ? ` · ${taxo}` : ''}${p.url ? ` — ${p.url}` : ''}`;
          })
          .join('\n')
      : '- (sin productos)';
    const comercialBits = [share.commercialName?.trim(), share.commercialEmail?.trim()].filter(
      Boolean
    );
    const note = await this.createNote({
      title: `Catálogo compartido — ${share.recipientName}`.slice(0, 120),
      bodyMarkdown: [
        `**Origen:** CMS comercial I-ME`,
        `**Canal:** ${canal}`,
        `**Destinatario:** ${share.recipientName}`,
        share.recipientEmail ? `**Email:** ${share.recipientEmail}` : '',
        share.recipientPhoneE164 ? `**Teléfono:** ${share.recipientPhoneE164}` : '',
        share.medicalCenterName?.trim()
          ? `**Centro médico:** ${share.medicalCenterName.trim()}`
          : '',
        comercialBits.length ? `**Comercial:** ${comercialBits.join(' · ')}` : '',
        '',
        share.message?.trim() ? `**Mensaje:**\n${share.message.trim()}` : '',
        '',
        `**Productos:**\n${productList}`,
      ]
        .filter(line => line !== '')
        .join('\n')
        .trim(),
    });
    if (!note.ok || !note.data) return { ok: false, error: note.error ?? 'Nota no creada' };

    const link = await this.linkNoteTarget({
      noteId: note.data.id,
      targetPersonId: person.data.id,
      targetCompanyId: companyId,
    });
    if (!link.ok) {
      // La persona y la nota ya existen: no perdemos el trabajo hecho,
      // solo reportamos que el link quedo pendiente.
      return {
        ok: false,
        error: link.error,
        data: { personId: person.data.id, companyId, noteId: note.data.id },
      };
    }

    // Tarea de seguimiento (best-effort): el digest diario la recoge.
    const ownerId = resolveTwentyOwnerId(share.ownerId ?? undefined);
    const due = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const task = await this.requestRecord('POST', '/tasks', {
      title: `Seguimiento catálogo: ${share.recipientName}`.slice(0, 120),
      status: 'TODO',
      dueAt: due,
      ...(ownerId ? { assigneeId: ownerId } : {}),
      position: 'first',
      bodyV2: {
        markdown: [
          `**Origen:** CMS comercial I-ME`,
          `**Canal:** ${canal}`,
          `**Destinatario:** ${share.recipientName}`,
          share.recipientEmail ? `**Email:** ${share.recipientEmail}` : '',
          share.recipientPhoneE164 ? `**Teléfono:** ${share.recipientPhoneE164}` : '',
          share.medicalCenterName?.trim()
            ? `**Centro médico:** ${share.medicalCenterName.trim()}`
            : '',
          comercialBits.length ? `**Comercial:** ${comercialBits.join(' · ')}` : '',
          '',
          `**Productos:**\n${productList}`,
        ]
          .filter(line => line !== '')
          .join('\n')
          .trim(),
      },
    });
    if (task.ok && task.data?.id) {
      await this.requestRaw('POST', '/taskTargets', {
        taskId: task.data.id,
        targetPersonId: person.data.id,
        ...(companyId ? { targetCompanyId: companyId } : {}),
        position: 'first',
      });
    }

    return { ok: true, data: { personId: person.data.id, companyId, noteId: note.data.id } };
  }

  /**
   * Presupuesto formal CMS → Company + Person + Opportunity PROPOSAL (PATCH si ya hay ID)
   * + nota con líneas, precios, condiciones y validez. No reutiliza syncCotizacionLead.
   */
  async syncCotizacionOferta(input: {
    cotizacionId: string;
    numero: string;
    nombre: string;
    email?: string;
    telefono?: string;
    empresa?: string;
    moneda: string;
    total: number;
    validezHasta?: string | null;
    condiciones?: string | null;
    estado?: string | null;
    productos: Array<{
      nombre: string;
      slug?: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      moneda?: string;
      notas?: string;
    }>;
    campaign?: string;
    origen?: string;
    canalEnvio?: string | null;
    formalizarUrl?: string | null;
    validatedByEmail?: string | null;
    twentyOpportunityId?: string | null;
    ownerId?: string;
  }): Promise<
    TwentyResult<{
      personId: string;
      companyId?: string;
      opportunityId: string;
      noteId?: string;
    }>
  > {
    const ownerId = resolveTwentyOwnerId(input.ownerId);
    const companyName =
      (input.empresa || '').trim() || `Presupuesto — ${input.nombre}`.slice(0, 120);
    const company = await this.upsertCompany({ name: companyName });
    if (!company.ok) return { ok: false, error: company.error };
    const companyId = company.data?.id;
    if (companyId && ownerId) {
      await this.requestRaw('PATCH', `/companies/${companyId}`, { accountOwnerId: ownerId });
    }

    let phoneNumber: string | undefined;
    let phoneCallingCode: string | undefined;
    if (input.telefono) {
      const digits = input.telefono.replace(/[^\d]/g, '');
      if (digits.length >= 8) {
        if (digits.startsWith('57') && digits.length > 10) {
          phoneCallingCode = '+57';
          phoneNumber = digits.slice(2);
        } else {
          phoneCallingCode = '+57';
          phoneNumber = digits;
        }
      }
    }

    const [firstName, ...restName] = input.nombre.trim().split(/\s+/);
    const person = await this.upsertPerson({
      firstName: firstName || 'Contacto',
      lastName: restName.join(' ') || 'Presupuesto',
      email: input.email,
      phoneNumber,
      phoneCallingCode,
      jobTitle: `Presupuesto ${input.numero}`,
      companyId,
    });
    if (!person.ok || !person.data) {
      return { ok: false, error: person.error ?? 'Persona no creada' };
    }

    const productLabel = input.productos
      .map(p => p.nombre || p.slug)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    const oppName = `${input.numero} — ${productLabel || companyName}`.slice(0, 120);
    const amount = {
      amountMicros: Math.round(Number(input.total) * 1_000_000),
      currencyCode: (input.moneda || 'COP').slice(0, 8),
    };
    const oppPayload: Record<string, unknown> = {
      name: oppName,
      stage: 'PROPOSAL',
      position: 'first',
      companyId,
      pointOfContactId: person.data.id,
      amount,
      ...(ownerId ? { ownerId } : {}),
      ...(input.validezHasta ? { closeDate: input.validezHasta } : {}),
    };

    let opportunityId = input.twentyOpportunityId?.trim() || '';
    if (opportunityId) {
      const patched = await this.requestRecord(
        'PATCH',
        `/opportunities/${opportunityId}`,
        oppPayload
      );
      if (!patched.ok) {
        // Opp borrada en Twenty: crear de nuevo.
        opportunityId = '';
      }
    }
    if (!opportunityId) {
      const created = await this.requestRecord('POST', '/opportunities', oppPayload);
      if (!created.ok || !created.data) {
        return { ok: false, error: created.error ?? 'Oportunidad no creada' };
      }
      opportunityId = created.data.id;
    }

    const lineList = input.productos.length
      ? input.productos
          .map(p => {
            const unit = `${p.precio_unitario} ${p.moneda || input.moneda}`;
            const sub = `${p.subtotal} ${p.moneda || input.moneda}`;
            const notes = p.notas?.trim() ? ` (${p.notas.trim()})` : '';
            return `- ${p.nombre || p.slug || 'producto'} ×${p.cantidad} @ ${unit} = ${sub}${notes}`;
          })
          .join('\n')
      : '- (sin líneas)';

    const note = await this.createNote({
      title: `Presupuesto ${input.numero}`.slice(0, 120),
      bodyMarkdown: [
        `**Origen:** ${input.origen || 'comercial_presupuesto'}`,
        `**Nº:** ${input.numero}`,
        `**Cotización ID:** ${input.cotizacionId}`,
        `**Estado local:** ${input.estado || '—'}`,
        `**Cliente:** ${input.nombre}`,
        input.email ? `**Email:** ${input.email}` : '',
        input.telefono ? `**Teléfono:** ${input.telefono}` : '',
        `**Empresa:** ${companyName}`,
        `**Total:** ${input.total} ${input.moneda}`,
        input.validezHasta ? `**Validez hasta:** ${input.validezHasta}` : '',
        input.canalEnvio ? `**Canal envío:** ${input.canalEnvio}` : '',
        input.campaign ? `**Campaña:** ${input.campaign}` : '',
        input.validatedByEmail ? `**Validado CRM por:** ${input.validatedByEmail}` : '',
        input.formalizarUrl ? `**Formalizar:** ${input.formalizarUrl}` : '',
        '',
        `**Líneas:**\n${lineList}`,
        '',
        input.condiciones?.trim()
          ? `**Condiciones:**\n${input.condiciones.trim()}`
          : '**Condiciones:** —',
      ]
        .filter(line => line !== '')
        .join('\n'),
    });
    if (note.ok && note.data) {
      await this.linkNoteTarget({
        noteId: note.data.id,
        targetOpportunityId: opportunityId,
        targetPersonId: person.data.id,
        targetCompanyId: companyId,
      });
    }

    return {
      ok: true,
      data: {
        personId: person.data.id,
        companyId,
        opportunityId,
        noteId: note.data?.id,
      },
    };
  }

  /**
   * Sync de solicitud de cotizacion web → Company + Person + Opportunity NEW
   * + Task SLA (owner comercial). Best-effort; no lanza.
   */
  async syncCotizacionLead(input: {
    nombre: string;
    nombres?: string;
    apellidos?: string;
    email?: string;
    telefono?: string;
    empresa?: string;
    mensaje?: string;
    origen?: string;
    tipoSolicitud?: string;
    productos?: Array<{ nombre?: string; slug?: string; cantidad?: number }>;
    totalEstimado?: number | null;
    moneda?: string;
    ownerId?: string;
    priority?: 'P1' | 'P2' | 'P3';
    campaign?: string;
    familySlug?: string;
    purchaseHorizon?: string;
    ciudad?: string;
    leadReference?: string;
    twentyOpportunityId?: string | null;
    /** Slug/nombre del evento presencial (ACISE, etc.) para etiquetar en Twenty. */
    eventSlug?: string;
    eventName?: string;
  }): Promise<
    TwentyResult<{
      personId: string;
      companyId?: string;
      opportunityId: string;
      taskId?: string;
    }>
  > {
    const ownerId = resolveTwentyOwnerId(input.ownerId);

    const companyName = (input.empresa || '').trim() || `Lead web — ${input.nombre}`.slice(0, 120);
    const company = await this.upsertCompany({ name: companyName });
    if (!company.ok) return { ok: false, error: company.error };
    const companyId = company.data?.id;
    if (companyId && ownerId) {
      await this.requestRaw('PATCH', `/companies/${companyId}`, { accountOwnerId: ownerId });
    }

    let phoneNumber: string | undefined;
    let phoneCallingCode: string | undefined;
    if (input.telefono) {
      const digits = input.telefono.replace(/[^\d]/g, '');
      if (digits.length >= 8) {
        if (digits.startsWith('57') && digits.length > 10) {
          phoneCallingCode = '+57';
          phoneNumber = digits.slice(2);
        } else {
          phoneCallingCode = '+57';
          phoneNumber = digits;
        }
      }
    }

    const [firstName, ...restName] = input.nombre.trim().split(/\s+/);
    const isEventLead = input.campaign === 'evento';
    const eventLabel =
      (input.eventName || '').trim() ||
      (input.eventSlug || '').trim() ||
      (isEventLead ? 'evento' : '');
    const eventOrigen = (input.origen || '').trim() || (isEventLead ? 'evento' : 'web');
    const person = await this.upsertPerson({
      firstName: input.nombres?.trim() || firstName || 'Contacto',
      lastName: input.apellidos?.trim() || restName.join(' ') || 'Web',
      email: input.email,
      phoneNumber,
      phoneCallingCode,
      jobTitle: isEventLead
        ? `Lead evento · ${eventLabel}`.slice(0, 80)
        : `${input.priority ? `${input.priority} · ` : ''}Lead ${eventOrigen}`,
      companyId,
    });
    if (!person.ok || !person.data) {
      return { ok: false, error: person.error ?? 'Persona no creada' };
    }

    const productLabel = (input.productos || [])
      .map(p => p.nombre || p.slug)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    const eventReference = input.leadReference?.trim().slice(0, 36);
    const oppName = isEventLead
      ? `Registro ${eventLabel}${eventReference ? ` ${eventReference}` : ''} — ${input.nombre}`.slice(
          0,
          120
        )
      : productLabel
        ? `${companyName} — ${productLabel}`.slice(0, 120)
        : companyName.slice(0, 120);

    const amountMicros =
      input.totalEstimado != null && Number.isFinite(input.totalEstimado)
        ? Math.round(input.totalEstimado * 1_000_000)
        : 0;

    const oppPayload: Record<string, unknown> = {
      name: oppName,
      stage: 'NEW',
      position: 'first',
      companyId,
      pointOfContactId: person.data.id,
      ...(ownerId ? { ownerId } : {}),
      amount: {
        amountMicros,
        currencyCode: (input.moneda || 'COP').slice(0, 8),
      },
    };

    let opportunityId = input.twentyOpportunityId?.trim() || '';
    if (opportunityId) {
      const patched = await this.requestRecord(
        'PATCH',
        `/opportunities/${opportunityId}`,
        oppPayload
      );
      if (!patched.ok) {
        if (!isEventLead) {
          return {
            ok: false,
            error: patched.error ?? 'Oportunidad no actualizada',
            data: {
              personId: person.data.id,
              companyId,
              opportunityId,
            },
          };
        }
        opportunityId = '';
      }
    }
    if (!opportunityId && isEventLead) {
      const existingOpportunity = await this.findOpportunityByName(oppName);
      if (!existingOpportunity.ok) {
        return { ok: false, error: existingOpportunity.error };
      }
      if (existingOpportunity.data) {
        const patched = await this.requestRecord(
          'PATCH',
          `/opportunities/${existingOpportunity.data.id}`,
          oppPayload
        );
        if (!patched.ok) {
          return {
            ok: false,
            error: patched.error ?? 'Oportunidad no actualizada',
            data: {
              personId: person.data.id,
              companyId,
              opportunityId: existingOpportunity.data.id,
            },
          };
        }
        opportunityId = existingOpportunity.data.id;
      }
    }
    if (!opportunityId) {
      const created = await this.requestRecord('POST', '/opportunities', oppPayload);
      if (!created.ok || !created.data) {
        return { ok: false, error: created.error ?? 'Oportunidad no creada' };
      }
      opportunityId = created.data.id;
    }

    void this.touchCompanyLifecycle(
      companyId,
      String(oppPayload.stage ?? 'NEW'),
      'syncCotizacionLead'
    );

    const productList = (input.productos || []).length
      ? (input.productos || [])
          .map(p => `- ${p.nombre || p.slug || 'producto'}${p.cantidad ? ` x${p.cantidad}` : ''}`)
          .join('\n')
      : '- (sin productos)';
    const dueHours = input.priority === 'P2' ? 72 : input.priority === 'P3' ? 168 : 4;
    const due = new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString();
    const taskTitle = (
      isEventLead
        ? `Lead ${eventLabel}${eventReference ? ` ${eventReference}` : ''}: ${input.nombre}`
        : `${input.priority ? `SLA ${input.priority}` : 'SLA cotización'}: ${oppName}`
    ).slice(0, 120);
    const taskPayload = {
      title: taskTitle,
      status: 'TODO',
      dueAt: due,
      ...(ownerId ? { assigneeId: ownerId } : {}),
      position: 'first',
      bodyV2: {
        markdown: [
          `**Canal:** ${eventOrigen}`,
          `**Tipo:** ${input.tipoSolicitud || 'cotizacion'}`,
          ...(input.campaign ? [`**Campaña:** ${input.campaign}`] : []),
          ...(eventLabel && isEventLead ? [`**Evento:** ${eventLabel}`] : []),
          ...(input.eventSlug ? [`**Evento slug:** ${input.eventSlug}`] : []),
          ...(input.familySlug ? [`**Familia:** ${input.familySlug}`] : []),
          ...(input.purchaseHorizon ? [`**Horizonte:** ${input.purchaseHorizon}`] : []),
          ...(input.ciudad ? [`**Ciudad:** ${input.ciudad}`] : []),
          `**Mensaje:** ${input.mensaje || '—'}`,
          // Congreso/evento: productos de interés van en la tarea para seguimiento.
          ...((input.productos || []).length ? [`**Productos:**\n${productList}`] : []),
        ].join('\n'),
      },
    };

    let task: TwentyResult<TwentyRecord>;
    if (isEventLead) {
      const existingTask = await this.findTaskByTitle(taskTitle);
      if (!existingTask.ok) {
        return {
          ok: false,
          error: existingTask.error,
          data: { personId: person.data.id, companyId, opportunityId },
        };
      }
      task = existingTask.data
        ? await this.requestRecord('PATCH', `/tasks/${existingTask.data.id}`, taskPayload)
        : await this.requestRecord('POST', '/tasks', taskPayload);
    } else {
      task = await this.requestRecord('POST', '/tasks', taskPayload);
    }

    const taskId = task.data?.id;
    if (isEventLead && (!task.ok || !taskId)) {
      return {
        ok: false,
        error: task.error ?? 'Tarea de evento no creada',
        data: { personId: person.data.id, companyId, opportunityId },
      };
    }

    if (task.ok && taskId) {
      if (isEventLead) {
        const existingTarget = await this.findTaskTargetByTaskId(taskId);
        if (!existingTarget.ok) {
          return {
            ok: false,
            error: existingTarget.error,
            data: { personId: person.data.id, companyId, opportunityId, taskId },
          };
        }
        const targetOpportunityId = existingTarget.data?.targetOpportunityId;
        const linkedOpportunityId =
          typeof targetOpportunityId === 'string'
            ? targetOpportunityId
            : isTwentyRecord(existingTarget.data?.targetOpportunity)
              ? existingTarget.data.targetOpportunity.id
              : undefined;
        if (!existingTarget.data || linkedOpportunityId !== opportunityId) {
          const method = existingTarget.data ? 'PATCH' : 'POST';
          const path = existingTarget.data
            ? `/taskTargets/${existingTarget.data.id}`
            : '/taskTargets';
          const target = await this.requestRecord(method, path, {
            taskId,
            targetOpportunityId: opportunityId,
            position: 'first',
          });
          if (!target.ok) {
            return {
              ok: false,
              error: target.error ?? 'Tarea de evento no enlazada',
              data: { personId: person.data.id, companyId, opportunityId, taskId },
            };
          }
        }
      } else {
        await this.requestRaw('POST', '/taskTargets', {
          taskId,
          targetOpportunityId: opportunityId,
          position: 'first',
        });
      }
    }

    return {
      ok: true,
      data: {
        personId: person.data.id,
        companyId,
        opportunityId,
        taskId,
      },
    };
  }

  /** Tras sync lead: nota de ciclo LEAD/PROSPECT en cuenta (best-effort). */
  private async touchCompanyLifecycle(
    companyId: string | undefined,
    stage: string,
    source: string
  ): Promise<void> {
    if (!companyId) return;
    const lifecycle = deriveLifecycleFromOpportunityStage(stage);
    await this.syncCompanyLifecycleNote({ companyId, lifecycle, source });
  }
}

/**
 * Punto de entrada usado por `registrar-cotizacion`: sync lead → Twenty.
 * Si no hay secrets TWENTY_*, `skipped: true`.
 */
export async function syncCotizacionWithTwenty(input: {
  nombre: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  mensaje?: string;
  origen?: string;
  tipoSolicitud?: string;
  productos?: Array<{ nombre?: string; slug?: string; cantidad?: number }>;
  totalEstimado?: number | null;
  moneda?: string;
  priority?: 'P1' | 'P2' | 'P3';
  campaign?: string;
  familySlug?: string;
  purchaseHorizon?: string;
  ciudad?: string;
  leadReference?: string;
  twentyOpportunityId?: string | null;
  eventSlug?: string;
  eventName?: string;
}): Promise<
  TwentyResult<{
    personId: string;
    companyId?: string;
    opportunityId: string;
    taskId?: string;
  }>
> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.syncCotizacionLead(input);
}

/** Lead consultivo persistido: mismo modelo Twenty, con SLA segun prioridad. */
export async function syncCommercialLeadWithTwenty(input: {
  nombre: string;
  nombres?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
  empresa: string;
  mensaje: string;
  priority: 'P1' | 'P2' | 'P3';
  campaign: string;
  familySlug: string;
  purchaseHorizon: string;
  ciudad?: string;
  leadReference?: string;
  twentyOpportunityId?: string | null;
  /** Override de canal (p.ej. `congreso`); por defecto deriva de campaign. */
  origen?: string;
  eventSlug?: string;
  eventName?: string;
  productos?: Array<{ nombre?: string; slug?: string; cantidad?: number }>;
}): Promise<
  TwentyResult<{
    personId: string;
    companyId?: string;
    opportunityId: string;
    taskId?: string;
  }>
> {
  const isEvent = input.campaign === 'evento';
  return syncCotizacionWithTwenty({
    ...input,
    origen: input.origen?.trim() || (isEvent ? 'evento' : `lead_consultivo:${input.campaign}`),
    tipoSolicitud: isEvent ? 'registro_evento' : 'evaluacion_proyecto',
    productos: isEvent
      ? (input.productos ?? [])
      : (input.productos ?? [{ slug: input.familySlug, nombre: input.familySlug, cantidad: 1 }]),
  });
}

/**
 * Punto de entrada usado por `comercial-share`: si Twenty no esta
 * configurado (`TWENTY_BASE_URL`/`TWENTY_API_KEY` ausentes), devuelve
 * `skipped: true` en vez de fallar la peticion.
 */
export async function syncShareWithTwenty(
  share: {
    recipientName: string;
    medicalCenterName?: string | null;
    recipientEmail?: string | null;
    recipientPhoneE164?: string | null;
    phoneCountryCode?: string | null;
    message?: string | null;
    channel?: 'email' | 'whatsapp' | string | null;
    commercialName?: string | null;
    commercialEmail?: string | null;
    ownerId?: string | null;
  },
  products: Array<{
    name: string;
    sku?: string | null;
    url?: string | null;
    family?: string | null;
    specialty?: string | null;
  }>
): Promise<TwentyResult<{ personId: string; companyId?: string; noteId: string }>> {
  const client = TwentyClient.fromEnv();
  if (!client)
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  return client.syncCommercialShare(share, products);
}

/**
 * Reintento seguro: si un intento previo creó persona y nota pero falló al
 * enlazarlas, solo repara el enlace. Evita notas duplicadas en Twenty.
 */
export async function retryShareWithTwenty(
  share: {
    recipientName: string;
    medicalCenterName?: string | null;
    recipientEmail?: string | null;
    recipientPhoneE164?: string | null;
    phoneCountryCode?: string | null;
    message?: string | null;
    channel?: 'email' | 'whatsapp' | string | null;
    commercialName?: string | null;
    commercialEmail?: string | null;
    ownerId?: string | null;
  },
  products: Array<{
    name: string;
    sku?: string | null;
    url?: string | null;
    family?: string | null;
    specialty?: string | null;
  }>,
  previous: { personId?: string | null; companyId?: string | null; noteId?: string | null }
): Promise<TwentyResult<{ personId: string; companyId?: string; noteId: string }>> {
  const client = TwentyClient.fromEnv();
  if (!client)
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };

  if (previous.personId && previous.noteId) {
    const link = await client.linkNoteTarget({
      noteId: previous.noteId,
      targetPersonId: previous.personId,
      targetCompanyId: previous.companyId ?? undefined,
    });
    if (!link.ok) return { ok: false, error: link.error };
    return {
      ok: true,
      data: {
        personId: previous.personId,
        ...(previous.companyId ? { companyId: previous.companyId } : {}),
        noteId: previous.noteId,
      },
    };
  }

  return client.syncCommercialShare(share, products);
}

/**
 * Presupuesto formal (Validar → CRM): Opportunity PROPOSAL + nota completa.
 * Si `twentyOpportunityId` existe, hace PATCH (no duplica opp).
 */
export async function syncCotizacionOfertaWithTwenty(input: {
  cotizacionId: string;
  numero: string;
  nombre: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  moneda: string;
  total: number;
  validezHasta?: string | null;
  condiciones?: string | null;
  estado?: string | null;
  productos: Array<{
    nombre: string;
    slug?: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    moneda?: string;
    notas?: string;
  }>;
  campaign?: string;
  origen?: string;
  canalEnvio?: string | null;
  formalizarUrl?: string | null;
  validatedByEmail?: string | null;
  twentyOpportunityId?: string | null;
}): Promise<
  TwentyResult<{
    personId: string;
    companyId?: string;
    opportunityId: string;
    noteId?: string;
  }>
> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.syncCotizacionOferta(input);
}

/** Cliente nuevo (pago/formalizar) → Company + Person + tipología/factura. */
export async function syncClienteWithTwenty(input: {
  nombre: string;
  apellido?: string | null;
  email: string;
  telefono?: string | null;
  institucion?: string | null;
  tipoCliente: 'b2b' | 'b2c' | 'mixto';
  razonSocial?: string | null;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  emailFacturacion?: string | null;
  totalGastado?: number | null;
  moneda?: string;
}): Promise<TwentyResult<{ personId: string; companyId: string; noteId?: string }>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.syncClienteFacturacion(input);
}

/** Pago confirmado → Opportunity CUSTOMER + importe. */
export async function syncPagoWithTwenty(input: {
  companyId?: string;
  personId?: string;
  opportunityId?: string;
  pedidoId: string;
  nombreOportunidad: string;
  total: number;
  moneda?: string;
  proveedorPago: 'wompi' | 'stripe' | 'bold' | 'transferencia';
  ownerId?: string;
}): Promise<TwentyResult<{ opportunityId: string; noteId?: string }>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.syncPagoConfirmado(input);
}

/** Factura DIAN → nota + patch oportunidad/compañía. */
export async function syncFacturaWithTwenty(input: {
  companyId?: string;
  personId?: string;
  opportunityId?: string;
  pedidoId: string;
  numeroFactura?: string | null;
  cufe?: string | null;
  estado: string;
  total?: number | null;
  moneda?: string;
}): Promise<TwentyResult<{ noteId?: string }>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.syncFacturaEmitida(input);
}

/** Reasigna lead/oportunidad a otro workspace member (comercial). */
export async function reassignTwentyLead(input: {
  opportunityId: string;
  newOwnerId: string;
  companyId?: string;
  personId?: string;
  reason?: string;
}): Promise<
  TwentyResult<{
    opportunityId: string;
    companyId?: string;
    taskIds: string[];
  }>
> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.reassignCommercialLead(input);
}

/** Resuelve workspaceMemberId por email del comercial (Settings → Members). */
export async function resolveTwentyOwnerByEmail(
  email: string
): Promise<TwentyResult<string | null>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  const member = await client.findWorkspaceMemberByEmail(email);
  if (!member.ok) return { ok: false, error: member.error };
  return { ok: true, data: member.data?.id ?? null };
}

/** Lista miembros workspace Twenty (comerciales). */
export async function listTwentyWorkspaceMembers(): Promise<TwentyResult<TwentyRecord[]>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.listWorkspaceMembers();
}

/** Enlaza contacto Twenty a empresa (bidireccional vía companyId). */
export async function linkTwentyPersonCompany(input: {
  personId: string;
  companyId?: string;
  companyName?: string;
  ownerId?: string;
}): Promise<TwentyResult<{ personId: string; companyId: string }>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.linkPersonAndCompany(input);
}

/** Sincroniza etapa/valor/nota desde CRM warehouse a Twenty. */
export async function syncTwentyOpportunityFromCrm(input: {
  opportunityId: string;
  etapa?: string;
  valorEstimado?: number | null;
  moneda?: string;
  ownerId?: string;
  companyId?: string;
  personId?: string;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
  titulo?: string;
}): Promise<TwentyResult<TwentyRecord>> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.updateManagedOpportunity(input);
}

/** Repara personas Twenty sin empresa asociada. */
export async function repairTwentyOrphanLinks(input?: {
  ownerId?: string;
  limit?: number;
}): Promise<
  TwentyResult<{
    scanned: number;
    linked: number;
    skipped: number;
    errors: number;
  }>
> {
  const client = TwentyClient.fromEnv();
  if (!client) {
    return { ok: false, skipped: true, error: 'TWENTY_BASE_URL/TWENTY_API_KEY no configurados' };
  }
  return client.repairOrphanPeopleLinks(input);
}
