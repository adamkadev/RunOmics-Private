export type AccentId = 'nature' | 'performance' | 'impact' | 'motivation' | 'trail'

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const DEFAULT_ACCENT: AccentId = 'nature'

// Hex preview swatch for each palette - mirrors the --accent value set in globals.css
export const ACCENT_SWATCHES: Record<AccentId, string> = {
  nature:      '#10b981', // emerald-500
  performance: '#3b82f6', // blue-500
  impact:      '#f43f5e', // rose-500
  motivation:  '#f97316', // orange-500
  trail:       '#d97706', // amber-600
}

export const ACCENT_IDS: AccentId[] = ['nature', 'performance', 'impact', 'motivation', 'trail']

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as string[]).includes(value)
}
