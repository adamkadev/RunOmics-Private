'use client'

import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useMounted } from '@/lib/useMounted'

function stored(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/** Read after mount, since the server's HTML cannot know what this browser has put away; blocked storage just shows the row. */
export function DismissibleRow({ storageKey, dismissLabel, children }: { storageKey: string; dismissLabel: string; children: ReactNode }) {
  const mounted = useMounted()
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  if (dismissedKey === storageKey || (mounted && stored(storageKey))) return null

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {}
    setDismissedKey(storageKey)
  }

  return (
    <GlassSurface variant="card" className="flex items-center pr-1.5">
      {children}
      <button
        type="button"
        aria-label={dismissLabel}
        data-testid="dismiss-row"
        onClick={dismiss}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={16} strokeWidth={2.2} aria-hidden />
      </button>
    </GlassSurface>
  )
}
