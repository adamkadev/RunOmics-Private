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

// "nature" reuses the original icon-192.png; other palettes have a hue-rotated variant.
export function accentIconSrc(accent: AccentId): string {
  return accent === DEFAULT_ACCENT ? '/icon-192.png' : `/icon-192-${accent}.png`
}

// Persists the chosen accent and notifies listeners (sidebar logo, charts) in this tab.
export function persistAccent(accent: AccentId): void {
  localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  document.documentElement.setAttribute('data-accent', accent)
  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT))
}
