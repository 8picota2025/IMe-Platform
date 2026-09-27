import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCampaignLanding, listCampaignLandingIds } from '../data/comercial-landings';
import { getFabricanteLanding, listFabricanteLandingIds } from '../data/fabricante-landings';
import { CITY_LANDINGS, getCityLanding } from '../data/city-landings';
import { FAMILIA_SEO, getFamiliaSeo } from '../data/familia-seo';
import {
  CAMPOS_BLOQUEADOS,
  copyEditableDesdeTs,
  getCampaignLandingCms,
  copyCiudadDesdeTs,
  copyFamiliaDesdeTs,
  getCityLandingCms,
  getFabricanteLandingCms,
  getFamiliaSeoCms,
  indexarFilas,
  mezclarCiudad,
  mezclarFamilia,
  validarParIdiomas,
  validarCopyLanding,
  indexarFilasCampana,
  mezclarLandingCampana,
  validarCopyCampana,
} from './landings-cms';

const LOCALES = ['es', 'en'] as const;

describe('esquema de campos editables', () => {
  it('cada landing de campaña del código es válida en ES y EN (el esquema cubre todos sus campos)', () => {
    for (const id of listCampaignLandingIds()) {
      for (const locale of LOCALES) {
        const copy = copyEditableDesdeTs(getCampaignLanding(id, locale));
        expect(validarCopyCampana(copy), `${id} (${locale})`).toEqual([]);
      }
    }
  });

  it('paridad: rehacer la landing desde su copy editable da el mismo objeto', () => {
    for (const id of listCampaignLandingIds()) {
      for (const locale of LOCALES) {
        const base = getCampaignLanding(id, locale);
        // Ida y vuelta por JSON, como jsonb en Postgres.
        const copy = JSON.parse(JSON.stringify(copyEditableDesdeTs(base)));
        expect(mezclarLandingCampana(base, copy), `${id} (${locale})`).toEqual(base);
      }
    }
  });

  it('el copy editable no lleva rutas, productos ni identidad', () => {
    const copy = copyEditableDesdeTs(getCampaignLanding('dotacion_monitoreo_uci', 'es'));
    for (const clave of CAMPOS_BLOQUEADOS) expect(copy).not.toHaveProperty(clave);
  });

  it('los campos bloqueados salen siempre del código aunque la fila los traiga', () => {
    const base = getCampaignLanding('monitores_biolight', 'es');
    const copy = { ...copyEditableDesdeTs(base), path: '/es/otra-ruta/', h1: 'Nuevo titular' };
    const mezclada = mezclarLandingCampana(base, copy);
    expect(mezclada.path).toBe(base.path);
    expect(mezclada.productSlugs).toEqual(base.productSlugs);
    expect(mezclada.h1).toBe('Nuevo titular');
  });
});

describe('validarCopyCampana', () => {
  const valido = () => copyEditableDesdeTs(getCampaignLanding('dotacion_monitoreo_uci', 'es'));

  it('señala obligatorios vacíos, tipos erróneos y campos desconocidos', () => {
    const copy = { ...valido(), h1: '  ', scope: [], heroImageWidth: -3, inventado: 'x' };
    const errores = validarCopyCampana(copy);
    expect(errores).toContain('h1: debe ser texto no vacío');
    expect(errores).toContain('scope: debe ser una lista de textos no vacía');
    expect(errores).toContain('heroImageWidth: debe ser un entero positivo');
    expect(errores).toContain('inventado: campo desconocido o no editable');
  });

  it('señala subcampos vacíos con su ruta', () => {
    const copy = valido();
    (copy['faqs'] as Array<{ q: string; a: string }>)[1]!.a = '';
    expect(validarCopyCampana(copy)).toContain('faqs[1].a: obligatorio');
  });

  it('los opcionales pueden faltar', () => {
    const copy = valido();
    delete copy['leadMagnet'];
    delete copy['relatedGuides'];
    delete copy['heroImageWidth'];
    expect(validarCopyCampana(copy)).toEqual([]);
  });
});

describe('indexarFilasCampana', () => {
  const copyDe = (id: 'monitores_biolight', locale: 'es' | 'en') =>
    copyEditableDesdeTs(getCampaignLanding(id, locale));
  const fila = (clave: string, contenido_es: unknown) => ({
    tipo: 'campana' as const,
    clave,
    contenido_es,
    contenido_en: copyDe('monitores_biolight', 'en'),
  });

  it('acepta filas válidas', () => {
    const mapa = indexarFilasCampana([
      fila('monitores_biolight', copyDe('monitores_biolight', 'es')),
    ]);
    expect(mapa.has('monitores_biolight')).toBe(true);
  });

  it('rompe con el detalle si una fila no cumple o no existe en el código', () => {
    expect(() => indexarFilasCampana([fila('monitores_biolight', { h1: 'sólo titular' })])).toThrow(
      /monitores_biolight» \(es\): tag: obligatorio/
    );
    expect(() =>
      indexarFilasCampana([fila('landing_inventada', copyDe('monitores_biolight', 'es'))])
    ).toThrow(/landing_inventada»: no existe en el código/);
  });
});

