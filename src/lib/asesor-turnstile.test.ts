import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  ASESOR_TURNSTILE_APPEARANCE,
  ASESOR_TURNSTILE_NORMAL_MIN_WIDTH_PX,
  ASESOR_TURNSTILE_SCRIPT_SRC,
  ASESOR_TURNSTILE_TOKEN_WAIT_MS,
  buildAsesorTurnstileRenderOptions,
  containerHasTurnstileIframe,
  isUnrecoverableTurnstileError,
  mapAsesorTurnstileClientFailure,
  obtainAsesorTurnstileToken,
  resolveAsesorTurnstileSize,
  shouldMarkTurnstilePending,
  turnstileMinHeightPx,
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
    expect(options.size).toBe('normal');
    expect(options.theme).toBe('light');
    expect(options.execution).toBe('render');
    expect(options.retry).toBe('auto');
    expect(ASESOR_TURNSTILE_SCRIPT_SRC).toContain('render=explicit');
    expect(ASESOR_TURNSTILE_TOKEN_WAIT_MS).toBeLessThanOrEqual(12_000);
    expect(ASESOR_TURNSTILE_TOKEN_WAIT_MS).toBeGreaterThanOrEqual(5_000);
  });

  it('elige compact bajo 300px y normal cuando cabe el checkbox', () => {
    expect(ASESOR_TURNSTILE_NORMAL_MIN_WIDTH_PX).toBe(300);
    expect(resolveAsesorTurnstileSize(272)).toBe('compact');
    expect(resolveAsesorTurnstileSize(299)).toBe('compact');
    expect(resolveAsesorTurnstileSize(300)).toBe('normal');
    expect(resolveAsesorTurnstileSize(360)).toBe('normal');
    expect(turnstileMinHeightPx('compact')).toBe(140);
    expect(turnstileMinHeightPx('normal')).toBe(65);
  });

  it('compact se pasa a las opciones de render', () => {
    const options = buildAsesorTurnstileRenderOptions(
      'site-key',
      {
        callback: () => undefined,
        'error-callback': () => undefined,
        'expired-callback': () => undefined,
      },
      { size: 'compact', language: 'es' }
    );
    expect(options.size).toBe('compact');
    expect(options.language).toBe('es');
  });

  it('marca el contenedor pendiente hasta que hay token', () => {
    expect(shouldMarkTurnstilePending({ siteKeyPresent: true, tokenReady: false })).toBe(true);
    expect(shouldMarkTurnstilePending({ siteKeyPresent: true, tokenReady: true })).toBe(false);
    expect(shouldMarkTurnstilePending({ siteKeyPresent: false, tokenReady: false })).toBe(false);
  });

  it('detecta iframe del widget y códigos irrecuperables', () => {
    expect(containerHasTurnstileIframe({ querySelector: () => ({}) })).toBe(true);
    expect(containerHasTurnstileIframe({ querySelector: () => null })).toBe(false);
    expect(isUnrecoverableTurnstileError('110200')).toBe(true);
    expect(isUnrecoverableTurnstileError('300010')).toBe(false);
    expect(mapAsesorTurnstileClientFailure({ tokenMissing: true })).toBe('verificacion');
    expect(mapAsesorTurnstileClientFailure({ iframeMissing: true })).toBe('verificacion');
    expect(mapAsesorTurnstileClientFailure({})).toBeNull();
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

  it('si no hay token no resetea el widget (evita el recuadro gris en móvil)', async () => {
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
    expect(resetWidget).not.toHaveBeenCalled();
    expect(waits).toEqual([30]);
    expect(setPending).toHaveBeenLastCalledWith(true);
  });

  it('falla rápido si el iframe nunca monta', async () => {
    const waitForToken = vi.fn();
    const token = await obtainAsesorTurnstileToken({
      siteKey: 'site-key',
      hasContainer: true,
      cachedToken: undefined,
      loadScript: async () => undefined,
      ensureWidget: async () => 'widget-1',
      waitForToken,
      resetWidget: vi.fn(),
      setPending: vi.fn(),
      iframeReady: () => false,
    });
    expect(token).toBeUndefined();
    expect(waitForToken).not.toHaveBeenCalled();
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

  it('Asesor.astro usa checkbox normal/compact, remount y no interaction-only', async () => {
    const source = await readFile(join(ROOT, 'components/Asesor.astro'), 'utf8');
    expect(source).toContain('buildAsesorTurnstileRenderOptions');
    expect(source).toContain('obtainAsesorTurnstileToken');
    expect(source).toContain('ASESOR_TURNSTILE_SCRIPT_SRC');
    expect(source).toContain('asesor-turnstile-wrap');
    expect(source).toContain('resolveAsesorTurnstileSize');
    expect(source).toContain('destroyTurnstileWidget');
    expect(source).toContain("tipo: 'verificacion'");
    expect(source).not.toContain('interaction-only');
    expect(source).not.toContain("size: 'flexible'");
    expect(source).not.toMatch(/asesor-turnstile iframe[\s\S]{0,80}max-width:\s*100%/);
    expect(source).toContain('void ensureTurnstileWidget()');
    expect(source).toContain('100dvh');
  });
});
