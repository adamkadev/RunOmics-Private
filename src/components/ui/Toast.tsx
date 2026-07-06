'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type ToastData = { msg: string; ok: boolean } | null

// Kept in sync with the fade-out transition duration below.
const EXIT_MS = 200

export function useToast() {
  const [toast, setToast] = useState<ToastData>(null)
  const [leaving, setLeaving] = useState(false)

  function showToast(msg: string, ok: boolean) {
    setLeaving(false)
    setToast({ msg, ok })
    const displayMs = ok ? 2000 : 3500
    setTimeout(() => setLeaving(true), displayMs)
    setTimeout(() => setToast(null), displayMs + EXIT_MS)
  }

  return { toast, leaving, showToast }
}

/**
 * Renders at the top of the screen (below the notch/status bar) so it's
 * never hidden behind the bottom tab bar, then fades out on its own.
 */
export function Toast({ toast, leaving }: { toast: ToastData; leaving?: boolean }) {
  if (!toast) return null

  return (
    <div
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
