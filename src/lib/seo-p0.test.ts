import { describe, expect, it } from 'vitest';
import { buildPageTitle, buildHomeSeo } from './src/lib/seo';
import { getCampaignLanding, listCampaignLandings } from './src/data/comercial-landings';

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
    const ids = listCampaignLandings('es').map(l => l.id);
    expect(ids).toContain('caminadores_adultos');
    expect(ids).toContain('sillas_ruedas');
    const caminadores = getCampaignLanding('caminadores_adultos', 'es');
    expect(caminadores.path).toBe('/es/caminadores-para-adultos/');
    expect(caminadores.productSlugs.length).toBeGreaterThan(0);
  });
});
