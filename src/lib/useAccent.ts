'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  ACCENT_CHANGE_EVENT,
  accentColor,
  readAccentPreference,
  type AccentPreference,
} from '@/lib/accent'

export function useAccent(): AccentPreference {
  const [accent, setAccent] = useState<AccentPreference>(readAccentPreference)

  useEffect(() => {
    function onChange() {
      setAccent(readAccentPreference())
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

export function useAccentUiColor(): string {
  const accent = useAccent()
  const { resolvedTheme } = useTheme()
  return accentColor(accent, resolvedTheme === 'light' ? 'light' : 'dark')
}
