import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendVaryAccept,
  buildAgentReadyHtaccessRules,
  buildLlmsWhenToUseSection,
  buildNotFoundMarkdown,
  legalDocumentToMarkdown,
  pageToMarkdown,
  prefersMarkdown,
  productToMarkdown,
} from './agent-ready';

describe('agent-ready', () => {
  it('buildNotFoundMarkdown includes sitemap, llms.txt, and recovery links', () => {
    const md = buildNotFoundMarkdown('/es/no-existe/');
    expect(md).toContain('# Page not found (404)');
    expect(md).toContain('/es/no-existe/');
    expect(md).toContain('https://i-me.com.co/sitemap-index.xml');
    expect(md).toContain('https://i-me.com.co/llms.txt');
    expect(md).toContain('/es/catalogo/');
    expect(md).toContain('/en/catalog/');
    expect(md.length).toBeGreaterThan(200);
  });

  it('appendVaryAccept adds Accept without duplicating', () => {
    expect(appendVaryAccept(undefined)).toBe('Accept');
    expect(appendVaryAccept('Accept-Encoding')).toBe('Accept-Encoding, Accept');
    expect(appendVaryAccept('Accept, Accept-Encoding')).toBe('Accept, Accept-Encoding');
  });

  it('prefersMarkdown respects text/markdown and q=0', () => {
    expect(prefersMarkdown('text/html')).toBe(false);
    expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=0, text/html')).toBe(false);
  });

  it('productToMarkdown includes canonical and agent caution', () => {
    const md = productToMarkdown({
      nombre: 'Monitor Test',
      descripcion_corta: 'Short desc.',
      canonicalUrl: 'https://i-me.com.co/es/productos/monitor-test/',
      sku: 'SK-001',
      marca: 'Saikang',
      familia: 'Monitores',
    });
    expect(md).toContain('# Monitor Test');
    expect(md).toContain('Canonical: https://i-me.com.co/es/productos/monitor-test/');
    expect(md).toContain('confirmed with I-ME');
  });

  it('legalDocumentToMarkdown renders sections', () => {
    const md = legalDocumentToMarkdown(
      {
        heading: 'Privacy Policy',
        summary: 'Summary text.',
        updatedAt: 'Updated 2026-01-01',
        sections: [{ title: 'Scope', paragraphs: ['Paragraph one.'] }],
      },
      'https://i-me.com.co/privacy/'
    );
    expect(md).toContain('# Privacy Policy');
    expect(md).toContain('## Scope');
    expect(md).toContain('Paragraph one.');
    expect(md.length).toBeGreaterThan(100);
  });

  it('pageToMarkdown includes title and description', () => {
    const md = pageToMarkdown({
      title: 'About I-ME',
      description: 'Long institutional description for trust verification.',
      canonicalUrl: 'https://i-me.com.co/about/',
      body: 'Additional body copy for agents.',
    });
    expect(md).toContain('# About I-ME');
    expect(md).toContain('Additional body copy');
  });

  it('buildLlmsWhenToUseSection names concrete use cases', () => {
    const section = buildLlmsWhenToUseSection();
    expect(section).toContain('## When to use I-ME');
    expect(section).toContain('Procurement research');
    expect(section).toContain('Do **not** use');
    expect(section).toContain('Accept: text/markdown');
  });

  it('buildAgentReadyHtaccessRules includes Vary and markdown rewrite', () => {
    const rules = buildAgentReadyHtaccessRules();
    expect(rules).toContain('Header merge Vary Accept');
    expect(rules).toContain('text/markdown');
    expect(rules).toContain('index.md');
    expect(rules).toContain('ErrorDocument 404');
    expect(rules).not.toContain('^about/?$');
  });

  it('public llms.txt includes when-to-use section', () => {
    const llmsPath = join(process.cwd(), 'public', 'llms.txt');
    const llms = readFileSync(llmsPath, 'utf8');
    expect(llms).toContain('## When to use I-ME');
    expect(llms).toContain('Procurement research');
  });

  it('public .htaccess includes agent-ready block', () => {
    const htaccess = readFileSync(join(process.cwd(), 'public', '.htaccess'), 'utf8');
    expect(htaccess).toContain('Agent-ready: markdown negotiation');
    expect(htaccess).toContain('Header merge Vary Accept');
  });
});
