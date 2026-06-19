'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type ToastData = { msg: string; ok: boolean } | null

export function useToast() {
  const [toast, setToast] = useState<ToastData>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), ok ? 2000 : 3500)
  }

  return { toast, showToast }
}

export function Toast({ toast }: { toast: ToastData }) {
  if (!toast) return null

  return (
    <div
      className={cn(
        'fixed inset-x-4 z-50 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg sm:inset-x-auto sm:right-4 sm:text-left',
        toast.ok ? 'bg-accent' : 'bg-destructive'
      )}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
    >
      {toast.msg}
    </div>
  )
}
