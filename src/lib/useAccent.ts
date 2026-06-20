'use client'

import { useEffect, useState } from 'react'
import { ACCENT_CHANGE_EVENT, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'

function readAccent(): AccentId {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
  return isAccentId(stored) ? stored : DEFAULT_ACCENT
}

export function useAccent(): AccentId {
  const [accent, setAccent] = useState<AccentId>(DEFAULT_ACCENT)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccent(readAccent())

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
