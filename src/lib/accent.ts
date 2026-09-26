import { ACCENT_IDS, CURATED_ACCENTS, LEGACY_ACCENTS, curatedAccent, type AccentId } from './accentScale'

export { ACCENT_IDS, CURATED_ACCENTS, LEGACY_ACCENTS }
export type { AccentId }

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

/** Nothing stored: the base `:root` block already paints this one, so no attribute is needed. */
export const DEFAULT_ACCENT: AccentId = 'lavender'

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as readonly string[]).includes(value)
}

/**
 * The stored preference as a palette. A pre-v4.3 id reads as its nearest
 * palette (LEGACY_ACCENTS); anything else - a custom hue, a hand-edited
 * value - is the default. Never undefined.
 */
export function parseAccent(stored: string | null): AccentId {
  if (isAccentId(stored)) return stored
  if (stored && stored in LEGACY_ACCENTS) return LEGACY_ACCENTS[stored]!
  return DEFAULT_ACCENT
}

export function readAccentPreference(): AccentId {
  if (typeof window === 'undefined') return DEFAULT_ACCENT
  try {
    return parseAccent(localStorage.getItem(ACCENT_STORAGE_KEY))
  } catch {
    return DEFAULT_ACCENT
  }
}

/** The accent itself, in the given mode. */
export function accentColor(id: AccentId, mode: 'light' | 'dark'): string {
  return curatedAccent(id)[mode].acc
}

/** The swatch a picker paints: the accent in the mode it will be seen in. */
export function accentSwatchColor(id: AccentId, mode: 'light' | 'dark' = 'dark'): string {
  return accentColor(id, mode)
}

/** The dark-mode fill of each accent: the share card's swatches. */
export const ACCENT_SWATCHES: Record<AccentId, string> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, accent.dark.acc]),
) as Record<AccentId, string>

/** The light-mode fill of each accent. */
export const ACCENT_SWATCHES_LIGHT: Record<AccentId, string> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, accent.light.acc]),
) as Record<AccentId, string>

export const ACCENT_UI: Record<AccentId, [light: string, dark: string]> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, [accent.light.acc, accent.dark.acc] as [string, string]]),
) as Record<AccentId, [light: string, dark: string]>

export function persistAccent(id: AccentId): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id)
    // A custom hue's stylesheet from before v4.3 has nothing left to paint.
    localStorage.removeItem('runomics-accent-css')
  } catch {
    // The accent still applies to this page; it just won't survive a reload.
  }
  document.getElementById('accent-custom')?.remove()
  document.documentElement.setAttribute('data-accent', id)
  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT))
}
