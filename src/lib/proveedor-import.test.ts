import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DROPSHIP_PROTECTED_IMPORT_FIELDS,
  PROVEEDOR_CONTACTO_IMPORT_COLUMNS,
  PROVEEDOR_CONTACTO_TEMPLATE_SAMPLE,
  PROVEEDOR_IMPORT_COLUMNS,
  PROVEEDOR_TEMPLATE_SAMPLE,
  applyCsvMapping,
  defaultCsvMapping,
  findDuplicateGroups,
  mapCanvaCsvRow,
  matchExistingProveedor,
  normalizeWhatsapp,
  omitEmptyFields,
  parseCsv,
  prepareContactoImportRow,
  prepareProveedorImportRow,
  sanitizeDropshipImportPayload,
  suggestContactsFromNote,
} from './proveedor-import';

describe('plantilla de proveedores', () => {
  it('usa las mismas columnas que la muestra y no incluye secretos', () => {
    expect(Object.keys(PROVEEDOR_TEMPLATE_SAMPLE)).toEqual([...PROVEEDOR_IMPORT_COLUMNS]);
    expect(PROVEEDOR_IMPORT_COLUMNS).not.toContain('webhook_url');
    expect(PROVEEDOR_IMPORT_COLUMNS).not.toContain('api_config');
    expect(PROVEEDOR_IMPORT_COLUMNS).not.toContain('dropship_enabled');
    expect(Object.keys(PROVEEDOR_CONTACTO_TEMPLATE_SAMPLE)).toEqual([
      ...PROVEEDOR_CONTACTO_IMPORT_COLUMNS,
    ]);
  });

  it('reimporta la fila de ejemplo sin cambios de significado', () => {
    const prepared = prepareProveedorImportRow(PROVEEDOR_TEMPLATE_SAMPLE, 2);
    expect(prepared.ok).toBe(true);
    expect(prepared.payload).toMatchObject({
      slug: 'proveedor-ejemplo',
      nombre: 'Proveedor ejemplo',
      tipo_entidad: 'proveedor',
      canal: 'email',
      lifecycle_status: 'prospect',
      estado_invima: 'sin_iniciar',
      contacto_whatsapp: '+573000000000',
      activo: false,
    });
    expect(prepared.payload).not.toHaveProperty('dropship_enabled');
    const again = prepareProveedorImportRow(prepared.payload, 2);
    expect(again.ok).toBe(true);
    expect(again.payload).toEqual(prepared.payload);
  });
});

describe('validación por fila', () => {
  it('señala fila, columna y valor inválido', () => {
    const prepared = prepareProveedorImportRow(
      {
        slug: 'acme',
        nombre: 'Acme',
        tipo_entidad: 'mayorista',
        lifecycle_status: 'vip',
        canal: 'telefono',
        contacto_email: 'no-es-correo',
        contacto_whatsapp: '300',
        sitio_web: 'acme',
        activo: 'quizas',
        estado_invima: 'pendiente raro',
      },
      4
    );
    expect(prepared.ok).toBe(false);
    const columns = prepared.errors.map(error => error.column);
    expect(columns).toEqual(
      expect.arrayContaining([
        'tipo_entidad',
        'lifecycle_status',
        'canal',
        'contacto_email',
        'contacto_whatsapp',
        'sitio_web',
        'activo',
        'estado_invima',
      ])
    );
    const email = prepared.errors.find(error => error.column === 'contacto_email');
    expect(email).toMatchObject({ row: 4, value: 'no-es-correo' });
  });

  it('no pisa datos cuando la celda viene vacía', () => {
    const prepared = prepareProveedorImportRow(
      {
        slug: 'acme',
        nombre: 'Acme',
        razon_social: '',
        contacto_email: '',
        notas: '',
        activo: '',
      },
      2
    );
    expect(prepared.ok).toBe(true);
    expect(prepared.payload).toEqual({ slug: 'acme', nombre: 'Acme' });
    expect(omitEmptyFields({ slug: 'acme', notas: null, activo: false }, false)).toEqual({
      slug: 'acme',
      activo: false,
    });
  });

  it('puede vaciar campos si se pide de forma explícita', () => {
    const prepared = prepareProveedorImportRow({ slug: 'acme', nombre: 'Acme', notas: '' }, 2, {
      clearEmpty: true,
    });
    expect(prepared.payload.notas).toBeNull();
  });

  it('rechaza dropshipping si el proveedor no está aprobado y no lo activa al aprobar', () => {
    const blocked = prepareProveedorImportRow(
      {
        slug: 'acme',
        nombre: 'Acme',
        lifecycle_status: 'prospect',
        dropship_enabled: true,
      },
      3
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.errors[0]?.message).toMatch(/Dropshipping solo se habilita/);

    const approved = prepareProveedorImportRow(
      {
        slug: 'acme',
        nombre: 'Acme',
        lifecycle_status: 'aprobado',
        dropship_enabled: true,
      },
      3
    );
    expect(approved.ok).toBe(true);
    expect(approved.payload.lifecycle_status).toBe('aprobado');
    expect(approved.payload).not.toHaveProperty('dropship_enabled');
  });

  it('normaliza WhatsApp de wa.me y acepta si/no', () => {
    const prepared = prepareProveedorImportRow(
      {
        slug: 'acme',
        nombre: 'Acme',
        contacto_whatsapp: 'https://wa.me/8613418937694',
        activo: 'si',
      },
      2
    );
    expect(prepared.payload.contacto_whatsapp).toBe('+8613418937694');
    expect(prepared.payload.activo).toBe(true);
    expect(normalizeWhatsapp('+57 300 000 0000')).toEqual({ ok: true, value: '+573000000000' });
  });

  it('rechaza columnas sensibles sin devolver su valor', () => {
    const prepared = prepareProveedorImportRow(
      {
        slug: 'acme',
        nombre: 'Acme',
        webhook_url: 'https://hooks.example/secret',
        api_config: { token: 'no-mostrar' },
      },
      2
    );
    expect(prepared.ok).toBe(false);
    expect(JSON.stringify(prepared.errors)).not.toContain('hooks.example');
    expect(JSON.stringify(prepared.errors)).not.toContain('no-mostrar');
  });
});

