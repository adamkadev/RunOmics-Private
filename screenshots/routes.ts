import { ACCENT_IDS, DEFAULT_ACCENT, type AccentId } from '@/lib/accent'

export interface RouteSpec {
  path: string
  name: string
  hasTabs?: boolean
  waitFor?: string
  /** A detail page, opened from the first link on `path` starting with this, so it has content in any dataset. */
  firstLinkTo?: string
  asOwner?: boolean
  /** Waited for, not required, before shooting: a mark set once something slow is done. */
  settledWhen?: string
}

export const ROUTES: RouteSpec[] = [
  { path: '/', name: 'dashboard' },
  { path: '/activities', name: 'activities' },
  { path: '/activities', name: 'activity-detail', firstLinkTo: '/activities/', hasTabs: true, settledWhen: '[data-route-drawn]' },
  { path: '/plan', name: 'plan', hasTabs: true },
  { path: '/analytics', name: 'analytics', hasTabs: true },
  { path: '/map', name: 'map' },
  { path: '/goals', name: 'goals' },
  { path: '/records', name: 'records', hasTabs: true },
  { path: '/shoes', name: 'shoes' },
  { path: '/shoes', name: 'shoe-detail', firstLinkTo: '/shoes/' },
  { path: '/profile', name: 'profile' },
  { path: '/athlete', name: 'athlete' },
  { path: '/consistency', name: 'consistency' },
  { path: '/all-time', name: 'all-time' },
  { path: '/settings', name: 'settings' },
  { path: '/settings', name: 'settings-owner', asOwner: true },
  { path: '/no-such-page', name: 'not-found' },
]

export const THEMES = ['light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export const ACCENTS = ACCENT_IDS
export const DEFAULT_ACCENT_ID = DEFAULT_ACCENT
export type Accent = AccentId

function select<T extends string>(env: string | undefined, all: readonly T[], fallback: readonly T[]): T[] {
  const raw = env?.trim()
  if (!raw) return [...fallback]
  if (raw === 'all') return [...all]

  const wanted = raw.split(',').map((v) => v.trim()).filter(Boolean)
  const unknown = wanted.filter((v) => !(all as readonly string[]).includes(v))
  if (unknown.length > 0) {
    throw new Error(`Unknown value(s): ${unknown.join(', ')}. Known: ${all.join(', ')}, or "all".`)
  }
  return wanted as T[]
}

export function selectedThemes(): Theme[] {
  return select(process.env.SCREENSHOT_THEMES, THEMES, THEMES)
}

export function selectedAccents(): Accent[] {
  return select(process.env.SCREENSHOT_ACCENTS, ACCENTS, [DEFAULT_ACCENT_ID])
}
