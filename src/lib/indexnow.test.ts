import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INDEXNOW_PRIORITY_PATHS,
  assertIndexNowKey,
  buildIndexNowPayload,
} from '../../scripts/indexnow-lib.mjs';

describe('IndexNow', () => {
  it('arma el ping con la clave pública y la guía EN de tensiómetros', () => {
    const key = readFileSync(
      join(process.cwd(), 'public/.well-known/indexnow-key.txt'),
      'utf8'
    ).trim();
    const root = readFileSync(join(process.cwd(), 'public', `${key}.txt`), 'utf8').trim();
    expect(root).toBe(key);
    const payload = buildIndexNowPayload(key, INDEXNOW_PRIORITY_PATHS);
    expect(payload.host).toBe('i-me.com.co');
    expect(payload.keyLocation).toBe(`https://i-me.com.co/${key}.txt`);
    expect(payload.urlList).toContain(
      'https://i-me.com.co/en/knowledge/como-elegir-tensiometro-digital/'
    );
    expect(payload.urlList).toContain('https://i-me.com.co/llms.txt');
    expect(payload.urlList.some((url: string) => url.includes('como-elegir-cama'))).toBe(false);
  });

  it('rechaza una clave que no es hexadecimal', () => {
    expect(() => assertIndexNowKey('no-es-hex')).toThrow(/IndexNow/);
  });

  it('el CLI con --send no llama a producción si INDEXNOW_SEND no es 1', () => {
    const result = spawnSync(process.execPath, ['scripts/indexnow-ping.mjs', '--send'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, INDEXNOW_SEND: '' },
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/INDEXNOW_SEND/);
    expect(`${result.stdout}\n${result.stderr}`).toContain('dry-run');
  });
});
