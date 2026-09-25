'use client'

import { useEffect, useRef, useState } from 'react'
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

  function showToast(msg: string, ok: boolean) {
    // A newer toast replaces the one on screen, timers and all: the older
    // one's would otherwise fade and remove the newer one early.
    timers.current.forEach(clearTimeout)
    setLeaving(false)
    setToast({ msg, ok })
    const displayMs = ok ? 2000 : 3500
    timers.current = [
      setTimeout(() => setLeaving(true), displayMs),
      setTimeout(() => setToast(null), displayMs + EXIT_MS),
    ]
  }

  return { toast, leaving, showToast }
}

export function Toast({ toast, leaving }: { toast: ToastData; leaving?: boolean }) {
  if (!toast) return null

  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-4 z-50 animate-fade-up rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg transition-opacity duration-200 ease-out sm:inset-x-auto sm:right-4 sm:text-left',
        toast.ok ? 'bg-accent' : 'bg-destructive',
        leaving && 'opacity-0'
      )}
      style={{ top: 'max(calc(env(safe-area-inset-top, 0px) + 0.75rem), 0.75rem)' }}
    >
      {toast.msg}
    </div>
  )
}
