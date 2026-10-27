import { ACCENT_IDS, CURATED_ACCENTS, LEGACY_ACCENTS, curatedAccent, type AccentId } from './accentScale'

export { ACCENT_IDS, CURATED_ACCENTS, LEGACY_ACCENTS }
export type { AccentId }

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

/** Nothing stored: the base `:root` block already paints this one, so no attribute is needed. */
export const DEFAULT_ACCENT: AccentId = 'teal'

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as readonly string[]).includes(value)
}

export function parseAccent(stored: string | null): AccentId {
  if (isAccentId(stored)) return stored
  if (stored && stored in LEGACY_ACCENTS) return LEGACY_ACCENTS[stored]!
  return DEFAULT_ACCENT
}

export function accentColor(id: AccentId, mode: 'light' | 'dark'): string {
  return curatedAccent(id)[mode].acc
}

export const ACCENT_SWATCHES: Record<AccentId, string> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, accent.dark.acc]),
) as Record<AccentId, string>

export const ACCENT_SWATCHES_LIGHT: Record<AccentId, string> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, accent.light.acc]),
) as Record<AccentId, string>

export function persistAccent(id: AccentId): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id)
    // Drops the stylesheet a retired custom hue left behind.
    localStorage.removeItem('runomics-accent-css')
  } catch {
    // The accent still applies to this page; it just won't survive a reload.
  }
  document.getElementById('accent-custom')?.remove()
  document.documentElement.setAttribute('data-accent', id)
  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT))
}
