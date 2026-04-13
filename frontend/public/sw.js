const CACHE_NAME = 'taskai-v1'
const MAX_RESULTS = 5
const RESULTS_STORE = 'repair-results'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/index.html'])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Cache navigate requests with network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Cache static assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    )
  }
})

// Store repair results in cache (max 5)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_RESULT') {
    const { key, data } = event.data
    caches.open(RESULTS_STORE).then((cache) => {
      cache.put(key, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      }))
    })
  }
})
