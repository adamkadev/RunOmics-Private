export type AccentId = 'nature' | 'performance' | 'impact' | 'motivation' | 'endurance'

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const DEFAULT_ACCENT: AccentId = 'nature'

// Hex preview swatch for each palette - mirrors the --accent value set in globals.css
export const ACCENT_SWATCHES: Record<AccentId, string> = {
  nature:      '#10b981', // emerald-500
  performance: '#3b82f6', // blue-500
  impact:      '#f43f5e', // rose-500
  motivation:  '#f97316', // orange-500
  endurance:   '#8b5cf6', // violet-500
}

export const ACCENT_IDS: AccentId[] = ['nature', 'performance', 'impact', 'motivation', 'endurance']

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as string[]).includes(value)
}

// Dispatched on the same tab when the accent changes, so other components (e.g. the
// sidebar logo) can react without a shared context - localStorage's own `storage`
// event only fires in other tabs.
export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

// "nature" reuses the original icon-{size}.png; other palettes have a hue-rotated variant.
export function accentIconSrc(accent: AccentId, size: 192 | 512): string {
  return accent === DEFAULT_ACCENT ? `/icon-${size}.png` : `/icon-${size}-${accent}.png`
}
