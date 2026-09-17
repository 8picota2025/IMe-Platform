/**
 * Service worker del sitio público I-ME.
 * Solo gestiona GET same-origin de rutas de catálogo/home.
 * Nunca intercepta APIs externas (Supabase, analytics, etc.) —
 * un SW que hace respondWith de cross-origin provoca "Failed to fetch"
 * en el cliente cuando el fetch interno falla o la respuesta CORS se corrompe.
 */
/** Bump al desplegar cliente asesor (poll); fuerza purga en móvil/PWA. */
const CACHE = 'ime-v5';
const SHELL_URLS = ['/es/', '/es/catalogo/'];

function isCacheableGet(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/comercial')) return false;
  if (url.pathname.startsWith('/admin')) return false;
  return (
    url.pathname === '/' ||
    url.pathname.startsWith('/es/') ||
    url.pathname.startsWith('/en/') ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/assets/')
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names => Promise.all(names.map(name => (name !== CACHE ? caches.delete(name) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!isCacheableGet(event.request, url)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      })
  );
});