describe('getCampaignLandingCms', () => {
  it('sin Supabase configurado devuelve la landing del código', async () => {
    const cms = await getCampaignLandingCms('esterilizacion', 'es');
    expect(cms).toEqual(getCampaignLanding('esterilizacion', 'es'));
  });
});

describe('seed de la tanda 1', () => {
  it('coincide con el copy del código: desde la tanda 1 el texto se edita en el CMS, no aquí', () => {
    const sql = readFileSync(
      new URL(
        '../../supabase/migrations/20260926200100_seed_landings_campana.sql',
        import.meta.url
      ),
      'utf8'
    );
    const filas = [
      ...sql.matchAll(
        /\('campana', '([a-z_]+)', \$ime_landing\$(.*?)\$ime_landing\$::jsonb, \$ime_landing\$(.*?)\$ime_landing\$::jsonb\)/g
      ),
    ];
    expect(filas.map(f => f[1]).sort()).toEqual([...listCampaignLandingIds()].sort());
    for (const [, clave, es, en] of filas) {
      const id = clave as ReturnType<typeof listCampaignLandingIds>[number];
      // Si esto falla, alguien cambió el copy en comercial-landings.ts: en producción manda
      // la tabla landings, así que ese cambio no se vería. Hazlo en admin → Landings.
      expect(JSON.parse(es!), `${clave} (es)`).toEqual(
        copyEditableDesdeTs(getCampaignLanding(id, 'es'))
      );
      expect(JSON.parse(en!), `${clave} (en)`).toEqual(
        copyEditableDesdeTs(getCampaignLanding(id, 'en'))
      );
    }
  });
});

describe('tanda 2: landings de fabricante', () => {
  it('cada landing de fabricante es válida y sale idéntica tras el paso por jsonb', () => {
    for (const id of listFabricanteLandingIds()) {
      for (const locale of LOCALES) {
        const base = getFabricanteLanding(id, locale);
        const copy = JSON.parse(JSON.stringify(copyEditableDesdeTs(base)));
        expect(validarCopyLanding(copy, 'fabricante'), `${id} (${locale})`).toEqual([]);
        expect(mezclarLandingCampana(base, copy), `${id} (${locale})`).toEqual(base);
      }
    }
  });

  it('en fabricante la marca es obligatoria y los productos no', () => {
    const copy = copyEditableDesdeTs(getFabricanteLanding('fab_tuttnauer', 'es'));
    delete copy['brandName'];
    expect(validarCopyLanding(copy, 'fabricante')).toContain('brandName: obligatorio');
    expect(
      validarCopyLanding({ ...copy, brandName: 'X', productsTitle: '' }, 'fabricante')
    ).toEqual([]);
  });

  it('no mezcla tipos: una fila de fabricante no vale como campaña', () => {
    const fila = {
      tipo: 'fabricante' as const,
      clave: 'fab_tuttnauer',
      contenido_es: copyEditableDesdeTs(getFabricanteLanding('fab_tuttnauer', 'es')),
      contenido_en: copyEditableDesdeTs(getFabricanteLanding('fab_tuttnauer', 'en')),
    };
    expect(indexarFilas('fabricante', [fila]).has('fab_tuttnauer')).toBe(true);
    expect(indexarFilas('campana', [fila]).size).toBe(0);
  });

  it('sin Supabase configurado devuelve la landing del código', async () => {
    expect(await getFabricanteLandingCms('fab_saikang', 'en')).toEqual(
      getFabricanteLanding('fab_saikang', 'en')
    );
  });

  it('el seed coincide con el copy del código (desde la tanda 2 se edita en el CMS)', () => {
    const sql = readFileSync(
      new URL(
        '../../supabase/migrations/20260926230000_seed_landings_fabricante.sql',
        import.meta.url
      ),
      'utf8'
    );
    const filas = [
      ...sql.matchAll(
        /\('fabricante', '([a-z_]+)', \$ime_landing\$(.*?)\$ime_landing\$::jsonb, \$ime_landing\$(.*?)\$ime_landing\$::jsonb\)/g
      ),
    ];
    expect(filas.map(f => f[1]).sort()).toEqual([...listFabricanteLandingIds()].sort());
    for (const [, clave, es, en] of filas) {
      const id = clave as ReturnType<typeof listFabricanteLandingIds>[number];
      expect(JSON.parse(es!), `${clave} (es)`).toEqual(
        copyEditableDesdeTs(getFabricanteLanding(id, 'es'))
      );
      expect(JSON.parse(en!), `${clave} (en)`).toEqual(
        copyEditableDesdeTs(getFabricanteLanding(id, 'en'))
      );
    }
  });
});

