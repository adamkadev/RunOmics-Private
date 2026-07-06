/**
 * Screenshot manifest: every screen the audit tool walks.
 *
 * `path`   - URL to visit (dynamic segments use real IDs from committed data,
 *            so the pages render fully without a live Firestore).
 * `name`   - slug used for the output folder (screenshots/output/<theme>/<name>).
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
