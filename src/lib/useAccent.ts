'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ACCENT_CHANGE_EVENT, ACCENT_STORAGE_KEY, ACCENT_UI, DEFAULT_ACCENT, HEADLINE_CHART_COLOR, isAccentId, type AccentId } from '@/lib/accent'

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

export function useAccentUiColor(): string {
  const accent = useAccent()
  const { resolvedTheme } = useTheme()
  return ACCENT_UI[accent][resolvedTheme === 'light' ? 0 : 1]
}

export function useHeadlineChartColor(): string {
  const accent = useAccent()
  const { resolvedTheme } = useTheme()
  return HEADLINE_CHART_COLOR[accent][resolvedTheme === 'light' ? 0 : 1]
}
