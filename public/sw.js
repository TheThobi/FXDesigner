// Offline support and instant reloads. Fingerprinted build files (assets/) never change:
// cache first. The page itself: network first (a deploy shows up at once), cache when
// offline. Other same-origin files: cached copy at once, refreshed in the background.
// The API is never cached.
const CACHE = 'fx-designer-v1';
/** Fingerprinted files kept (older builds are dropped beyond this). */
const MAX_ASSETS = 40;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length - 1);
  if (path.startsWith('/api/') || path === '/healthz') return;
  if (request.mode === 'navigate') event.respondWith(networkFirst(request));
  else if (path.startsWith('/assets/')) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(event, request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    // The page is cached under the scope URL whatever the query (share links, ?auth_error).
    if (response.ok) await cache.put(self.registration.scope, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(self.registration.scope);
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await pruneAssets(cache);
  }
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

/** Keys come back in insertion order: the oldest builds go first. */
async function pruneAssets(cache) {
  const assets = (await cache.keys()).filter((r) => new URL(r.url).pathname.includes('/assets/'));
  for (const old of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) {
    await cache.delete(old);
  }
}
