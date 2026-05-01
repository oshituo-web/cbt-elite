const CACHE_NAME = 'cbt-elite-v12' // Incremented on every deploy
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
