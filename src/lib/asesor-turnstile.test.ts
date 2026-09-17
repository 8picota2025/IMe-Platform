import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  ASESOR_TURNSTILE_APPEARANCE,
  ASESOR_TURNSTILE_SCRIPT_SRC,
  ASESOR_TURNSTILE_TOKEN_WAIT_MS,
  buildAsesorTurnstileRenderOptions,
  obtainAsesorTurnstileToken,
  shouldMarkTurnstilePending,
} from './asesor-turnstile';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('asesor Turnstile widget contract', () => {
  it('renderiza checkbox visible (appearance always) y script explicit', () => {
    const options = buildAsesorTurnstileRenderOptions('site-key', {
      callback: () => undefined,
      'error-callback': () => undefined,
      'expired-callback': () => undefined,
    });
    expect(options.appearance).toBe('always');
    expect(options.appearance).toBe(ASESOR_TURNSTILE_APPEARANCE);
    expect(options.size).toBe('flexible');
    expect(options.retry).toBe('auto');
    expect(ASESOR_TURNSTILE_SCRIPT_SRC).toContain('render=explicit');
    expect(ASESOR_TURNSTILE_TOKEN_WAIT_MS).toBeGreaterThanOrEqual(20_000);
  });

  it('marca el contenedor pendiente hasta que hay token', () => {
    expect(shouldMarkTurnstilePending({ siteKeyPresent: true, tokenReady: false })).toBe(true);
    expect(shouldMarkTurnstilePending({ siteKeyPresent: true, tokenReady: true })).toBe(false);
    expect(shouldMarkTurnstilePending({ siteKeyPresent: false, tokenReady: false })).toBe(false);
  });

  it('devuelve el token en cache sin esperar', async () => {
    const setPending = vi.fn();
    const waitForToken = vi.fn();
    const token = await obtainAsesorTurnstileToken({
      siteKey: 'site-key',
      hasContainer: true,
      cachedToken: 'cached-token',
      loadScript: async () => undefined,
      ensureWidget: async () => 'widget-1',
      waitForToken,
      resetWidget: vi.fn(),
      setPending,
    });
    expect(token).toBe('cached-token');
    expect(waitForToken).not.toHaveBeenCalled();
    expect(setPending).toHaveBeenCalledWith(true);
    expect(setPending).toHaveBeenLastCalledWith(false);
  });

  it('espera el checkbox y no cambia a interaction-only', async () => {
    const resetWidget = vi.fn();
    const token = await obtainAsesorTurnstileToken({
      siteKey: 'site-key',
      hasContainer: true,
      cachedToken: undefined,
      loadScript: async () => undefined,
      ensureWidget: async () => 'widget-1',
      waitForToken: async () => 'from-checkbox',
      resetWidget,
      setPending: vi.fn(),
      waitMs: 50,
      retryWaitMs: 50,
    });
    expect(token).toBe('from-checkbox');
    expect(resetWidget).not.toHaveBeenCalled();
  });

  it('tras un wait vacío hace reset y reintenta, dejando el widget visible si falla', async () => {
    const setPending = vi.fn();
    const resetWidget = vi.fn();
    const waits: number[] = [];
    const token = await obtainAsesorTurnstileToken({
      siteKey: 'site-key',
      hasContainer: true,
      cachedToken: undefined,
      loadScript: async () => undefined,
      ensureWidget: async () => 'widget-1',
      waitForToken: async ms => {
        waits.push(ms);
        return undefined;
      },
      resetWidget,
      setPending,
      waitMs: 30,
      retryWaitMs: 15,
    });
    expect(token).toBeUndefined();
    expect(resetWidget).toHaveBeenCalledWith('widget-1');
    expect(waits).toEqual([30, 15]);
    expect(setPending).toHaveBeenLastCalledWith(true);
  });

  it('sin site key no llama al script', async () => {
    const loadScript = vi.fn();
    const token = await obtainAsesorTurnstileToken({
      siteKey: '',
      hasContainer: true,
      cachedToken: undefined,
      loadScript,
      ensureWidget: async () => 'widget-1',
      waitForToken: async () => 'nope',
      resetWidget: vi.fn(),
      setPending: vi.fn(),
    });
    expect(token).toBeUndefined();
    expect(loadScript).not.toHaveBeenCalled();
  });

  it('Asesor.astro usa el contrato visible y no interaction-only', async () => {
    const source = await readFile(join(ROOT, 'components/Asesor.astro'), 'utf8');
    expect(source).toContain('buildAsesorTurnstileRenderOptions');
    expect(source).toContain('obtainAsesorTurnstileToken');
    expect(source).toContain('ASESOR_TURNSTILE_SCRIPT_SRC');
    expect(source).toContain('asesor-turnstile-wrap');
    expect(source).not.toContain('interaction-only');
    expect(source).toContain('void ensureTurnstileWidget()');
  });
});
