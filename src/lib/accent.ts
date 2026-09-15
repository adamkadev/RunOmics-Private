import { HUE } from '@/lib/palette'
import { ACCENT_BACKGROUNDS } from '@/lib/themeTokens'

export type AccentId = 'nature' | 'performance' | 'motivation' | 'endurance' | 'silver'

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const DEFAULT_ACCENT: AccentId = 'nature'

export const ACCENT_SWATCHES: Record<AccentId, string> = {
  nature:      HUE.emerald500,
  performance: HUE.blue500,
  motivation:  HUE.orange500,
  endurance:   HUE.violet500,
  silver:      HUE.slate400,
}

export const ACCENT_SWATCHES_LIGHT: Record<AccentId, string> = {
  nature:      HUE.emerald600,
  performance: HUE.blue600,
  motivation:  HUE.orange600,
  endurance:   HUE.violet600,
  silver:      HUE.slate600,
}

export const ACCENT_UI: Record<AccentId, [light: string, dark: string]> = {
  nature:      [HUE.roEmeraldDeep, HUE.roEmerald],
  performance: [HUE.blue500,       HUE.blue400],
  motivation:  [HUE.orange500,     HUE.orange400],
  endurance:   [HUE.violet500,     HUE.violet400],
  silver:      [HUE.slate500,      HUE.slate400],
}

export const HEADLINE_CHART_COLOR: Record<AccentId, [light: string, dark: string]> = {
  nature:      [HUE.roEmeraldDeep, HUE.roEmerald],
  endurance:   [HUE.violet500,     HUE.violet400],
  silver:      [HUE.slate500,      HUE.slate400],
  performance: [HUE.roEmeraldDeep, HUE.roEmerald],
  motivation:  [HUE.roEmeraldDeep, HUE.roEmerald],
}

export const ACCENT_IDS: AccentId[] = ['nature', 'performance', 'motivation', 'endurance', 'silver']

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as string[]).includes(value)
}

export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

export function applyThemeColor(accent: string, isDark: boolean): void {
  const pair = ACCENT_BACKGROUNDS[accent] ?? ACCENT_BACKGROUNDS[DEFAULT_ACCENT]
  if (!pair) return
  const color = isDark ? pair[1] : pair[0]
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', color)
  })
}

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
