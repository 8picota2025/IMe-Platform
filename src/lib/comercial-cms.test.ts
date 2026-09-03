import { describe, expect, it } from 'vitest';

import {
  buildIdempotencyKey,
  buildWhatsAppLink,
  canAccessShare,
  canManageCommercialTemplates,
  canManageTwentyBridge,
  filterProductsHierarchical,
  isCommercialAdmin,
  isComercialUser,
  isValidIdempotencyKey,
  normalizeEmail,
  normalizePhoneE164,
  renderMessageTemplate,
  specialtyForFamiliaSlug,
  SPECIALTY_GROUPS,
  type ProductoFiltrable,
} from './comercial-cms';

describe('normalizeEmail', () => {
  it('acepta un email valido y lo normaliza a minusculas/trim', () => {
    const result = normalizeEmail('  Doctor@Hospital.COM  ');
    expect(result.ok).toBe(true);
    expect(result.email).toBe('doctor@hospital.com');
  });

  it('rechaza valores vacios, no-string o sin formato de email', () => {
    expect(normalizeEmail('').ok).toBe(false);
    expect(normalizeEmail(undefined).ok).toBe(false);
    expect(normalizeEmail('no-es-email').ok).toBe(false);
    expect(normalizeEmail(123).ok).toBe(false);
  });
});

describe('normalizePhoneE164', () => {
  it('normaliza un numero local colombiano con el codigo de pais por defecto (57)', () => {
    const result = normalizePhoneE164('300 123 4567');
    expect(result.ok).toBe(true);
    expect(result.e164).toBe('+573001234567');
  });

  it('respeta un numero que ya viene con "+" y codigo de pais', () => {
    const result = normalizePhoneE164('+1 (415) 555-0132');
    expect(result.ok).toBe(true);
    expect(result.e164).toBe('+14155550132');
  });

  it('no duplica el codigo de pais si el usuario ya lo escribio sin "+"', () => {
    const result = normalizePhoneE164('573001234567', '57');
    expect(result.ok).toBe(true);
    expect(result.e164).toBe('+573001234567');
  });

  it('usa el countryCode explicito cuando se provee', () => {
    const result = normalizePhoneE164('4155550132', '1');
    expect(result.ok).toBe(true);
    expect(result.e164).toBe('+14155550132');
  });

  it('rechaza telefonos vacios o con longitud invalida', () => {
    expect(normalizePhoneE164('').ok).toBe(false);
    expect(normalizePhoneE164('123').ok).toBe(false);
    expect(normalizePhoneE164('1'.repeat(20)).ok).toBe(false);
  });
});

describe('buildWhatsAppLink', () => {
  it('construye un enlace wa.me sin el "+" y con el texto codificado', () => {
    const link = buildWhatsAppLink('+573001234567', 'Hola, te comparto el catalogo');
    expect(link).toBe('https://wa.me/573001234567?text=Hola%2C%20te%20comparto%20el%20catalogo');
  });
});

describe('renderMessageTemplate', () => {
  const vars = {
    nombre_destinatario: 'Dra. Ana Perez',
    nombre_comercial: 'Carlos Ruiz',
    centro_medico: 'Hospital Central',
    mensaje: 'Adjunto catalogo solicitado',
    lista_productos_texto: '- Monitor de signos vitales',
    lista_productos_html: '<li>Monitor de signos vitales</li>',
    correo_comercial: 'carlos@i-me.com.co',
    telefono_comercial: '+573000000000',
  };

  it('reemplaza todas las variables conocidas', () => {
    const result = renderMessageTemplate(
      'Hola {{nombre_destinatario}}, soy {{nombre_comercial}} de {{centro_medico}}. {{mensaje}}',
      vars
    );
    expect(result.ok).toBe(true);
    expect(result.text).toBe(
      'Hola Dra. Ana Perez, soy Carlos Ruiz de Hospital Central. Adjunto catalogo solicitado'
    );
  });

  it('rechaza plantillas con variables desconocidas', () => {
    const result = renderMessageTemplate(
      'Hola {{nombre_destinatario}}, tu descuento es {{descuento_secreto}}',
      vars
    );
    expect(result.ok).toBe(false);
    expect(result.unknownVars).toEqual(['descuento_secreto']);
  });

  it('trata variables conocidas ausentes en `vars` como cadena vacia', () => {
    const result = renderMessageTemplate('Mensaje: {{mensaje}}', {});
    expect(result.ok).toBe(true);
    expect(result.text).toBe('Mensaje: ');
  });
});

