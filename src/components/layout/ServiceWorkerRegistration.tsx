'use client'

import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { t } from '@/i18n'
import { SIGN_IN_PATH } from '@/lib/siteSession'
import { APP_VERSION, BUILD_COMMIT } from '@/lib/version'

/** Per deploy, not per package version: the worker's caches are named after it, so a deploy drops the last one's pages. */
export const SERVICE_WORKER_URL = `/sw.js?v=${encodeURIComponent(`${APP_VERSION}-${BUILD_COMMIT}`)}`

/** A worker of the build this page runs is no update: the deploy that served it has already taken over. */
export function isOtherBuild(worker: ServiceWorker | null): boolean {
  return worker !== null && worker.scriptURL !== new URL(SERVICE_WORKER_URL, window.location.href).href
}

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
        if (isOtherBuild(reg.waiting)) setUpdateReady(true)
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller && isOtherBuild(installing)) setUpdateReady(true)
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
      data-testid="update-banner"
      className="fixed inset-x-4 bottom-[calc(var(--tab-bar-float)+var(--tab-bar-h)+12px)] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-foreground/[0.12] bg-card/90 px-4 py-3 shadow-lg backdrop-blur-xl lg:bottom-4"
    >
      <p className="text-sm font-medium text-foreground">{t.pwa.updateAvailable}</p>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/85"
        >
          <RotateCcw size={14} />
          {t.pwa.refresh}
        </button>
        <button
          type="button"
          onClick={() => setUpdateReady(false)}
          aria-label={t.pwa.dismiss}
          className="hit-44 flex size-8 items-center justify-center rounded-full text-muted-foreground"
        >
          <X size={16} aria-hidden />
        </button>
      </span>
    </div>
  )
}
