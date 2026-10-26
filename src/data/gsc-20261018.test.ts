import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getFamiliaSeo } from './familia-seo';
import { getProductoSeoCopy } from './producto-seo-copy';
import { TEMAS_CONOCIMIENTO } from './temas-conocimiento';
import { buildPageTitle } from '../lib/seo';

describe('GSC 10–16 oct 2026', () => {
  it('la guía INVIMA abre con la consulta y no inventa registros', () => {
    const tema = TEMAS_CONOCIMIENTO['invima-regulacion'];
    expect(tema).toBeDefined();
    expect(tema!.es).toEqual({
      nombre: 'INVIMA: registro sanitario de dispositivos médicos',
      intro:
        'Cómo consultar registros INVIMA y planificar el registro sanitario de dispositivos médicos en Colombia (Decreto 4725 de 2005): requisitos y tarifas. I-ME.',
    });
    expect(tema!.en).toEqual({
      nombre: 'INVIMA: Medical Device Registration in Colombia',
      intro:
        'How to check INVIMA registrations and plan medical device registration in Colombia (Decree 4725 of 2005): requirements, fees and phases. Contact I-ME.',
    });
    expect(tema!.es.intro).toHaveLength(154);
    expect(tema!.en.intro).toHaveLength(150);
    expect(buildPageTitle(tema!.es.nombre)).toBe(
      'INVIMA: registro sanitario de dispositivos médicos | I-ME'
    );
    expect(buildPageTitle(tema!.es.nombre)).toHaveLength(57);
    expect(buildPageTitle(tema!.en.nombre)).toBe(
      'INVIMA: Medical Device Registration in Colombia | I-ME'
    );
    expect(buildPageTitle(tema!.en.nombre)).toHaveLength(54);
    for (const locale of ['es', 'en'] as const) {
      const copy = tema![locale];
      expect(copy.nombre.startsWith('INVIMA:')).toBe(true);
      expect(copy.intro).toContain(locale === 'es' ? 'Decreto 4725' : 'Decree 4725');
      expect(copy.intro.length).toBeLessThanOrEqual(160);
      expect(copy.intro).not.toMatch(/registro\s+sanitario\s+n[.ºo]/i);
      const title = buildPageTitle(copy.nombre);
      expect(title.startsWith('INVIMA:')).toBe(true);
      expect(title.endsWith('| I-ME')).toBe(true);
      expect(title.length).toBeLessThanOrEqual(70);
    }
  });

  it('monitores recupera el title de Biolight y conserva S12 y M12', () => {
    const familia = getFamiliaSeo('monitores');
    expect(familia).toBeDefined();
    expect(familia!.title_en).toBe('Biolight S12/M12 & ICU multiparameter monitors | I-ME');
    expect(familia!.name_en).toBe('Patient monitors');
    expect(familia!.title_es).toContain('S12/M12');
    expect(familia!.body_en.join(' ')).toContain('S12');
    expect(familia!.body_en.join(' ')).toContain('M12');
    expect(familia!.relatedSlugs).toEqual(
      expect.arrayContaining([
        'monitor-de-paciente-ref-s12-biolight',
        'monitor-de-paciente-ref-m12-biolight',
      ])
    );
    expect(familia!.body_en.join(' ')).not.toContain('P15');
  });

  it('S12 y KBE-9000D tienen title y meta de cotización, sin promesa clínica', () => {
    const slugs = [
      'monitor-de-paciente-ref-s12-biolight',
      'silla-de-ruedas-estandar-con-rin-estrella-kp-ref-kbe-9000d',
    ];
    for (const slug of slugs) {
      for (const locale of ['es', 'en'] as const) {
        const copy = getProductoSeoCopy(slug, locale);
        expect(copy, slug).toBeDefined();
        expect(copy!.title.length).toBeLessThanOrEqual(60);
        expect(copy!.description.length).toBeLessThanOrEqual(155);
        expect(copy!.description).not.toMatch(/…|\.\.\./);
        expect(copy!.title.toLowerCase()).toContain('colombia');
        expect(copy!.description.toLowerCase()).toContain('whatsapp');
        expect(copy!.description.toLowerCase()).not.toMatch(
          /clínic|clinic|diagnóst|iot|confiable|reliable/
        );
      }
    }
    const s12 = getProductoSeoCopy('monitor-de-paciente-ref-s12-biolight', 'en');
    const kbe = getProductoSeoCopy(
      'silla-de-ruedas-estandar-con-rin-estrella-kp-ref-kbe-9000d',
      'es'
    );
    expect(s12?.title).toContain('S12');
    expect(s12?.title.toLowerCase()).not.toContain('quote');
    expect(kbe?.title).toContain('KBE-9000D');
  });

  it('la variante sin barra de INVIMA y de /es redirige a la URL con barra', () => {
    const htaccess = readFileSync('public/.htaccess', 'utf8');
    expect(htaccess).toContain(
      'RewriteRule ^en/knowledge/topic/invima-regulacion$ /en/knowledge/topic/invima-regulacion/ [R=301,L]'
    );
    expect(htaccess).toContain(
      'RewriteRule ^es/conocimiento/tema/invima-regulacion$ /es/conocimiento/tema/invima-regulacion/ [R=301,L]'
    );
    expect(htaccess).toContain('RewriteRule ^es$ /es/ [R=301,L]');
  });
});
