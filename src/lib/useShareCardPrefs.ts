'use client'

import { useState } from 'react'
import type { ShareDesign, ThemeMode } from '@/lib/shareCard'

/** Picks hold only while the sheet is open: a theme kept from an earlier share left the card light in a dark app. */
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
