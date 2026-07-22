import { HUE } from '@/lib/palette'
import { ACCENT_BACKGROUNDS } from '@/lib/themeTokens'

export type AccentId = 'nature' | 'performance' | 'impact' | 'motivation' | 'endurance' | 'silver'

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const DEFAULT_ACCENT: AccentId = 'nature'

// Hex preview swatch for each palette. Nature shows the mid-tone emerald rather
// than either of its --accent values, which are tuned per theme.
export const ACCENT_SWATCHES: Record<AccentId, string> = {
  nature:      HUE.emerald500,
  performance: HUE.blue500,
  impact:      HUE.rose500,
  motivation:  HUE.orange500,
  endurance:   HUE.violet500,
  silver:      HUE.slate400,
}

// Darker variant of each accent for use on light backgrounds - the raw swatch above
// washes out against pale map tiles / canvases (see ShareCardModal's light-style fix).
export const ACCENT_SWATCHES_LIGHT: Record<AccentId, string> = {
  nature:      HUE.emerald600,
  performance: HUE.blue600,
  impact:      HUE.rose600,
  motivation:  HUE.orange600,
  endurance:   HUE.violet600,
  silver:      HUE.slate600,
}

// The actual `--accent` value per theme, as [light, dark] - what Recharts/SVG
// need when a mark is meant to *be* the accent rather than merely evoke it.
// ACCENT_SWATCHES above is the picker's preview chip and rounds to the generic
// Tailwind 500s; these are the values globals.css was generated from.
export const ACCENT_UI: Record<AccentId, [light: string, dark: string]> = {
  nature:      [HUE.roEmeraldDeep, HUE.roEmerald],
  performance: [HUE.blue500,       HUE.blue400],
  impact:      [HUE.rose500,       HUE.rose400],
  motivation:  [HUE.orange500,     HUE.orange400],
  endurance:   [HUE.violet500,     HUE.violet400],
  silver:      [HUE.slate500,      HUE.slate400],
}

// The colour for a chart's *headline* line (Form / TSB) when it shares a plot
// with fixed-hue series (Fitness blue, Fatigue orange, HR red). The accent may
// only stand in when it stays distinguishable from all of them; the three
// red-adjacent accents (performance≈Fitness, motivation≈Fatigue, impact≈HR)
// collide, so they fall back to the brand emerald. Mono-series charts keep the
// accent via `useAccentUiColor()` instead. See F13.
export const HEADLINE_CHART_COLOR: Record<AccentId, [light: string, dark: string]> = {
  nature:      [HUE.roEmeraldDeep, HUE.roEmerald],
  endurance:   [HUE.violet500,     HUE.violet400],
  silver:      [HUE.slate500,      HUE.slate400],
  performance: [HUE.roEmeraldDeep, HUE.roEmerald], // accent bleu = Fitness
  motivation:  [HUE.roEmeraldDeep, HUE.roEmerald], // accent orange = Fatigue
  impact:      [HUE.roEmeraldDeep, HUE.roEmerald], // accent rose = HR
}

export const ACCENT_IDS: AccentId[] =['nature', 'performance', 'impact', 'motivation', 'endurance', 'silver']

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as string[]).includes(value)
}

// Dispatched on the same tab when the accent changes, so other components (e.g. the
// sidebar logo) can react without a shared context - localStorage's own `storage`
// event only fires in other tabs.
export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

/**
 * Points the iOS status bar at the accent's own `--background`. The values come
 * from the same table globals.css was generated from, so the status bar can
 * never drift from the canvas behind it.
 */
export function applyThemeColor(accent: string, isDark: boolean): void {
  const pair = ACCENT_BACKGROUNDS[accent] ?? ACCENT_BACKGROUNDS[DEFAULT_ACCENT]
  if (!pair) return
  const color = isDark ? pair[1] : pair[0]
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', color)
  })
}

// Persists the chosen accent and notifies listeners (sidebar logo, charts) in this tab.
export function persistAccent(accent: AccentId): void {
  localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  document.documentElement.setAttribute('data-accent', accent)

  const isDark =
    typeof window !== 'undefined' &&
    (localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches))
  applyThemeColor(accent, isDark)

  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT))
}
