import { type AccentId } from '@/lib/accent'

export type ThemeMode = 'light' | 'dark'
export type ShareDesign = 'aurora' | 'pulse' | 'terrain' | 'prism' | 'cadence' | 'map' | 'memory'
export const SHARE_DESIGNS: ShareDesign[] = ['aurora', 'pulse', 'terrain', 'prism', 'cadence', 'map', 'memory']

export const W = 390
export const H = 844

/** Accent RGB values [r, g, b] for canvas drawing per theme mode */
export const ACCENT_RGB: Record<AccentId, { dark: [number, number, number]; light: [number, number, number] }> = {
  nature:      { dark: [16, 185, 129],  light: [14, 159, 110] },
  performance: { dark: [59, 130, 246],  light: [37, 99, 235] },
  impact:      { dark: [244, 63, 94],   light: [225, 29, 72] },
  motivation:  { dark: [249, 115, 22],  light: [234, 88, 12] },
  endurance:   { dark: [139, 92, 246],  light: [124, 58, 237] },
  silver:      { dark: [148, 163, 184], light: [100, 116, 139] },
}
