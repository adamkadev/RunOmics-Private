'use client'

import { useState } from 'react'
import type { ShareDesign, ThemeMode } from '@/lib/shareCard'
import { SHARE_SIZES, type ShareSize } from '@/lib/shareCardPalette'

const SIZE_KEY = 'runomics-share-size'

/** The size kept from the last share: a story or a feed post is a habit, not a choice per run. */
function storedSize(): ShareSize {
  try {
    const saved = localStorage.getItem(SIZE_KEY)
    return SHARE_SIZES.find((size) => size === saved) ?? 'portrait'
  } catch {
    return 'portrait'
  }
}

/**
 * Picks hold only while the sheet is open, the size apart: a theme kept from an earlier share left the card light in
 * a dark app.
 */
export function useShareCardPrefs(appTheme: ThemeMode, hasRoute: boolean) {
  const [design, setDesign] = useState<ShareDesign>(hasRoute ? 'route' : 'stats')
  const [chosenTheme, setChosenTheme] = useState<ThemeMode | null>(null)
  const [showReps, setShowReps] = useState(true)
  const [photoRoute, setPhotoRoute] = useState(false)
  const [size, setSizeState] = useState<ShareSize>(storedSize)
  const setSize = (next: ShareSize) => {
    setSizeState(next)
    try {
      localStorage.setItem(SIZE_KEY, next)
    } catch {
      // Private mode or storage full: the size still applies to this share.
    }
  }
  return {
    design, setDesign,
    theme: chosenTheme ?? appTheme,
    setTheme: setChosenTheme,
    showReps, setShowReps,
    photoRoute, setPhotoRoute,
    size, setSize,
  }
}
