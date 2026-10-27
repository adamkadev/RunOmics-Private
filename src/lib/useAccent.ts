'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  ACCENT_CHANGE_EVENT,
  ACCENT_STORAGE_KEY,
  parseAccent,
  type AccentId,
} from '@/lib/accent'

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ACCENT_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ACCENT_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// The raw string, not the parsed preference: a snapshot has to compare equal
// while nothing changed, and parsing builds a new object every time.
function storedAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * The server has no localStorage, so it and the hydrating render both see the
 * default, and the stored accent arrives right after.
 */
export function useAccent(): AccentId {
  const stored = useSyncExternalStore(subscribe, storedAccent, () => null)
  return useMemo(() => parseAccent(stored), [stored])
}
