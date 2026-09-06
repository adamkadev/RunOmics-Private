'use client'

import { useEffect, useState } from 'react'
import { SHARE_DESIGNS, hexToRgb, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { ACCENT_SWATCHES, type AccentId } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { HUE } from '@/lib/palette'

export type ShareAccent = AccentId | 'custom'

function readLocalStorage(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function useShareCardPrefs(appTheme: ThemeMode) {
  const [selectedDesign, setSelectedDesign] = useState<ShareDesign>(SHARE_DESIGNS[0] ?? 'aurora')
  const appAccent = useAccent()
  const [shareAccent, setShareAccent] = useState<ShareAccent>(appAccent)
  const [customHex, setCustomHex] = useState<string>(() =>
    readLocalStorage('ro_shareCustomHex', HUE.emerald500)
  )
  const [lightMode, setLightMode] = useState<boolean>(() =>
    readLocalStorage('ro_shareLightMode', 'false') === 'true'
  )

  useEffect(() => { try { localStorage.setItem('ro_shareCustomHex', customHex) } catch {} }, [customHex])
  useEffect(() => { try { localStorage.setItem('ro_shareLightMode', String(lightMode)) } catch {} }, [lightMode])

  const effectiveAccent: AccentId = shareAccent === 'custom' ? 'nature' : shareAccent
  const customAccentHex: string | undefined = shareAccent === 'custom' ? customHex : undefined
  const customRgb: [number, number, number] | undefined = shareAccent === 'custom' ? hexToRgb(customHex) : undefined
  const shareAccentHex = shareAccent === 'custom' ? customHex : ACCENT_SWATCHES[shareAccent]
  const shareTheme: ThemeMode = lightMode ? 'light' : appTheme

  return {
    selectedDesign, setSelectedDesign,
    shareAccent, setShareAccent,
    customHex, setCustomHex,
    lightMode, setLightMode,
    effectiveAccent, customAccentHex, customRgb, shareAccentHex, shareTheme,
  }
}
