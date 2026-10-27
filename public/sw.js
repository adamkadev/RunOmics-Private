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
      // The page request starts while the worker boots, instead of after it.
      .then(() => self.registration.navigationPreload?.enable())
      .then(() => self.clients.claim())
  )
})

// Dev builds reuse the same /_next/static/chunks/... URLs across rebuilds, so cache-first would pin stale chunks.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']
const isLocalDev = LOCAL_HOSTS.includes(self.location.hostname)

// MapLibre's worker sits under its version (scripts/copy-maplibre-worker.mjs), so a new one comes at a new path.
const VERSIONED_MAPLIBRE = /^\/maplibre\/[^/]+\//

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || VERSIONED_MAPLIBRE.test(url.pathname)
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

/** A page this slow on a bad connection opens from its cached copy; the network's answer still updates the cache. */
const NAVIGATION_TIMEOUT_MS = 3000

async function fromNetwork(event) {
  const { request } = event
  const preloaded = request.mode === 'navigate' ? await event.preloadResponse : undefined
  const response = preloaded || (await fetch(request))
  // Never a redirected one: on a private site that is /sign-in, which must not be cached as the page.
  if (response.ok && !response.redirected) {
    const copy = response.clone()
    // Written while the page streams: awaited, the page would arrive only once its whole body reached the disk.
    event.waitUntil(caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined))
  }
  return response
}

function cachedAfter(request, ms) {
  return new Promise((resolve) => setTimeout(() => caches.match(request).then(resolve, () => resolve(undefined)), ms))
}

async function networkFirst(event, { isNavigation }) {
  const { request } = event
  const network = fromNetwork(event)
  try {
    if (!isNavigation) return await network
    event.waitUntil(network.catch(() => undefined))
    return (await Promise.race([network, cachedAfter(request, NAVIGATION_TIMEOUT_MS)])) || (await network)
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
  // A prefetch is a partial payload, no offline copy of a page: it goes straight to the network, uncached.
  if (request.headers.has('Next-Router-Prefetch')) return

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(event, { isNavigation: request.mode === 'navigate' }))
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
      tag: notification.tag,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  // A GitHub run link would take the app's own window off the app.
  if (new URL(url, self.location.origin).origin !== self.location.origin) {
    event.waitUntil(self.clients.openWindow(url))
    return
  }
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
