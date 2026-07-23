/*
 * TradeFlow Service Worker — Cache Management
 *
 * Strategy:
 * - Navigation requests (HTML): network-first — always fetch fresh, fall back to cache
 * - Static assets (JS/CSS/images): stale-while-revalidate — serve cached, update in background
 * - API requests: network-first, cache successful responses, fall back to cache on network failure
 *
 * Cache versioning: uses BUILD_HASH placeholder replaced at build time.
 * Old caches are automatically cleaned up on activate.
 */

const CACHE_NAME = 'tradeflow-v5';
const STATIC_CACHE = 'tradeflow-static-v5';
const API_CACHE = 'tradeflow-api-v5';
const MAX_API_CACHE_ENTRIES = 100;
const MAX_STATIC_CACHE_ENTRIES = 200;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/favicon.ico',
  '/manifest.json',
  '/logo.jpg',
];

const API_HOSTS = [
  'data-api.crossverse.app',
  'api.hyperpax.xyz',
  'api.paxscan.io',
  'paxscan.io',
  'api.coingecko.com',
  'api.binance.com',
  'api.coincap.io',
  'api.bybit.com',
  'api.alternative.me',
];

const ALL_CACHES = [CACHE_NAME, STATIC_CACHE, API_CACHE];

function isApiRequest(url) {
  try {
    const u = new URL(url);
    return API_HOSTS.some(h => u.hostname.includes(h)) ||
           u.pathname.startsWith('/api');
  } catch { return false; }
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

function isStaticAsset(url) {
  try {
    const pathname = new URL(url).pathname;
    return /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|eot|webp|avif|map)(\?|$)/.test(pathname);
  } catch { return false; }
}

/** Trim a cache to MAX_ENTRIES by deleting oldest entries */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Delete oldest entries (first in list)
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Push Notifications ───────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'TradeFlow', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/logo.jpg',
    badge: data.badge || '/logo.jpg',
    tag: data.tag || 'tradeflow-alert',
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TradeFlow Alert', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Fetch Handler ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const { request } = event;

  // 1. Navigation requests: network-first (always get fresh HTML)
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // 2. API requests: network-first, cache successful responses
  if (isApiRequest(request.url)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(request, clone);
              trimCache(API_CACHE, MAX_API_CACHE_ENTRIES);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Static assets: stale-while-revalidate
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => {
              cache.put(request, clone);
              trimCache(STATIC_CACHE, MAX_STATIC_CACHE_ENTRIES);
            });
          }
          return response;
        }).catch(() => cached);

        // Return cached immediately, update in background
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Everything else: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
