export type AccentId = 'nature' | 'performance' | 'impact' | 'motivation' | 'endurance' | 'silver'

export const ACCENT_STORAGE_KEY = 'runomics-accent'

export const DEFAULT_ACCENT: AccentId = 'nature'

// Hex preview swatch for each palette - mirrors the --accent value set in globals.css
export const ACCENT_SWATCHES: Record<AccentId, string> = {
  nature:      '#10b981', // emerald-500
  performance: '#3b82f6', // blue-500
  impact:      '#f43f5e', // rose-500
  motivation:  '#f97316', // orange-500
  endurance:   '#8b5cf6', // violet-500
  silver:      '#94a3b8', // slate-400
}

// Darker variant of each accent for use on light backgrounds - the raw swatch above
// washes out against pale map tiles / canvases (see ShareCardModal's light-style fix).
export const ACCENT_SWATCHES_LIGHT: Record<AccentId, string> = {
  nature:      '#059669',
  performance: '#2563eb',
  impact:      '#e11d48',
  motivation:  '#ea580c',
  endurance:   '#7c3aed',
  silver:      '#475569',
}

export const ACCENT_IDS: AccentId[] = ['nature', 'performance', 'impact', 'motivation', 'endurance', 'silver']

export function isAccentId(value: string | null): value is AccentId {
  return value !== null && (ACCENT_IDS as string[]).includes(value)
}

// Dispatched on the same tab when the accent changes, so other components (e.g. the
// sidebar logo) can react without a shared context - localStorage's own `storage`
// event only fires in other tabs.
export const ACCENT_CHANGE_EVENT = 'runomics:accent-change'

// Persists the chosen accent and notifies listeners (sidebar logo, charts) in this tab.
export function persistAccent(accent: AccentId): void {
  localStorage.setItem(ACCENT_STORAGE_KEY, accent)
  document.documentElement.setAttribute('data-accent', accent)

  // Update theme-color meta tag for iOS status bar
  const bgColors: Record<AccentId, [string, string]> = {
    nature: ['#eef3f0', '#070f0c'],
    performance: ['#eff6ff', '#06091a'],
    impact: ['#fff1f2', '#130608'],
    motivation: ['#fff7ed', '#130a04'],
    endurance: ['#f5f3ff', '#0d0a1a'],
    silver: ['#f8fafc', '#080c10'],
  }
  const isDark =
    typeof window !== 'undefined' &&
    (localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const colors = bgColors[accent]
  const color = isDark ? colors[1] : colors[0]
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', color)
  })

  window.dispatchEvent(new Event(ACCENT_CHANGE_EVENT))
}
