/* JSON Studio service worker.
 * Network-first navigations pick up new deployments; static assets are served
 * cache-first so the installed app opens instantly and works offline.
 */
const CACHE = 'json-studio-v1'
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
]

async function precache() {
  const cache = await caches.open(CACHE)
  await cache.addAll(CORE)

  // The built index references hashed JS/CSS bundles. Cache them during
  // install so an installed app can start with no network at all.
  const index = await fetch('./index.html', { cache: 'reload' })
  if (!index.ok) return
  const html = await index.text()
  const assets = Array.from(
    html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g),
    (match) => match[1],
  )
  if (assets.length > 0) await cache.addAll(assets)
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          }
          return response
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then(
              (cached) =>
                cached ||
                new Response('JSON Studio is offline.', {
                  status: 503,
                  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                }),
            ),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
