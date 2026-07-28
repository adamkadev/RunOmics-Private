/* RunOmics service worker: offline app shell + push notifications.
 *
 * Caching strategy:
 * - Hashed build assets (/_next/static) and icons: cache-first (immutable).
 * - Pages, RSC payloads and /data JSON: network-first with cache fallback,
 *   so the app opens with the last-seen content when offline.
 * - /api and cross-origin requests (map tiles, analytics) are never cached.
 *
 * Push events display FCM webpush payloads ({ notification: { title, body } })
 * so a separate firebase-messaging-sw.js is not needed.
 *
 * Bump VERSION to invalidate all caches on deploy of a breaking change.
 */

const VERSION = 'v1'
const STATIC_CACHE = `runomics-static-${VERSION}`
const PAGE_CACHE = `runomics-pages-${VERSION}`
const CURRENT_CACHES = [STATIC_CACHE, PAGE_CACHE]

const SHELL_URLS = ['/', '/manifest.json', '/icons/logo.svg', '/icons/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, { isNavigation }) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await caches.match(request)
    if (cached) return cached
    if (isNavigation) {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request, { isNavigation: request.mode === 'navigate' }))
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* non-JSON push: show the generic notification below */
  }
  const notification = payload.notification ?? {}
  const url = payload.fcmOptions?.link ?? '/'
  event.waitUntil(
    self.registration.showNotification(notification.title ?? 'RunOmics', {
      body: notification.body ?? '',
      icon: '/icons/apple-touch-icon.png',
      badge: '/icons/apple-touch-icon.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c)
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