const viaJsonb = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function filasDelSeed(archivo: string, tipo: string): Array<[string, unknown, unknown]> {
  const sql = readFileSync(
    new URL(`../../supabase/migrations/${archivo}`, import.meta.url),
    'utf8'
  );
  const re = new RegExp(
    `\\('${tipo}', '([a-z0-9_-]+)', \\$ime_landing\\$(.*?)\\$ime_landing\\$::jsonb, \\$ime_landing\\$(.*?)\\$ime_landing\\$::jsonb\\)`,
    'g'
  );
  return [...sql.matchAll(re)].map(m => [m[1]!, JSON.parse(m[2]!), JSON.parse(m[3]!)]);
}

describe('tanda 3: ciudades', () => {
  it('cada ciudad es válida y sale idéntica tras el paso por jsonb', () => {
    for (const city of CITY_LANDINGS) {
      const es = viaJsonb(copyCiudadDesdeTs(city, 'es'));
      const en = viaJsonb(copyCiudadDesdeTs(city, 'en'));
      expect(validarCopyLanding(es, 'ciudad'), city.slug).toEqual([]);
      expect(validarCopyLanding(en, 'ciudad'), city.slug).toEqual([]);
      expect(mezclarCiudad(city, es, en), city.slug).toEqual(city);
    }
  });

  it('el seed coincide con el código', () => {
    const filas = filasDelSeed('20260927020000_seed_landings_ciudad.sql', 'ciudad');
    expect(filas).toHaveLength(CITY_LANDINGS.length);
    for (const [slug, es, en] of filas) {
      const city = getCityLanding(slug)!;
      expect(es, slug).toEqual(copyCiudadDesdeTs(city, 'es'));
      expect(en, slug).toEqual(copyCiudadDesdeTs(city, 'en'));
    }
  });

  it('sin Supabase configurado devuelve la ciudad del código', async () => {
    expect(await getCityLandingCms('medellin')).toEqual(getCityLanding('medellin'));
    expect(await getCityLandingCms('no-existe')).toBeUndefined();
  });
});

describe('tanda 3: familias', () => {
  it('cada familia es válida y sale idéntica tras el paso por jsonb', () => {
    for (const familia of FAMILIA_SEO) {
      const es = viaJsonb(copyFamiliaDesdeTs(familia, 'es'));
      const en = viaJsonb(copyFamiliaDesdeTs(familia, 'en'));
      expect(validarCopyLanding(es, 'familia'), familia.slug).toEqual([]);
      expect(validarCopyLanding(en, 'familia'), familia.slug).toEqual([]);
      expect(validarParIdiomas('familia', es, en), familia.slug).toEqual([]);
      expect(mezclarFamilia(familia, es, en), familia.slug).toEqual(familia);
    }
  });

  it('las FAQ de ES y EN deben tener el mismo número de preguntas', () => {
    const familia = FAMILIA_SEO.find(f => f.faq.length > 1)!;
    const es = copyFamiliaDesdeTs(familia, 'es');
    const en = copyFamiliaDesdeTs(familia, 'en');
    (en['faq'] as unknown[]).pop();
    expect(validarParIdiomas('familia', es, en)[0]).toMatch(/deben coincidir/);
    expect(() =>
      indexarFilas('familia', [
        { tipo: 'familia', clave: familia.slug, contenido_es: es, contenido_en: en },
      ])
    ).toThrow(/deben coincidir/);
  });

  it('el seed coincide con el código', () => {
    const filas = filasDelSeed('20260927020100_seed_landings_familia.sql', 'familia');
    expect(filas).toHaveLength(FAMILIA_SEO.length);
    for (const [slug, es, en] of filas) {
      const familia = getFamiliaSeo(slug)!;
      expect(es, slug).toEqual(copyFamiliaDesdeTs(familia, 'es'));
      expect(en, slug).toEqual(copyFamiliaDesdeTs(familia, 'en'));
    }
  });

  it('sin Supabase configurado devuelve la familia del código', async () => {
    const slug = FAMILIA_SEO[0]!.slug;
    expect(await getFamiliaSeoCms(slug)).toEqual(getFamiliaSeo(slug));
  });
});
