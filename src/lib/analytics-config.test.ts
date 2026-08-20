import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_COOKIE_DOMAIN,
  GA4_MEASUREMENT_ID,
  SEARCH_CONSOLE_SITEMAP,
  resolveAnalyticsDomain,
  resolveGaId,
  resolveSearchConsoleHtmlFile,
  resolveSearchConsoleVerification,
} from './analytics-config';

const analyticsHead = readFileSync(
  new URL('../components/AnalyticsHead.astro', import.meta.url),
  'utf8'
);
const baseHead = readFileSync(new URL('../components/BaseHead.astro', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../layouts/Layout.astro', import.meta.url), 'utf8');

describe('analytics-config', () => {
  it('keeps the production GA4 stream id', () => {
    expect(GA4_MEASUREMENT_ID).toBe('G-YKKFCZHE2N');
    expect(ANALYTICS_COOKIE_DOMAIN).toBe('i-me.com.co');
    expect(SEARCH_CONSOLE_SITEMAP).toBe('https://i-me.com.co/sitemap-index.xml');
  });

  it('prefers an explicit GA4 env id', () => {
    expect(resolveGaId(' G-TEST123 ')).toBe('G-TEST123');
  });

  it('falls back to production GA4 only in prod builds', () => {
    const resolved = resolveGaId('');
    if (import.meta.env.PROD) {
      expect(resolved).toBe(GA4_MEASUREMENT_ID);
    } else {
      expect(resolved).toBe('');
    }
  });

  it('accepts only Google HTML verification filenames', () => {
    expect(resolveSearchConsoleHtmlFile('googleabc123.html')).toBe('googleabc123.html');
    expect(resolveSearchConsoleHtmlFile('index.html')).toBe('');
    expect(resolveSearchConsoleHtmlFile('../secret.html')).toBe('');
  });

  it('trims Search Console meta tokens', () => {
    expect(resolveSearchConsoleVerification('  token-1  ')).toBe('token-1');
    expect(resolveSearchConsoleVerification('')).toBe('');
  });

  it('defaults cookie domain to i-me.com.co', () => {
    expect(resolveAnalyticsDomain('')).toBe('i-me.com.co');
    expect(resolveAnalyticsDomain('auto')).toBe('auto');
  });
});

describe('analytics head wiring', () => {
  it('loads GA4, Search Console meta and the client tracker from Layout', () => {
    expect(layout).toContain('AnalyticsHead');
    expect(analyticsHead).toContain('resolveGaId');
    expect(analyticsHead).toContain('googletagmanager.com/gtag/js');
    expect(baseHead).toContain('google-site-verification');
    expect(baseHead).toContain('resolveSearchConsoleVerification');
  });
});
