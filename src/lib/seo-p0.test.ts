import { describe, expect, it } from 'vitest';
import {
  buildPageTitle,
  buildHomeSeo,
  buildAboutSeo,
  buildServiciosSeo,
  buildOrganizationJsonLd,
} from './seo';
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
    expect(buildHomeSeo('es').description).toContain('i-me.com.co');
  });

  it('about/nosotros targets brand queries', () => {
    const es = buildAboutSeo('es');
    expect(es.title).toContain('i-me.com.co');
    expect(es.description.toLowerCase()).toContain('ime');
    const org = buildOrganizationJsonLd();
    expect(org.alternateName).toEqual(
      expect.arrayContaining(['i-me.com', 'i-me.com.co', 'IME', 'i.me.com'])
    );
  });

  it('new landings registered', () => {
    const ids = listCampaignLandings('es').map(landing => landing.id);
    expect(ids).toContain('caminadores_adultos');
    expect(ids).toContain('sillas_ruedas');
    expect(ids).toContain('monitores_biolight');
    expect(ids).toContain('alto_flujo_fisher_paykel');
    expect(ids).toContain('camillas_medicas');
    expect(ids).toContain('ventiladores_mecanicos');
    expect(ids).toContain('desfibriladores_hospital');
    const caminadores = getCampaignLanding('caminadores_adultos', 'es');
    expect(caminadores.path).toBe('/es/caminadores-para-adultos/');
    expect(caminadores.productSlugs.length).toBeGreaterThan(0);
    const monitores = getCampaignLanding('monitores_biolight', 'es');
    expect(monitores.path).toBe('/es/monitores-biolight-uci/');
    expect(monitores.productSlugs).toContain(
      'monitor-de-paciente-modular-serie-p-ref-p15-biolight'
    );
    const altoFlujo = getCampaignLanding('alto_flujo_fisher_paykel', 'es');
    expect(altoFlujo.path).toBe('/es/alto-flujo-fisher-paykel/');
    expect(altoFlujo.productSlugs).toContain('sistema-de-alto-flujo-ref-airvo-3-fisher-paykel');
    const camillas = getCampaignLanding('camillas_medicas', 'es');
    expect(camillas.path).toBe('/es/camillas-medicas/');
    expect(camillas.productSlugs).toContain('camilla-de-traslado-ref-skb041-6-saikang');
    const ventiladores = getCampaignLanding('ventiladores_mecanicos', 'es');
    expect(ventiladores.path).toBe('/es/ventiladores-mecanicos-uci/');
    expect(ventiladores.productSlugs).toContain(
      'ventilador-cuidado-intensivo-adulto-pediatrico-monnal-ref-t75-air-liquide'
    );
    const desfibriladores = getCampaignLanding('desfibriladores_hospital', 'es');
    expect(desfibriladores.path).toBe('/es/desfibriladores-hospitalarios/');
    expect(desfibriladores.productSlugs).toContain('desfibrilador-bifasico-con-monitor');
  });

  it('GSC landings use SEO hero images tied to content', () => {
    expect(getCampaignLanding('monitores_biolight', 'es').heroImage).toBe(
      '/assets/img/monitores-biolight-uci-es.webp'
    );
    expect(getCampaignLanding('monitores_biolight', 'en').heroImage).toBe(
      '/assets/img/biolight-icu-monitors-en.webp'
    );
    expect(getCampaignLanding('alto_flujo_fisher_paykel', 'es').heroImage).toBe(
      '/assets/img/alto-flujo-fisher-paykel-es.webp'
    );
    expect(getCampaignLanding('alto_flujo_fisher_paykel', 'en').heroImage).toBe(
      '/assets/img/fisher-paykel-high-flow-en.webp'
    );
    expect(getCampaignLanding('camillas_medicas', 'es').heroImage).toBe(
      '/assets/img/camillas-medicas-es.webp'
    );
    expect(getCampaignLanding('camillas_medicas', 'en').heroImage).toBe(
      '/assets/img/medical-stretchers-en.webp'
    );
    expect(getCampaignLanding('caminadores_adultos', 'es').heroImage).toBe(
      '/assets/img/caminadores-para-adultos-es.webp'
    );
    expect(getCampaignLanding('caminadores_adultos', 'en').heroImage).toBe(
      '/assets/img/adult-walkers-en.webp'
    );
    expect(getCampaignLanding('sillas_ruedas', 'es').heroImage).toBe(
      '/assets/img/sillas-de-ruedas-es.webp'
    );
    expect(getCampaignLanding('sillas_ruedas', 'en').heroImage).toBe(
      '/assets/img/wheelchairs-en.webp'
    );
    expect(getCampaignLanding('ventiladores_mecanicos', 'es').heroImage).toBe(
      '/assets/img/ventiladores-mecanicos-uci-es.webp'
    );
    expect(getCampaignLanding('ventiladores_mecanicos', 'en').heroImage).toBe(
      '/assets/img/mechanical-ventilators-icu-en.webp'
    );
    expect(getCampaignLanding('desfibriladores_hospital', 'es').heroImage).toBe(
      '/assets/img/desfibriladores-hospitalarios-es.webp'
    );
    expect(getCampaignLanding('desfibriladores_hospital', 'en').heroImage).toBe(
      '/assets/img/hospital-defibrillators-en.webp'
    );
  });

  it('EN services targets GSC B2B queries', () => {
    const en = buildServiciosSeo('en');
    expect(en.title.toLowerCase()).toContain('leading');
    expect(en.description.toLowerCase()).toContain('renewal');
    expect(en.description.toLowerCase()).toContain('health sector');
  });
});
