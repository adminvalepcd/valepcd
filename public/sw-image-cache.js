const CACHE_NAME = 'multei-images-cache-v1';
const MAX_CACHED_IMAGES = 300;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith('multei-images-cache-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      } catch {}
      await self.clients.claim();
    })()
  );
});

function isFirebaseStorageImageRequest(request) {
  if (!request || request.method !== 'GET') return false;
  try {
    const url = new URL(request.url);
    return (
      url.hostname.includes('firebasestorage.googleapis.com') ||
      url.hostname.includes('.firebasestorage.app')
    );
  } catch {
    return false;
  }
}

async function trimImageCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length > MAX_CACHED_IMAGES) {
      const toDelete = keys.slice(0, keys.length - MAX_CACHED_IMAGES);
      await Promise.all(toDelete.map((req) => cache.delete(req)));
    }
  } catch {}
}

self.addEventListener('fetch', (event) => {
  if (!isFirebaseStorageImageRequest(event.request)) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request, { ignoreVary: true });
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          try {
            await cache.put(event.request, networkResponse.clone());
            trimImageCache(cache);
          } catch {}
        }
        return networkResponse;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const fallback = await cache.match(event.request, { ignoreVary: true });
        if (fallback) return fallback;
        throw err;
      }
    })()
  );
});