describe('SPECIALTY_GROUPS / specialtyForFamiliaSlug', () => {
  it('mirroring de PRINCIPALES: incluye las 4 especialidades UI base', () => {
    const slugs = SPECIALTY_GROUPS.map(g => g.slug);
    expect(slugs).toEqual([
      'diagnostico-monitoreo',
      'terapia-soporte-vital',
      'quirofano-cuidado-critico',
      'infraestructura-clinica',
    ]);
  });

  it('resuelve la especialidad de una familia conocida', () => {
    expect(specialtyForFamiliaSlug('monitores')).toBe('Diagnóstico y monitoreo');
    expect(specialtyForFamiliaSlug('anestesia')).toBe('Terapia y soporte vital');
    expect(specialtyForFamiliaSlug('sala-cirugia')).toBe('Quirófano y cuidado crítico');
    expect(specialtyForFamiliaSlug('mobiliario')).toBe('Infraestructura clínica');
  });

  it('no solapa familias entre especialidades', () => {
    const seen = new Set<string>();
    for (const grupo of SPECIALTY_GROUPS) {
      for (const familia of grupo.familias) {
        expect(seen.has(familia)).toBe(false);
        seen.add(familia);
      }
    }
  });

  it('devuelve null para una familia que no pertenece a ningun grupo', () => {
    expect(specialtyForFamiliaSlug('familia-inexistente')).toBeNull();
  });
});

describe('filterProductsHierarchical', () => {
  const productos: ProductoFiltrable[] = [
    {
      id: '1',
      nombre: 'Monitor UCI',
      familiaSlug: 'monitores',
      tipoSlug: 'monitor-signos-vitales',
      seccion: 'equipo',
    },
    {
      id: '2',
      nombre: 'Electrodo ECG',
      familiaSlug: 'cardiologia',
      tipoSlug: 'electrodos',
      seccion: 'consumible',
    },
    {
      id: '3',
      nombre: 'Camilla hospitalaria',
      familiaSlug: 'mobiliario',
      tipoSlug: null,
      seccion: 'equipo',
    },
    {
      id: '4',
      nombre: 'Monitor inactivo',
      familiaSlug: 'monitores',
      tipoSlug: 'monitor-signos-vitales',
      seccion: 'equipo',
      activo: false,
    },
  ];

  it('filtra por especialidad (agrupa varias familias)', () => {
    const result = filterProductsHierarchical(productos, {
      specialtySlug: 'diagnostico-monitoreo',
    });
    expect(result.map(p => p.id).sort()).toEqual(['1', '2']);
  });

  it('filtra por familia', () => {
    const result = filterProductsHierarchical(productos, { familiaSlug: 'mobiliario' });
    expect(result.map(p => p.id)).toEqual(['3']);
  });

  it('filtra por subfamilia (tipo)', () => {
    const result = filterProductsHierarchical(productos, { tipoSlug: 'electrodos' });
    expect(result.map(p => p.id)).toEqual(['2']);
  });

  it('filtra por seccion (tipo_comercial)', () => {
    const result = filterProductsHierarchical(productos, { seccion: 'consumible' });
    expect(result.map(p => p.id)).toEqual(['2']);
  });

  it('combina niveles jerarquicos (especialidad + seccion)', () => {
    const result = filterProductsHierarchical(productos, {
      specialtySlug: 'diagnostico-monitoreo',
      seccion: 'equipo',
    });
    expect(result.map(p => p.id)).toEqual(['1']);
  });

  it('filtra por texto libre (query) sin distinguir mayusculas', () => {
    const result = filterProductsHierarchical(productos, { query: 'camilla' });
    expect(result.map(p => p.id)).toEqual(['3']);
  });

  it('excluye siempre los productos con activo=false', () => {
    const result = filterProductsHierarchical(productos, { familiaSlug: 'monitores' });
    expect(result.map(p => p.id)).toEqual(['1']);
  });

  it('sin filtros devuelve todos los productos activos', () => {
    const result = filterProductsHierarchical(productos, {});
    expect(result).toHaveLength(3);
  });
});

