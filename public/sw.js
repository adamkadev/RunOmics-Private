const VERSION = new URL(self.location.href).searchParams.get('v') || 'v1'
const STATIC_CACHE = `runomics-static-${VERSION}`
const PAGE_CACHE = `runomics-pages-${VERSION}`
const CURRENT_CACHES = [STATIC_CACHE, PAGE_CACHE]

// Every file here must exist: cache.addAll fails the whole install on one 404, and the old worker keeps the app.
const SHELL_URLS = ['/', '/manifest.json', '/icons/favicon.svg', '/icons/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  if (isLocalDev) {
    event.waitUntil(self.skipWaiting())
    return
  }

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
  // A worker left on localhost by a local production build retires itself so it never shadows a dev server.
  if (isLocalDev) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    )
    return
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Dev builds reuse the same /_next/static/chunks/... URLs across rebuilds, so cache-first would pin stale chunks.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']
const isLocalDev = LOCAL_HOSTS.includes(self.location.hostname)

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
    // Never a redirected one: on a private site that is /sign-in, which must not be cached as the page.
    if (response.ok && !response.redirected) {
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
  if (isLocalDev) return
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
  } catch {}
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
