import { describe, expect, it } from 'vitest';
import { listCampaignLandings } from './comercial-landings';
import { listCampaignLandingRevision } from './comercial-landings-revision';

describe('índice de revisión de landings', () => {
  it('coincide con id, ruta, h1 y slugs de las campañas en español', () => {
    expect(listCampaignLandingRevision()).toEqual(
      listCampaignLandings('es').map(landing => ({
        id: landing.id,
        path: landing.path,
        h1: landing.h1,
        productSlugs: landing.productSlugs,
      }))
    );
  });
});
