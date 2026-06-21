'use client'

import { useEffect, useState } from 'react'
import { ACCENT_CHANGE_EVENT, ACCENT_STORAGE_KEY, ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'

function readAccent(): AccentId {
  if (typeof window === 'undefined') return DEFAULT_ACCENT
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
  return isAccentId(stored) ? stored : DEFAULT_ACCENT
}

export function useAccent(): AccentId {
  const [accent, setAccent] = useState<AccentId>(readAccent)

  useEffect(() => {
    function onChange() {
      setAccent(readAccent())
    }

    window.addEventListener(ACCENT_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(ACCENT_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  return accent
}

// Resolved hex for the active accent - for Recharts/SVG props that can't take a CSS var.
export function useAccentColor(): string {
  return ACCENT_SWATCHES[useAccent()]
}
