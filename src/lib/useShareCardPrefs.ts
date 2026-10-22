'use client'

import { useState } from 'react'
import type { ShareDesign, ThemeMode } from '@/lib/shareCard'

/**
 * The sheet's choices. The design opens on Route, or on Stats when the run
 * has no route. The background opens on the app's theme every time, and a
 * pick holds only while the sheet is open (the owner's report, Oct 2026: a
 * pick kept from an earlier share left the card light in a dark app). An
 * interval session's rep pace opens on, and holds the same way. The accent
 * is the app's (v4.9).
 */
export function useShareCardPrefs(appTheme: ThemeMode, hasRoute: boolean) {
  const [design, setDesign] = useState<ShareDesign>(hasRoute ? 'route' : 'stats')
  const [chosenTheme, setChosenTheme] = useState<ThemeMode | null>(null)
  const [showReps, setShowReps] = useState(true)
  return {
    design, setDesign,
    theme: chosenTheme ?? appTheme,
    setTheme: setChosenTheme,
    showReps, setShowReps,
  }
}
