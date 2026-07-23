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

/**
 * Share-card appearance preferences (design, accent, custom color, light
 * mode), persisted to localStorage, plus the values derived from them that
 * the renderer and the pickers consume.
 */
export function useShareCardPrefs(appTheme: ThemeMode) {
  // The design deliberately does NOT persist: every time the sheet opens it
  // resets to the first card, so a design picked on a previous activity never
  // carries over. The accent likewise defaults to the app's own theme accent
  // (blue app -> blue pre-selected) rather than a separately remembered value,
  // so the card opens matching the athlete's chosen colour. Only the custom hex
  // and light mode persist below.
  const [selectedDesign, setSelectedDesign] = useState<ShareDesign>(SHARE_DESIGNS[0] ?? 'aurora')
  const appAccent = useAccent()
  const [shareAccent, setShareAccent] = useState<ShareAccent>(appAccent)
  const [customHex, setCustomHex] = useState<string>(() =>
    readLocalStorage('ro_shareCustomHex', HUE.emerald500)
  )
  const [lightMode, setLightMode] = useState<boolean>(() =>
    readLocalStorage('ro_shareLightMode', 'false') === 'true'
  )

  useEffect(() => { try { localStorage.setItem('ro_shareCustomHex', customHex) } catch { /* noop */ } }, [customHex])
  useEffect(() => { try { localStorage.setItem('ro_shareLightMode', String(lightMode)) } catch { /* noop */ } }, [lightMode])

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
