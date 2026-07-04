'use client'

import { useEffect, useState } from 'react'
import { SHARE_DESIGNS, hexToRgb, type ShareDesign, type ThemeMode } from '@/lib/shareCard'
import { ACCENT_SWATCHES, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'

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
  const [selectedDesign, setSelectedDesign] = useState<ShareDesign>(() => {
    const stored = readLocalStorage('ro_shareTheme', 'aurora')
    return (SHARE_DESIGNS as string[]).includes(stored) ? stored as ShareDesign : 'aurora'
  })
  const [shareAccent, setShareAccent] = useState<ShareAccent>(() => {
    const stored = readLocalStorage('ro_shareAccent', DEFAULT_ACCENT)
    if (stored === 'custom') return 'custom'
    return isAccentId(stored) ? stored : DEFAULT_ACCENT
  })
  const [customHex, setCustomHex] = useState<string>(() =>
    readLocalStorage('ro_shareCustomHex', '#10b981')
  )
  const [lightMode, setLightMode] = useState<boolean>(() =>
    readLocalStorage('ro_shareLightMode', 'false') === 'true'
  )

  useEffect(() => { try { localStorage.setItem('ro_shareTheme', selectedDesign) } catch { /* noop */ } }, [selectedDesign])
  useEffect(() => { try { localStorage.setItem('ro_shareAccent', shareAccent) } catch { /* noop */ } }, [shareAccent])
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