describe('hoja de contactos', () => {
  it('exige un medio de contacto y un slug', () => {
    const missing = prepareContactoImportRow({ nombre: 'Ana' }, 2);
    expect(missing.ok).toBe(false);
    const ready = prepareContactoImportRow(
      {
        slug_proveedor: 'Acme Medical',
        nombre: 'Ana',
        tipo: 'ventas',
        whatsapp: 'https://wa.me/573005551010',
        es_principal: 'si',
      },
      2
    );
    expect(ready.payload).toMatchObject({
      slug_proveedor: 'acme-medical',
      tipo: 'ventas',
      whatsapp: '+573005551010',
      es_principal: true,
    });
  });
});

describe('CSV interno de proveedores', () => {
  it('separa campos, contacto principal y deja los extras en vista previa', () => {
    const mapped = mapCanvaCsvRow({
      Origen: 'China',
      Marca: 'Northern Meditec Limited',
      Fabricante: 'Shenzhen Northern Meditec Technology Co., Ltd',
      'Sitio web': 'https://es.northernmeditec.com',
      Contacto: 'Cherry Yang',
      WhatsApp: 'https://wa.me/8613418937694',
      Email: '',
      Equipos: 'Ventiladores, monitores, máquinas de anestesia',
      'Estado INVIMA': 'En proceso de Modificación',
      Notas:
        'Frenchy Cuello es el Gerente de Ventas, contacto en Colombia: https://wa.me/573505775704',
    });
    expect(mapped.proveedor).toMatchObject({
      slug: 'northern-meditec-limited',
      nombre: 'Northern Meditec Limited',
      razon_social: 'Shenzhen Northern Meditec Technology Co., Ltd',
      pais: 'China',
      sitio_web: 'https://es.northernmeditec.com',
      lineas_equipos: 'Ventiladores, monitores, máquinas de anestesia',
      estado_invima: 'En proceso de Modificación',
      lifecycle_status: 'contactado',
      activo: false,
    });
    expect(String(mapped.proveedor.notas)).not.toContain('Cherry');
    expect(mapped.contactoPrincipal).toMatchObject({
      nombre: 'Cherry Yang',
      whatsapp: '+8613418937694',
      es_principal: true,
    });
    expect(mapped.contactosSugeridos.map(item => item.whatsapp)).toContain('+573505775704');
    expect(mapped.contactosSugeridos.map(item => item.nombre)).toContain('Frenchy Cuello');
  });

  it('normaliza países, INVIMA y el cargo del contacto', () => {
    const mapped = mapCanvaCsvRow({
      Origen: 'China/Alemania',
      Marca: 'Angell Technology',
      Fabricante: 'Shenzhen Angell Technology Co., Ltd.',
      Contacto: 'Oscar Meng, Gerente de America',
      WhatsApp: 'https://wa.me/8615252255305',
      Equipos: 'Ultrasonidos',
      'Estado INVIMA': 'A nombre de otro titular',
      Notas: 'Electromed los distribuye acá.',
    });
    const prepared = prepareProveedorImportRow(mapped.proveedor, 2);
    expect(prepared.ok).toBe(true);
    expect(prepared.payload.pais).toBe('China / Alemania');
    expect(prepared.payload.estado_invima).toBe('titular_tercero');
    expect(mapped.contactoPrincipal).toMatchObject({
      nombre: 'Oscar Meng',
      cargo: 'Gerente de America',
    });
    expect(mapped.distribuidorLocalSugerido).toBe('Electromed');
    const buried = mapCanvaCsvRow({
      Marca: 'Kaixin',
      Fabricante: 'Xuzhou Kaixin',
      Notas: 'Interesados en que negociemos. Electromed los distribuye acá.',
    });
    expect(buried.distribuidorLocalSugerido).toBe('Electromed');
  });

  it('lee la muestra del directorio y propone el titular aparte de la nota', () => {
    const rows = parseCsv(
      readFileSync(new URL('./proveedor-import.fixture.csv', import.meta.url), 'utf8')
    );
    expect(rows).toHaveLength(1);
    const headers = Object.keys(rows[0] ?? {});
    const mapping = defaultCsvMapping(headers);
    expect(mapping.Marca).toBe('nombre');
    expect(mapping.Equipos).toBe('lineas_equipos');
    const perlove = rows.find(row => row.Marca === 'Perlove');
    expect(perlove).toBeTruthy();
    const mapped = applyCsvMapping(perlove ?? {}, mapping);
    expect(mapped.invimaTitularSugerido?.toLowerCase()).toContain('ultrashall');
    expect(mapped.proveedor.lineas_equipos).toBeTruthy();
    expect(String(mapped.proveedor.lineas_equipos)).not.toMatch(/ultrashall/i);
  });
});

