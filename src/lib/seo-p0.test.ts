import { describe, expect, it } from 'vitest';
import { buildPageTitle, buildHomeSeo, buildServiciosSeo } from './seo';
import { getCampaignLanding, listCampaignLandings } from '../data/comercial-landings';

describe('SEO P0', () => {
  it('does not double brand suffix', () => {
    expect(buildPageTitle('Equipos de movilidad y rehabilitación | I-ME')).toBe(
      'Equipos de movilidad y rehabilitación | I-ME'
    );
    expect(buildPageTitle('Caminadores para adultos')).toBe('Caminadores para adultos | I-ME');
  });

  it('home title is brand-first', () => {
    expect(buildHomeSeo('es').title.startsWith('I-ME |')).toBe(true);
    expect(buildHomeSeo('en').title.startsWith('I-ME |')).toBe(true);
  });

  it('new landings registered', () => {
    const ids = listCampaignLandings('es').map(landing => landing.id);
    expect(ids).toContain('caminadores_adultos');
    expect(ids).toContain('sillas_ruedas');
    expect(ids).toContain('monitores_biolight');
    const caminadores = getCampaignLanding('caminadores_adultos', 'es');
    expect(caminadores.path).toBe('/es/caminadores-para-adultos/');
    expect(caminadores.productSlugs.length).toBeGreaterThan(0);
    const monitores = getCampaignLanding('monitores_biolight', 'es');
    expect(monitores.path).toBe('/es/monitores-biolight-uci/');
    expect(monitores.productSlugs).toContain(
      'monitor-de-paciente-modular-serie-p-ref-p15-biolight'
    );
  });

  it('EN services targets GSC B2B queries', () => {
    const en = buildServiciosSeo('en');
    expect(en.description.toLowerCase()).toContain('renewal');
    expect(en.description.toLowerCase()).toContain('leading');
  });
});
