'use client'

import { useEffect } from 'react'

/** Registers the offline/push service worker. Production only: a SW serving
 *  cached pages during development would mask live code changes. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is progressive enhancement; the app works without it */
    })
  }, [])

  return null
}
