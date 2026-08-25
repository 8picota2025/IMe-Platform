// PWA aislada: solo recursos same-origin dentro de /mkt/ y bundles Astro.
const CACHE = 'ime-mkt-v1';
const SHELL = ['/mkt/', '/manifest-mkt.json'];
self.addEventListener('install', event =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
);
self.addEventListener('activate', event =>
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.map(key =>
            key.startsWith('ime-mkt-') && key !== CACHE ? caches.delete(key) : undefined
          )
        )
      )
      .then(() => self.clients.claim())
  )
);
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== location.origin ||
    !(
      url.pathname.startsWith('/mkt/') ||
      url.pathname.startsWith('/_astro/') ||
      url.pathname === '/manifest-mkt.json'
    )
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && response.type === 'basic')
          void caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/mkt/')))
  );
});
