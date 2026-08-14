const SHELL_CACHE_PREFIX = 'pharmaerp-pos-shell-';
const SHELL_CACHE = `${SHELL_CACHE_PREFIX}v2`;
const SHELL_ENTRY = '/';
const STATIC_ASSET_DESTINATIONS = new Set(['script', 'style', 'font', 'image']);

async function cacheShell() {
  const response = await fetch(SHELL_ENTRY, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Shell fetch failed: ${response.status}`);
  }

  await updateShellFromResponse(response);
}

async function updateShellFromResponse(response) {
  const cache = await caches.open(SHELL_CACHE);
  const shellResponse = response.clone();

  await cache.put(SHELL_ENTRY, shellResponse.clone());
  await cache.put('/index.html', shellResponse.clone());

  const html = await shellResponse.text();
  const assetPaths = Array.from(
    html.matchAll(/(?:src|href)=["']([^"'#?]+\.(?:js|css|woff2?|png|svg|ico|webmanifest))["']/gi),
    (match) => match[1],
  );

  const uniqueAssets = Array.from(new Set(['/manifest.webmanifest', ...assetPaths]))
    .filter((assetPath) => assetPath.startsWith('/'))
    .map((assetPath) => new URL(assetPath, self.location.origin).toString());

  await Promise.all(
    uniqueAssets.map(async (assetUrl) => {
      try {
        const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
        if (assetResponse.ok) {
          await cache.put(assetUrl, assetResponse);
        }
      } catch (_) {
        return undefined;
      }
      return undefined;
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(SHELL_CACHE_PREFIX) && cacheName !== SHELL_CACHE)
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request, { cache: 'no-store' });
          if (networkResponse.ok) {
            await updateShellFromResponse(networkResponse.clone());
          }
          return networkResponse;
        } catch (_) {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match('/index.html')) || (await cache.match(SHELL_ENTRY)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (!STATIC_ASSET_DESTINATIONS.has(request.destination) && !url.pathname.endsWith('.webmanifest')) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })(),
  );
});
