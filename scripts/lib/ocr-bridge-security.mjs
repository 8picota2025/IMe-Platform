/**
 * Auth + image_url guards for the local OCR bridge (Cloudflare-tunneled).
 * Fail closed: empty secret rejects; image_url must be https on allowlisted hosts.
 */

/**
 * @param {string} secret
 * @param {string | undefined | null} authorizationHeader
 */
export function isBridgeAuthorized(secret, authorizationHeader) {
  const expected = typeof secret === 'string' ? secret.trim() : '';
  if (!expected) return false;
  const header = typeof authorizationHeader === 'string' ? authorizationHeader : '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return Boolean(token) && token === expected;
}

/**
 * @param {string | undefined | null} supabaseUrl
 * @param {string | undefined | null} extraHostsCsv
 * @returns {string[]}
 */
export function resolveAllowedImageHosts(supabaseUrl, extraHostsCsv) {
  const hosts = new Set();
  const add = value => {
    const host = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      ?.split(':')[0];
    if (host) hosts.add(host);
  };

  add(supabaseUrl);
  for (const part of String(extraHostsCsv ?? '').split(',')) add(part);

  // Default Supabase Storage hosts when SUPABASE_URL is unset in the bridge process.
  if (hosts.size === 0) {
    hosts.add('supabase.co');
  }
  return [...hosts];
}

/**
 * @param {string} hostname
 * @param {string[]} allowedHosts
 */
export function hostAllowed(hostname, allowedHosts) {
  const host = String(hostname ?? '')
    .trim()
    .toLowerCase();
  if (!host) return false;
  return allowedHosts.some(allowed => {
    const needle = String(allowed ?? '')
      .trim()
      .toLowerCase();
    if (!needle) return false;
    return host === needle || host.endsWith(`.${needle}`);
  });
}

/**
 * @param {string} imageUrl
 * @param {string[]} allowedHosts
 * @returns {{ ok: true, url: URL } | { ok: false, error: string }}
 */
export function assertSafeImageUrl(imageUrl, allowedHosts) {
  let parsed;
  try {
    parsed = new URL(String(imageUrl ?? '').trim());
  } catch {
    return { ok: false, error: 'image_url invalida' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'image_url debe ser https' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'image_url no puede incluir credenciales' };
  }
  if (!hostAllowed(parsed.hostname, allowedHosts)) {
    return { ok: false, error: 'image_url host no permitido' };
  }
  // Storage signed objects only — blocks random HTTPS SSRF on allowlisted apex.
  if (!parsed.pathname.includes('/storage/')) {
    return { ok: false, error: 'image_url debe apuntar a Storage firmado' };
  }
  return { ok: true, url: parsed };
}
