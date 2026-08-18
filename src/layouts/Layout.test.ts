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

  it('does not hard-block event registration when Turnstile never issues a token', () => {
    expect(eventPageSource).toContain('waitForTurnstileToken');
    expect(eventPageSource).toContain('Challenge 600* no bloquea el registro');
    expect(eventPageSource).not.toContain('Completa la verificación de seguridad.');
  });
});
