import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(new URL('./Layout.astro', import.meta.url), 'utf8');
const eventPageSource = readFileSync(new URL('../pages/evento.astro', import.meta.url), 'utf8');

describe('event layout', () => {
  it('opts out of the global quote request modal without changing its default', () => {
    expect(layoutSource).toContain('showQuoteRequest?: boolean;');
    expect(layoutSource).toContain('showQuoteRequest = true');
    expect(layoutSource).toContain('{showQuoteRequest && <QuoteRequestModal locale={locale} />}');
    expect(eventPageSource).toContain('showQuoteRequest={false}');
  });
});
