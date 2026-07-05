'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { t } from '@/i18n'

/** Registers the offline/push service worker. Production only: a SW serving
 *  cached pages during development would mask live code changes.
 *
 *  Also owns the update flow: when a new SW version is installed and waiting,
 *  a banner offers to activate it (SKIP_WAITING message) and reloads once the
 *  new worker has taken control - otherwise users keep the old version until
 *  they happen to close every tab. */
export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (cancelled) return
        // Update already downloaded on a previous visit.
        if (reg.waiting) setWaitingWorker(reg.waiting)
        // Update discovered while this page is open.
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // "installed" with an existing controller = a new version is
            // waiting (first-ever install has no controller: nothing to show).
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(reg.waiting)
            }
          })
        })
      })
      .catch(() => {
        /* offline support is progressive enhancement; the app works without it */
      })

    return () => {
      cancelled = true
    }
  }, [])

  function refresh() {
    if (!waitingWorker) return
    // Reload only after the new worker controls the page, so the fresh HTML
    // is served by the fresh SW.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    setWaitingWorker(null)
  }

  if (!waitingWorker) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),16px)] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-foreground/[0.12] bg-card/90 px-4 py-3 shadow-lg backdrop-blur-xl"
    >
      <p className="text-sm font-medium text-foreground">{t.pwa.updateAvailable}</p>
      <button
        type="button"
        onClick={refresh}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/85"
      >
        <RotateCcw size={14} />
        {t.pwa.refresh}
      </button>
    </div>
  )
}
