import { t } from '@/i18n'

const PARENT_SECTION: Record<string, string> = {
  '/records': '/profile',
  '/shoes': '/profile',
  '/athlete': '/profile',
  '/goals': '/profile',
  '/settings': '/profile',
  '/milestones': '/profile',
  '/map': '/activities',
}

function baseSegment(pathname: string): string {
  return `/${pathname.split('/')[1] ?? ''}`
}

const SECTION_LABELS: Record<string, string> = {
  '/': t.nav.items.dashboard,
  '/activities': t.nav.items.activities,
  '/plan': t.nav.items.plan,
  '/analytics': t.nav.items.analytics,
  '/map': t.nav.items.heatmap,
  '/profile': t.nav.items.profile,
  '/settings': t.nav.items.settings,
  '/records': t.pages.records.title,
  '/shoes': t.pages.shoes.title,
  '/athlete': t.pages.athlete.title,
  '/goals': t.goals.title,
}

export function sectionLabel(pathname: string): string | null {
  return SECTION_LABELS[baseSegment(pathname)] ?? null
}

export interface NavigationOrigin {
  path: string
  /** True when `path` is the entry right below the current one in the history stack. */
  isImmediate: boolean
}

// Sibling detail pages (activity 1 -> activity 2, shoe A -> shoe B) share a shape,
// so going back from one lands on the list that opened the first of them.
function routeShape(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  return `${segments[0] ?? ''}:${segments.length}`
}

export function findOrigin(stack: readonly string[], pathname: string): NavigationOrigin | null {
  const shape = routeShape(pathname)
  const index = stack.findLastIndex((path) => routeShape(path) !== shape)
  const path = index === -1 ? null : stack[index]
  return path ? { path, isImmediate: index === stack.length - 1 } : null
}

export function activeNavHref(pathname: string, navHrefs: readonly string[]): string | null {
  const base = baseSegment(pathname)
  if (navHrefs.includes(base)) return base
  const parent = PARENT_SECTION[base]
  return parent && navHrefs.includes(parent) ? parent : null
}

const PAGE_AURORA_BASES = ['/goals', '/records', '/shoes', '/settings', '/analytics'] as const

export function getPageAuroraKey(pathname: string): (typeof PAGE_AURORA_BASES)[number] | undefined {
  return PAGE_AURORA_BASES.find((base) => pathname === base || pathname.startsWith(`${base}/`))
}
