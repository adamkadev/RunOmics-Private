'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { t } from '@/i18n'
import { SIGN_IN_PATH } from '@/lib/siteSession'

export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    // Not on sign-in: the install caches the app's first page, which only
    // redirects a signed-out visitor.
    if (window.location.pathname === SIGN_IN_PATH) return

    let cancelled = false

    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev')}`)
      .then((reg) => {
        if (cancelled) return
        if (reg.waiting) setWaitingWorker(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(reg.waiting)
            }
          })
        })
      })
      .catch(() => {
      })

    return () => {
      cancelled = true
    }
  }, [])

  function refresh() {
    if (!waitingWorker) return
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
