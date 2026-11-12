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
  /** Also opens the share sheet and shoots each card design. */
  hasShareCard?: boolean
}

export const ROUTES: RouteSpec[] = [
  { path: '/', name: 'dashboard' },
  { path: '/activities', name: 'activities' },
  { path: '/activities', name: 'activity-detail', firstLinkTo: '/activities/', hasTabs: true, settledWhen: '[data-route-drawn]', hasShareCard: true },
  // Straight to the view: /map's redirect drops the query and races the capture.
  { path: '/activities?view=map', name: 'map' },
  { path: '/activities?view=map&layer=districts', name: 'map-districts', settledWhen: '[data-testid="next-quartier-card"]' },
  { path: '/activities?view=map&explore=route', name: 'map-route', settledWhen: '[data-testid="route-stats"]' },
  { path: '/plan', name: 'plan', hasTabs: true },
  { path: '/plan/checkpoint', name: 'plan-checkpoint' },
  { path: '/analytics', name: 'analytics', hasTabs: true },
  { path: '/profile', name: 'progress' },
  { path: '/goals', name: 'goals' },
  { path: '/race', name: 'race' },
  { path: '/records', name: 'records', hasTabs: true },
  { path: '/home-runs', name: 'home-runs' },
  { path: '/shoes', name: 'shoes' },
  { path: '/shoes', name: 'shoe-detail', firstLinkTo: '/shoes/' },
  { path: '/athlete', name: 'athlete' },
  { path: '/athlete/vo2max', name: 'athlete-vo2max' },
  { path: '/consistency', name: 'consistency' },
  { path: '/all-time', name: 'all-time' },
  { path: '/settings', name: 'settings' },
  { path: '/settings', name: 'settings-owner', asOwner: true },
  { path: '/sign-in', name: 'sign-in' },
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
