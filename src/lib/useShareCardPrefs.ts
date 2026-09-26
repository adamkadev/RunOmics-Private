'use client'

import { useEffect, useState } from 'react'
import type { ShareDesign, ThemeMode } from '@/lib/shareCard'

export const SHARE_THEME_KEY = 'ro_shareTheme'

function storedTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(SHARE_THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch { return null }
}

/**
 * The sheet's two choices. The design opens on Route, or on Stats when the
 * run has no route; the background opens on the app's theme until the reader
 * picks one, and is remembered after that. The accent is the app's (v4.9).
 */
export function useShareCardPrefs(appTheme: ThemeMode, hasRoute: boolean) {
  const [design, setDesign] = useState<ShareDesign>(hasRoute ? 'route' : 'stats')
  const [chosenTheme, setChosenTheme] = useState<ThemeMode | null>(storedTheme)

  useEffect(() => {
    if (!chosenTheme) return
    try { localStorage.setItem(SHARE_THEME_KEY, chosenTheme) } catch {}
  }, [chosenTheme])

  return {
    design, setDesign,
    theme: chosenTheme ?? appTheme,
    setTheme: setChosenTheme,
  }
}
