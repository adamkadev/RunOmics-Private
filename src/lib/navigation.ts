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
