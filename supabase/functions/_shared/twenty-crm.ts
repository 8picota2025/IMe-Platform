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

export interface TwentyRecord {
  id: string;
  [key: string]: unknown;
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

  async upsertPerson(input: {
    firstName: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    phoneCallingCode?: string;
    jobTitle?: string;
    companyId?: string;
  }): Promise<TwentyResult<TwentyRecord>> {
    let existing: TwentyResult<TwentyRecord | null> = { ok: true, data: null };
    if (input.email) {
      existing = await this.findPersonByEmail(input.email);
    } else if (input.phoneNumber) {
      existing = await this.findPersonByPhone(input.phoneNumber);
    }
    if (!existing.ok) return { ok: false, error: existing.error };

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
    if (input.jobTitle) payload.jobTitle = input.jobTitle;
    if (input.companyId) payload.companyId = input.companyId;

    const existingId = existing.data?.id;
    if (existingId) {
      return this.requestRecord('PATCH', `/people/${existingId}`, payload);
    }
    return this.requestRecord('POST', '/people', payload);
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
    const ownerId =
      input.ownerId?.trim() ||
      Deno.env.get('TWENTY_OWNER_ID')?.trim() ||
      '8c9ca697-bc48-45d1-aba4-9a51a68d19e9';
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
      ownerId,
      position: 'first',
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
    },
    products: Array<{ name: string; sku?: string | null; url?: string | null }>
  ): Promise<TwentyResult<{ personId: string; companyId?: string; noteId: string }>> {
    let companyId: string | undefined;
    if (share.medicalCenterName?.trim()) {
      const company = await this.upsertCompany({ name: share.medicalCenterName.trim() });
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

    const person = await this.upsertPerson({
      firstName: firstName || share.recipientName.trim() || 'Contacto',
      lastName: restName.join(' ') || undefined,
      email: share.recipientEmail ?? undefined,
      phoneNumber,
      phoneCallingCode,
      companyId,
    });
    if (!person.ok || !person.data)
      return { ok: false, error: person.error ?? 'Persona no creada' };

    const productList = products.length
      ? products
          .map(p => `- ${p.name}${p.sku ? ` (ref. ${p.sku})` : ''}${p.url ? ` — ${p.url}` : ''}`)
          .join('\n')
      : '- (sin productos)';
    const note = await this.createNote({
      title: `Catalogo compartido — ${share.recipientName}`,
      bodyMarkdown: `${share.message ?? ''}\n\nProductos:\n${productList}`.trim(),
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

    return { ok: true, data: { personId: person.data.id, companyId, noteId: note.data.id } };
  }

  /**
   * Sync de solicitud de cotizacion web → Company + Person + Opportunity NEW
   * + Task SLA (owner comercial). Best-effort; no lanza.
   */
  async syncCotizacionLead(input: {
    nombre: string;
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
  }): Promise<
    TwentyResult<{
      personId: string;
      companyId?: string;
      opportunityId: string;
      taskId?: string;
    }>
  > {
    const ownerId =
      input.ownerId?.trim() ||
      Deno.env.get('TWENTY_OWNER_ID')?.trim() ||
      '8c9ca697-bc48-45d1-aba4-9a51a68d19e9';

    const companyName = (input.empresa || '').trim() || `Lead web — ${input.nombre}`.slice(0, 120);
    const company = await this.upsertCompany({ name: companyName });
    if (!company.ok) return { ok: false, error: company.error };
    const companyId = company.data?.id;
    if (companyId) {
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
      lastName: restName.join(' ') || 'Web',
      email: input.email,
      phoneNumber,
      phoneCallingCode,
      jobTitle: `Lead ${input.origen || 'web'}`,
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
    const oppName = productLabel
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
      ownerId,
      amount: {
        amountMicros,
        currencyCode: (input.moneda || 'COP').slice(0, 8),
      },
    };
    const opp = await this.requestRecord('POST', '/opportunities', oppPayload);
    if (!opp.ok || !opp.data) {
      return { ok: false, error: opp.error ?? 'Oportunidad no creada' };
    }

    const productList = (input.productos || []).length
      ? (input.productos || [])
          .map(p => `- ${p.nombre || p.slug || 'producto'}${p.cantidad ? ` x${p.cantidad}` : ''}`)
          .join('\n')
      : '- (sin productos)';
    const due = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const task = await this.requestRecord('POST', '/tasks', {
      title: `SLA cotización: ${oppName}`.slice(0, 120),
      status: 'TODO',
      dueAt: due,
      assigneeId: ownerId,
      position: 'first',
      bodyV2: {
        markdown: [
          `**Canal:** ${input.origen || 'web'}`,
          `**Tipo:** ${input.tipoSolicitud || 'cotizacion'}`,
          `**Mensaje:** ${input.mensaje || '—'}`,
          `**Productos:**\n${productList}`,
        ].join('\n'),
      },
    });

    const taskId: string | undefined = task.data?.id;
    if (task.ok && taskId) {
      await this.requestRaw('POST', '/taskTargets', {
        taskId,
        targetOpportunityId: opp.data.id,
        position: 'first',
      });
    }

    return {
      ok: true,
      data: {
        personId: person.data.id,
        companyId,
        opportunityId: opp.data.id,
        taskId,
      },
    };
  }
}

/**
 * Punto de entrada usado por `registrar-cotizacion`: sync lead → Twenty.
 * Si no hay secrets TWENTY_*, `skipped: true`.
 */
export async function syncCotizacionWithTwenty(input: {
  nombre: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  mensaje?: string;
  origen?: string;
  tipoSolicitud?: string;
  productos?: Array<{ nombre?: string; slug?: string; cantidad?: number }>;
  totalEstimado?: number | null;
  moneda?: string;
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
  },
  products: Array<{ name: string; sku?: string | null; url?: string | null }>
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
  },
  products: Array<{ name: string; sku?: string | null; url?: string | null }>,
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
