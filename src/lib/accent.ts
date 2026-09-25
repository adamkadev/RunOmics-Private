import {
  ACCENT_C,
  ACCENT_IDS,
  ACCENT_L,
  CURATED_ACCENTS,
  CUSTOM_ACCENT_ID,
  HUE_STEP,
  HUE_STOPS,
  RESERVED_HUE_BAND,
  SELECTABLE_STOPS,
  curatedAccent,
  darkRoleHex,
  isReservedHue,
  lightRoleHex,
  snapHue,
  type AccentId,
} from './accentScale'
import { customAccentCss } from './themeTokens'

export {
  ACCENT_C,
  ACCENT_IDS,
  ACCENT_L,
  CURATED_ACCENTS,
  CUSTOM_ACCENT_ID,
  HUE_STEP,
  HUE_STOPS,
  RESERVED_HUE_BAND,
  SELECTABLE_STOPS,
  isReservedHue,
  snapHue,
}
export type { AccentId }

export const ACCENT_STORAGE_KEY = 'runomics-accent'

/**
 * A custom accent's generated CSS, stored beside the preference. The
 * before-interactive script in layout.tsx injects it verbatim, which is how a
 * hue survives a reload without shipping the OKLCH maths twice.
 */
export const ACCENT_CSS_STORAGE_KEY = 'runomics-accent-css'
export const CUSTOM_ACCENT_STYLE_ID = 'accent-custom'

export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

/** Nothing stored: the base `:root` block already paints this one, so no attribute is needed. */
export const DEFAULT_ACCENT: AccentId = 'nature'

/**
 * Stored but unreadable - an id the app has since dropped, a hand-edited value,
 * a half-written string. Blue, because it is the accent the whole scale is
 * measured from and the one with the most miles on it. Never undefined.
 */
export const FALLBACK_ACCENT: AccentId = 'performance'

export type AccentPreference =
  | { readonly kind: 'curated'; readonly id: AccentId }
  | { readonly kind: 'custom'; readonly hue: number }

export interface ResolvedAccent {
  /** The value `data-accent` carries; absent from the DOM for the default accent. */
  attribute: AccentId | typeof CUSTOM_ACCENT_ID
  hue: number
  chromaScale: number
  isCustom: boolean
}

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as readonly string[]).includes(value)
}

export function serializeAccent(preference: AccentPreference): string {
  return preference.kind === 'custom' ? `${CUSTOM_ACCENT_ID}:${preference.hue}` : preference.id
}

/**
 * Anything that is not a live curated id or a `custom:<hue>` resolves rather
 * than throwing. A reserved hue injected straight into storage is snapped off
 * the band on the way out, so the band cannot be reached by hand either.
 */
export function parseAccent(stored: string | null): AccentPreference {
  if (stored === null || stored === '') return { kind: 'curated', id: DEFAULT_ACCENT }
  if (isAccentId(stored)) return { kind: 'curated', id: stored }

  const custom = /^custom:(-?\d+(?:\.\d+)?)$/.exec(stored)
  if (custom) {
    const hue = Number(custom[1])
    if (Number.isFinite(hue)) return { kind: 'custom', hue: snapHue(hue) }
  }

  return { kind: 'curated', id: FALLBACK_ACCENT }
}

export function resolveAccent(preference: AccentPreference): ResolvedAccent {
  if (preference.kind === 'custom') {
    return {
      attribute: CUSTOM_ACCENT_ID,
      hue: snapHue(preference.hue),
      chromaScale: 1,
      isCustom: true,
    }
  }
  const { id, hue, chromaScale = 1 } = curatedAccent(preference.id)
  return { attribute: id, hue, chromaScale, isCustom: false }
}

export function readAccentPreference(): AccentPreference {
  if (typeof window === 'undefined') return { kind: 'curated', id: DEFAULT_ACCENT }
  return parseAccent(localStorage.getItem(ACCENT_STORAGE_KEY))
}

/** The accent itself, at the depth the given mode uses. */
export function accentColor(preference: AccentPreference, mode: 'light' | 'dark'): string {
  const { hue, chromaScale } = resolveAccent(preference)
  return mode === 'light' ? lightRoleHex('accent', hue, chromaScale) : darkRoleHex('accent', hue, chromaScale)
}

/** What a swatch paints: the light-mode fill, whichever mode the app is in. */
export function accentSwatchColor(preference: AccentPreference): string {
  const { hue, chromaScale } = resolveAccent(preference)
  return lightRoleHex('accent', hue, chromaScale)
}

export const ACCENT_SWATCHES: Record<AccentId, string> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, lightRoleHex('accent', accent.hue, accent.chromaScale)]),
) as Record<AccentId, string>

export const ACCENT_SWATCHES_LIGHT: Record<AccentId, string> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [accent.id, lightRoleHex('accentText', accent.hue, accent.chromaScale)]),
) as Record<AccentId, string>

export const ACCENT_UI: Record<AccentId, [light: string, dark: string]> = Object.fromEntries(
  CURATED_ACCENTS.map((accent) => [
    accent.id,
    [
      lightRoleHex('accent', accent.hue, accent.chromaScale),
      darkRoleHex('accent', accent.hue, accent.chromaScale),
    ] as [string, string],
  ]),
) as Record<AccentId, [light: string, dark: string]>

/** The page background for an accent, as a hex a theme-color meta takes. */
export function accentBackground(preference: AccentPreference, mode: 'light' | 'dark'): string {
  const { hue, chromaScale } = resolveAccent(preference)
  return mode === 'light' ? lightRoleHex('background', hue, chromaScale) : darkRoleHex('background', hue, chromaScale)
}

export function applyThemeColor(preference: AccentPreference, isDark: boolean): void {
  const color = accentBackground(preference, isDark ? 'dark' : 'light')
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color)
  })
}

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('theme')
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * A custom hue has no generated block in globals.css, so it ships its own
 * stylesheet. `.dark` still picks the half that applies, which is why this is a
 * <style> tag rather than inline variables on the root element.
 */
function applyCustomStylesheet(css: string | null): void {
  const existing = document.getElementById(CUSTOM_ACCENT_STYLE_ID)
  if (css === null) {
    existing?.remove()
    return
  }
  const style = existing ?? document.createElement('style')
  style.id = CUSTOM_ACCENT_STYLE_ID
  style.textContent = css
  if (!existing) document.head.appendChild(style)
}

export function persistAccent(preference: AccentPreference | AccentId): void {
  const next: AccentPreference = typeof preference === 'string' ? { kind: 'curated', id: preference } : preference
  const resolved = resolveAccent(next)

  localStorage.setItem(ACCENT_STORAGE_KEY, serializeAccent(next))

  if (resolved.isCustom) {
    const css = customAccentCss(resolved.hue)
    localStorage.setItem(ACCENT_CSS_STORAGE_KEY, css)
    applyCustomStylesheet(css)
  } else {
    localStorage.removeItem(ACCENT_CSS_STORAGE_KEY)
    applyCustomStylesheet(null)
  }

  document.documentElement.setAttribute('data-accent', resolved.attribute)
  applyThemeColor(next, prefersDark())
  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT))
}