describe('sanitizeDropshipImportPayload', () => {
  it('no altera filas sin dropship', () => {
    const payload = {
      slug: 'acme',
      nombre: 'Acme',
      canal: 'whatsapp',
      contacto_email: 'nuevo@acme.test',
      activo: false,
      lifecycle_status: 'contactado',
      lineas_equipos: 'Monitores',
    };
    expect(sanitizeDropshipImportPayload(payload, undefined)).toEqual(payload);
    expect(sanitizeDropshipImportPayload(payload, { dropship_enabled: false })).toEqual(payload);
  });

  it('quita routing y estado en proveedores dropship sin tocar fills comerciales', () => {
    const payload = {
      slug: 'acme',
      nombre: 'Acme',
      canal: 'email',
      contacto_email: 'spoof@evil.test',
      contacto_whatsapp: '+573001111111',
      activo: false,
      lifecycle_status: 'prospect',
      lineas_equipos: 'Monitores UCI',
      estado_invima: 'titular_marca',
      notas: 'Actualización INVIMA',
    };
    const sanitized = sanitizeDropshipImportPayload(payload, {
      dropship_enabled: true,
    });
    for (const field of DROPSHIP_PROTECTED_IMPORT_FIELDS) {
      expect(sanitized).not.toHaveProperty(field);
    }
    expect(sanitized).toMatchObject({
      slug: 'acme',
      nombre: 'Acme',
      lineas_equipos: 'Monitores UCI',
      estado_invima: 'titular_marca',
      notas: 'Actualización INVIMA',
    });
  });
});

describe('duplicados', () => {
  it('agrupa el mismo nombre normalizado y el mismo dominio', () => {
    const groups = findDuplicateGroups([
      {
        id: '1',
        slug: 'saikang',
        nombre: 'Saikang',
        sitio_web: 'https://www.saikangmedical.com/about',
        contacto_email: '',
      },
      {
        id: '2',
        slug: 'saikang-medical',
        nombre: 'Saikang Medical',
        sitio_web: 'https://saikangmedical.com/',
        contacto_email: 'export@saikangmedical.com',
      },
      {
        id: '3',
        slug: 'otra',
        nombre: 'Otra Marca',
        sitio_web: 'https://otra.example',
        contacto_email: 'hola@otra.example',
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.members.map(member => member.slug).sort()).toEqual([
      'saikang',
      'saikang-medical',
    ]);
    const match = matchExistingProveedor(
      {
        nombre: 'Saikang Medical',
        sitio_web: 'https://www.saikangmedical.com/English/About-us/',
        contacto_email: '',
        slug: 'saikang-medical-2',
      },
      [
        {
          id: '1',
          slug: 'saikang',
          nombre: 'Saikang',
          sitio_web: '',
          contacto_email: '',
        },
      ]
    );
    expect(match?.slug).toBe('saikang');
  });
});

describe('vista previa de notas', () => {
  it('encuentra correos y WhatsApp sin guardarlos solos', () => {
    const suggestions = suggestContactsFromNote(
      'Correo de Olivia: olivia.zhang@zkmeiling.com. Otro contacto: Felisd https://wa.me/8619942668587'
    );
    expect(suggestions.map(item => item.email)).toContain('olivia.zhang@zkmeiling.com');
    expect(suggestions.map(item => item.whatsapp)).toContain('+8619942668587');
    expect(suggestions.map(item => item.nombre)).toContain('Olivia');
  });
});
