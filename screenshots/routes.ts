import { ACCENT_IDS, DEFAULT_ACCENT, type AccentId } from '@/lib/accent'

/**
 * Screenshot manifest: every screen the audit tool walks.
 *
 * `path`   - URL to visit (dynamic segments use real IDs from committed data,
 *            so the pages render fully without a live Firestore).
 * `name`   - slug used for the output folder
 *            (screenshots/output/<accent>/<theme>/<name>).
 * `hasTabs`- true when the screen has an in-page tab bar (role="tab"). Only
 *            Analytics and Calendar do today; the capture walks each tab and
 *            shoots begin/middle/end for it. Everything else is a single scroll.
 * `waitFor`- optional selector to await before shooting, when the default
 *            "first heading is visible" heuristic isn't enough.
 */
export interface RouteSpec {
  path: string
  name: string
  hasTabs?: boolean
  waitFor?: string
}

// Real IDs pulled from committed data so the detail pages prerender with
// content instead of a 404:
//   - activity: public/data/activities/2026.json
//   - shoe:     src/domain/shoe/types.ts (SHOE_REGISTRY)
const SAMPLE_ACTIVITY_ID = '23400726979'
const SAMPLE_SHOE_ID = 'e6aa89fbda0747059f5acbd4dfb5736f'

export const ROUTES: RouteSpec[] = [
  { path: '/', name: 'dashboard' },
  { path: '/activities', name: 'activities' },
  { path: `/activities/${SAMPLE_ACTIVITY_ID}`, name: 'activity-detail' },
  { path: '/calendar', name: 'calendar', hasTabs: true },
  { path: '/analytics', name: 'analytics', hasTabs: true },
  { path: '/map', name: 'map' },
  { path: '/goals', name: 'goals' },
  { path: '/milestones', name: 'milestones' },
  { path: '/records', name: 'records' },
  { path: '/shoes', name: 'shoes' },
  { path: `/shoes/${SAMPLE_SHOE_ID}`, name: 'shoe-detail' },
  { path: '/profile', name: 'profile' },
  { path: '/settings', name: 'settings' },
]

export const THEMES = ['light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

// The accent palettes come straight from the app so a new one is captured the
// moment it ships - there is no second list to keep in sync here.
export const ACCENTS = ACCENT_IDS
export const DEFAULT_ACCENT_ID = DEFAULT_ACCENT
export type Accent = AccentId

/**
 * Which themes/accents a run walks. Both default to the shipped-out-of-the-box
 * look (all themes, the default accent) because the full matrix is 6x the work;
 * override with `SCREENSHOT_THEMES` / `SCREENSHOT_ACCENTS`, each taking `all`
 * or a comma-separated list.
 */
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