describe('buildIdempotencyKey / isValidIdempotencyKey', () => {
  it('genera la misma clave sin importar el orden de productIds', () => {
    const base = {
      userId: 'user-1',
      channel: 'email' as const,
      recipientEmail: 'a@b.com',
      productIds: [],
    };
    const keyA = buildIdempotencyKey({ ...base, productIds: ['p1', 'p2', 'p3'] });
    const keyB = buildIdempotencyKey({ ...base, productIds: ['p3', 'p1', 'p2'] });
    expect(keyA).toBe(keyB);
  });

  it('usa el email como destinatario cuando channel=email, y el telefono cuando channel=whatsapp', () => {
    const emailKey = buildIdempotencyKey({
      userId: 'user-1',
      channel: 'email',
      recipientEmail: 'Doctor@Hospital.com',
      productIds: ['p1'],
    });
    expect(emailKey).toBe('share:user-1:email:doctor@hospital.com:p1');

    const waKey = buildIdempotencyKey({
      userId: 'user-1',
      channel: 'whatsapp',
      recipientPhone: '+573001234567',
      productIds: ['p1'],
    });
    expect(waKey).toBe('share:user-1:whatsapp:+573001234567:p1');
  });

  it('produce claves distintas para usuarios, canales o productos distintos', () => {
    const a = buildIdempotencyKey({
      userId: 'user-1',
      channel: 'email',
      recipientEmail: 'a@b.com',
      productIds: ['p1'],
    });
    const b = buildIdempotencyKey({
      userId: 'user-2',
      channel: 'email',
      recipientEmail: 'a@b.com',
      productIds: ['p1'],
    });
    const c = buildIdempotencyKey({
      userId: 'user-1',
      channel: 'whatsapp',
      recipientPhone: '+1',
      productIds: ['p1'],
    });
    const d = buildIdempotencyKey({
      userId: 'user-1',
      channel: 'email',
      recipientEmail: 'a@b.com',
      productIds: ['p2'],
    });
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it('valida el formato producido por buildIdempotencyKey', () => {
    const key = buildIdempotencyKey({
      userId: 'user-1',
      channel: 'email',
      recipientEmail: 'a@b.com',
      productIds: ['p1'],
    });
    expect(isValidIdempotencyKey(key)).toBe(true);
  });

  it('rechaza claves con formato invalido o de tipo incorrecto', () => {
    expect(isValidIdempotencyKey('no-es-una-clave-valida')).toBe(false);
    expect(isValidIdempotencyKey('share:user-1:invalido:a@b.com:p1')).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey(42)).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(201))).toBe(false);
  });
});

describe('permisos comerciales (mirror de is_admin()/is_comercial_user())', () => {
  it('isComercialUser: true solo para ventas/admin/owner activos', () => {
    expect(isComercialUser('ventas', true)).toBe(true);
    expect(isComercialUser('admin', true)).toBe(true);
    expect(isComercialUser('owner', true)).toBe(true);
    expect(isComercialUser('catalogo', true)).toBe(false);
    expect(isComercialUser('lectura', true)).toBe(false);
    expect(isComercialUser('ventas', false)).toBe(false);
    expect(isComercialUser(null, true)).toBe(false);
  });

  it('isCommercialAdmin: true solo para admin/owner activos', () => {
    expect(isCommercialAdmin('admin', true)).toBe(true);
    expect(isCommercialAdmin('owner', true)).toBe(true);
    expect(isCommercialAdmin('ventas', true)).toBe(false);
    expect(isCommercialAdmin('admin', false)).toBe(false);
  });

  it('canManageTwentyBridge: ventas no repara ni reasigna Twenty', () => {
    expect(canManageTwentyBridge('ventas', true)).toBe(false);
    expect(canManageTwentyBridge('admin', true)).toBe(true);
    expect(canManageTwentyBridge('owner', true)).toBe(true);
    expect(canManageTwentyBridge('admin', false)).toBe(false);
  });

  it('canAccessShare: ventas solo ve lo propio', () => {
    const ventasViewer = { userId: 'user-1', rol: 'ventas', activo: true };
    expect(canAccessShare(ventasViewer, { userId: 'user-1' })).toBe(true);
    expect(canAccessShare(ventasViewer, { userId: 'user-2' })).toBe(false);
  });

  it('canAccessShare: admin/owner ven cualquier envio', () => {
    const adminViewer = { userId: 'admin-1', rol: 'admin', activo: true };
    expect(canAccessShare(adminViewer, { userId: 'user-2' })).toBe(true);
  });

  it('canAccessShare: usuarios sin rol comercial (o inactivos) nunca acceden', () => {
    expect(
      canAccessShare({ userId: 'user-1', rol: 'lectura', activo: true }, { userId: 'user-1' })
    ).toBe(false);
    expect(
      canAccessShare({ userId: 'user-1', rol: 'ventas', activo: false }, { userId: 'user-1' })
    ).toBe(false);
  });

  it('canManageCommercialTemplates: solo admin/owner', () => {
    expect(canManageCommercialTemplates({ userId: 'u', rol: 'owner', activo: true })).toBe(true);
    expect(canManageCommercialTemplates({ userId: 'u', rol: 'ventas', activo: true })).toBe(false);
  });
});
