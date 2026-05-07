const CACHE_NAME = 'cbt-elite-v14' // Incremented on every deploy

const ASSETS = [
  '/',
  '/index.html',
  '/src/styles/main.css',
  '/main.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js',
  '/pwa-icon.svg',
  '/brand-icon.svg'
]

// 1. Install - ENABLE SKIP WAITING (CRITICAL)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets for', CACHE_NAME)
      return cache.addAll(ASSETS)
    })
  )
  self.skipWaiting();
})

// 2. Activate - FORCE CLIENT CLAIM & CLEAR OLD CACHES
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('[SW] Clearing old cache:', cache)
              return caches.delete(cache)
            }
          })
        )
      })
    ])
  )
})

// 3. Fetch - Optimized Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Skip non-GET and Supabase API calls
  if (event.request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return

  // NETWORK-FIRST for Navigation (HTML) and Application Logic (main.js)
  // This ensures users always get the latest version if online.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('main.js') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone())
            return networkResponse
          })
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // STALE-WHILE-REVALIDATE for other assets (CSS, Images, Fonts)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone())
          return networkResponse
        }).catch(() => cachedResponse)

        return cachedResponse || fetchedResponse
      })
    })
  )
})

// 4. Background Sync - Syncing offline results when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-results') {
    console.log('[SW] Triggering background sync for exam results')
    // Logic to be triggered via IndexedDbService from main thread
  }
})

// 5. Push Notifications - Receiving the background push event
self.addEventListener('push', (event) => {
  let pushData = {}
  try {
    if (event.data) {
      pushData = event.data.json()
    }
  } catch (e) {
    pushData = { title: 'New Update!', body: event.data.text() }
  }

  const title = pushData.title || 'CBT Elite';
  const options = {
    body: pushData.body || 'You have a new message.',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    data: pushData.data || { url: '/' },
    vibrate: [100, 50, 100],
    tag: pushData.tag || 'elite-notification',
    requireInteraction: pushData.requireInteraction || false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 6. Notification Click - Handling when the user taps the push notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it.
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
