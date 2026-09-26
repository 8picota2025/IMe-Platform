import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCampaignLanding, listCampaignLandingIds } from '../data/comercial-landings';
import {
  CAMPOS_BLOQUEADOS,
  copyEditableDesdeTs,
  getCampaignLandingCms,
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
