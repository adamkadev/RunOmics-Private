'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { t } from '@/i18n'
import { SIGN_IN_PATH } from '@/lib/siteSession'
import { APP_VERSION, BUILD_COMMIT } from '@/lib/version'

/** Per deploy, not per package version: the worker's caches are named after it, so a deploy drops the last one's pages. */
export const SERVICE_WORKER_URL = `/sw.js?v=${encodeURIComponent(`${APP_VERSION}-${BUILD_COMMIT}`)}`

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    // Not on sign-in: the install caches the app's first page, which only
    // redirects a signed-out visitor.
    if (window.location.pathname === SIGN_IN_PATH) return

    let cancelled = false

    navigator.serviceWorker
      .register(SERVICE_WORKER_URL)
      .then((reg) => {
        if (cancelled) return
        if (reg.waiting) setUpdateReady(true)
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true)
          })
        })
      })
      .catch(() => {
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    setUpdateReady(false)
    const waiting = (await navigator.serviceWorker.getRegistration())?.waiting
    // The worker skips waiting on install, so by the tap it has usually taken over already: then only a reload is left.
    if (!waiting) {
      window.location.reload()
      return
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!updateReady) return null

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
