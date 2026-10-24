'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/reportClientError'

/** Harmless, and fired by Safari on many layouts: a ResizeObserver that settled in a later frame. */
const IGNORED = /ResizeObserver loop|^Script error\.?$/

export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!IGNORED.test(event.message)) reportClientError('error', event.error ?? event.message)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if ((event.reason as { name?: unknown } | null)?.name !== 'AbortError') reportClientError('rejection', event.reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
