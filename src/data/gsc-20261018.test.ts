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
