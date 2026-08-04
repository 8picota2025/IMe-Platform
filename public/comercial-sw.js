/**
 * Service worker mínimo para el shell offline de /comercial/.
 * Cachea shell + bundles Astro same-origin. Nunca intercepta Supabase
 * ni otras APIs cross-origin.
 */
const CACHE = 'ime-comercial-v4';
const SHELL_URLS = ['/comercial/', '/manifest-comercial.json'];

function shouldHandle(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  // Scope de registro = /comercial/ — rutas bajo ese prefijo + assets del bundle.
  return (
    url.pathname.startsWith('/comercial') ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname === '/manifest-comercial.json' ||
    url.pathname === '/comercial-sw.js'
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
  if (!shouldHandle(event.request, url)) return;

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
        return cached || caches.match('/comercial/') || Response.error();
      })
  );
});
