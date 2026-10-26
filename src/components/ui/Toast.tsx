'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type ToastData = { msg: string; ok: boolean } | null

const EXIT_MS = 200

export function useToast() {
  const [toast, setToast] = useState<ToastData>(null)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const pending = timers
    return () => pending.current.forEach(clearTimeout)
  }, [])

  const showToast = useCallback((msg: string, ok: boolean) => {
    // Clear the older toast's timers, or they would fade and remove the newer one early.
    timers.current.forEach(clearTimeout)
    setLeaving(false)
    setToast({ msg, ok })
    const displayMs = ok ? 2000 : 3500
    timers.current = [
      setTimeout(() => setLeaving(true), displayMs),
      setTimeout(() => setToast(null), displayMs + EXIT_MS),
    ]
  }, [])

  return { toast, leaving, showToast }
}

const TOP = { top: 'max(calc(env(safe-area-inset-top, 0px) + 0.75rem), 0.75rem)' }

export function Toast({ toast, leaving, compact = false }: { toast: ToastData; leaving?: boolean; compact?: boolean }) {
  if (!toast) return null
  // White on red: the destructive red is tuned for it.
  const tone = toast.ok ? 'surface-raised border border-border text-foreground' : 'bg-destructive text-white'

  if (compact) {
    return (
      <div role="status" className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={TOP}>
        <span className={cn('max-w-full animate-fade-up truncate rounded-full px-3 py-1.5 text-xs font-medium shadow-lg transition-opacity duration-200 ease-out', tone, leaving && 'opacity-0')}>
          {toast.msg}
        </span>
      </div>
    )
  }

  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-4 z-50 animate-fade-up rounded-lg px-4 py-2.5 text-center text-sm font-semibold shadow-lg transition-opacity duration-200 ease-out sm:inset-x-auto sm:right-4 sm:text-left',
        tone,
        leaving && 'opacity-0'
      )}
      style={TOP}
    >
      {toast.msg}
    </div>
  )
}
