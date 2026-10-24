const PARENT_SECTION: Record<string, string> = {
  '/records': '/profile',
  '/shoes': '/profile',
  '/athlete': '/profile',
  '/consistency': '/profile',
  '/all-time': '/profile',
  '/goals': '/profile',
  '/race': '/profile',
  '/settings': '/profile',
  '/map': '/activities',
}

function baseSegment(pathname: string): string {
  return `/${pathname.split('/')[1] ?? ''}`
}

export interface NavigationOrigin {
  path: string
  isImmediate: boolean
}

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

